import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, App, Button, Input, Rate, Select, Space, Table, Tag } from 'antd';
import { API_BASE_URL } from '../../config/config';
import { apiError } from '../../utils/apiError';
import FormModal from '../../components/FormModal';
import SupplierFormFields from './SupplierFormFields';
import { supplierPayload } from './SupplierDetail';
import { useList } from '../../utils/lists';

export default function Suppliers() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const provinces = useList('provinces');
  const [filters, setFilters] = useState({ q: '', province_id: undefined });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data } = await axios.get(`${API_BASE_URL}/suppliers`, { params: { q: filters.q || undefined, province_id: filters.province_id } });
      setRows(data.data);
    } catch (err) {
      setLoadError(apiError(err, 'Erreur lors du chargement des fournisseurs'));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  // "Guangdong 广东", as the buyers read the province on the fair's documents.
  const provinceLabel = (id) => {
    const p = provinces.find((x) => x.id === id);
    return p ? [p.name_en, p.name_zh].filter(Boolean).join(' ') : null;
  };
  const visitPct = (r) => (r.booth_visit_pct === null ? -1 : Number(r.booth_visit_pct));

  // D40: design from Claude Design ("Fournisseurs", version A).
  const columns = [
    { title: 'N°', dataIndex: 'supplier_no', width: 70, sorter: (a, b) => a.supplier_no - b.supplier_no },
    {
      title: 'Nom', dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name),
      render: (v, r) => <Link to={`/fournisseurs/${r.id}`}>{v}</Link>,
    },
    { title: 'Province', dataIndex: 'province_id', render: (v, r) => provinceLabel(v) || r.province || '—' },
    { title: 'Téléphone', dataIndex: 'phone', responsive: ['md'], render: (v) => v || '—' },
    {
      title: 'Note', dataIndex: 'rating', width: 150, sorter: (a, b) => (a.rating || 0) - (b.rating || 0),
      render: (v) => (v ? <Rate disabled value={v} style={{ fontSize: 14 }} /> : <span className="text-muted small">Non noté</span>),
    },
    { title: 'Stands', dataIndex: 'nbr_booths', width: 80, align: 'right', responsive: ['lg'] },
    {
      title: '% visités', dataIndex: 'booth_visit_pct', width: 110, align: 'right', sorter: (a, b) => visitPct(a) - visitPct(b),
      render: (v) => (v === null
        ? <span className="text-muted">—</span>
        : <Tag color={Number(v) === 100 ? 'green' : Number(v) > 0 ? 'blue' : 'default'} className="m-0">{v} %</Tag>),
    },
    {
      title: 'Produits', dataIndex: 'products_count', width: 100, align: 'right', responsive: ['lg'],
      sorter: (a, b) => a.products_count - b.products_count,
    },
  ];

  return (
    <>
      <Space className="mb-3 w-100 justify-content-between" wrap>
        <h1 className="h4 m-0">Fournisseurs</h1>
        <Button type="primary" onClick={() => setCreating(true)}>Nouveau fournisseur</Button>
      </Space>
      <Space className="mb-3 w-100 justify-content-between" wrap>
        <Space wrap>
          <Input.Search placeholder="Rechercher par nom ou téléphone" allowClear style={{ width: 280 }}
            onSearch={(q) => setFilters((f) => ({ ...f, q }))} />
          <Select placeholder="Province" allowClear showSearch optionFilterProp="label" style={{ width: 220 }} value={filters.province_id}
            options={provinces.map((p) => ({ value: p.id, label: provinceLabel(p.id) }))}
            onChange={(province_id) => setFilters((f) => ({ ...f, province_id }))} />
        </Space>
        {!loading && !loadError && <span className="text-muted small">{rows.length} fournisseur{rows.length > 1 ? 's' : ''}</span>}
      </Space>
      {loadError && <Alert type="error" message={loadError} showIcon className="mb-3" />}
      <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} size="middle"
        scroll={{ x: true }} pagination={{ pageSize: 20 }} />

      <FormModal open={creating} title="Nouveau fournisseur" width={640}
        onCancel={() => setCreating(false)}
        onSubmit={(values) => axios.post(`${API_BASE_URL}/suppliers`, supplierPayload(values))}
        onSaved={(res) => {
          setCreating(false);
          message.success('Fournisseur créé');
          navigate(`/fournisseurs/${res.data.data.id}`);
        }}>
        <SupplierFormFields />
      </FormModal>
    </>
  );
}
