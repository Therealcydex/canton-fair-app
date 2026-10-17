import { useState } from 'react';
import { App, Button, Upload } from 'antd';
import { CameraOutlined, DeleteOutlined } from '@ant-design/icons';
import ContactAvatar from '../../components/ContactAvatar';
import { ACCEPTED_IMAGES, toDataImage } from '../../utils/image';

// D63: the contact's photo in the contact form. Value: a Base64 data URL (resized to 256 px before
// it is sent) or null. On a phone, "Choisir une photo" also offers the camera.
export default function AvatarField({ value, onChange, name }) {
  const { message } = App.useApp();
  const [reading, setReading] = useState(false);

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
        <Upload accept={ACCEPTED_IMAGES} showUploadList={false} beforeUpload={pick} maxCount={1}>
          <Button icon={<CameraOutlined />} loading={reading}>{value ? 'Changer la photo' : 'Choisir une photo'}</Button>
        </Upload>
        {value && <Button icon={<DeleteOutlined />} danger onClick={() => onChange?.(null)}>Retirer</Button>}
      </div>
    </div>
  );
}
