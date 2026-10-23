import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, App, Button, Card, Descriptions, Popconfirm, Rate, Space, Spin, Table, Tabs, Tag } from 'antd';
import { API_BASE_URL } from '../../config/config';
import { apiError } from '../../utils/apiError';
import FormModal from '../../components/FormModal';
import SupplierFormFields from './SupplierFormFields';
import { QrThumb } from './WechatQr';
import ContactCard, { openCardOnClick } from '../contacts/ContactCard';
import ContactAvatar from '../../components/ContactAvatar';
import BoothList from '../booths/BoothList';
import ProductList, { NewProductModal } from '../products/ProductList';
import ProductThumb from '../../components/ProductThumb';
import { useAuth } from '../../context/AuthContext';
import { isAdmin, isViewer } from '../../utils/access';
import { boothLabel, formatPrice } from '../../utils/format';
import { companyLabel } from '../../utils/lists';

// antd's Rate gives 0 when cleared and a cleared Select gives undefined; the API expects null.
// The contact fields of a new supplier's form (contact_…) are sent apart, to the contact route.
// D66: share_company_ids only goes when the field was shown (the admin's form): a buyer's save
// leaves the shares as they are (the server refuses them from a buyer, 403).
export const supplierPayload = ({ share_company_ids: shares, shared_company_ids: _ids, ...values }) => ({
  ...Object.fromEntries(Object.entries(values).filter(([key]) => !key.startsWith('contact_'))),
  ...(Array.isArray(shares) ? { share_company_ids: shares } : {}),
  rating: values.rating || null,
  province_id: values.province_id ?? null,
});

// The edit form's starting values; the shares only for the admin, whose form shows them.
export const supplierInitialValues = (s, admin) => s && {
  ...s, ...(admin ? { share_company_ids: s.shared_company_ids || [] } : {}),
};

// D66: a viewer's products, sent with its supplier (no decision, no product page).
const viewerProductColumns = [
  { title: 'Photo', dataIndex: 'cover_thumb', width: 64, render: (src) => <ProductThumb src={src} /> },
  {
    title: 'Nom', dataIndex: 'name',
    render: (v, p) => (
      <>
        <span className="fw-medium">{v}</span>
        {p.supplier_ref && <div className="text-muted small">Réf. {p.supplier_ref}</div>}
        {p.description && <div className="small text-secondary text-truncate" style={{ maxWidth: 360 }}>{p.description}</div>}
      </>
    ),
  },
  {
    title: 'Booth', dataIndex: 'booth_code', responsive: ['md'],
    render: (v, p) => (v ? <Link to={`/booths/${p.booth_id}`}>{boothLabel(p.booth_phase, v)}</Link> : '—'),
  },
  {
    title: 'Prix', dataIndex: 'price', align: 'right',
    render: (v, p) => <span className="text-nowrap">{formatPrice(v, p.currency)}{p.unit ? <span className="text-muted"> / {p.unit}</span> : null}</span>,
  },
  { title: 'MOQ', dataIndex: 'moq', align: 'right', render: (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('fr-FR')) },
  { title: 'Expédition', dataIndex: 'shipping_type', responsive: ['md'], render: (v, p) => (v ? <Tag color="geekblue" className="m-0" title={p.shipping_name}>{v}</Tag> : '—') },
];

