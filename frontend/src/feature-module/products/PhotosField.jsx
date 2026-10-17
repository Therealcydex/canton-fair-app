import { useRef, useState } from 'react';
import { App, Upload } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { ACCEPTED_IMAGES, toProductPhoto } from '../../utils/image';

export const MAX_PHOTOS = 10;

// D61: the photos of the product form. Value: { existing: [{ id, thumb_data }], removed: [ids],
// add: [{ data, thumb }] }; the photos are resized and sent with the product (productPayload).
export default function PhotosField({ value, onChange }) {
  const { message } = App.useApp();
  const [reading, setReading] = useState(0);
  const v = { existing: [], removed: [], add: [], ...value };
  const kept = v.existing.filter((img) => !v.removed.includes(img.id));
  const count = kept.length + v.add.length;

  const fileList = [
    ...kept.map((img) => ({ uid: `e${img.id}`, name: 'photo', status: 'done', url: img.thumb_data, thumbUrl: img.thumb_data })),
    ...v.add.map((img, i) => ({ uid: `n${i}`, name: 'nouvelle photo', status: 'done', url: img.thumb, thumbUrl: img.thumb })),
  ];

  // Several files are read at once: each one adds to the latest value, not to the one of its render.
  const latest = useRef(v);
  latest.current = v;
  const add = async (file) => {
    setReading((n) => n + 1);
    try {
      const photo = await toProductPhoto(file);
      const next = { ...latest.current, add: [...latest.current.add, photo] };
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
    <Upload listType="picture-card" accept={ACCEPTED_IMAGES} multiple fileList={fileList}
      showUploadList={{ showPreviewIcon: false }} onRemove={(f) => { remove(f); return false; }}
      beforeUpload={(file, files) => {
        // Only as many as the product can still take.
        if (files.indexOf(file) >= MAX_PHOTOS - count) {
          if (files.indexOf(file) === MAX_PHOTOS - count) message.warning(`Un produit a au plus ${MAX_PHOTOS} photos`);
          return false;
        }
        add(file);
        return false;
      }}>
      {count + reading < MAX_PHOTOS && (
        <div><PlusOutlined /><div className="small mt-1">{reading ? 'Lecture…' : 'Photo'}</div></div>
      )}
    </Upload>
  );
}

// The photos of a product from the API, as the field's starting value.
export const photosValue = (product) => ({ existing: product?.images || [], removed: [], add: [] });
