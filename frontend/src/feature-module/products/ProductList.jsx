import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, App, Button, Popconfirm, Space, Table, Tag, Tooltip } from 'antd';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { API_BASE_URL } from '../../config/config';
import { apiError } from '../../utils/apiError';
import { boothLabel, formatPrice } from '../../utils/format';
import { STATUS } from '../../utils/decision';
import FormModal from '../../components/FormModal';
import ProductFormFields, { productPayload } from './ProductFormFields';
import { photosValue } from './PhotosField';
import ProductThumb from '../../components/ProductThumb';

// "New product", opened from the page headers (products page, supplier page, booth page: boothId).
export function NewProductModal({ open, supplierId, onClose }) {
  const { message } = App.useApp();
  const navigate = useNavigate();
  return (
    <FormModal open={open} title="Nouveau produit" width={720}
      initialValues={{ supplier_id: supplierId, shipping_type: 'FOB', photos: photosValue(null) }}
      onCancel={onClose}
      onSubmit={(values) => axios.post(`${API_BASE_URL}/products`, productPayload(values))}
      onSaved={(res) => {
        onClose();
        message.success('Produit créé');
        navigate(`/produits/${res.data.data.id}`);
      }}>
      <ProductFormFields lockSupplier={!!supplierId} showBooth={false} />
    </FormModal>
  );
}

// Table of products for the given API filters, with "Modifier" on each row. D62: products are no
// longer shared, so the rows are not selectable any more.
export default function ProductList({ filters, supplierId, onChanged }) {
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

  const remove = async (product) => {
    try {
      await axios.delete(`${API_BASE_URL}/products/${product.id}`);
      message.success('Produit supprimé');
      load();
      onChanged?.();
    } catch (err) {
      message.error(apiError(err, 'Erreur lors de la suppression'));
    }
  };

  // The list has no photos: the edit form gets them from the product.
  const edit = async (p) => {
    try {
      const { data } = await axios.get(`${API_BASE_URL}/products/${p.id}`);
      setEditing({ ...data.data, photos: photosValue(data.data) });
    } catch (err) {
      message.error(apiError(err, 'Erreur lors du chargement du produit'));
    }
  };

  const columns = [
    // D61: the first photo's thumbnail, or the placeholder; never hidden, even on a phone.
    { title: 'Photo', dataIndex: 'cover_thumb', width: 64, render: (src) => <ProductThumb src={src} /> },
    {
      title: 'Nom', dataIndex: 'name',
      render: (v, p) => (
        <>
          <Link to={supplierId ? `/produits/${p.id}?supplier=${supplierId}` : `/produits/${p.id}`} className="fw-medium">{v}</Link>
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
      title: '', key: 'actions', width: supplierId ? 220 : 110, align: 'right',
      render: (_, p) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => edit(p)}>Modifier</Button>
          {supplierId && (
            <Popconfirm title={`Supprimer « ${p.name} » ?`} description="Ses photos seront supprimées."
              okText="Supprimer" okButtonProps={{ danger: true }} cancelText="Annuler" onConfirm={() => remove(p)}>
              <Button size="small" danger icon={<DeleteOutlined />}>Supprimer</Button>
            </Popconfirm>
          )}
        </Space>
      ),
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
