import { useRef, useState } from 'react';
import { App, Button, Upload } from 'antd';
import { CameraOutlined, DeleteOutlined, PictureOutlined } from '@ant-design/icons';
import ContactAvatar from '../../components/ContactAvatar';
import { ACCEPTED_IMAGES, toDataImage } from '../../utils/image';

// A touch screen (phone, tablet): the only devices where "Prendre une photo" opens a camera.
const onTouchScreen = () => !!window.matchMedia?.('(pointer: coarse)').matches;

// D63: the contact's photo in the contact form. Value: a Base64 data URL (resized to 256 px before
// it is sent) or null. "Choisir une photo" picks a file; on a phone, "Prendre une photo" opens the
// camera directly (an input with `capture`, like the business-card scan, D37).
export default function AvatarField({ value, onChange, name }) {
  const { message } = App.useApp();
  const [reading, setReading] = useState(false);
  const camera = useRef(null);

  const pick = async (file) => {
    setReading(true);
    try {
      onChange?.(await toDataImage(file, 256, 0.85));
    } catch (err) {
      message.error(err.message);
    } finally {
      setReading(false);
    }
    return false;
  };

  return (
    <div className="d-flex align-items-center gap-3">
      <ContactAvatar contact={{ avatar: value, name }} size={64} />
      <div className="d-flex flex-wrap gap-2">
        {onTouchScreen() && (
          <>
            <Button icon={<CameraOutlined />} loading={reading} onClick={() => camera.current?.click()}>Prendre une photo</Button>
            <input ref={camera} type="file" accept="image/*" capture="environment" hidden
              onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) pick(file); }} />
          </>
        )}
        <Upload accept={ACCEPTED_IMAGES} showUploadList={false} beforeUpload={pick} maxCount={1}>
          <Button icon={<PictureOutlined />} loading={reading}>{value ? 'Changer la photo' : 'Choisir une photo'}</Button>
        </Upload>
        {value && <Button icon={<DeleteOutlined />} danger onClick={() => onChange?.(null)}>Retirer</Button>}
      </div>
    </div>
  );
}
