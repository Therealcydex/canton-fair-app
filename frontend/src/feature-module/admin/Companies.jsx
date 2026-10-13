import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Alert, App, Button, Form, Input, Modal, Popconfirm, Space, Table } from 'antd';
import { API_BASE_URL } from '../../config/config';
import { apiError } from '../../utils/apiError';

export default function Companies() {
  const { message } = App.useApp();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data } = await axios.get(`${API_BASE_URL}/companies`);
      setCompanies(data.data);
    } catch (err) {
      setLoadError(apiError(err, 'Erreur lors du chargement des sociétés'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const open = (c) => {
    setFormError(null);
    setEditing(c || {});
    form.setFieldsValue({ name: c?.name || '' });
  };

  const save = async () => {
    const values = await form.validateFields();
    setSaving(true);
    setFormError(null);
    try {
      if (editing.id) await axios.put(`${API_BASE_URL}/companies/${editing.id}`, values);
      else await axios.post(`${API_BASE_URL}/companies`, values);
      message.success(editing.id ? 'Société renommée' : 'Société créée');
      setEditing(null);
      load();
    } catch (err) {
      setFormError(apiError(err, "Erreur lors de l'enregistrement"));
    } finally {
      setSaving(false);
    }
  };

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
    { title: 'Nom', dataIndex: 'name' },
    {
      title: '', key: 'actions', width: 200,
      render: (_, c) => (
        <Space>
          <Button size="small" onClick={() => open(c)}>Renommer</Button>
          <Popconfirm title="Supprimer cette société ?"
            description="Refusé si elle a encore des utilisateurs ou des fournisseurs."
            okText="Supprimer" cancelText="Annuler" onConfirm={() => remove(c)}>
            <Button size="small" danger>Supprimer</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Space className="mb-3 w-100 justify-content-between" wrap>
        <h1 className="h4 m-0">Sociétés</h1>
        <Button type="primary" onClick={() => open(null)}>Nouvelle société</Button>
      </Space>
      {loadError && <Alert type="error" message={loadError} showIcon className="mb-3" />}
      <Table rowKey="id" columns={columns} dataSource={companies} loading={loading} size="middle" pagination={false} />

      <Modal open={!!editing} title={editing?.id ? 'Renommer la société' : 'Nouvelle société'}
        onCancel={() => setEditing(null)} onOk={save} okText="Enregistrer" cancelText="Annuler"
        confirmLoading={saving} destroyOnClose>
        {formError && <Alert type="error" message={formError} showIcon className="mb-3" />}
        <Form form={form} layout="vertical" requiredMark={false} onFinish={save}>
          <Form.Item name="name" label="Nom" rules={[{ required: true, whitespace: true, message: 'Le nom est obligatoire' }]}>
            <Input maxLength={100} autoFocus />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
