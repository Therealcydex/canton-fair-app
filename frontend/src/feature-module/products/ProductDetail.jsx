import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, App, Button, Descriptions, Empty, Image, Popconfirm, Select, Space, Spin, Tag, Upload } from 'antd';
import { API_BASE_URL, fileUrl } from '../../config/config';
import { useAuth } from '../../context/AuthContext';
import { apiError } from '../../utils/apiError';
import { formatPrice } from '../../utils/format';
import FormModal from '../../components/FormModal';
import ProductFormFields, { productPayload } from './ProductFormFields';

const ACCEPTED = 'image/jpeg,image/png,image/webp';
const MAX_MB = 8;

export default function ProductDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [shareTo, setShareTo] = useState();

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const { data } = await axios.get(`${API_BASE_URL}/products/${id}`);
      setProduct(data.data);
    } catch (err) {
      setLoadError(apiError(err, 'Erreur lors du chargement du produit'));
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    axios.get(`${API_BASE_URL}/companies`).then((r) => setCompanies(r.data.data)).catch(() => {});
  }, []);

  const call = async (request, success, fallback) => {
    try {
      await request();
      if (success) message.success(success);
      await load();
      return true;
    } catch (err) {
      message.error(apiError(err, fallback));
      return false;
    }
  };

  const remove = async () => {
    try {
      await axios.delete(`${API_BASE_URL}/products/${id}`);
      message.success('Produit supprimé');
      navigate('/produits');
    } catch (err) {
      message.error(apiError(err, 'Erreur lors de la suppression'));
    }
  };

  // Sends the selected photos in one request; the server checks type, size and count.
  const upload = async (files) => {
    const tooBig = files.find((f) => f.size > MAX_MB * 1024 * 1024);
    if (tooBig) return message.error(`« ${tooBig.name} » dépasse ${MAX_MB} Mo`);
    const form = new FormData();
    files.forEach((f) => form.append('images', f));
    setUploading(true);
    await call(() => axios.post(`${API_BASE_URL}/products/${id}/images`, form), 'Photos ajoutées', "Erreur lors de l'envoi des photos");
    setUploading(false);
  };

  if (loadError) return <Alert type="error" message={loadError} showIcon action={<Link to="/produits">Retour</Link>} />;
  if (!product) return <div className="text-center py-5"><Spin /></div>;

  const own = product.own;
  const shareable = companies.filter((c) => c.id !== user.company_id && !(product.shares || []).some((s) => s.company_id === c.id));

  return (
    <>
      <Link to={own ? '/produits' : '/produits?vue=partages'}>← Produits</Link>
      <Space className="my-2 w-100 justify-content-between" wrap>
        <h1 className="h4 m-0">{product.name}</h1>
        {own && (
          <Space wrap>
            <Button onClick={() => setEditing(true)}>Modifier</Button>
            <Popconfirm title="Supprimer ce produit ?" description="Ses photos et ses partages seront supprimés."
              okText="Supprimer" cancelText="Annuler"
              onConfirm={remove}>
              <Button danger>Supprimer</Button>
            </Popconfirm>
          </Space>
        )}
      </Space>
      {!own && (
        <Alert type="info" showIcon className="mb-3"
          message={`Produit partagé par ${product.owner_company_name} : lecture seule.`} />
      )}

      <Descriptions bordered size="small" column={{ xs: 1, sm: 1, md: 2 }} className="mb-3">
        <Descriptions.Item label="Prix">{formatPrice(product.price_tnd)}{product.unit ? ` / ${product.unit}` : ''}</Descriptions.Item>
        <Descriptions.Item label="MOQ">{product.moq ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="Incoterm">{product.incoterm || '—'}</Descriptions.Item>
        <Descriptions.Item label="Référence fournisseur">{product.supplier_ref || '—'}</Descriptions.Item>
        <Descriptions.Item label="Fournisseur">
          {own ? <Link to={`/fournisseurs/${product.supplier_id}`}>{product.supplier_name}</Link> : product.supplier_name}
        </Descriptions.Item>
        <Descriptions.Item label="Stand">
          {product.booth_id
            ? (own ? <Link to={`/stands/${product.booth_id}`}>{product.booth_location}</Link> : product.booth_location)
            : '—'}
          {product.booth_phase ? ` · phase ${product.booth_phase}` : ''}
        </Descriptions.Item>
        <Descriptions.Item label="Catégorie">{product.category_name || '—'}</Descriptions.Item>
        <Descriptions.Item label="Saisi par">{product.created_by_name}</Descriptions.Item>
        <Descriptions.Item label="Description" span="filled">
          <span style={{ whiteSpace: 'pre-wrap' }}>{product.description || '—'}</span>
        </Descriptions.Item>
      </Descriptions>

      <Space className="mb-2" align="center" wrap>
        <h2 className="h5 m-0">Photos ({product.images.length})</h2>
        {own && (
          <Upload accept={ACCEPTED} multiple showUploadList={false}
            beforeUpload={(file, fileList) => {
              // Called once per file: send the whole selection once, on its last file.
              if (file === fileList[fileList.length - 1]) upload(fileList);
              return false;
            }}>
            <Button loading={uploading}>Ajouter des photos</Button>
          </Upload>
        )}
      </Space>
      {product.images.length === 0 ? <Empty description="Aucune photo" className="mb-3" /> : (
        <Image.PreviewGroup>
          <Space wrap className="mb-3">
            {product.images.map((img) => (
              <div key={img.id} className="text-center">
                <Image src={fileUrl(img.image_url)} width={140} height={140} style={{ objectFit: 'cover' }} />
                {own && (
                  <div>
                    <Popconfirm title="Supprimer cette photo ?" okText="Supprimer" cancelText="Annuler"
                      onConfirm={() => call(() => axios.delete(`${API_BASE_URL}/products/${id}/images/${img.id}`), 'Photo supprimée', 'Erreur lors de la suppression')}>
                      <Button size="small" type="link" danger>Supprimer</Button>
                    </Popconfirm>
                  </div>
                )}
              </div>
            ))}
          </Space>
        </Image.PreviewGroup>
      )}

      {own && (
        <>
          <h2 className="h5">Partage</h2>
          <p className="text-muted small mb-2">Les sociétés choisies voient ce produit en lecture seule.</p>
          <Space wrap className="mb-2">
            {(product.shares || []).length === 0 && <span className="text-muted">Non partagé</span>}
            {(product.shares || []).map((s) => (
              <Tag key={s.company_id} color="purple" closable
                onClose={(e) => {
                  e.preventDefault();
                  call(() => axios.delete(`${API_BASE_URL}/products/${id}/shares/${s.company_id}`), 'Partage retiré', 'Erreur lors du retrait du partage');
                }}>
                {s.company_name}
              </Tag>
            ))}
          </Space>
          <Space wrap>
            <Select placeholder="Partager avec…" style={{ width: 240 }} value={shareTo} onChange={setShareTo}
              options={shareable.map((c) => ({ value: c.id, label: c.name }))}
              notFoundContent="Aucune autre société" />
            <Button type="primary" disabled={!shareTo}
              onClick={async () => {
                if (await call(() => axios.post(`${API_BASE_URL}/products/${id}/shares`, { company_id: shareTo }), 'Produit partagé', 'Erreur lors du partage')) {
                  setShareTo(undefined);
                }
              }}>
              Partager
            </Button>
          </Space>
        </>
      )}

      <FormModal open={editing} title="Modifier le produit" width={720} initialValues={product}
        onCancel={() => setEditing(false)}
        onSubmit={(values) => axios.put(`${API_BASE_URL}/products/${id}`, productPayload(values))}
        onSaved={() => { setEditing(false); message.success('Produit modifié'); load(); }}>
        <ProductFormFields />
      </FormModal>
    </>
  );
}
