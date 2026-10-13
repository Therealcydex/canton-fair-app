import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Alert, App, Button, Form, Input, InputNumber, Modal, Select, Space, Switch, Table, Tag, Tooltip } from 'antd';
import { API_BASE_URL } from '../../config/config';
import { useAuth } from '../../context/AuthContext';
import { isSuperAdmin } from '../../utils/access';
import { apiError } from '../../utils/apiError';

const MAX_LEVEL = 9;

export default function Users() {
  const { user: me } = useAuth();
  const { message } = App.useApp();
  const superAdmin = isSuperAdmin(me);
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
      const { data } = await axios.get(`${API_BASE_URL}/users`);
      setUsers(data.data);
      if (superAdmin) {
        const res = await axios.get(`${API_BASE_URL}/companies`);
        setCompanies(res.data.data);
      }
    } catch (err) {
      setLoadError(apiError(err, 'Erreur lors du chargement des utilisateurs'));
    } finally {
      setLoading(false);
    }
  }, [superAdmin]);

  useEffect(() => { load(); }, [load]);

  const open = (u) => {
    setFormError(null);
    setEditing(u || {});
    form.setFieldsValue(u
      ? { ...u, active: !!u.active, password: '' }
      : { name: '', username: '', password: '', level: 1, role: 'ACHETEUR', active: true, company_id: me.company_id });
  };

  const save = async () => {
    const values = await form.validateFields();
    setSaving(true);
    setFormError(null);
    try {
      if (editing.id) await axios.put(`${API_BASE_URL}/users/${editing.id}`, values);
      else await axios.post(`${API_BASE_URL}/users`, values);
      message.success(editing.id ? 'Utilisateur modifié' : 'Utilisateur créé');
      setEditing(null);
      load();
    } catch (err) {
      setFormError(apiError(err, "Erreur lors de l'enregistrement"));
    } finally {
      setSaving(false);
    }
  };

  const isSelf = editing?.id === me.id;
  // A company admin cannot give a level above their own (the server refuses it too).
  const maxLevel = superAdmin ? MAX_LEVEL : me.level;

  const columns = [
    { title: 'Nom', dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
    { title: 'Utilisateur', dataIndex: 'username' },
    superAdmin && { title: 'Société', dataIndex: 'company_name' },
    { title: 'Niveau', dataIndex: 'level', width: 90 },
    { title: 'Rôle', dataIndex: 'role' },
    {
      title: 'Statut', dataIndex: 'active', width: 100,
      render: (v) => (v ? <Tag color="green">Actif</Tag> : <Tag>Inactif</Tag>),
    },
    {
      title: '', key: 'actions', width: 110,
      render: (_, u) => {
        const locked = !superAdmin && u.level > me.level;
        return (
          <Tooltip title={locked ? 'Utilisateur de niveau supérieur au vôtre' : ''}>
            <Button size="small" disabled={locked} onClick={() => open(u)}>Modifier</Button>
          </Tooltip>
        );
      },
    },
  ].filter(Boolean);

  return (
    <>
      <Space className="mb-3 w-100 justify-content-between" wrap>
        <h1 className="h4 m-0">Utilisateurs</h1>
        <Button type="primary" onClick={() => open(null)}>Nouvel utilisateur</Button>
      </Space>
      {loadError && <Alert type="error" message={loadError} showIcon className="mb-3" />}
      <Table rowKey="id" columns={columns} dataSource={users} loading={loading}
        size="middle" scroll={{ x: true }} pagination={{ pageSize: 20 }} />

      <Modal open={!!editing} title={editing?.id ? "Modifier l'utilisateur" : 'Nouvel utilisateur'}
        onCancel={() => setEditing(null)} onOk={save} okText="Enregistrer" cancelText="Annuler"
        confirmLoading={saving} destroyOnClose>
        {formError && <Alert type="error" message={formError} showIcon className="mb-3" />}
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item name="name" label="Nom" rules={[{ required: true, message: 'Le nom est obligatoire' }]}>
            <Input maxLength={100} />
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
          {superAdmin && (
            <Form.Item name="company_id" label="Société" extra={isSelf ? 'Vous ne pouvez pas changer votre propre société' : ''}>
              <Select disabled={isSelf} options={companies.map((c) => ({ value: c.id, label: c.name }))} />
            </Form.Item>
          )}
          <Space size="large" wrap>
            <Form.Item name="level" label="Niveau" extra={`1 à ${maxLevel}${isSelf ? ' — pas le vôtre' : ''}`}>
              <InputNumber min={1} max={maxLevel} disabled={isSelf} />
            </Form.Item>
            <Form.Item name="role" label="Rôle">
              <Select disabled={isSelf} style={{ minWidth: 160 }} options={[
                { value: 'ACHETEUR', label: 'Acheteur' },
                ...(superAdmin ? [{ value: 'SUPER_ADMIN', label: 'Super-admin' }] : []),
              ]} />
            </Form.Item>
            <Form.Item name="active" label="Actif" valuePropName="checked"
              extra={isSelf ? 'Vous ne pouvez pas vous désactiver' : ''}>
              <Switch disabled={isSelf} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </>
  );
}
