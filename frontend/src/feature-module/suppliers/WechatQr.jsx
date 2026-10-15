import { useState } from 'react';
import axios from 'axios';
import { App, Button, Image, Popconfirm, Space, Upload } from 'antd';
import { API_BASE_URL } from '../../config/config';
import { apiError } from '../../utils/apiError';
import { decodeQrFromFile, isQrLink, isQrPhoto, useQrImage } from '../../utils/qr';

const ACCEPTED = 'image/*';
const MAX_MB = 15;

export { isQrPhoto };

// The QR code alone (click to enlarge and scan it), for a table cell: the photo, a QR code drawn
// from the scanned link, or the older typed text (D34).
export function QrThumb({ value, size = 56 }) {
  const image = useQrImage(value);
  if (image) {
    return <Image src={image} width={size} height={size} style={{ objectFit: 'contain', background: '#fff' }} alt="QR code WeChat" />;
  }
  if (value && !isQrLink(value)) return <span>{value}</span>;
  return <span className="text-muted">—</span>;
}

// The WeChat QR code read from a picture BEFORE the contact exists (new contact form): a form
// field (value/onChange) holding the QR content, saved by the form right after the contact.
export function QrPicker({ value, onChange }) {
  const { message } = App.useApp();
  const [busy, setBusy] = useState(false);

  const read = async (file) => {
    if (file.size > MAX_MB * 1024 * 1024) {
      message.error(`« ${file.name} » dépasse ${MAX_MB} Mo`);
      return;
    }
    setBusy(true);
    const content = await decodeQrFromFile(file);
    setBusy(false);
    if (!content) message.error(`Aucun QR code lisible dans « ${file.name} »`);
    else onChange?.(content);
  };

  return (
    <Space direction="vertical" size={4}>
      <Space align="center" wrap>
        {value && <QrThumb value={value} size={120} />}
        <Upload accept={ACCEPTED} showUploadList={false} disabled={busy}
          beforeUpload={(file) => { read(file); return false; }}>
          <Button size="small" loading={busy}>{value ? 'Lire un autre QR (image)' : 'Lire un QR (image)'}</Button>
        </Upload>
        {value && <Button size="small" type="link" danger onClick={() => onChange?.(null)}>Retirer</Button>}
      </Space>
      {isQrLink(value) && <a href={value} target="_blank" rel="noreferrer" className="small text-break">{value}</a>}
    </Space>
  );
}

// The WeChat QR code of a contact with its buttons, in the contact's edit form. "Lire un QR"
// reads the QR code from a picture (photo, screenshot) in the browser and saves its content;
// the server checks it and explains a refusal.
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

  const read = async (file) => {
    if (file.size > MAX_MB * 1024 * 1024) {
      message.error(`« ${file.name} » dépasse ${MAX_MB} Mo`);
      return;
    }
    setBusy(true);
    const content = await decodeQrFromFile(file);
    setBusy(false);
    if (!content) {
      message.error(`Aucun QR code lisible dans « ${file.name} »`);
      return;
    }
    send(() => axios.put(url, { content }), 'QR code WeChat enregistré', "Erreur lors de l'enregistrement du QR code");
  };

  return (
    <Space direction="vertical" size={4}>
      <Space align="center" wrap>
        {value && <QrThumb value={value} size={size} />}
        <Upload accept={ACCEPTED} showUploadList={false} disabled={busy}
          beforeUpload={(file) => { read(file); return false; }}>
          <Button size="small" loading={busy}>{value ? 'Lire un autre QR (image)' : 'Lire un QR (image)'}</Button>
        </Upload>
        {value && (
          <Popconfirm title="Retirer le QR code WeChat ?" okText="Retirer" cancelText="Annuler"
            onConfirm={() => send(() => axios.delete(url), 'QR code retiré', 'Erreur lors du retrait du QR code')}>
            <Button size="small" type="link" danger disabled={busy}>Retirer</Button>
          </Popconfirm>
        )}
      </Space>
      {isQrLink(value) && <a href={value} target="_blank" rel="noreferrer" className="small text-break">{value}</a>}
    </Space>
  );
}
