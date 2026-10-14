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

// The QR code alone (click to enlarge and scan it), for a table cell.
export function QrThumb({ value, size = 56 }) {
  if (isQrPhoto(value)) {
    return <Image src={fileUrl(value)} width={size} height={size} style={{ objectFit: 'contain', background: '#fff' }} alt="QR code WeChat" />;
  }
  return value ? <span>{value}</span> : <span className="text-muted">—</span>;
}

// The WeChat QR code of a contact with its buttons: add, replace, remove. Used in the contact's
// edit form. The server checks the photo (type, size) and explains a refusal.
export default function WechatQr({ supplierId, contact, onChanged, size = 56 }) {
  const { message } = App.useApp();
  const [busy, setBusy] = useState(false);
  const url = `${API_BASE_URL}/suppliers/${supplierId}/contacts/${contact.id}/wechat-qr`;
  const value = contact.wechat_qr;

  const send = async (request, success, fallback) => {
    setBusy(true);
    try {
      await request();
      message.success(success);
      await onChanged();
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
      {value && <QrThumb value={value} size={size} />}
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
