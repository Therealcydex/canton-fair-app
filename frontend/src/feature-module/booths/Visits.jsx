import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Alert, Select, Space, Switch, Table, Tag } from 'antd';
import { API_BASE_URL } from '../../config/config';
import { apiError } from '../../utils/apiError';
import { VISIT_STATUS, formatDateTime } from '../../utils/format';

// Visit log of the company (BF09); "Mes visites" limits it to the user's own visits.
export default function Visits() {
  const [rows, setRows] = useState([]);
  const [mine, setMine] = useState(false);
  const [status, setStatus] = useState();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data } = await axios.get(`${API_BASE_URL}/booths/visits`, { params: { mine: mine ? 1 : undefined, status } });
      setRows(data.data);
    } catch (err) {
      setLoadError(apiError(err, 'Erreur lors du chargement des visites'));
    } finally {
      setLoading(false);
    }
  }, [mine, status]);

  useEffect(() => { load(); }, [load]);

  const columns = [
    { title: 'Date', dataIndex: 'visited_at', render: formatDateTime },
    { title: 'Stand', dataIndex: 'location', render: (v, r) => <Link to={`/stands/${r.booth_id}`}>{v}</Link> },
    { title: 'Fournisseur', dataIndex: 'supplier_name', render: (v, r) => <Link to={`/fournisseurs/${r.supplier_id}`}>{v}</Link> },
    { title: 'Statut', dataIndex: 'status', render: (s) => <Tag color={VISIT_STATUS[s]?.color}>{VISIT_STATUS[s]?.label}</Tag> },
    { title: 'Par', dataIndex: 'user_name', responsive: ['md'] },
    { title: 'Commentaire', dataIndex: 'comment', responsive: ['lg'], render: (c) => c || '—' },
  ];

  return (
    <>
      <h1 className="h4 mb-3">Visites</h1>
      <Space className="mb-3" wrap>
        <Space><Switch checked={mine} onChange={setMine} /> Mes visites</Space>
        <Select placeholder="Statut" allowClear style={{ width: 160 }} value={status} onChange={setStatus}
          options={Object.entries(VISIT_STATUS).map(([value, s]) => ({ value, label: s.label }))} />
      </Space>
      {loadError && <Alert type="error" message={loadError} showIcon className="mb-3" />}
      <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} size="middle"
        scroll={{ x: true }} pagination={{ pageSize: 50 }} locale={{ emptyText: 'Aucune visite' }} />
    </>
  );
}
