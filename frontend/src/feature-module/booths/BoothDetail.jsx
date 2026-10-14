import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, App, Button, Descriptions, Form, Input, Popconfirm, Select, Space, Spin, Table, Tag, Tooltip } from 'antd';
import { API_BASE_URL } from '../../config/config';
import { useAuth } from '../../context/AuthContext';
import { isCompanyAdmin } from '../../utils/access';
import { apiError } from '../../utils/apiError';
import { VISIT_STATUS, formatDateTime, toInputDateTime } from '../../utils/format';
import FormModal from '../../components/FormModal';
import BoothFormFields, { boothPayload } from './BoothFormFields';

const STATUS_OPTIONS = Object.entries(VISIT_STATUS).map(([value, s]) => ({ value, label: s.label }));

export default function BoothDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [booth, setBooth] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [visit, setVisit] = useState(null); // null = closed, {} = new, row = edit

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const { data } = await axios.get(`${API_BASE_URL}/booths/${id}`);
      setBooth(data.data);
    } catch (err) {
      setLoadError(apiError(err, 'Erreur lors du chargement du stand'));
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const remove = async () => {
    try {
      await axios.delete(`${API_BASE_URL}/booths/${id}`);
      message.success('Stand supprimé');
      navigate('/stands');
    } catch (err) {
      message.error(apiError(err, 'Erreur lors de la suppression'));
    }
  };

  const removeVisit = async (v) => {
    try {
      await axios.delete(`${API_BASE_URL}/booths/${id}/visits/${v.id}`);
      message.success('Visite supprimée');
      load();
    } catch (err) {
      message.error(apiError(err, 'Erreur lors de la suppression'));
    }
  };

  if (loadError) return <Alert type="error" message={loadError} showIcon action={<Link to="/stands">Retour</Link>} />;
  if (!booth) return <div className="text-center py-5"><Spin /></div>;

  // Comfort only: the server refuses a change by someone else than the author or an admin.
  const canEdit = (v) => v.user_id === user.id || isCompanyAdmin(user);

  const visitColumns = [
    { title: 'Date', dataIndex: 'visited_at', render: formatDateTime },
    { title: 'Statut', dataIndex: 'status', render: (s) => <Tag color={VISIT_STATUS[s]?.color}>{VISIT_STATUS[s]?.label}</Tag> },
    { title: 'Par', dataIndex: 'user_name' },
    { title: 'Commentaire', dataIndex: 'comment', render: (c) => <span style={{ whiteSpace: 'pre-wrap' }}>{c || '—'}</span> },
    {
      title: '', key: 'actions', width: 190,
      render: (_, v) => {
        const locked = !canEdit(v);
        const why = locked ? "Seul l'auteur ou un administrateur peut modifier cette visite" : '';
        return (
          <Tooltip title={why}>
            <Space>
              <Button size="small" disabled={locked} onClick={() => setVisit(v)}>Modifier</Button>
              <Popconfirm title="Supprimer cette visite ?" okText="Supprimer" cancelText="Annuler"
                onConfirm={() => removeVisit(v)} disabled={locked}>
                <Button size="small" danger disabled={locked}>Supprimer</Button>
              </Popconfirm>
            </Space>
          </Tooltip>
        );
      },
    },
  ];

  return (
    <>
      <Link to="/stands">← Stands</Link>
      <Space className="my-2 w-100 justify-content-between" wrap>
        <h1 className="h4 m-0">
          Stand {booth.location} {booth.to_visit ? <Tag color="orange" className="ms-2">À visiter</Tag> : null}
        </h1>
        <Space wrap>
          <Button type="primary" onClick={() => setVisit({ status: 'visite' })}>Enregistrer une visite</Button>
          <Button onClick={() => setEditing(true)}>Modifier</Button>
          <Popconfirm title="Supprimer ce stand ?"
            description="Ses visites seront supprimées. Refusé si des produits y sont rattachés."
            okText="Supprimer" cancelText="Annuler" onConfirm={remove}>
            <Button danger>Supprimer</Button>
          </Popconfirm>
        </Space>
      </Space>

      <Descriptions bordered size="small" column={{ xs: 1, sm: 1, md: 2 }} className="mb-3">
        <Descriptions.Item label="Fournisseur"><Link to={`/fournisseurs/${booth.supplier_id}`}>{booth.supplier_name}</Link></Descriptions.Item>
        <Descriptions.Item label="Catégorie">{booth.category_name || '—'}</Descriptions.Item>
        <Descriptions.Item label="Phase">{booth.phase ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="Hall / étage">{booth.hall}{booth.level !== null ? `.${booth.level}` : ''}</Descriptions.Item>
        <Descriptions.Item label="Commentaire" span={2}><span style={{ whiteSpace: 'pre-wrap' }}>{booth.comment || '—'}</span></Descriptions.Item>
      </Descriptions>

      <h2 className="h5">Visites ({booth.visits.length})</h2>
      <Table rowKey="id" columns={visitColumns} dataSource={booth.visits} size="small" pagination={false}
        scroll={{ x: true }} locale={{ emptyText: 'Aucune visite' }} />

      <FormModal open={editing} title="Modifier le stand" width={640} initialValues={{ ...booth, to_visit: !!booth.to_visit }}
        onCancel={() => setEditing(false)}
        onSubmit={(values) => axios.put(`${API_BASE_URL}/booths/${id}`, boothPayload(values))}
        onSaved={() => { setEditing(false); message.success('Stand modifié'); load(); }}>
        <BoothFormFields />
      </FormModal>

      <FormModal open={!!visit} title={visit?.id ? 'Modifier la visite' : 'Nouvelle visite'}
        initialValues={visit && { ...visit, visited_at: toInputDateTime(visit.visited_at) }}
        onCancel={() => setVisit(null)}
        onSubmit={(values) => {
          const body = { ...values, visited_at: values.visited_at || null };
          return visit.id
            ? axios.put(`${API_BASE_URL}/booths/${id}/visits/${visit.id}`, body)
            : axios.post(`${API_BASE_URL}/booths/${id}/visits`, body);
        }}
        onSaved={() => { setVisit(null); message.success('Visite enregistrée'); load(); }}>
        <Form.Item name="status" label="Statut" rules={[{ required: true, message: 'Choisissez un statut' }]}>
          <Select options={STATUS_OPTIONS} />
        </Form.Item>
        <Form.Item name="visited_at" label="Date et heure (heure du salon)"
          extra="Vide pour une visite faite : la date et l'heure actuelles sont utilisées.">
          <Input type="datetime-local" />
        </Form.Item>
        <Form.Item name="comment" label="Commentaire"><Input.TextArea rows={3} /></Form.Item>
      </FormModal>
    </>
  );
}
