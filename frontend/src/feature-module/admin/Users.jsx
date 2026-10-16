import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Alert, App, Button, Col, Form, Input, Popconfirm, Row, Select, Switch, Table, Tag } from 'antd';
import { DownloadOutlined, InfoCircleOutlined, ReloadOutlined, SearchOutlined, UserAddOutlined } from '@ant-design/icons';
import { API_BASE_URL } from '../../config/config';
import { useAuth } from '../../context/AuthContext';
import { apiError } from '../../utils/apiError';
import { companyLabel } from '../../utils/lists';
import FormModal from '../../components/FormModal';
import PageHeader from '../../components/PageHeader';

const ROLES = [
  { value: 'ACHETEUR', label: 'Acheteur' },
  { value: 'ADMIN', label: 'Administrateur' },
];
const roleLabel = (v) => ROLES.find((r) => r.value === v)?.label || v;
const userCompany = (u) => (u.company_id ? companyLabel({ name: u.company_name, branch: u.company_branch }) : '');

// The users shown, as a CSV file for Excel (";" and a BOM). No password is ever in a user row.
const exportCsv = (rows) => {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['Nom', "Nom d'utilisateur", 'Rôle', 'Niveau', 'Société', 'Statut'],
    ...rows.map((u) => [u.name, u.username, roleLabel(u.role), u.level, userCompany(u), u.is_active ? 'Actif' : 'Inactif'])];
  const blob = new Blob([`﻿${lines.map((l) => l.map(cell).join(';')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'utilisateurs.csv' });
  a.click();
  URL.revokeObjectURL(a.href);
};

// The accounts (admin only, D46: there is no sign-up), laid out like the Stitch "Gestion des
// utilisateurs" screen (D49), without its sign-up requests.
export default function Users() {
  const { user: me } = useAuth();
  const { message } = App.useApp();
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [editing, setEditing] = useState(null); // null = closed, {} = new, user = edit
  const [filters, setFilters] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [u, c] = await Promise.all([
        axios.get(`${API_BASE_URL}/users`),
        axios.get(`${API_BASE_URL}/companies`),
      ]);
      setUsers(u.data.data);
      setCompanies(c.data.data);
    } catch (err) {
      setLoadError(apiError(err, 'Erreur lors du chargement des utilisateurs'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const q = (filters.q || '').trim().toLowerCase();
    return users.filter((u) => (!q || `${u.name} ${u.username}`.toLowerCase().includes(q))
      && (!filters.role || u.role === filters.role)
      && (!filters.company_id || u.company_id === filters.company_id));
  }, [users, filters]);
  const active = users.filter((u) => u.is_active).length;
  const set = (key) => (value) => setFilters((f) => ({ ...f, [key]: value || undefined }));

  const setActive = async (u, isActive) => {
    try {
      await axios.put(`${API_BASE_URL}/users/${u.id}`, { is_active: isActive ? 1 : 0 });
      message.success(isActive ? `${u.name} peut maintenant se connecter` : `${u.name} ne peut plus se connecter`);
      load();
    } catch (err) {
      message.error(apiError(err, "Erreur lors de l'enregistrement"));
    }
  };

  const remove = async (u) => {
    try {
      await axios.delete(`${API_BASE_URL}/users/${u.id}`);
      message.success('Utilisateur supprimé');
      load();
    } catch (err) {
      message.error(apiError(err, 'Erreur lors de la suppression'));
    }
  };

  const isSelf = editing?.id === me.id;

  const columns = [
    {
      title: "Nom & nom d'utilisateur", dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name, 'fr'),
      render: (v, u) => <><span className="fw-semibold fs-6">{v}</span> <span className="text-secondary small">&lt;{u.username}&gt;</span></>,
    },
    {
      title: 'Rôle', dataIndex: 'role',
      render: (v) => (v === 'ADMIN' ? <span className="fw-semibold text-primary">{roleLabel(v)}</span> : roleLabel(v)),
    },
    { title: 'Niveau', dataIndex: 'level', render: (v) => (v ? <Tag className="m-0">{v}</Tag> : '—') },
    { title: 'Société rattachée', key: 'company', render: (_, u) => userCompany(u) || '—' },
    { title: 'Statut', dataIndex: 'is_active', render: (v) => (v ? <Tag color="green" className="m-0">Actif</Tag> : <Tag className="m-0">Inactif</Tag>) },
    {
      title: 'Actions', key: 'actions', align: 'right',
      render: (_, u) => (
        <span className="text-nowrap">
          <Button type="link" size="small" className="fw-semibold" onClick={() => setEditing(u)}>Modifier</Button>
          {u.id !== me.id && (
            <>
              <span className="text-secondary">|</span>
              {u.is_active
                ? <Button type="link" size="small" className="text-secondary" onClick={() => setActive(u, false)}>Désactiver</Button>
                : <Button type="link" size="small" className="text-success fw-semibold" onClick={() => setActive(u, true)}>Réactiver</Button>}
              <Popconfirm title="Supprimer cet utilisateur ?" description="Le compte est supprimé."
                okText="Supprimer" okButtonProps={{ danger: true }} cancelText="Annuler" onConfirm={() => remove(u)}>
                <Button type="link" size="small" danger>Supprimer</Button>
              </Popconfirm>
            </>
          )}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader eyebrow="Administration" title="Gestion des utilisateurs"
        subtitle="Contrôle des accès des acheteurs : il n'y a pas d'inscription, l'administrateur crée chaque compte"
        actions={(
          <>
            <Button icon={<DownloadOutlined />} disabled={!shown.length} onClick={() => exportCsv(shown)}>Exporter (CSV)</Button>
            <Button type="primary" icon={<UserAddOutlined />} onClick={() => setEditing({})}>Nouvel utilisateur</Button>
          </>
        )} />
      {loadError && <Alert type="error" message={loadError} showIcon className="mb-3" />}

      <div className="sc-filters">
        <h2 className="h5 m-0 me-2 d-flex align-items-baseline gap-2">
          Utilisateurs enregistrés <span className="fs-6 fw-normal text-secondary">({active} compte{active > 1 ? 's' : ''} actif{active > 1 ? 's' : ''})</span>
        </h2>
        <Input prefix={<SearchOutlined />} placeholder="Rechercher par nom…" allowClear className="ms-lg-auto" style={{ width: 240 }}
          value={filters.q} onChange={(e) => set('q')(e.target.value)} />
        <Select prefix={<span className="sc-label">Rôle :</span>} placeholder="Tous" allowClear style={{ width: 200 }}
          value={filters.role} onChange={set('role')} options={ROLES} />
        <Select prefix={<span className="sc-label">Société :</span>} placeholder="Toutes" allowClear showSearch optionFilterProp="label"
          style={{ width: 240 }} value={filters.company_id} onChange={set('company_id')}
          options={companies.map((c) => ({ value: c.id, label: companyLabel(c) }))} />
        <Button icon={<ReloadOutlined />} title="Actualiser" aria-label="Actualiser" onClick={load} />
      </div>
      <Table rowKey="id" columns={columns} dataSource={shown} loading={loading} size="middle" className="sc-table"
        scroll={{ x: 'max-content' }} locale={{ emptyText: 'Aucun utilisateur' }}
        rowClassName={(u) => (u.is_active ? '' : 'user-inactive')}
        pagination={{
          pageSize: 20,
          showTotal: (total, [from, to]) => <>Affichage de <strong>{from} à {to}</strong> sur <strong>{total}</strong> utilisateur{total > 1 ? 's' : ''}</>,
        }} />

      <div className="sc-note mt-3">
        <InfoCircleOutlined className="sc-panel-icon fs-5" />
        <div>
          <h2 className="sc-label text-body mb-1">Règles d'accès</h2>
          <p className="mb-0 small text-secondary">
            Deux rôles : <strong>Administrateur</strong> (comptes, sociétés, décisions sur les produits) et <strong>Acheteur</strong>
            (fournisseurs, booths, produits). Tous les comptes actifs voient et modifient les données du groupe. Un compte
            inactif ne peut plus se connecter. Le niveau est un texte libre.
          </p>
        </div>
      </div>

      <FormModal open={!!editing} title={editing?.id ? "Modifier l'utilisateur" : 'Nouvel utilisateur'}
        icon={<UserAddOutlined />} className="sc-modal-dark" width={640}
        initialValues={editing?.id
          ? { ...editing, is_active: !!editing.is_active, password: '' }
          : { name: '', username: '', password: '', level: '', role: 'ACHETEUR', is_active: true, company_id: undefined }}
        onCancel={() => setEditing(null)}
        onSubmit={(values) => {
          const body = { ...values, company_id: values.company_id ?? null };
          return editing.id ? axios.put(`${API_BASE_URL}/users/${editing.id}`, body) : axios.post(`${API_BASE_URL}/users`, body);
        }}
        onSaved={() => { message.success(editing.id ? 'Utilisateur modifié' : 'Utilisateur créé'); setEditing(null); load(); }}>
        <Form.Item name="name" label="Nom" rules={[{ required: true, whitespace: true, message: 'Le nom est obligatoire' }]}>
          <Input maxLength={150} />
        </Form.Item>
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item name="username" label="Nom d'utilisateur"
              rules={[{ required: true, message: "Le nom d'utilisateur est obligatoire" }]}>
              <Input maxLength={50} autoComplete="off" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="password" label="Mot de passe"
              extra={editing?.id ? 'Laisser vide pour ne pas le changer' : 'Au moins 8 caractères'}
              rules={editing?.id ? [] : [{ required: true, message: 'Le mot de passe est obligatoire' }]}>
              <Input.Password autoComplete="new-password" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item name="company_id" label="Société">
              <Select allowClear placeholder="Aucune" showSearch optionFilterProp="label"
                options={companies.map((c) => ({ value: c.id, label: companyLabel(c) }))} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="level" label="Niveau" extra="Texte libre, par exemple « Chef des achats »">
              <Input maxLength={50} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item name="role" label="Rôle" extra={isSelf ? 'Pas le vôtre' : ''}>
              <Select disabled={isSelf} options={ROLES} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="is_active" label="Actif" valuePropName="checked"
              extra={isSelf ? 'Vous ne pouvez pas vous désactiver' : ''}>
              <Switch disabled={isSelf} />
            </Form.Item>
          </Col>
        </Row>
      </FormModal>
    </>
  );
}
