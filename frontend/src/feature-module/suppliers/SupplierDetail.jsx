import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, App, Button, Descriptions, Popconfirm, Rate, Space, Spin, Tabs } from 'antd';
import { API_BASE_URL } from '../../config/config';
import { apiError } from '../../utils/apiError';
import FormModal from '../../components/FormModal';
import SupplierFormFields from './SupplierFormFields';
import BoothList from '../booths/BoothList';
import ProductList from '../products/ProductList';

// antd's Rate gives 0 when cleared and a cleared Select gives undefined; the API expects null.
export const supplierPayload = (values) => ({ ...values, rating: values.rating || null, province_id: values.province_id ?? null });

export default function SupplierDetail() {
  const { id } = useParams();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const { data } = await axios.get(`${API_BASE_URL}/suppliers/${id}`);
      setSupplier(data.data);
    } catch (err) {
      setLoadError(apiError(err, 'Erreur lors du chargement du fournisseur'));
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const remove = async () => {
    try {
      await axios.delete(`${API_BASE_URL}/suppliers/${id}`);
      message.success('Fournisseur supprimé');
      navigate('/fournisseurs');
    } catch (err) {
      message.error(apiError(err, 'Erreur lors de la suppression'));
    }
  };

  if (loadError) return <Alert type="error" message={loadError} showIcon action={<Link to="/fournisseurs">Retour</Link>} />;
  if (!supplier) return <div className="text-center py-5"><Spin /></div>;

  const tabs = [
    {
      key: 'booths',
      label: 'Stands',
      children: <BoothList supplierId={supplier.id} hideSupplier />,
    },
    {
      key: 'products',
      label: 'Produits',
      children: <ProductList supplierId={supplier.id} />,
    },
  ];

  return (
    <>
      <Link to="/fournisseurs">← Fournisseurs</Link>
      <Space className="my-2 w-100 justify-content-between" wrap>
        <h1 className="h4 m-0">{supplier.name}</h1>
        <Space wrap>
          {/* Contacts are managed on the Contacts page, filtered on this supplier. */}
          <Link to={`/contacts?supplier_id=${supplier.id}`}>
            <Button>Contacts ({supplier.contacts.length})</Button>
          </Link>
          <Button onClick={() => setEditing(true)}>Modifier</Button>
          <Popconfirm title="Supprimer ce fournisseur ?"
            description="Ses contacts, ses produits et leurs photos seront supprimés ; ses stands restent, sans fournisseur."
            okText="Supprimer" cancelText="Annuler" onConfirm={remove}>
            <Button danger>Supprimer</Button>
          </Popconfirm>
        </Space>
      </Space>

      <Descriptions bordered size="small" column={{ xs: 1, sm: 1, md: 2 }} className="mb-3">
        <Descriptions.Item label="Province">{supplier.province || '—'}</Descriptions.Item>
        <Descriptions.Item label="Stands visités">{supplier.nbr_booths ? `${supplier.booth_visit_pct} % de ${supplier.nbr_booths} stand(s)` : 'Aucun stand'}</Descriptions.Item>
        <Descriptions.Item label="Note">{supplier.rating ? <Rate disabled value={supplier.rating} /> : '—'}</Descriptions.Item>
        <Descriptions.Item label="Téléphone">{supplier.phone || '—'}</Descriptions.Item>
        <Descriptions.Item label="E-mail">{supplier.email || '—'}</Descriptions.Item>
        <Descriptions.Item label="Site web">
          {supplier.website
            ? <a href={/^https?:\/\//i.test(supplier.website) ? supplier.website : `https://${supplier.website}`} target="_blank" rel="noreferrer">{supplier.website}</a>
            : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Adresse">{supplier.address || '—'}</Descriptions.Item>
        <Descriptions.Item label="Notes" span="filled"><span style={{ whiteSpace: 'pre-wrap' }}>{supplier.notes || '—'}</span></Descriptions.Item>
      </Descriptions>

      <Tabs items={tabs} />

      <FormModal open={editing} title="Modifier le fournisseur" width={640} initialValues={supplier}
        onCancel={() => setEditing(false)}
        onSubmit={(values) => axios.put(`${API_BASE_URL}/suppliers/${id}`, supplierPayload(values))}
        onSaved={() => { setEditing(false); message.success('Fournisseur modifié'); load(); }}>
        <SupplierFormFields />
      </FormModal>

    </>
  );
}
