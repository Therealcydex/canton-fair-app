import { useState } from 'react';
import axios from 'axios';
import { App, Button, Form, Popconfirm, Table } from 'antd';
import { UserAddOutlined } from '@ant-design/icons';
import { API_BASE_URL } from '../../config/config';
import { apiError } from '../../utils/apiError';
import FormModal from '../../components/FormModal';
import ContactAvatar from '../../components/ContactAvatar';
import ContactFormFields, { contactPayload } from '../contacts/ContactFormFields';
import WechatQr, { QrPicker, QrThumb } from './WechatQr';

// A contact kept in the form until the new supplier is saved.
const draftOf = (values, key) => ({
  key,
  name: values.name || null,
  phone: values.phone || null,
  email: values.email || null,
  avatar: values.avatar || null,
  wechat_qr: values.wechat_qr || null,
});

// Writes the contacts gathered while creating a supplier. A refused one does not undo the supplier.
export async function saveDraftContacts(supplierId, contacts) {
  let failed = null;
  for (const c of contacts) {
    try {
      const res = await axios.post(`${API_BASE_URL}/suppliers/${supplierId}/contacts`, contactPayload(c));
      if (c.wechat_qr) {
        await axios.put(`${API_BASE_URL}/suppliers/${supplierId}/contacts/${res.data.data.id}/wechat-qr`, { content: c.wechat_qr });
      }
    } catch (err) {
      failed = err;
    }
  }
  return failed;
}

// Contacts of the supplier form: a table, and "Ajouter contact" opens the same "Nouveau contact" form.
// Without `supplierId` (a supplier being created) the rows stay in `contacts` until the supplier is saved.
export default function SupplierContacts({ supplierId, contacts = [], onContacts }) {
  const { message } = App.useApp();
  const [editing, setEditing] = useState(null); // null closed, {} new, a row = edit

  const refresh = async () => {
    if (!supplierId) return;
    onContacts?.();
    const { data } = await axios.get(`${API_BASE_URL}/suppliers/${supplierId}`);
    setEditing((current) => (current?.id ? data.data.contacts.find((c) => c.id === current.id) || current : current));
  };

  const save = async (values) => {
    if (supplierId && editing?.id) {
      await axios.put(`${API_BASE_URL}/suppliers/${supplierId}/contacts/${editing.id}`, contactPayload(values));
      await refresh();
      return;
    }
    if (supplierId) {
      const res = await axios.post(`${API_BASE_URL}/suppliers/${supplierId}/contacts`, contactPayload(values));
      if (values.wechat_qr) {
        try {
          await axios.put(`${API_BASE_URL}/suppliers/${supplierId}/contacts/${res.data.data.id}/wechat-qr`, { content: values.wechat_qr });
        } catch (err) {
          message.warning(`Contact enregistré, mais pas son QR code : ${apiError(err, 'erreur')}`);
        }
      }
      await refresh();
      return;
    }
    const key = editing?.key || `new-${Date.now()}`;
    const next = draftOf(values, key);
    onContacts?.(editing?.key ? contacts.map((c) => (c.key === key ? next : c)) : [...contacts, next]);
  };

  const remove = async (c) => {
    if (supplierId && c.id) {
      try {
        await axios.delete(`${API_BASE_URL}/suppliers/${supplierId}/contacts/${c.id}`);
        message.success('Contact supprimé');
        onContacts?.();
      } catch (err) {
        message.error(apiError(err, 'Erreur lors de la suppression'));
      }
      return;
    }
    onContacts?.(contacts.filter((row) => row.key !== c.key));
  };

  const columns = [
    {
      title: 'Nom', dataIndex: 'name',
      render: (v, c) => (
        <span className="d-inline-flex align-items-center gap-2 text-nowrap">
          <ContactAvatar contact={c} size={32} />
          {v ? <span className="fw-semibold">{v}</span> : '—'}
        </span>
      ),
    },
    { title: 'Téléphone mobile', dataIndex: 'phone', render: (v) => v || '—' },
    { title: 'E-mail professionnel', dataIndex: 'email', responsive: ['sm'], render: (v) => v || '—' },
    { title: 'QR code WeChat', dataIndex: 'wechat_qr', width: 110, align: 'center', render: (v) => <QrThumb value={v} size={48} /> },
    {
      title: '', key: 'actions', align: 'right',
      render: (_, c) => (
        <span className="text-nowrap">
          <Button type="link" size="small" className="fw-semibold" onClick={() => setEditing(c)}>Modifier</Button>
          <Popconfirm title="Supprimer ce contact ?" okText="Supprimer" okButtonProps={{ danger: true }} cancelText="Annuler" onConfirm={() => remove(c)}>
            <Button type="link" size="small" danger className="fw-semibold">Supprimer</Button>
          </Popconfirm>
        </span>
      ),
    },
  ];

  return (
    <>
      <div className="d-flex justify-content-between align-items-center gap-2 mt-2 mb-2">
        <h3 className="h6 m-0">Contacts</h3>
        <Button type="primary" icon={<UserAddOutlined />} onClick={() => setEditing({})}>Ajouter contact</Button>
      </div>
      <Table rowKey={(c) => c.id || c.key} size="small" columns={columns} dataSource={contacts} pagination={false}
        scroll={{ x: true }} locale={{ emptyText: 'Aucun contact' }} />

      <FormModal open={!!editing} zIndex={1200} width={680} className="sc-modal-dark" icon={<UserAddOutlined />}
        title={editing?.id || editing?.key ? 'Modifier le contact' : 'Nouveau contact'} initialValues={editing || {}}
        onCancel={() => setEditing(null)}
        onSubmit={save}
        onSaved={() => { setEditing(null); message.success('Contact enregistré'); }}>
        <ContactFormFields scan={!editing?.id} />
        {editing?.id ? (
          <Form.Item label="QR code WeChat" className="mt-3 mb-0"
            extra="Enregistré tout de suite, sans attendre le bouton « Enregistrer ».">
            <WechatQr supplierId={supplierId} contact={editing} onChanged={refresh} size={120} />
          </Form.Item>
        ) : (
          <Form.Item name="wechat_qr" label={<>QR code WeChat <span className="fw-normal text-secondary ms-1">(enregistré avec le contact)</span></>}
            className="mb-0">
            <QrPicker />
          </Form.Item>
        )}
      </FormModal>
    </>
  );
}
