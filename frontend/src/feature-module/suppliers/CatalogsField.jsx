import { useRef, useState } from 'react';
import axios from 'axios';
import { App, Button, Progress, Upload } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { API_BASE_URL } from '../../config/config';
import { apiError } from '../../utils/apiError';

const CHUNK_BYTES = 1 * 1024 * 1024; // 1 Mo — under common 10–32 Mo proxy cuts
const UPLOAD_TIMEOUT_MS = 2 * 60 * 1000;
const CHUNK_RETRIES = 3;

function isPdf(file) {
  return !file.type || file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

function catalogError(err) {
  if (err?.code === 'ECONNABORTED') return 'Envoi trop long : le catalogue n\'a pas pu être envoyé à temps';
  if (err?.response?.status === 413) return 'Catalogue trop volumineux pour le serveur (200 Mo au maximum)';
  if (!err?.response) return 'Envoi interrompu (réseau ou serveur). Réessayez.';
  return apiError(err, 'Erreur lors de l\'ajout du catalogue');
}

function newUploadId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}

// D78: large PDFs are split into small pieces (compressing a PDF barely helps). Progress is
// based on finished pieces so a cut connection does not leave the button spinning forever.
export async function uploadCatalog(supplierId, file, onProgress) {
  if (!isPdf(file)) throw new Error(`« ${file.name} » n'est pas un PDF`);
  const total = Math.max(1, Math.ceil(file.size / CHUNK_BYTES));
  const uploadId = newUploadId();
  let saved = null;
  for (let index = 0; index < total; index++) {
    const blob = file.slice(index * CHUNK_BYTES, Math.min(file.size, (index + 1) * CHUNK_BYTES));
    let lastErr = null;
    for (let attempt = 1; attempt <= CHUNK_RETRIES; attempt++) {
      try {
        const body = new FormData();
        // Fields before the file so multer can read them for the temp path.
        body.append('uploadId', uploadId);
        body.append('index', String(index));
        body.append('total', String(total));
        body.append('fileName', file.name);
        body.append('chunk', blob, `part-${index}`);
        const { data } = await axios.post(
          `${API_BASE_URL}/suppliers/${supplierId}/catalogs/chunk`,
          body,
          { timeout: UPLOAD_TIMEOUT_MS },
        );
        onProgress?.(Math.min(100, Math.round(((index + 1) / total) * 100)));
        if (data.data && data.data.pending === false) saved = data.data;
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        if (attempt === CHUNK_RETRIES) throw err;
      }
    }
    if (lastErr) throw lastErr;
  }
  if (!saved?.file_url) throw new Error('Catalogue incomplet côté serveur');
  return saved;
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
        <Button htmlType="button" icon={<PlusOutlined />} loading={busy > 0}>
          {busy > 0 && percent != null ? `Envoi… ${percent} %` : 'Catalogue PDF'}
        </Button>
      </Upload>
      {percent != null && <Progress percent={percent} size="small" className="mt-2" style={{ maxWidth: 280 }} />}
    </>
  );
}
