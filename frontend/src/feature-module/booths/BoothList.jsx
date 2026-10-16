import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, App, Button, Switch, Table, Tag, Tooltip } from 'antd';
import { API_BASE_URL } from '../../config/config';
import { apiError } from '../../utils/apiError';
import FormModal from '../../components/FormModal';
import BoothFormFields, { boothPayload } from './BoothFormFields';

// Table of booths for the given API filters, with "new booth" and a "visited" switch on each row.
// Used by the booth pages and by the supplier page.
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
      setLoadError(apiError(err, 'Erreur lors du chargement des booths'));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { load(); }, [load]);

  const setVisited = async (booth, visited) => {
    try {
      await axios.patch(`${API_BASE_URL}/booths/${booth.id}/visited`, { visited });
      message.success(`${booth.booth_code} : ${visited ? 'visité' : 'à visiter'}`);
      load();
      onChanged?.();
    } catch (err) {
      message.error(apiError(err, "Erreur lors de l'enregistrement"));
    }
  };

  const columns = [
    {
      title: 'Booth', dataIndex: 'booth_code',
      render: (v, b) => <Link to={`/booths/${b.id}`}><strong>{v}</strong></Link>,
    },
    { title: 'Zone', dataIndex: 'zone', width: 70, render: (v) => v || '—' },
    !hideSupplier && {
      title: 'Fournisseur', dataIndex: 'supplier_name',
      render: (v, b) => (b.supplier_id ? <Link to={`/fournisseurs/${b.supplier_id}`}>{v}</Link> : '—'),
    },
    {
      title: 'Catégorie', key: 'category', responsive: ['md'],
      render: (_, b) => (b.sub_category
        ? <Tooltip title={`${b.category} › ${b.section}`}>{b.sub_category}</Tooltip>
        : '—'),
    },
    {
      title: 'Visité', dataIndex: 'visited', width: 130,
      render: (v, b) => (
        <span className="d-inline-flex align-items-center gap-2">
          <Switch size="small" checked={!!v} onChange={(checked) => setVisited(b, checked)} />
          {v ? <Tag color="green">Visité</Tag> : <Tag color="orange">À visiter</Tag>}
        </span>
      ),
    },
    { title: 'Commentaire', dataIndex: 'comment', responsive: ['lg'], ellipsis: true, render: (v) => v || '—' },
  ].filter(Boolean);

  return (
    <>
      <Button className="mb-2" onClick={() => setCreating(true)}>Nouveau booth</Button>
      {loadError && <Alert type="error" message={loadError} showIcon className="mb-3" />}
      <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} size="middle"
        scroll={{ x: true }} pagination={{ pageSize: 50 }}
        locale={{ emptyText: planning ? 'Aucun booth à visiter' : 'Aucun booth' }} />

      <FormModal open={creating} title="Nouveau booth" width={640}
        initialValues={{ supplier_id: supplierId, visited: false, floor: 1 }}
        onCancel={() => setCreating(false)}
        onSubmit={(values) => axios.post(`${API_BASE_URL}/booths`, boothPayload(values))}
        onSaved={(res) => {
          setCreating(false);
          message.success(`Booth ${res.data.data.booth_code} créé`);
          if (supplierId) { load(); onChanged?.(); } else navigate(`/booths/${res.data.data.id}`);
        }}>
        <BoothFormFields lockSupplier={!!supplierId} />
      </FormModal>
    </>
  );
}
