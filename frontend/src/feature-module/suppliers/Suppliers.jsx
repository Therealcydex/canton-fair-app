import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, App, Button, Input, Rate, Select, Space, Table } from 'antd';
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

  const columns = [
    { title: 'N°', dataIndex: 'supplier_no', width: 70, sorter: (a, b) => a.supplier_no - b.supplier_no },
    { title: 'Nom', dataIndex: 'name', render: (v, r) => <Link to={`/fournisseurs/${r.id}`}>{v}</Link> },
    { title: 'Province', dataIndex: 'province' },
    { title: 'Téléphone', dataIndex: 'phone', responsive: ['md'] },
    { title: 'Note', dataIndex: 'rating', width: 150, render: (v) => (v ? <Rate disabled value={v} /> : '—') },
    { title: 'Contacts', dataIndex: 'contacts_count', width: 90, responsive: ['lg'] },
    { title: 'Stands', dataIndex: 'nbr_booths', width: 80, responsive: ['lg'] },
    { title: 'Visités', dataIndex: 'booth_visit_pct', width: 90, render: (v) => (v === null ? '—' : `${v} %`) },
    { title: 'Produits', dataIndex: 'products_count', width: 90, responsive: ['lg'] },
  ];

  return (
    <>
      <Space className="mb-3 w-100 justify-content-between" wrap>
        <h1 className="h4 m-0">Fournisseurs</h1>
        <Button type="primary" onClick={() => setCreating(true)}>Nouveau fournisseur</Button>
      </Space>
      <Space className="mb-3" wrap>
        <Input.Search placeholder="Rechercher par nom" allowClear style={{ width: 260 }}
          onSearch={(q) => setFilters((f) => ({ ...f, q }))} />
        <Select placeholder="Province" allowClear showSearch optionFilterProp="label" style={{ width: 200 }} value={filters.province_id}
          options={provinces.map((p) => ({ value: p.id, label: p.name_en }))}
          onChange={(province_id) => setFilters((f) => ({ ...f, province_id }))} />
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
