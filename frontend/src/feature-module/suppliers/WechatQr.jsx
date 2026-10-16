import { useState } from 'react';
import axios from 'axios';
import { App, Button, Image, Popconfirm, Space, Upload } from 'antd';
import { CameraOutlined } from '@ant-design/icons';
import { API_BASE_URL } from '../../config/config';
import { apiError } from '../../utils/apiError';
import QrScanner from '../../components/QrScanner';
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
  const [scanning, setScanning] = useState(false);

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

  // D49: the drop zone of the Stitch "Nouveau contact" form; the picture is read here, never uploaded.
  // D52: "Scanner le QR WeChat" reads it live with the camera (phone).
  return (
    <div className="qr-drop">
      <Button icon={<CameraOutlined />} size="large" block className="mb-2" onClick={() => setScanning(true)}>
        {value ? 'Scanner un autre QR WeChat' : 'Scanner le QR WeChat'}
      </Button>
      {value && (
        <div className="qr-drop-thumb">
          <QrThumb value={value} size={104} />
          <button type="button" className="qr-drop-remove" aria-label="Retirer le QR code" onClick={() => onChange?.(null)}>×</button>
        </div>
      )}
      <Upload.Dragger accept={ACCEPTED} showUploadList={false} disabled={busy} className="qr-drop-zone"
        beforeUpload={(file) => { read(file); return false; }}>
        <div className="text-start">
          <div className="fw-semibold text-body">
            {busy ? 'Lecture du QR code…' : <>Glissez-déposez la capture WeChat <span className="fw-normal text-secondary">ou</span> <span className="text-primary">parcourir les fichiers</span></>}
          </div>
          <div className="small text-secondary">Photo ou capture d'écran du QR code (PNG, JPG, WebP, {MAX_MB} Mo au plus), lue dans le navigateur.</div>
        </div>
      </Upload.Dragger>
      {value && (
        <div className="qr-drop-read">
          <span className="share-dot rounded-circle" style={{ background: 'var(--sc-accent)' }} />
          QR code lu{isQrLink(value) && <> : <a href={value} target="_blank" rel="noreferrer" className="text-break">{value}</a></>}
          <Button size="small" type="link" danger onClick={() => onChange?.(null)}>Retirer</Button>
        </div>
      )}
      {scanning && (
        <QrScanner saveLabel="Utiliser ce QR code" onClose={() => setScanning(false)}
          onSave={async (content) => { onChange?.(content); setScanning(false); }} />
      )}
    </div>
  );
}

// The WeChat QR code of a contact with its buttons, in the contact's edit form. "Lire un QR"
// reads the QR code from a picture (photo, screenshot) in the browser and saves its content;
// the server checks it and explains a refusal.
export default function WechatQr({ supplierId, contact, onChanged, size = 56 }) {
  const { message } = App.useApp();
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
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
        <Button size="small" icon={<CameraOutlined />} disabled={busy} onClick={() => setScanning(true)}>
          {value ? 'Scanner un autre QR' : 'Scanner le QR'}
        </Button>
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
      {scanning && (
        <QrScanner onClose={() => setScanning(false)}
          onSave={async (content) => {
            try {
              await axios.put(url, { content });
            } catch (err) {
              throw new Error(apiError(err, "Erreur lors de l'enregistrement du QR code"));
            }
            setScanning(false);
            message.success('QR code WeChat enregistré');
            await onChanged();
          }} />
      )}
    </Space>
  );
}
