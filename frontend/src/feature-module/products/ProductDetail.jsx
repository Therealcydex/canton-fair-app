import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, App, Button, Col, Image, Input, Popconfirm, Row, Select, Spin, Tag, Upload } from 'antd';
import {
  BankOutlined, CheckCircleOutlined, DeleteOutlined, EditOutlined, EnvironmentOutlined, FileTextOutlined, HistoryOutlined,
  InboxOutlined, PictureOutlined, PlusOutlined, ShareAltOutlined, SolutionOutlined,
} from '@ant-design/icons';
import { API_BASE_URL, fileUrl } from '../../config/config';
import { apiError } from '../../utils/apiError';
import { boothLabel, formatPrice } from '../../utils/format';
import { companyLabel } from '../../utils/lists';
import { useAuth } from '../../context/AuthContext';
import { isAdmin } from '../../utils/access';
import { STATUS, formatDateTime } from '../../utils/decision';
import FormModal from '../../components/FormModal';
import ProductFormFields, { productPayload } from './ProductFormFields';

const ACCEPTED = 'image/jpeg,image/png,image/webp';
const MAX_MB = 8;
// The decisions in the order of the Stitch switch; "À étudier" puts the product back in the review.
const CHOICES = ['A_ETUDIER', 'RETENU', 'ECHANTILLON', 'A_COMMANDER', 'REJETE'];

function Panel({ icon, title, extra, children, className = '' }) {
  return (
    <section className={`sc-panel p-3 mb-3 ${className}`} style={{ height: 'auto' }}>
      <div className="sc-panel-head rounded mb-3 align-items-center">
        <span className="sc-panel-icon fs-5 m-0">{icon}</span>
        <h2 className="flex-grow-1">{title}</h2>
        {extra}
      </div>
      {children}
    </section>
  );
}

// D38: the admin's decision on the product, with a note for the buyers. Everyone else reads it.
function DecisionPanel({ product, onDecide }) {
  const { user } = useAuth();
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(null);
  const s = STATUS[product.status] || { label: product.status };
  const decide = async (status) => {
    setSaving(status);
    if (await onDecide(status, note.trim() || null)) setNote('');
    setSaving(null);
  };
  return (
    <Panel icon={<SolutionOutlined />} title="Décision" extra={<span className="sc-label">Revue du soir</span>}>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <span>Statut :</span>
        <Tag color={s.color} className="m-0">{s.label}</Tag>
      </div>
      {product.decision_note && (
        <div className="booth-comment mb-3">
          <div className="sc-label mb-1">Note de l'administrateur</div>
          <em>« {product.decision_note} »</em>
        </div>
      )}
      {isAdmin(user) ? (
        <>
          <Input.TextArea rows={2} maxLength={500} showCount placeholder="Note pour l'acheteur (facultatif), envoyée avec la décision"
            value={note} onChange={(e) => setNote(e.target.value)} className="mb-3" />
          <div className="sc-label mb-1">Mettre à jour la décision :</div>
          <div className="decision-switch">
            {CHOICES.map((d) => (
              <button key={d} type="button" disabled={!!saving}
                className={`decision-choice ${d === product.status ? `active decision-${d}` : ''}`} onClick={() => decide(d)}>
                {saving === d ? '…' : STATUS[d].label}
              </button>
            ))}
          </div>
        </>
      ) : product.status === 'A_ETUDIER' && (
        <p className="text-secondary small mb-0">En attente de la décision de l'administrateur (revue du soir).</p>
      )}
    </Panel>
  );
}