// D66: a viewer (LECTEUR) reads a supplier shared with its companies: its details, contacts,
// booths and products, without any change.
export default function SupplierDetail() {
  const { id } = useParams();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { user } = useAuth();
  const viewer = isViewer(user);
  const admin = isAdmin(user);
  const [params, setParams] = useSearchParams();
  const [supplier, setSupplier] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [viewing, setViewing] = useState(null); // D63: the contact shown in its card
  const [companies, setCompanies] = useState([]);
  useEffect(() => {
    if (admin) axios.get(`${API_BASE_URL}/companies`).then((r) => setCompanies(r.data.data)).catch(() => {});
  }, [admin]);

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
            locale={{ emptyText: 'Aucun contact' }} className="sc-table-clickable"
            onRow={openCardOnClick(setViewing)} // D63
            columns={[
              { title: 'QR WeChat', dataIndex: 'wechat_qr', width: 110, render: (v) => <QrThumb value={v} size={72} /> },
              {
                title: 'Nom', dataIndex: 'name',
                render: (v, c) => (
                  <span className="d-inline-flex align-items-center gap-2"><ContactAvatar contact={c} size={36} /><span className="fw-medium">{v || '—'}</span></span>
                ),
              },
              { title: 'Téléphone', dataIndex: 'phone', render: (v) => v || '—' },
              { title: 'E-mail', dataIndex: 'email', responsive: ['md'], render: (v) => v || '—' },
            ]} />
          {/* Contacts are added and edited on the Contacts page, filtered on this supplier. */}
          {!viewer && <div className="mt-2 small"><Link to={`/contacts?supplier_id=${supplier.id}`}>Ajouter ou modifier les contacts →</Link></div>}
          <ContactCard contact={viewing} supplierName={supplier.name} onClose={() => setViewing(null)}
            onEdit={viewer ? undefined : () => navigate(`/contacts?supplier_id=${supplier.id}`)} />
        </>
      ),
    },
    {
      key: 'booths',
      label: <Space size={6}>Booths<Tag className="m-0">{visited}/{booths}</Tag></Space>,
      children: <BoothList supplierId={supplier.id} onChanged={load} />,
    },
    {
      key: 'products',
      label: `Produits (${supplier.products_count})`,
      children: viewer
        ? <Table rowKey="id" size="middle" columns={viewerProductColumns} dataSource={supplier.products}
            scroll={{ x: true }} pagination={{ pageSize: 30, hideOnSinglePage: true }} locale={{ emptyText: 'Aucun produit' }} />
        : <ProductList supplierId={supplier.id} onChanged={load} />,
    },
  ];
  const sharedWith = (supplier.shared_company_ids || []).map((cid) => companies.find((c) => c.id === cid)).filter(Boolean);

  return (
    <>
      <div className="mb-2 small"><Link to="/fournisseurs">← Fournisseurs</Link></div>
      <Space className="mb-3 w-100 justify-content-between" wrap>
        <Space align="center" wrap>
          <h1 className="h4 m-0">{supplier.name}</h1>
          {supplier.province && <Tag className="m-0">{supplier.province}</Tag>}
        </Space>
        {viewer ? <Tag color="purple" className="m-0">Lecture seule</Tag> : (
          <Space wrap>
            <Button onClick={() => setEditing(true)}>Modifier</Button>
            <Popconfirm title="Supprimer ce fournisseur ?"
              description="Ses contacts, ses produits et leurs photos seront supprimés ; ses booths restent, sans fournisseur."
              okText="Supprimer" cancelText="Annuler" onConfirm={remove}>
              <Button danger>Supprimer</Button>
            </Popconfirm>
            <Button type="primary" onClick={() => setCreatingProduct(true)}>Nouveau produit</Button>
          </Space>
        )}
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
            admin && {
              key: 'shares', label: 'Partagé avec', span: 'filled',
              children: sharedWith.length
                ? sharedWith.map((c) => <Tag key={c.id} color="purple" className="mb-1">{companyLabel(c)}</Tag>)
                : <span className="text-secondary">Aucune société</span>,
            },
          ].filter(Boolean)} />
      </Card>

      <Card size="small">
        <Tabs
          activeKey={['contacts', 'booths', 'products'].includes(params.get('tab')) ? params.get('tab') : 'contacts'}
          onChange={(key) => {
            const next = new URLSearchParams(params);
            if (key === 'contacts') next.delete('tab');
            else next.set('tab', key);
            setParams(next, { replace: true });
          }}
          items={tabs} />
      </Card>

      {!viewer && (
        <>
          <NewProductModal open={creatingProduct} supplierId={supplier.id} onClose={() => setCreatingProduct(false)} />

          <FormModal open={editing} title="Modifier le fournisseur" width={640} initialValues={supplierInitialValues(supplier, admin)}
            onCancel={() => setEditing(false)}
            onSubmit={(values) => axios.put(`${API_BASE_URL}/suppliers/${id}`, supplierPayload(values))}
            onSaved={() => { setEditing(false); message.success('Fournisseur modifié'); load(); }}>
            <SupplierFormFields />
          </FormModal>
        </>
      )}

    </>
  );
}
