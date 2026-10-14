import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, App, Button, Image, Table, Tag } from 'antd';
import { API_BASE_URL, fileUrl } from '../../config/config';
import { apiError } from '../../utils/apiError';
import { formatPrice } from '../../utils/format';
import FormModal from '../../components/FormModal';
import ProductFormFields, { productPayload } from './ProductFormFields';

// Table of products for the given API filters. `shared` lists the products other
// companies share with ours (read only, no "new product").
export default function ProductList({ filters, supplierId, boothId, shared }) {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [creating, setCreating] = useState(false);

  const query = JSON.stringify({ ...filters, supplier_id: supplierId, booth_id: boothId, scope: shared ? 'shared' : undefined });
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
    { title: 'Prix', dataIndex: 'price_tnd', render: (v, p) => <>{formatPrice(v)}{p.unit ? <span className="text-muted"> / {p.unit}</span> : null}</> },
    { title: 'MOQ', dataIndex: 'moq', width: 80, render: (v) => v ?? '—' },
    { title: 'Incoterm', dataIndex: 'incoterm', width: 90, responsive: ['md'], render: (v) => v || '—' },
    !supplierId && { title: 'Fournisseur', dataIndex: 'supplier_name', responsive: ['md'] },
    !boothId && { title: 'Stand', dataIndex: 'booth_location', responsive: ['lg'], render: (v) => v || '—' },
    shared
      ? { title: 'Partagé par', dataIndex: 'owner_company_name' }
      : { title: 'Partage', dataIndex: 'shares_count', width: 100, responsive: ['lg'], render: (n) => (n ? <Tag color="purple">{n} société(s)</Tag> : '—') },
  ].filter(Boolean);

  return (
    <>
      {!shared && <Button className="mb-2" onClick={() => setCreating(true)}>Nouveau produit</Button>}
      {loadError && <Alert type="error" message={loadError} showIcon className="mb-3" />}
      <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} size="middle"
        scroll={{ x: true }} pagination={{ pageSize: 30 }}
        locale={{ emptyText: shared ? 'Aucun produit partagé avec votre société' : 'Aucun produit' }} />

      <FormModal open={creating} title="Nouveau produit" width={720}
        initialValues={{ supplier_id: supplierId, booth_id: boothId }}
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
