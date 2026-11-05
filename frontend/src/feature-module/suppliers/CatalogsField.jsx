import { useRef, useState } from 'react';
import axios from 'axios';
import { App, Button, Upload } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { API_BASE_URL } from '../../config/config';
import { apiError } from '../../utils/apiError';

function isPdf(file) {
  return !file.type || file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

// D77: upload one PDF as multipart (never Base64 — large files crash the browser).
export async function uploadCatalog(supplierId, file) {
  if (!isPdf(file)) throw new Error(`« ${file.name} » n'est pas un PDF`);
  const body = new FormData();
  body.append('catalog', file, file.name);
  const { data } = await axios.post(`${API_BASE_URL}/suppliers/${supplierId}/catalogs`, body);
  return data.data;
}

// Uploads the files chosen while creating a supplier. A refused one does not undo the supplier.
export async function saveDraftCatalogs(supplierId, files = []) {
  let failed = null;
  for (const file of files) {
    try {
      await uploadCatalog(supplierId, file);
    } catch (err) {
      failed = err;
    }
  }
  return failed;
}

// D75/D77: catalogues of the supplier form. Value: { existing: [{ id, file_name, file_url }],
// removed: [ids], add: [File] }. With supplierId, a new PDF is uploaded at once.
export default function CatalogsField({ value, onChange, supplierId }) {
  const { message } = App.useApp();
  const [busy, setBusy] = useState(0);
  const v = { existing: [], removed: [], add: [], ...value };
  const kept = v.existing.filter((file) => !v.removed.includes(file.id));
  const latest = useRef(v);
  latest.current = v;

  const fileList = [
    ...kept.map((file) => ({ uid: `e${file.id}`, name: file.file_name, status: 'done' })),
    ...v.add.map((file, i) => ({ uid: `n${i}`, name: file.name, status: 'done' })),
  ];

  const add = async (file) => {
    if (!isPdf(file)) {
      message.error(`« ${file.name} » n'est pas un PDF`);
      return;
    }
    if (!supplierId) {
      const next = { ...latest.current, add: [...latest.current.add, file] };
      latest.current = next;
      onChange?.(next);
      return;
    }
    setBusy((n) => n + 1);
    try {
      const saved = await uploadCatalog(supplierId, file);
      const next = {
        ...latest.current,
        existing: [...latest.current.existing, { id: saved.id, file_name: saved.file_name, file_url: saved.file_url }],
      };
      latest.current = next;
      onChange?.(next);
    } catch (err) {
      message.error(err.response ? apiError(err, 'Erreur lors de l\'ajout') : err.message);
    } finally {
      setBusy((n) => n - 1);
    }
  };

  const remove = (f) => {
    if (f.uid.startsWith('e')) onChange?.({ ...v, removed: [...v.removed, Number(f.uid.slice(1))] });
    else onChange?.({ ...v, add: v.add.filter((_, i) => `n${i}` !== f.uid) });
  };

  return (
    <Upload accept="application/pdf,.pdf" multiple fileList={fileList}
      onRemove={(f) => { remove(f); return false; }}
      beforeUpload={(file) => {
        add(file);
        return false;
      }}>
      <Button htmlType="button" icon={<PlusOutlined />} loading={busy > 0}>Catalogue PDF</Button>
    </Upload>
  );
}
