import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Alert, App, Button, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, Tag } from 'antd';
import { API_BASE_URL } from '../../config/config';
import { useAuth } from '../../context/AuthContext';
import { apiError } from '../../utils/apiError';
import { companyLabel } from '../../utils/lists';

const ROLES = [
  { value: 'ACHETEUR', label: 'Acheteur' },
  { value: 'ADMIN', label: 'Administrateur' },
];

export default function Users() {
  const { user: me } = useAuth();
  const { message } = App.useApp();
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [editing, setEditing] = useState(null); // null = closed, {} = new, user = edit
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [form] = Form.useForm();

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


  const open = (u) => {
    setFormError(null);
    setEditing(u || {});
    form.setFieldsValue(u
      ? { ...u, is_active: !!u.is_active, password: '' }
      : { name: '', username: '', password: '', level: '', role: 'ACHETEUR', is_active: true, company_id: undefined });
  };

  const save = async () => {
    const values = await form.validateFields();
    setSaving(true);
    setFormError(null);
    try {
      const body = { ...values, company_id: values.company_id ?? null };
      if (editing.id) await axios.put(`${API_BASE_URL}/users/${editing.id}`, body);
      else await axios.post(`${API_BASE_URL}/users`, body);
      message.success(editing.id ? 'Utilisateur modifié' : 'Utilisateur créé');
      setEditing(null);
      load();
    } catch (err) {
      setFormError(apiError(err, "Erreur lors de l'enregistrement"));
    } finally {
      setSaving(false);
    }
  };

  const activate = async (u) => {
    try {
      await axios.put(`${API_BASE_URL}/users/${u.id}`, { is_active: 1 });
      message.success(`${u.name} peut maintenant se connecter`);
      load();
    } catch (err) {
      message.error(apiError(err, "Erreur lors de l'activation"));
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
    { title: 'Nom', dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
    { title: 'Utilisateur', dataIndex: 'username' },
    { title: 'Société', key: 'company', render: (_, u) => (u.company_id ? companyLabel({ name: u.company_name, branch: u.company_branch }) : '—') },
    { title: 'Niveau', dataIndex: 'level', render: (v) => v || '—' },
    { title: 'Rôle', dataIndex: 'role', render: (v) => ROLES.find((r) => r.value === v)?.label || v },
    { title: 'Statut', dataIndex: 'is_active', render: (v) => (v ? <Tag color="green">Actif</Tag> : <Tag color="orange">Inactif</Tag>) },
    {
      title: '', key: 'actions', width: 260,
      render: (_, u) => (
        <Space wrap>
          {!u.is_active && <Button size="small" type="primary" onClick={() => activate(u)}>Activer</Button>}
          <Button size="small" onClick={() => open(u)}>Modifier</Button>
          {u.id !== me.id && (
            <Popconfirm title="Supprimer cet utilisateur ?"
              description="Le compte est supprimé." okText="Supprimer" cancelText="Annuler" onConfirm={() => remove(u)}>
              <Button size="small" danger>Supprimer</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <Space className="mb-3 w-100 justify-content-between" wrap>
        <h1 className="h4 m-0">Utilisateurs</h1>
        <Button type="primary" onClick={() => open(null)}>Nouvel utilisateur</Button>
      </Space>
      {loadError && <Alert type="error" message={loadError} showIcon className="mb-3" />}
      <p className="text-muted">Il n'y a pas d'inscription : créez ici le compte de chaque personne qui doit accéder à l'application. Un compte inactif ne peut pas se connecter.</p>
      <Table rowKey="id" columns={columns} dataSource={users} loading={loading}
        size="middle" scroll={{ x: true }} pagination={{ pageSize: 20 }}
        locale={{ emptyText: 'Aucun utilisateur' }} />

      <Modal open={!!editing} title={editing?.id ? "Modifier l'utilisateur" : 'Nouvel utilisateur'}
        onCancel={() => setEditing(null)} onOk={save} okText="Enregistrer" cancelText="Annuler"
        confirmLoading={saving} destroyOnClose>
        {formError && <Alert type="error" message={formError} showIcon className="mb-3" />}
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item name="name" label="Nom" rules={[{ required: true, whitespace: true, message: 'Le nom est obligatoire' }]}>
            <Input maxLength={150} />
          </Form.Item>
          <Form.Item name="username" label="Nom d'utilisateur"
            rules={[{ required: true, message: "Le nom d'utilisateur est obligatoire" }]}>
            <Input maxLength={50} autoComplete="off" />
          </Form.Item>
          <Form.Item name="password" label="Mot de passe"
            extra={editing?.id ? 'Laisser vide pour ne pas le changer' : 'Au moins 8 caractères'}
            rules={editing?.id ? [] : [{ required: true, message: 'Le mot de passe est obligatoire' }]}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item name="company_id" label="Société">
            <Select allowClear placeholder="Aucune" showSearch optionFilterProp="label"
              options={companies.map((c) => ({ value: c.id, label: companyLabel(c) }))} />
          </Form.Item>
          <Form.Item name="level" label="Niveau" extra="Texte libre, par exemple « Chef des achats »">
            <Input maxLength={50} />
          </Form.Item>
          <Space size="large" wrap>
            <Form.Item name="role" label="Rôle" extra={isSelf ? 'Pas le vôtre' : ''}>
              <Select disabled={isSelf} style={{ minWidth: 180 }} options={ROLES} />
            </Form.Item>
            <Form.Item name="is_active" label="Actif" valuePropName="checked"
              extra={isSelf ? 'Vous ne pouvez pas vous désactiver' : ''}>
              <Switch disabled={isSelf} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </>
  );
}
