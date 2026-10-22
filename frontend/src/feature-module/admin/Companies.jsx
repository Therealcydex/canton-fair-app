import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Alert, App, Button, Col, Form, Input, Popconfirm, Row, Table, Tag } from 'antd';
import {
  ApartmentOutlined, DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined, SearchOutlined,
  ShareAltOutlined, BankOutlined, TeamOutlined,
} from '@ant-design/icons';
import { API_BASE_URL } from '../../config/config';
import { apiError } from '../../utils/apiError';
import FormModal from '../../components/FormModal';
import PageHeader from '../../components/PageHeader';

const two = (n) => String(n).padStart(2, '0');
const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;
const initials = (name) => (name || '?').split(/[\s-]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

// The group's companies (admin), laid out like the Stitch "Sociétés du groupe" screen (D49).
export default function Companies() {
  const { message } = App.useApp();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [editing, setEditing] = useState(null); // null = closed, {} = new, company = edit
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data } = await axios.get(`${API_BASE_URL}/companies`);
      setCompanies(data.data.map((c, i) => ({ ...c, n: i + 1 })));
    } catch (err) {
      setLoadError(apiError(err, 'Erreur lors du chargement des sociétés'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? companies.filter((c) => `${c.name} ${c.branch || ''}`.toLowerCase().includes(q)) : companies;
  }, [companies, search]);

  const remove = async (c) => {
    try {
      await axios.delete(`${API_BASE_URL}/companies/${c.id}`);
      message.success('Société supprimée');
      load();
    } catch (err) {
      message.error(apiError(err, 'Erreur lors de la suppression'));
    }
  };

  const columns = [
    { title: '#', dataIndex: 'n', width: 56, render: (v) => <span className="text-secondary">{two(v)}</span> },
    {
      title: 'Société', dataIndex: 'name',
      render: (v) => (
        <span className="d-inline-flex align-items-center gap-2">
          <span className="company-initials">{initials(v)}</span>
          <span className="fw-semibold">{v}</span>
        </span>
      ),
    },
    { title: 'Branche', dataIndex: 'branch', render: (v) => (v ? <Tag className="m-0">{v}</Tag> : '—') },
    {
      title: 'Utilisateurs rattachés', dataIndex: 'users_count', align: 'center',
      render: (v) => <Tag color="blue" icon={<TeamOutlined />} className="m-0">{plural(Number(v) || 0, 'utilisateur')}</Tag>,
    },
    {
      title: 'Fournisseurs partagés', dataIndex: 'shared_suppliers_count', align: 'center',
      render: (v) => <Tag icon={<BankOutlined />} className="m-0">{plural(Number(v) || 0, 'fournisseur')}</Tag>,
    },
    {
      title: 'Actions', key: 'actions', align: 'right',
      render: (_, c) => (
        <span className="d-inline-flex gap-2">
          <Button size="small" icon={<EditOutlined />} onClick={() => setEditing(c)}>Modifier</Button>
          <Popconfirm title="Supprimer cette société ?"
            description="Ses utilisateurs restent, sans cette société ; les fournisseurs ne lui sont plus partagés."
            okText="Supprimer" okButtonProps={{ danger: true }} cancelText="Annuler" onConfirm={() => remove(c)}>
            <Button size="small" danger icon={<DeleteOutlined />}>Supprimer</Button>
          </Popconfirm>
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader eyebrow="Administration / Sociétés du groupe" title="Sociétés du groupe"
        chip={plural(companies.length, 'société')}
        subtitle="Les sociétés avec lesquelles les fournisseurs sont partagés"
        actions={(
          <>
            <Input prefix={<SearchOutlined />} placeholder="Filtrer société ou branche…" allowClear style={{ width: 260 }}
              value={search} onChange={(e) => setSearch(e.target.value)} />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing({})}>Nouvelle société</Button>
          </>
        )} />
      {loadError && <Alert type="error" message={loadError} showIcon className="mb-3" />}

      <div className="sc-toolbar">
        <span className="d-inline-flex align-items-center gap-2 fw-semibold text-uppercase small">
          <ApartmentOutlined /> Toutes les sociétés ({companies.length})
        </span>
        <Button size="small" icon={<ReloadOutlined />} onClick={load}>Actualiser</Button>
      </div>
      <Table rowKey="id" columns={columns} dataSource={shown} loading={loading} size="middle" className="sc-table"
        scroll={{ x: 'max-content' }} locale={{ emptyText: 'Aucune société' }}
        pagination={{
          pageSize: 10, hideOnSinglePage: false,
          showTotal: (total, [from, to]) => <>Affichage de <strong>{from} à {to}</strong> sur <strong>{total}</strong> société{total > 1 ? 's' : ''}</>,
        }} />

      <Row gutter={[16, 16]} className="mt-3">
        <Col xs={24} md={12}>
          <div className="sc-note">
            <ShareAltOutlined className="sc-panel-icon fs-5" />
            <div>
              <h2 className="h6 mb-1">Partage des fournisseurs</h2>
              <p className="mb-0 small text-secondary">
                L'administrateur partage un fournisseur avec une ou plusieurs sociétés (« Partager avec » dans la fiche
                du <Link to="/fournisseurs">fournisseur</Link>) ; les lecteurs de ces sociétés le voient en lecture seule,
                avec ses contacts, ses booths et ses produits.
              </p>
            </div>
          </div>
        </Col>
        <Col xs={24} md={12}>
          <div className="sc-note">
            <TeamOutlined className="sc-panel-icon fs-5" />
            <div>
              <h2 className="h6 mb-1">Utilisateurs rattachés</h2>
              <p className="mb-0 small text-secondary">
                Un utilisateur peut appartenir à plusieurs sociétés, choisies dans son compte (<Link to="/admin/utilisateurs">Utilisateurs</Link>).
                Supprimer une société garde ses utilisateurs, sans cette société.
              </p>
            </div>
          </div>
        </Col>
      </Row>

      <FormModal open={!!editing} title={editing?.id ? 'Modifier la société' : 'Nouvelle société'}
        icon={<ApartmentOutlined />} className="sc-modal-dark"
        initialValues={{ name: editing?.name || '', branch: editing?.branch || '' }}
        onCancel={() => setEditing(null)}
        onSubmit={(values) => {
          const body = { ...values, branch: values.branch || null };
          return editing.id ? axios.put(`${API_BASE_URL}/companies/${editing.id}`, body) : axios.post(`${API_BASE_URL}/companies`, body);
        }}
        onSaved={() => { message.success(editing.id ? 'Société modifiée' : 'Société créée'); setEditing(null); load(); }}>
        <Form.Item name="name" label="Nom" rules={[{ required: true, whitespace: true, message: 'Le nom est obligatoire' }]}>
          <Input maxLength={150} autoFocus placeholder="ex. Groupe démo" />
        </Form.Item>
        <Form.Item name="branch" label="Branche" extra="Facultatif, par exemple la ville">
          <Input maxLength={150} placeholder="ex. Tunis" />
        </Form.Item>
      </FormModal>
    </>
  );
}
