import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, App, Button, Popconfirm, Space, Table, Tag } from 'antd';
import { API_BASE_URL } from '../../config/config';
import { apiError } from '../../utils/apiError';
import { VISIT_STATUS, formatDateTime } from '../../utils/format';
import FormModal from '../../components/FormModal';
import BoothFormFields, { boothPayload } from './BoothFormFields';

// Table of booths for the given API filters, with "new booth" and, for the planning view,
// a quick "Visité" action. Used by the booth pages and by the supplier page.
export default function BoothList({ filters, supplierId, planning, hideSupplier, onChanged }) {
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
      const { data } = await axios.get(`${API_BASE_URL}/booths`, { params: JSON.parse(query) });
      setRows(data.data);
    } catch (err) {
      setLoadError(apiError(err, 'Erreur lors du chargement des stands'));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { load(); }, [load]);

  const markVisited = async (booth) => {
    try {
      await axios.post(`${API_BASE_URL}/booths/${booth.id}/visits`, { status: 'visite' });
      message.success(`${booth.supplier_name} : visite enregistrée`);
      load();
      onChanged?.();
    } catch (err) {
      message.error(apiError(err, "Erreur lors de l'enregistrement de la visite"));
    }
  };

  const columns = [
    {
      title: 'Emplacement', dataIndex: 'location',
      render: (v, b) => <Link to={`/stands/${b.id}`}><strong>{v}</strong></Link>,
    },
    { title: 'Phase', dataIndex: 'phase', width: 70, render: (v) => v ?? '—' },
    !hideSupplier && {
      title: 'Fournisseur', dataIndex: 'supplier_name',
      render: (v, b) => <Link to={`/fournisseurs/${b.supplier_id}`}>{v}</Link>,
    },
    { title: 'Catégorie', dataIndex: 'category_name', responsive: ['md'], render: (v) => v || '—' },
    {
      title: 'Statut', key: 'status', width: 170,
      render: (_, b) => (
        <Space size={4} wrap>
          {b.to_visit ? <Tag color="orange">À visiter</Tag> : null}
          {b.last_status && <Tag color={VISIT_STATUS[b.last_status]?.color}>{VISIT_STATUS[b.last_status]?.label}</Tag>}
        </Space>
      ),
    },
    {
      title: 'Dernière visite', dataIndex: 'last_visited_at', responsive: ['lg'],
      render: (v) => (v ? formatDateTime(v) : '—'),
    },
    { title: 'Produits', dataIndex: 'products_count', width: 90, responsive: ['lg'] },
    planning && {
      title: '', key: 'visit', width: 110,
      render: (_, b) => (
        <Popconfirm title={`Visite du stand ${b.location} faite ?`} okText="Oui, visité" cancelText="Annuler"
          onConfirm={() => markVisited(b)}>
          <Button size="small" type="primary">Visité</Button>
        </Popconfirm>
      ),
    },
  ].filter(Boolean);

  return (
    <>
      <Button className="mb-2" onClick={() => setCreating(true)}>Nouveau stand</Button>
      {loadError && <Alert type="error" message={loadError} showIcon className="mb-3" />}
      <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} size="middle"
        scroll={{ x: true }} pagination={{ pageSize: 50 }}
        locale={{ emptyText: planning ? 'Aucun stand à visiter' : 'Aucun stand' }} />

      <FormModal open={creating} title="Nouveau stand" width={640}
        initialValues={{ supplier_id: supplierId, to_visit: !!planning }}
        onCancel={() => setCreating(false)}
        onSubmit={(values) => axios.post(`${API_BASE_URL}/booths`, boothPayload(values))}
        onSaved={(res) => {
          setCreating(false);
          message.success('Stand créé');
          if (supplierId) { load(); onChanged?.(); } else navigate(`/stands/${res.data.data.id}`);
        }}>
        <BoothFormFields lockSupplier={!!supplierId} />
      </FormModal>
    </>
  );
}
