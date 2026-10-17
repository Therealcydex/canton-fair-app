import { Button, Modal } from 'antd';
import { Link } from 'react-router-dom';
import { BankOutlined, EditOutlined, MailOutlined, PhoneOutlined } from '@ant-design/icons';
import ContactAvatar from '../../components/ContactAvatar';
import { QrThumb } from '../suppliers/WechatQr';

// The row props that open a contact's card on a click. Not on its links, buttons or QR code
// (which opens its own preview), and not from a popup above the row (a QR preview, a delete
// confirmation): React passes their clicks up to the row although they are not inside it.
export const openCardOnClick = (open) => (c) => ({
  onClick: (e) => {
    if (!e.currentTarget.contains(e.target)) return;
    if (e.target.closest('a, button, .ant-image')) return;
    open(c);
  },
});

// D63: a contact's details in a popup, opened by clicking the contact: its photo, supplier,
// phone, e-mail and WeChat QR code. `onEdit` (optional) adds the "Modifier" button.
export default function ContactCard({ contact, supplierName, onClose, onEdit }) {
  const c = contact;
  const supplier = c?.supplier_name || supplierName;
  return (
    <Modal open={!!c} onCancel={onClose} title="Fiche contact" width={420} centered
      footer={(
        <div className="d-flex justify-content-end gap-2">
          <Button onClick={onClose}>Fermer</Button>
          {onEdit && <Button type="primary" icon={<EditOutlined />} onClick={() => onEdit(c)}>Modifier</Button>}
        </div>
      )}>
      {c && (
        <div className="contact-card">
          <div className="text-center mb-3">
            <ContactAvatar contact={c} size={112} />
            <h2 className="h5 mt-2 mb-0">{c.name || 'Contact sans nom'}</h2>
            {supplier && (
              <div className="small text-secondary mt-1">
                <BankOutlined />{' '}
                {c.supplier_id ? <Link to={`/fournisseurs/${c.supplier_id}`} onClick={onClose}>{supplier}</Link> : supplier}
              </div>
            )}
          </div>
          <dl className="contact-card-facts">
            <dt><PhoneOutlined /> Téléphone</dt>
            <dd>{c.phone ? <a href={`tel:${c.phone}`}>{c.phone}</a> : '—'}</dd>
            <dt><MailOutlined /> E-mail</dt>
            <dd>{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : '—'}</dd>
          </dl>
          {c.wechat_qr && (
            <div className="text-center">
              <div className="sc-label mb-1">QR code WeChat</div>
              <QrThumb value={c.wechat_qr} size={160} />
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
