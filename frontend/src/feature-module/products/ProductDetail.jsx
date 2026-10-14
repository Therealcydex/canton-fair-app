import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, App, Button, Descriptions, Empty, Image, Popconfirm, Select, Space, Spin, Upload } from 'antd';
import { API_BASE_URL, fileUrl } from '../../config/config';
import { apiError } from '../../utils/apiError';
import { formatPrice } from '../../utils/format';
import { companyLabel } from '../../utils/lists';
import FormModal from '../../components/FormModal';
import ProductFormFields, { productPayload } from './ProductFormFields';

const ACCEPTED = 'image/jpeg,image/png,image/webp';
const MAX_MB = 8;

export default function ProductDetail() {
  const { id } = useParams();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sharing, setSharing] = useState(false);

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

  // The multi-select sends the whole list; the server replaces it in one transaction.
  const setShares = async (companyIds) => {
    setSharing(true);
    await call(() => axios.put(`${API_BASE_URL}/products/${id}/shares`, { company_ids: companyIds }), 'Partage enregistré', 'Erreur lors du partage');
    setSharing(false);
  };

  if (loadError) return <Alert type="error" message={loadError} showIcon action={<Link to="/produits">Retour</Link>} />;
  if (!product) return <div className="text-center py-5"><Spin /></div>;

  return (
    <>
      <Link to="/produits">← Produits</Link>
      <Space className="my-2 w-100 justify-content-between" wrap>
        <h1 className="h4 m-0">{product.name}</h1>
        <Space wrap>
          <Button onClick={() => setEditing(true)}>Modifier</Button>
          <Popconfirm title="Supprimer ce produit ?" description="Ses photos et ses partages seront supprimés."
            okText="Supprimer" cancelText="Annuler" onConfirm={remove}>
            <Button danger>Supprimer</Button>
          </Popconfirm>
        </Space>
      </Space>

      <Descriptions bordered size="small" column={{ xs: 1, sm: 1, md: 2 }} className="mb-3">
        <Descriptions.Item label="Prix">{formatPrice(product.price)}{product.unit ? ` / ${product.unit}` : ''}</Descriptions.Item>
        <Descriptions.Item label="MOQ">{product.moq ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="Expédition">{product.shipping_type ? `${product.shipping_type} — ${product.shipping_name}` : '—'}</Descriptions.Item>
        <Descriptions.Item label="Référence fournisseur">{product.supplier_ref || '—'}</Descriptions.Item>
        <Descriptions.Item label="Fournisseur" span="filled">
          {product.supplier_id ? <Link to={`/fournisseurs/${product.supplier_id}`}>{product.supplier_name}</Link> : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Description" span="filled">
          <span style={{ whiteSpace: 'pre-wrap' }}>{product.description || '—'}</span>
        </Descriptions.Item>
      </Descriptions>

      <h2 className="h5">Partagé avec</h2>
      <p className="text-muted small mb-2">Les sociétés du groupe à qui ce produit est destiné.</p>
      <Select mode="multiple" allowClear placeholder="Aucune société" style={{ width: '100%', maxWidth: 520 }}
        className="mb-4" loading={sharing} disabled={sharing} optionFilterProp="label"
        value={product.shares.map((s) => s.company_id)} onChange={setShares}
        options={companies.map((c) => ({ value: c.id, label: companyLabel(c) }))} />

      <Space className="mb-2" align="center" wrap>
        <h2 className="h5 m-0">Photos ({product.images.length})</h2>
        <Upload accept={ACCEPTED} multiple showUploadList={false}
          beforeUpload={(file, fileList) => {
            // Called once per file: send the whole selection once, on its last file.
            if (file === fileList[fileList.length - 1]) upload(fileList);
            return false;
          }}>
          <Button loading={uploading}>Ajouter des photos</Button>
        </Upload>
      </Space>
      {product.images.length === 0 ? <Empty description="Aucune photo" className="mb-3" /> : (
        <Image.PreviewGroup>
          <Space wrap className="mb-3">
            {product.images.map((img) => (
              <div key={img.id} className="text-center">
                <Image src={fileUrl(img.image_url)} width={140} height={140} style={{ objectFit: 'cover' }} />
                <div>
                  <Popconfirm title="Supprimer cette photo ?" okText="Supprimer" cancelText="Annuler"
                    onConfirm={() => call(() => axios.delete(`${API_BASE_URL}/products/${id}/images/${img.id}`), 'Photo supprimée', 'Erreur lors de la suppression')}>
                    <Button size="small" type="link" danger>Supprimer</Button>
                  </Popconfirm>
                </div>
              </div>
            ))}
          </Space>
        </Image.PreviewGroup>
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
