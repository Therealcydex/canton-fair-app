import { useRef, useState } from 'react';
import { App, Button, Upload } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

const MAX_BYTES = 32 * 1024 * 1024;

export function readCatalogFile(file) {
  return new Promise((resolve, reject) => {
    if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      reject(new Error(`« ${file.name} » n'est pas un PDF`));
      return;
    }
    if (file.size > MAX_BYTES) {
      reject(new Error('Un catalogue fait 32 Mo au maximum'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, data: reader.result });
    reader.onerror = () => reject(new Error(`« ${file.name} » n'a pas pu être lu`));
    reader.readAsDataURL(file);
  });
}

// D75: the catalogues of the supplier form. Value: { existing: [{ id, file_name }], removed, add }.
export default function CatalogsField({ value, onChange }) {
  const { message } = App.useApp();
  const [reading, setReading] = useState(0);
  const v = { existing: [], removed: [], add: [], ...value };
  const kept = v.existing.filter((file) => !v.removed.includes(file.id));
  const latest = useRef(v);
  latest.current = v;

  const fileList = [
    ...kept.map((file) => ({ uid: `e${file.id}`, name: file.file_name, status: 'done' })),
    ...v.add.map((file, i) => ({ uid: `n${i}`, name: file.name, status: 'done' })),
  ];

  const add = async (file) => {
    setReading((n) => n + 1);
    try {
      const pdf = await readCatalogFile(file);
      const next = { ...latest.current, add: [...latest.current.add, pdf] };
      latest.current = next;
      onChange?.(next);
    } catch (err) {
      message.error(err.message);
    } finally {
      setReading((n) => n - 1);
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
      <Button htmlType="button" icon={<PlusOutlined />} loading={reading > 0}>Catalogue PDF</Button>
    </Upload>
  );
}
