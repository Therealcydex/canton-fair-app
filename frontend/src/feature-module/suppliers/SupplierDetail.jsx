import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, App, Button, Descriptions, Form, Input, Popconfirm, Rate, Space, Spin, Table, Tabs } from 'antd';
import { API_BASE_URL } from '../../config/config';
import { apiError } from '../../utils/apiError';
import FormModal from '../../components/FormModal';
import SupplierFormFields from './SupplierFormFields';
import BoothList from '../booths/BoothList';
import ProductList from '../products/ProductList';

// antd's Rate gives 0 when cleared; the API expects no rating (null) or 1 to 5.
export const supplierPayload = (values) => ({ ...values, rating: values.rating || null });

export default function SupplierDetail() {
  const { id } = useParams();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [contact, setContact] = useState(null); // null = closed, {} = new, row = edit

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const { data } = await axios.get(`${API_BASE_URL}/suppliers/${id}`);
      setSupplier(data.data);
    } catch (err) {
      setLoadError(apiError(err, 'Erreur lors du chargement du fournisseur'));
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const remove = async () => {
    try {
      await axios.delete(`${API_BASE_URL}/suppliers/${id}`);
      message.success('Fournisseur supprimé');
      navigate('/fournisseurs');
    } catch (err) {
      message.error(apiError(err, 'Erreur lors de la suppression'));
    }
  };

  const removeContact = async (c) => {
    try {
      await axios.delete(`${API_BASE_URL}/suppliers/${id}/contacts/${c.id}`);
      message.success('Contact supprimé');
      load();
    } catch (err) {
      message.error(apiError(err, 'Erreur lors de la suppression'));
    }
  };

  if (loadError) return <Alert type="error" message={loadError} showIcon action={<Link to="/fournisseurs">Retour</Link>} />;
  if (!supplier) return <div className="text-center py-5"><Spin /></div>;

  const contactColumns = [
    { title: 'Nom', dataIndex: 'name' },
    { title: 'Téléphone', dataIndex: 'phone' },
    { title: 'E-mail', dataIndex: 'email', responsive: ['md'] },
    { title: 'WeChat', dataIndex: 'wechat_qr', responsive: ['md'] },
    {
      title: '', key: 'actions', width: 190,
      render: (_, c) => (
        <Space>
          <Button size="small" onClick={() => setContact(c)}>Modifier</Button>
          <Popconfirm title="Supprimer ce contact ?" okText="Supprimer" cancelText="Annuler" onConfirm={() => removeContact(c)}>
            <Button size="small" danger>Supprimer</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const tabs = [
    {
      key: 'contacts',
      label: `Contacts (${supplier.contacts.length})`,
      children: (
        <>
          <Button className="mb-2" onClick={() => setContact({})}>Ajouter un contact</Button>
          <Table rowKey="id" columns={contactColumns} dataSource={supplier.contacts} size="small"
            pagination={false} scroll={{ x: true }} />
        </>
      ),
    },
    {
      key: 'booths',
      label: 'Stands',
      children: <BoothList supplierId={supplier.id} hideSupplier />,
    },
    {
      key: 'products',
      label: 'Produits',
      children: <ProductList supplierId={supplier.id} />,
    },
  ];

  return (
    <>
      <Link to="/fournisseurs">← Fournisseurs</Link>
      <Space className="my-2 w-100 justify-content-between" wrap>
        <h1 className="h4 m-0">{supplier.name}</h1>
        <Space>
          <Button onClick={() => setEditing(true)}>Modifier</Button>
          <Popconfirm title="Supprimer ce fournisseur ?"
            description="Ses contacts seront supprimés. Refusé s'il a encore des stands ou des produits."
            okText="Supprimer" cancelText="Annuler" onConfirm={remove}>
            <Button danger>Supprimer</Button>
          </Popconfirm>
        </Space>
      </Space>

      <Descriptions bordered size="small" column={{ xs: 1, sm: 1, md: 2 }} className="mb-3">
        <Descriptions.Item label="Province">{supplier.province || '—'}</Descriptions.Item>
        <Descriptions.Item label="Note">{supplier.rating ? <Rate disabled value={supplier.rating} /> : '—'}</Descriptions.Item>
        <Descriptions.Item label="Téléphone">{supplier.phone || '—'}</Descriptions.Item>
        <Descriptions.Item label="E-mail">{supplier.email || '—'}</Descriptions.Item>
        <Descriptions.Item label="Site web">
          {supplier.website
            ? <a href={/^https?:\/\//i.test(supplier.website) ? supplier.website : `https://${supplier.website}`} target="_blank" rel="noreferrer">{supplier.website}</a>
            : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Adresse">{supplier.address || '—'}</Descriptions.Item>
        <Descriptions.Item label="Notes" span="filled"><span style={{ whiteSpace: 'pre-wrap' }}>{supplier.notes || '—'}</span></Descriptions.Item>
      </Descriptions>

      <Tabs items={tabs} />

      <FormModal open={editing} title="Modifier le fournisseur" width={640} initialValues={supplier}
        onCancel={() => setEditing(false)}
        onSubmit={(values) => axios.put(`${API_BASE_URL}/suppliers/${id}`, supplierPayload(values))}
        onSaved={() => { setEditing(false); message.success('Fournisseur modifié'); load(); }}>
        <SupplierFormFields />
      </FormModal>

      <FormModal open={!!contact} title={contact?.id ? 'Modifier le contact' : 'Nouveau contact'} initialValues={contact}
        onCancel={() => setContact(null)}
        onSubmit={(values) => (contact.id
          ? axios.put(`${API_BASE_URL}/suppliers/${id}/contacts/${contact.id}`, values)
          : axios.post(`${API_BASE_URL}/suppliers/${id}/contacts`, values))}
        onSaved={() => { setContact(null); message.success('Contact enregistré'); load(); }}>
        <Form.Item name="name" label="Nom" rules={[{ required: true, whitespace: true, message: 'Le nom est obligatoire' }]}>
          <Input maxLength={100} />
        </Form.Item>
        <Form.Item name="phone" label="Téléphone"><Input maxLength={50} /></Form.Item>
        <Form.Item name="email" label="E-mail" rules={[{ type: 'email', message: 'Adresse e-mail invalide' }]}>
          <Input maxLength={150} />
        </Form.Item>
        <Form.Item name="wechat_qr" label="WeChat (identifiant ou lien du QR code)"><Input maxLength={255} /></Form.Item>
      </FormModal>
    </>
  );
}
