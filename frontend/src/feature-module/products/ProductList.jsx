import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, App, Button, Image, Table, Tag, Tooltip } from 'antd';
import { API_BASE_URL, fileUrl } from '../../config/config';
import { apiError } from '../../utils/apiError';
import { formatPrice } from '../../utils/format';
import { STATUS } from '../../utils/decision';
import FormModal from '../../components/FormModal';
import ProductFormFields, { productPayload } from './ProductFormFields';

// Table of products for the given API filters, with "new product".
export default function ProductList({ filters, supplierId }) {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [creating, setCreating] = useState(false);

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
      title: '', dataIndex: 'cover_url', width: 72,
      render: (url) => (url
        ? <Image src={fileUrl(url)} width={56} height={56} style={{ objectFit: 'cover' }} preview={false} />
        : <div className="bg-light border rounded" style={{ width: 56, height: 56 }} />),
    },
    {
      title: 'Produit', dataIndex: 'name',
      render: (v, p) => (
        <>
          <Link to={`/produits/${p.id}`}><strong>{v}</strong></Link>
          {p.supplier_ref && <div className="text-muted small">Réf. {p.supplier_ref}</div>}
        </>
      ),
    },
    {
      title: 'Décision', dataIndex: 'status', width: 130,
      render: (v, p) => {
        const tag = <Tag color={STATUS[v]?.color}>{STATUS[v]?.label || v}</Tag>;
        return p.decision_note ? <Tooltip title={p.decision_note}>{tag}</Tooltip> : tag;
      },
    },
    { title: 'Prix', dataIndex: 'price', render: (v, p) => <>{formatPrice(v)}{p.unit ? <span className="text-muted"> / {p.unit}</span> : null}</> },
    { title: 'MOQ', dataIndex: 'moq', width: 80, render: (v) => v ?? '—' },
    {
      title: 'Expédition', dataIndex: 'shipping_type', width: 100, responsive: ['md'],
      render: (v, p) => (v ? <Tooltip title={p.shipping_name}>{v}</Tooltip> : '—'),
    },
    !supplierId && { title: 'Fournisseur', dataIndex: 'supplier_name', responsive: ['md'], render: (v) => v || '—' },
    { title: 'Partagé avec', dataIndex: 'shared_with', responsive: ['lg'], render: (v) => v || '—' },
  ].filter(Boolean);

  return (
    <>
      <Button className="mb-2" onClick={() => setCreating(true)}>Nouveau produit</Button>
      {loadError && <Alert type="error" message={loadError} showIcon className="mb-3" />}
      <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} size="middle"
        scroll={{ x: true }} pagination={{ pageSize: 30 }}
        locale={{ emptyText: filters?.mine ? 'Aucun produit partagé avec votre société' : 'Aucun produit' }} />

      <FormModal open={creating} title="Nouveau produit" width={720}
        initialValues={{ supplier_id: supplierId, shipping_type: 'FOB' }}
        onCancel={() => setCreating(false)}
        onSubmit={(values) => axios.post(`${API_BASE_URL}/products`, productPayload(values))}
        onSaved={(res) => {
          setCreating(false);
          message.success('Produit créé : ajoutez ses photos');
          navigate(`/produits/${res.data.data.id}`);
        }}>
        <ProductFormFields lockSupplier={!!supplierId} />
      </FormModal>
    </>
  );
}
