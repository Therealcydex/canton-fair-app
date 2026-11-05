import { useRef, useState } from 'react';
import axios from 'axios';
import { App, Button, Progress, Upload } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { API_BASE_URL } from '../../config/config';
import { apiError } from '../../utils/apiError';

const UPLOAD_TIMEOUT_MS = 15 * 60 * 1000; // 15 min for a large PDF on a slow link

function isPdf(file) {
  return !file.type || file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

function catalogError(err) {
  if (err?.code === 'ECONNABORTED') return 'Envoi trop long : le catalogue n\'a pas pu être envoyé à temps';
  if (err?.response?.status === 413) return 'Catalogue trop volumineux pour le serveur (200 Mo au maximum)';
  if (!err?.response) return 'Envoi interrompu (réseau ou serveur). Réessayez, ou déployez la version fichiers si le site est encore à l\'ancienne.';
  return apiError(err, 'Erreur lors de l\'ajout du catalogue');
}

// D77: upload one PDF as multipart (never Base64 — large files crash the browser).
export async function uploadCatalog(supplierId, file, onProgress) {
  if (!isPdf(file)) throw new Error(`« ${file.name} » n'est pas un PDF`);
  const body = new FormData();
  body.append('catalog', file, file.name);
  const { data } = await axios.post(`${API_BASE_URL}/suppliers/${supplierId}/catalogs`, body, {
    timeout: UPLOAD_TIMEOUT_MS,
    onUploadProgress: (e) => {
      if (!onProgress || !e.total) return;
      onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)));
    },
  });
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
  const [percent, setPercent] = useState(null);
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
    setPercent(0);
    try {
      const saved = await uploadCatalog(supplierId, file, setPercent);
      const next = {
        ...latest.current,
        existing: [...latest.current.existing, { id: saved.id, file_name: saved.file_name, file_url: saved.file_url }],
      };
      latest.current = next;
      onChange?.(next);
      message.success('Catalogue ajouté');
    } catch (err) {
      message.error(catalogError(err));
    } finally {
      setBusy((n) => n - 1);
      setPercent(null);
    }
  };

  const remove = (f) => {
    if (f.uid.startsWith('e')) onChange?.({ ...v, removed: [...v.removed, Number(f.uid.slice(1))] });
    else onChange?.({ ...v, add: v.add.filter((_, i) => `n${i}` !== f.uid) });
  };

  return (
    <>
      <Upload accept="application/pdf,.pdf" multiple fileList={fileList}
        onRemove={(f) => { remove(f); return false; }}
        beforeUpload={(file) => {
          add(file);
          return false;
        }}>
        <Button htmlType="button" icon={<PlusOutlined />} loading={busy > 0}>Catalogue PDF</Button>
      </Upload>
      {percent != null && <Progress percent={percent} size="small" className="mt-2" style={{ maxWidth: 280 }} />}
    </>
  );
}
