import { useState } from 'react';
import axios from 'axios';
import { App, Button, Image, Popconfirm, Space, Upload } from 'antd';
import { API_BASE_URL, fileUrl } from '../../config/config';
import { apiError } from '../../utils/apiError';

const ACCEPTED = 'image/jpeg,image/png,image/webp';
const MAX_MB = 8;

// D33: wechat_qr is the link of a photo of the contact's WeChat QR code. An older value typed by
// hand (a WeChat id) is not a link: it is shown as text.
export const isQrPhoto = (value) => typeof value === 'string' && value.startsWith('/uploads/');

// The WeChat QR code of a contact: the photo (click to enlarge and scan it), and buttons to add,
// replace or remove it. The server checks the photo (type, size) and explains a refusal.
export default function WechatQr({ supplierId, contact, onChanged }) {
  const { message } = App.useApp();
  const [busy, setBusy] = useState(false);
  const url = `${API_BASE_URL}/suppliers/${supplierId}/contacts/${contact.id}/wechat-qr`;
  const value = contact.wechat_qr;

  const send = async (request, success, fallback) => {
    setBusy(true);
    try {
      await request();
      message.success(success);
      onChanged();
    } catch (err) {
      message.error(apiError(err, fallback));
    } finally {
      setBusy(false);
    }
  };

  const upload = (file) => {
    if (file.size > MAX_MB * 1024 * 1024) {
      message.error(`« ${file.name} » dépasse ${MAX_MB} Mo`);
      return false;
    }
    const form = new FormData();
    form.append('images', file);
    send(() => axios.post(url, form), 'QR code WeChat enregistré', "Erreur lors de l'envoi du QR code");
    return false; // sent by hand above, not by antd
  };

  return (
    <Space align="center" wrap>
      {isQrPhoto(value)
        ? <Image src={fileUrl(value)} width={56} height={56} style={{ objectFit: 'contain', background: '#fff' }} alt="QR code WeChat" />
        : value && <span>{value}</span>}
      <Upload accept={ACCEPTED} showUploadList={false} beforeUpload={upload} disabled={busy}>
        <Button size="small" loading={busy}>{isQrPhoto(value) ? 'Remplacer' : 'Ajouter le QR'}</Button>
      </Upload>
      {value && (
        <Popconfirm title="Retirer le QR code WeChat ?" okText="Retirer" cancelText="Annuler"
          onConfirm={() => send(() => axios.delete(url), 'QR code retiré', 'Erreur lors du retrait du QR code')}>
          <Button size="small" type="link" danger disabled={busy}>Retirer</Button>
        </Popconfirm>
      )}
    </Space>
  );
}
