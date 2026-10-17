import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, App, Button, Image, Table, Tag, Tooltip } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { API_BASE_URL, fileUrl } from '../../config/config';
import { apiError } from '../../utils/apiError';
import { boothLabel, formatPrice } from '../../utils/format';
import { STATUS } from '../../utils/decision';
import FormModal from '../../components/FormModal';
import ProductFormFields, { productPayload } from './ProductFormFields';

// "New product", opened from the page headers (products page, supplier page, booth page: boothId).
export function NewProductModal({ open, supplierId, boothId, onClose }) {
  const { message } = App.useApp();
  const navigate = useNavigate();
  return (
    <FormModal open={open} title="Nouveau produit" width={720}
      initialValues={{ supplier_id: supplierId, booth_id: boothId, shipping_type: 'FOB' }}
      onCancel={onClose}
      onSubmit={(values) => axios.post(`${API_BASE_URL}/products`, productPayload(values))}
      onSaved={(res) => {
        onClose();
        message.success('Produit créé : ajoutez ses photos');
        navigate(`/produits/${res.data.data.id}`);
      }}>
      <ProductFormFields lockSupplier={!!supplierId} />
    </FormModal>
  );
}

// Table of products for the given API filters, with "Modifier" on each row. D62: products are no
// longer shared, so the rows are not selectable any more.
export default function ProductList({ filters, supplierId }) {
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [editing, setEditing] = useState(null); // the product being edited

  const query = JSON.stringify({ ...filters, supplier_id: supplierId });
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data } = await axios.get(`${API_BASE_URL}/products`, { params: JSON.parse(query) });
      setRows(data.data);
    } catch (err) {
      setLoadError(apiError(err, 'Erreur lors du chargement des produits'));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { load(); }, [load]);

  const columns = [
    {
      title: 'Photo', dataIndex: 'cover_url', width: 72,
      render: (url) => (url
        ? <Image src={fileUrl(url)} width={48} height={48} style={{ objectFit: 'cover', borderRadius: 6 }} preview={false} />
        : <div className="bg-light border rounded" style={{ width: 48, height: 48 }} />),
    },
    {
      title: 'Nom', dataIndex: 'name',
      render: (v, p) => (
        <>
          <Link to={`/produits/${p.id}`} className="fw-medium">{v}</Link>
          {p.supplier_ref && <div className="text-muted small">Réf. {p.supplier_ref}</div>}
        </>
      ),
    },
    !supplierId && { title: 'Fournisseur', dataIndex: 'supplier_name', responsive: ['md'], render: (v) => v || '—' },
    {
      title: 'Booth', dataIndex: 'booth_code', width: 140, responsive: ['md'],
      render: (v, p) => (v ? <Link to={`/booths/${p.booth_id}`}>{boothLabel(p.booth_phase, v)}</Link> : '—'),
    },
    {
      title: 'Décision', dataIndex: 'status', width: 130,
      render: (v, p) => {
        const tag = <Tag color={STATUS[v]?.color} className="m-0">{STATUS[v]?.label || v}</Tag>;
        return p.decision_note ? <Tooltip title={p.decision_note}>{tag}</Tooltip> : tag;
      },
    },
    {
      title: 'Prix', dataIndex: 'price', align: 'right',
      render: (v, p) => <span className="text-nowrap">{formatPrice(v)}{p.unit ? <span className="text-muted"> / {p.unit}</span> : null}</span>,
    },
    { title: 'MOQ', dataIndex: 'moq', width: 90, align: 'right', render: (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('fr-FR')) },
    {
      title: 'Expédition', dataIndex: 'shipping_type', width: 110, responsive: ['md'],
      render: (v, p) => (v ? <Tooltip title={p.shipping_name}><Tag color="geekblue" className="m-0">{v}</Tag></Tooltip> : '—'),
    },
    {
      title: '', key: 'actions', width: 110, align: 'right',
      render: (_, p) => <Button size="small" icon={<EditOutlined />} onClick={() => setEditing(p)}>Modifier</Button>,
    },
  ].filter(Boolean);

  return (
    <>
      {loadError && <Alert type="error" message={loadError} showIcon className="mb-3" />}
      <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} size="middle"
        scroll={{ x: true }} pagination={{ pageSize: 30 }} locale={{ emptyText: 'Aucun produit' }} />

      <FormModal open={!!editing} title="Modifier le produit" width={720} initialValues={editing}
        onCancel={() => setEditing(null)}
        onSubmit={(values) => axios.put(`${API_BASE_URL}/products/${editing.id}`, productPayload(values))}
        onSaved={() => { setEditing(null); message.success('Produit modifié'); load(); }}>
        <ProductFormFields lockSupplier={!!supplierId} />
      </FormModal>
    </>
  );
}