// A product (BF10-BF14), laid out like the Stitch "Fiche Produit" screen (D49): photos, commercial
// information, decision (D38), who recorded and decided it, and the companies it is shared with.
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
  const [photo, setPhoto] = useState(0); // the photo shown large

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

  const decide = (status, note) => call(
    () => axios.put(`${API_BASE_URL}/products/${id}/decision`, { status, note }),
    `Décision enregistrée : ${STATUS[status].label}`, "Erreur lors de l'enregistrement de la décision");

  if (loadError) return <Alert type="error" message={loadError} showIcon action={<Link to="/produits">Retour</Link>} />;
  if (!product) return <div className="text-center py-5"><Spin /></div>;

  const s = STATUS[product.status] || { label: product.status };
  const images = product.images;
  const current = images[Math.min(photo, images.length - 1)];
  const facts = [product.shipping_type, product.moq != null && `MOQ ${product.moq}`].filter(Boolean).join(' · ');

  const dropZone = (
    <Upload.Dragger accept={ACCEPTED} multiple showUploadList={false} disabled={uploading} className="photo-drop"
      beforeUpload={(file, fileList) => {
        // Called once per file: send the whole selection once, on its last file.
        if (file === fileList[fileList.length - 1]) upload(fileList);
        return false;
      }}>
      <PlusOutlined className="fs-5 text-secondary" />
      <div className="fw-semibold small">{uploading ? 'Envoi…' : 'Glisser / déposer'}</div>
      <div className="sc-label">JPG, PNG, WebP · {MAX_MB} Mo max</div>
    </Upload.Dragger>
  );

  return (
    <>
      <nav className="booth-crumb">
        <Link to="/produits"><InboxOutlined /> Produits</Link>
        <span className="mx-2 text-secondary">/</span>
        <strong>{product.name}</strong>
        {product.supplier_ref && <span className="page-chip ms-2">{product.supplier_ref}</span>}
      </nav>

      <div className="page-header">
        <div>
          <h1 className="page-title">
            {product.name}
            <Tag color={s.color} className="m-0">{s.label}</Tag>
            {facts && <Tag className="m-0 fw-normal">{facts}</Tag>}
          </h1>
          <div className="page-subtitle d-flex flex-wrap gap-3">
            {product.supplier_id && <Link to={`/fournisseurs/${product.supplier_id}`} className="text-secondary"><BankOutlined /> {product.supplier_name}</Link>}
            {product.booth_id && <Link to={`/booths/${product.booth_id}`}><EnvironmentOutlined /> Booth {boothLabel(product.booth_phase, product.booth_code)}</Link>}
            {product.supplier_ref && <span>Réf. fournisseur : {product.supplier_ref}</span>}
          </div>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Button type="primary" icon={<EditOutlined />} onClick={() => setEditing(true)}>Modifier</Button>
          <Popconfirm title="Supprimer ce produit ?" description="Ses photos et ses partages seront supprimés."
            okText="Supprimer" okButtonProps={{ danger: true }} cancelText="Annuler" onConfirm={remove}>
            <Button danger icon={<DeleteOutlined />} aria-label="Supprimer le produit" title="Supprimer" />
          </Popconfirm>
        </div>
      </div>

      {product.status !== 'A_ETUDIER' && product.decision_note && (
        <div className={`decision-banner decision-${product.status}`}>
          <CheckCircleOutlined className="fs-5" />
          <span className="flex-grow-1"><strong>{s.label}</strong> : {product.decision_note}</span>
          {product.decided_at && <span className="sc-label">{product.decided_by_name || '—'} · {formatDateTime(product.decided_at)}</span>}
        </div>
      )}

      <Row gutter={[16, 0]}>
        <Col xs={24} xl={14}>
          <Panel icon={<PictureOutlined />} title="Photos" extra={<span className="small text-secondary">{images.length} photo{images.length > 1 ? 's' : ''}</span>}>
            {current ? (
              <Image.PreviewGroup items={images.map((img) => fileUrl(img.image_url))}>
                <div className="photo-main mb-3">
                  <Image src={fileUrl(current.image_url)} width="100%" height="100%" style={{ objectFit: 'contain' }} />
                </div>
              </Image.PreviewGroup>
            ) : (
              <div className="photo-main photo-main-empty mb-3">
                <PictureOutlined className="fs-1" />
                <span>Aucune photo : ajoutez celles prises au booth</span>
              </div>
            )}
            <div className="photo-strip">
              {images.map((img, i) => (
                <div key={img.id} className={`photo-thumb ${img === current ? 'active' : ''}`}>
                  <button type="button" className="photo-thumb-btn" onClick={() => setPhoto(i)} aria-label={`Afficher la photo ${i + 1}`}>
                    <img src={fileUrl(img.image_url)} alt="" />
                  </button>
                  <Popconfirm title="Supprimer cette photo ?" okText="Supprimer" okButtonProps={{ danger: true }} cancelText="Annuler"
                    onConfirm={() => call(() => axios.delete(`${API_BASE_URL}/products/${id}/images/${img.id}`), 'Photo supprimée', 'Erreur lors de la suppression')}>
                    <button type="button" className="qr-drop-remove" aria-label="Supprimer la photo">×</button>
                  </Popconfirm>
                </div>
              ))}
              {dropZone}
            </div>
          </Panel>
          <Panel icon={<FileTextOutlined />} title="Description">
            <div className="booth-comment">{product.description || <span className="text-secondary">Aucune description.</span>}</div>
          </Panel>
        </Col>

        <Col xs={24} xl={10}>
          <Panel icon={<FileTextOutlined />} title="Informations commerciales" extra={<span className="page-chip">Cotation booth</span>}>
            <dl className="info-list">
              <dt>Fournisseur</dt>
              <dd>{product.supplier_id ? <Link to={`/fournisseurs/${product.supplier_id}`} className="fw-semibold">{product.supplier_name}</Link> : '—'}</dd>
              <dt>Booth</dt>
              <dd>{product.booth_id ? <Link to={`/booths/${product.booth_id}`}><Tag color="blue" className="m-0"><EnvironmentOutlined /> Booth {boothLabel(product.booth_phase, product.booth_code)}</Tag></Link> : '—'}</dd>
            </dl>
            <div className="info-price">
              <span>Prix<div className="sc-label">{product.shipping_type ? `Base ${product.shipping_type}` : 'Sans incoterm'}</div></span>
              <span><span className="info-price-value">{formatPrice(product.price)}</span>{product.price != null && product.unit ? <small> / {product.unit}</small> : ''}</span>
            </div>
            <dl className="info-list">
              <dt>Incoterm</dt>
              <dd>{product.shipping_type ? <Tag color="blue" className="m-0">{product.shipping_type}</Tag> : '—'}{product.shipping_name ? <span className="small text-secondary ms-2">{product.shipping_name}</span> : ''}</dd>
              <dt>Quantité min. (MOQ)</dt>
              <dd className="fw-semibold">{product.moq ?? '—'}</dd>
              <dt>Réf. fournisseur</dt>
              <dd>{product.supplier_ref || '—'}</dd>
            </dl>
          </Panel>

          <DecisionPanel product={product} onDecide={decide} />

          <Panel icon={<HistoryOutlined />} title="Traçabilité">
            <ul className="trace">
              <li>
                <span className="trace-dot"><EditOutlined /></span>
                <div>
                  <div className="fw-semibold">Saisi par {product.created_by_name || '—'}</div>
                  <div className="small text-secondary">Le {formatDateTime(product.created_at)}</div>
                </div>
              </li>
              {product.decided_at && (
                <li>
                  <span className="trace-dot trace-dot-done"><CheckCircleOutlined /></span>
                  <div>
                    <div className="fw-semibold">Décidé par {product.decided_by_name || '—'}</div>
                    <div className="small text-secondary">Le {formatDateTime(product.decided_at)} · {s.label}</div>
                  </div>
                </li>
              )}
            </ul>
          </Panel>

          <Panel icon={<ShareAltOutlined />} title="Partage avec les sociétés du groupe">
            <p className="small text-secondary mb-2">Les sociétés du groupe à qui ce produit est destiné.</p>
            <div className="d-flex flex-wrap gap-2 mb-3">
              {product.shares.length === 0 && <span className="small text-secondary">Aucune société pour l'instant.</span>}
              {product.shares.map((sh) => (
                <Tag key={sh.company_id} className="m-0 py-1 px-2">
                  <span className="share-dot rounded-circle" style={{ background: 'var(--sc-primary)' }} />
                  {companyLabel({ name: sh.company_name, branch: sh.company_branch })}
                </Tag>
              ))}
            </div>
            <div className="sc-label mb-1">Modifier les partages</div>
            <Select mode="multiple" allowClear placeholder="Aucune société" style={{ width: '100%' }}
              loading={sharing} disabled={sharing} optionFilterProp="label"
              value={product.shares.map((sh) => sh.company_id)} onChange={setShares}
              options={companies.map((c) => ({ value: c.id, label: companyLabel(c) }))} />
          </Panel>
        </Col>
      </Row>

      <FormModal open={editing} title="Modifier le produit" width={720} initialValues={product}
        icon={<EditOutlined />} className="sc-modal-dark"
        onCancel={() => setEditing(false)}
        onSubmit={(values) => axios.put(`${API_BASE_URL}/products/${id}`, productPayload(values))}
        onSaved={() => { setEditing(false); message.success('Produit modifié'); load(); }}>
        <ProductFormFields />
      </FormModal>
    </>
  );
}
