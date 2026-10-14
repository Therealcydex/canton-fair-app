import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Alert, App, Button, Empty, Form, Input, Popconfirm, Space, Spin, Tree, TreeSelect } from 'antd';
import { API_BASE_URL } from '../../config/config';
import { apiError } from '../../utils/apiError';
import { categoryTree } from '../../utils/format';
import FormModal from '../../components/FormModal';

// Global category tree (D3), edited by the super-admin only. Limits (4 levels, no move under
// a sub-category, no delete while used) are enforced by the server, which explains refusals.
export default function Categories() {
  const { message } = App.useApp();
  const [flat, setFlat] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null); // { id?, name, parent_id }

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data } = await axios.get(`${API_BASE_URL}/categories`);
      setFlat(data.data);
    } catch (err) {
      setLoadError(apiError(err, 'Erreur lors du chargement des catégories'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const tree = useMemo(() => categoryTree(flat), [flat]);
  const current = flat.find((c) => c.id === selected);

  const remove = async () => {
    try {
      await axios.delete(`${API_BASE_URL}/categories/${current.id}`);
      message.success('Catégorie supprimée');
      setSelected(null);
      load();
    } catch (err) {
      message.error(apiError(err, 'Erreur lors de la suppression'));
    }
  };

  return (
    <>
      <h1 className="h4 mb-3">Catégories</h1>
      {loadError && <Alert type="error" message={loadError} showIcon className="mb-3" />}
      <Space className="mb-3" wrap>
        <Button type="primary" onClick={() => setEditing({ name: '', parent_id: null })}>Nouvelle catégorie</Button>
        <Button disabled={!current} onClick={() => setEditing({ name: '', parent_id: current.id })}>Ajouter une sous-catégorie</Button>
        <Button disabled={!current} onClick={() => setEditing({ id: current.id, name: current.name, parent_id: current.parent_id })}>
          Renommer / déplacer
        </Button>
        <Popconfirm title="Supprimer cette catégorie ?" description="Refusé si elle a des sous-catégories ou des stands."
          okText="Supprimer" cancelText="Annuler" onConfirm={remove} disabled={!current}>
          <Button danger disabled={!current}>Supprimer</Button>
        </Popconfirm>
      </Space>
      {!current && <p className="text-muted small">Sélectionnez une catégorie pour la modifier.</p>}
      {loading ? <Spin /> : tree.length === 0 ? <Empty description="Aucune catégorie" /> : (
        <Tree treeData={tree} defaultExpandAll blockNode selectedKeys={selected ? [selected] : []}
          onSelect={(keys) => setSelected(keys[0] ?? null)} />
      )}

      <FormModal open={!!editing} title={editing?.id ? 'Renommer / déplacer' : 'Nouvelle catégorie'}
        initialValues={editing} onCancel={() => setEditing(null)}
        onSubmit={(values) => {
          const body = { name: values.name, parent_id: values.parent_id ?? null };
          return editing.id
            ? axios.put(`${API_BASE_URL}/categories/${editing.id}`, body)
            : axios.post(`${API_BASE_URL}/categories`, body);
        }}
        onSaved={() => { setEditing(null); message.success('Catégorie enregistrée'); load(); }}>
        <Form.Item name="name" label="Nom" rules={[{ required: true, whitespace: true, message: 'Le nom est obligatoire' }]}>
          <Input maxLength={100} />
        </Form.Item>
        <Form.Item name="parent_id" label="Catégorie parente" extra="Vide = catégorie principale. 4 niveaux au maximum.">
          <TreeSelect treeData={tree} allowClear treeDefaultExpandAll placeholder="Aucune (catégorie principale)" />
        </Form.Item>
      </FormModal>
    </>
  );
}
