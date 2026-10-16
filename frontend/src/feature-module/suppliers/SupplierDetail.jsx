import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, App, Button, Card, Descriptions, Popconfirm, Rate, Space, Spin, Table, Tabs, Tag } from 'antd';
import { API_BASE_URL } from '../../config/config';
import { apiError } from '../../utils/apiError';
import FormModal from '../../components/FormModal';
import SupplierFormFields from './SupplierFormFields';
import { QrThumb } from './WechatQr';
import BoothList from '../booths/BoothList';
import ProductList, { NewProductModal } from '../products/ProductList';

// antd's Rate gives 0 when cleared and a cleared Select gives undefined; the API expects null.
export const supplierPayload = (values) => ({ ...values, rating: values.rating || null, province_id: values.province_id ?? null });

export default function SupplierDetail() {
  const { id } = useParams();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [creatingProduct, setCreatingProduct] = useState(false);

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

  if (loadError) return <Alert type="error" message={loadError} showIcon action={<Link to="/fournisseurs">Retour</Link>} />;
  if (!supplier) return <div className="text-center py-5"><Spin /></div>;

  // v_suppliers gives the % visited (rounded); a supplier has far fewer than 100 booths, so the
  // number of visited booths comes back exactly.
  const booths = Number(supplier.nbr_booths);
  const visited = booths ? Math.round((Number(supplier.booth_visit_pct) * booths) / 100) : 0;
  const contacts = supplier.contacts;

  // D40: design from Claude Design ("Fournisseurs", detail, version A).
  const tabs = [
    {
      key: 'contacts',
      label: `Contacts (${contacts.length})`,
      children: (
        <>
          <Table rowKey="id" size="middle" pagination={false} dataSource={contacts} scroll={{ x: true }}
            locale={{ emptyText: 'Aucun contact' }}
            columns={[
              { title: 'QR WeChat', dataIndex: 'wechat_qr', width: 110, render: (v) => <QrThumb value={v} size={72} /> },
              { title: 'Nom', dataIndex: 'name', render: (v) => <span className="fw-medium">{v || '—'}</span> },
              { title: 'Téléphone', dataIndex: 'phone', render: (v) => v || '—' },
              { title: 'E-mail', dataIndex: 'email', responsive: ['md'], render: (v) => v || '—' },
            ]} />
          {/* Contacts are added and edited on the Contacts page, filtered on this supplier. */}
          <div className="mt-2 small"><Link to={`/contacts?supplier_id=${supplier.id}`}>Ajouter ou modifier les contacts →</Link></div>
        </>
      ),
    },
    {
      key: 'booths',
      label: <Space size={6}>Booths<Tag className="m-0">{visited}/{booths}</Tag></Space>,
      children: <BoothList supplierId={supplier.id} hideSupplier onChanged={load} />,
    },
    {
      key: 'products',
      label: `Produits (${supplier.products_count})`,
      children: <ProductList supplierId={supplier.id} />,
    },
  ];

  return (
    <>
      <div className="mb-2 small"><Link to="/fournisseurs">← Fournisseurs</Link></div>
      <Space className="mb-3 w-100 justify-content-between" wrap>
        <Space align="center" wrap>
          <h1 className="h4 m-0">{supplier.name}</h1>
          {supplier.province && <Tag className="m-0">{supplier.province}</Tag>}
        </Space>
        <Space wrap>
          <Button onClick={() => setEditing(true)}>Modifier</Button>
          <Popconfirm title="Supprimer ce fournisseur ?"
            description="Ses contacts, ses produits et leurs photos seront supprimés ; ses booths restent, sans fournisseur."
            okText="Supprimer" cancelText="Annuler" onConfirm={remove}>
            <Button danger>Supprimer</Button>
          </Popconfirm>
          <Button type="primary" onClick={() => setCreatingProduct(true)}>Nouveau produit</Button>
        </Space>
      </Space>

      <Card size="small" className="mb-3">
        <Descriptions size="small" column={{ xs: 1, md: 2, xl: 3 }}
          items={[
            { key: 'province', label: 'Province', children: supplier.province || '—' },
            { key: 'phone', label: 'Téléphone', children: supplier.phone || '—' },
            {
              key: 'website', label: 'Site web',
              children: supplier.website
                ? <a href={/^https?:\/\//i.test(supplier.website) ? supplier.website : `https://${supplier.website}`} target="_blank" rel="noreferrer">{supplier.website}</a>
                : '—',
            },
            { key: 'email', label: 'E-mail', children: supplier.email || '—' },
            {
              key: 'cantonfair', label: 'Page du salon',
              children: supplier.cantonfair_url
                ? <a href={supplier.cantonfair_url} target="_blank" rel="noreferrer">Ouvrir sur cantonfair.org.cn ↗</a>
                : '—',
            },
            { key: 'rating', label: 'Note', children: supplier.rating ? <Rate disabled value={supplier.rating} style={{ fontSize: 14 }} /> : 'Non noté' },
            { key: 'booths', label: 'Booths visités', children: booths ? `${visited} / ${booths}` : 'Aucun booth' },
            { key: 'address', label: 'Adresse', span: 'filled', children: supplier.address || '—' },
            { key: 'notes', label: 'Notes', span: 'filled', children: <span style={{ whiteSpace: 'pre-wrap' }}>{supplier.notes || '—'}</span> },
          ]} />
      </Card>

      <Card size="small">
        <Tabs defaultActiveKey="contacts" items={tabs} />
      </Card>

      <NewProductModal open={creatingProduct} supplierId={supplier.id} onClose={() => setCreatingProduct(false)} />

      <FormModal open={editing} title="Modifier le fournisseur" width={640} initialValues={supplier}
        onCancel={() => setEditing(false)}
        onSubmit={(values) => axios.put(`${API_BASE_URL}/suppliers/${id}`, supplierPayload(values))}
        onSaved={() => { setEditing(false); message.success('Fournisseur modifié'); load(); }}>
        <SupplierFormFields />
      </FormModal>

    </>
  );
}
