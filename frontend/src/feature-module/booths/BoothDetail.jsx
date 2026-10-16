import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, App, Button, Descriptions, Popconfirm, Space, Spin, Tag } from 'antd';
import { API_BASE_URL } from '../../config/config';
import { apiError } from '../../utils/apiError';
import { categoryPath, useList } from '../../utils/lists';
import FormModal from '../../components/FormModal';
import BoothFormFields, { boothPayload } from './BoothFormFields';

export default function BoothDetail() {
  const { id } = useParams();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const categories = useList('canton-categories');
  const [booth, setBooth] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const { data } = await axios.get(`${API_BASE_URL}/booths/${id}`);
      setBooth(data.data);
    } catch (err) {
      setLoadError(apiError(err, 'Erreur lors du chargement du booth'));
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const remove = async () => {
    try {
      await axios.delete(`${API_BASE_URL}/booths/${id}`);
      message.success('Booth supprimé');
      navigate('/booths');
    } catch (err) {
      message.error(apiError(err, 'Erreur lors de la suppression'));
    }
  };

  const setVisited = async (visited) => {
    try {
      await axios.patch(`${API_BASE_URL}/booths/${id}/visited`, { visited });
      message.success(visited ? 'Booth marqué visité' : 'Booth remis à visiter');
      load();
    } catch (err) {
      message.error(apiError(err, "Erreur lors de l'enregistrement"));
    }
  };

  if (loadError) return <Alert type="error" message={loadError} showIcon action={<Link to="/booths">Retour</Link>} />;
  if (!booth) return <div className="text-center py-5"><Spin /></div>;

  return (
    <>
      <Link to="/booths">← Booths</Link>
      <Space className="my-2 w-100 justify-content-between" wrap>
        <h1 className="h4 m-0">
          Booth {booth.booth_code}{booth.zone && <Tag className="ms-2">Zone {booth.zone}</Tag>}{' '}
          {booth.visited ? <Tag color="green" className="ms-2">Visité</Tag> : <Tag color="orange" className="ms-2">À visiter</Tag>}
        </h1>
        <Space wrap>
          {booth.visited
            ? <Button onClick={() => setVisited(false)}>Remettre à visiter</Button>
            : <Button type="primary" onClick={() => setVisited(true)}>Marquer visité</Button>}
          <Button onClick={() => setEditing(true)}>Modifier</Button>
          <Popconfirm title="Supprimer ce booth ?" okText="Supprimer" cancelText="Annuler" onConfirm={remove}>
            <Button danger>Supprimer</Button>
          </Popconfirm>
        </Space>
      </Space>

      <Descriptions bordered size="small" column={{ xs: 1, sm: 1, md: 2 }} className="mb-3">
        <Descriptions.Item label="Fournisseur">
          {booth.supplier_id ? <Link to={`/fournisseurs/${booth.supplier_id}`}>{booth.supplier_name}</Link> : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Catégorie">
          {booth.sub_category ? `${booth.category} › ${booth.section} › ${booth.sub_category}` : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Phase">{booth.phase}</Descriptions.Item>
        <Descriptions.Item label="Hall / étage / lettre">{booth.hall} / {booth.floor} / {booth.letter || '—'}</Descriptions.Item>
        <Descriptions.Item label="Numéros">
          {booth.num_start === null ? '—' : booth.num_end ? `${booth.num_start} à ${booth.num_end}` : booth.num_start}
        </Descriptions.Item>
        <Descriptions.Item label="Commentaire" span="filled"><span style={{ whiteSpace: 'pre-wrap' }}>{booth.comment || '—'}</span></Descriptions.Item>
      </Descriptions>

      <FormModal open={editing} title="Modifier le booth" width={640}
        initialValues={{ ...booth, visited: !!booth.visited, category_path: categoryPath(categories, booth.category_id) }}
        onCancel={() => setEditing(false)}
        onSubmit={(values) => axios.put(`${API_BASE_URL}/booths/${id}`, boothPayload(values))}
        onSaved={() => { setEditing(false); message.success('Booth modifié'); load(); }}>
        <BoothFormFields />
      </FormModal>
    </>
  );
}
