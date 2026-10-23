import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Alert, Button, Col, Empty, Image, Input, Progress, Row, Segmented, Spin, Tag } from 'antd';
import {
  ArrowRightOutlined, CalendarOutlined, CheckCircleOutlined, CloseCircleOutlined, ExperimentOutlined, EyeOutlined,
  FastForwardOutlined, LeftOutlined, PictureOutlined, RedoOutlined, RightOutlined, ShopOutlined, ShoppingCartOutlined,
  UndoOutlined, UserOutlined,
} from '@ant-design/icons';
import { API_BASE_URL } from '../../config/config';
import ProductThumb from '../../components/ProductThumb';
import { useAuth } from '../../context/AuthContext';
import { isAdmin } from '../../utils/access';
import { apiError } from '../../utils/apiError';
import { DECISIONS, STATUS, formatDateTime } from '../../utils/decision';
import { boothLabel, formatPrice } from '../../utils/format';
import PageHeader from '../../components/PageHeader';

const priceLine = (p) => [
  `${formatPrice(p.price, p.currency)}${p.unit ? ` / ${p.unit}` : ''}`,
  p.moq && `MOQ ${p.moq}`,
  p.shipping_type,
].filter(Boolean).join(' · ');


// D59: the decision buttons of the Stitch design: icon, what the decision means, keyboard key.
const DECISION_UI = {
  RETENU: { icon: <CheckCircleOutlined />, hint: 'Valider pour la sélection', key: '1' },
  ECHANTILLON: { icon: <ExperimentOutlined />, hint: 'Demander un échantillon', key: '2' },
  A_COMMANDER: { icon: <ShoppingCartOutlined />, hint: 'Commande ferme', key: '3' },
  REJETE: { icon: <CloseCircleOutlined />, hint: 'Non retenu / hors cible', key: '4' },
};

// A key typed in a text field is text, not a shortcut.
const typing = (e) => ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable;

// D38: "Revue du soir". The boss (admin) goes through the products recorded by the buyers, one at
// a time, and decides: kept, sample, to order or rejected, with a note. The buyers see the queue
// and the decisions. The server refuses a decision from anyone but the admin.
// D59: laid out after the Stitch screens "Revue du soir - Boss (Desktop / Mobile)", "Décidés"
// and "États": the product on the left and the decision on the right on a computer; on a phone the
// note and the four decisions stay at the bottom of the screen, above the tab bar.
export default function Review() {
  const { user } = useAuth();
  const boss = isAdmin(user);
  const [tab, setTab] = useState('pending');
  const [review, setReview] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data } = await axios.get(`${API_BASE_URL}/products/review`);
      setReview(data.data);
      return data.data;
    } catch (err) {
      setError(apiError(err, 'Erreur lors du chargement de la revue'));
      return null;
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const pending = review ? review.counts.A_ETUDIER ?? 0 : null;
  const decided = review ? Object.entries(review.counts).filter(([s]) => s !== 'A_ETUDIER').reduce((n, [, c]) => n + c, 0) : null;
  const count = (n, active) => <span className={`review-count ${active ? 'is-active' : ''}`}>{n ?? '…'}</span>;

  return (
    <div className={`review ${boss && tab === 'pending' ? 'review-wide' : ''}`}>
      <PageHeader title="Revue du soir" chip="Décisions"
        subtitle={boss ? 'Décidez des produits saisis par les acheteurs, un par un' : "Les produits en attente de la décision de l'administrateur"}
        actions={(
          <Segmented size="large" className="review-tabs" value={tab} onChange={setTab}
            options={[
              { value: 'pending', label: <>À décider {count(pending, tab === 'pending')}</> },
              { value: 'decided', label: <>Décidés {count(decided, tab === 'decided')}</> },
            ]} />
        )} />
      {error && (
        <Alert type="error" showIcon message={error} className="mb-3"
          action={<Button size="small" type="link" onClick={load}>Réessayer</Button>} />
      )}
      {!review && !error && <div className="text-center py-5"><Spin /></div>}
      {review && tab === 'pending' && (boss
        ? <BossQueue review={review} reload={load} decided={decided} onShowDecided={() => setTab('decided')} />
        : <PendingList products={review.pending} />)}
      {review && tab === 'decided' && <DecidedList boss={boss} reload={load} />}
    </div>
  );
}

// The boss's queue: one product at a time, the four decisions, the note, and "Annuler" for the last one.
function BossQueue({ review, reload, decided, onShowDecided }) {
  const [index, setIndex] = useState(0);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [last, setLast] = useState(null); // { product, status }
  const [images, setImages] = useState([]);
  const [shown, setShown] = useState(0);

  const queue = review.pending;
  const product = queue[index];
  const productId = product?.id;

  // A new product on screen: empty note, first photo, and all its photos (the list only has the cover).
  useEffect(() => {
    setNote('');
    setError(null);
    setImages([]);
    setShown(0);
    if (!productId) return undefined;
    let live = true;
    axios.get(`${API_BASE_URL}/products/${productId}`)
      .then((r) => { if (live) setImages(r.data.data.images || []); })
      .catch(() => {}); // the cover from the list is still shown
    return () => { live = false; };
  }, [productId]);

  const send = async (id, status, body, fallback) => {
    setSaving(true);
    setError(null);
    try {
      await axios.put(`${API_BASE_URL}/products/${id}/decision`, { status, ...body });
      return true;
    } catch (err) {
      setError(apiError(err, fallback));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const decide = useCallback(async (status) => {
    if (!product || saving) return;
    if (await send(product.id, status, { note: note.trim() || null }, "La décision n'a pas été enregistrée")) {
      setLast({ product, status });
      await reload(); // the product leaves the queue; the same index now shows the next one
    }
  }, [product, saving, note, reload]);

  const undo = async () => {
    if (!last) return;
    if (await send(last.product.id, 'A_ETUDIER', {}, "La décision n'a pas été annulée")) {
      setLast(null);
      const r = await reload();
      // The queue is oldest first: show the product again at its place.
      setIndex(Math.max(0, r?.pending.findIndex((p) => p.id === last.product.id) ?? 0));
    }
  };

  // On a computer: 1-4 decide, ← and → move through the queue (not while typing the note).
  useEffect(() => {
    const onKey = (e) => {
      if (typing(e) || e.ctrlKey || e.metaKey || e.altKey || !product) return;
      const status = DECISIONS.find((s) => DECISION_UI[s].key === e.key);
      if (status) { e.preventDefault(); decide(status); }
      else if (e.key === 'ArrowRight') setIndex((i) => i + 1);
      else if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [decide, product]);

  const undoBar = last && (
    <div className="review-undo">
      <span className="text-truncate"><span className="review-undo-dot" />« {last.product.name} » : <strong>{STATUS[last.status].label}</strong></span>
      <Button size="small" icon={<UndoOutlined />} disabled={saving} onClick={undo}>Annuler</Button>
    </div>
  );

  if (queue.length === 0) {
    return (
      <>
        {undoBar}
        <section className="sc-panel review-state">
          <span className="review-state-icon"><CheckCircleOutlined /></span>
          <h2 className="h5 mb-1">Aucun produit à décider.</h2>
          <p className="review-state-good mb-2">Bonne soirée !</p>
          {decided > 0 && (
            <Button block size="large" icon={<EyeOutlined />} onClick={onShowDecided}>
              Consulter les {decided} produit{decided > 1 ? 's' : ''} décidé{decided > 1 ? 's' : ''}
            </Button>
          )}
        </section>
      </>
    );
  }
  if (!product) {
    return (
      <>
        {undoBar}
        <section className="sc-panel review-state review-state-skipped">
          <p className="fw-semibold mb-1"><FastForwardOutlined className="me-2" />
            Vous avez passé {queue.length > 1 ? `les ${queue.length} produits restants` : 'le produit restant'}.
          </p>
          <p className="small text-secondary">{queue.length > 1 ? 'Ils restent' : 'Il reste'} en attente de décision.</p>
          <Button type="primary" block size="large" icon={<RedoOutlined />} onClick={() => setIndex(0)}>Reprendre au début</Button>
        </section>
      </>
    );
  }

  const photos = images.length
    ? images.map((i) => ({ src: i.image_data, thumb: i.thumb_data || i.image_data }))
    : product.cover_thumb ? [{ src: product.cover_thumb, thumb: product.cover_thumb }] : [];
  const left = queue.length - index - 1;

  return (
    <div className="review-queue">
      {undoBar}
      <section className="sc-panel review-progress">
        <div className="review-progress-text">
          <strong>Produit {index + 1} sur {queue.length}</strong>
          <span className="text-secondary small">{left ? `${left} restant${left > 1 ? 's' : ''}` : 'Dernier produit'}</span>
        </div>
        <Progress percent={Math.round(((index + 1) / queue.length) * 100)} showInfo={false} size="small" className="review-progress-bar" />
        <div className="review-nav">
          <Button size="small" icon={<LeftOutlined />} disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}>Précédent</Button>
          <Button size="small" onClick={() => setIndex((i) => i + 1)}>Suivant <RightOutlined /></Button>
        </div>
      </section>

      <Row gutter={[20, 16]}>
        <Col xs={24} lg={14}>
          <section className="sc-panel review-product">
            {photos.length > 0 ? (
              <div className="review-gallery">
                <Image.PreviewGroup items={photos.map((p) => p.src)}
                  preview={{ current: shown, onChange: (current) => setShown(current) }}>
                  <Image src={photos[shown]?.src} alt={product.name} rootClassName="review-gallery-main" className="review-gallery-img" />
                </Image.PreviewGroup>
                {photos.length > 1 && <span className="review-gallery-count"><PictureOutlined /> {shown + 1} / {photos.length}</span>}
                {photos.length > 1 && (
                  <div className="review-gallery-thumbs">
                    {photos.map((p, i) => (
                      <button key={i} type="button" className={`review-gallery-thumb ${i === shown ? 'is-active' : ''}`}
                        onClick={() => setShown(i)} aria-label={`Photo ${i + 1}`}>
                        <img src={p.thumb} alt="" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="review-nophoto"><PictureOutlined /> Pas de photo</div>
            )}

            <div className="review-product-body">
              <div className="d-flex justify-content-between align-items-start gap-2">
                <h2 className="review-product-name"><Link to={`/produits/${product.id}`} className="text-body">{product.name}</Link></h2>
                <Tag color="orange" className="m-0 flex-shrink-0">{STATUS.A_ETUDIER.label}</Tag>
              </div>
              <div className="review-product-meta">
                {product.supplier_id
                  ? <Link to={`/fournisseurs/${product.supplier_id}`}><ShopOutlined /> {product.supplier_name}</Link>
                  : <span className="text-secondary">Sans fournisseur</span>}
                {product.booth_id && (
                  <Link to={`/booths/${product.booth_id}`} className="review-chip">Booth {boothLabel(product.booth_phase, product.booth_code)}</Link>
                )}
                {product.supplier_ref && <span className="review-ref">Réf. {product.supplier_ref}</span>}
              </div>

              <div className="review-price">
                <div>
                  <div className="sc-label">Prix</div>
                  <div className="review-price-value">{formatPrice(product.price, product.currency)}{product.unit && <span> / {product.unit}</span>}</div>
                </div>
                {product.moq && (
                  <div className="review-price-item">
                    <div className="small text-secondary">MOQ</div>
                    <strong>{product.moq}</strong>
                  </div>
                )}
                {product.shipping_type && (
                  <div className="review-price-item">
                    <div className="small text-secondary">Incoterm</div>
                    <span className="review-incoterm">{product.shipping_type}</span>
                  </div>
                )}
              </div>

              {product.description && (
                <>
                  <div className="sc-label mb-1">Description</div>
                  <p className="review-description">{product.description}</p>
                </>
              )}
              <div className="review-product-foot">
                <span><UserOutlined /> Saisi par <strong>{product.created_by_name || '—'}</strong></span>
                {product.created_at && <span><CalendarOutlined /> {formatDateTime(product.created_at)}</span>}
              </div>
            </div>
          </section>
        </Col>

        <Col xs={24} lg={10} className="review-decide-col">
          <section className="sc-panel review-decide">
            <h2 className="review-decide-title d-none d-lg-block">Décision</h2>
            <p className="small text-secondary d-none d-lg-block">L'acheteur voit la décision et la note dans « Décidés ».</p>
            {error && <Alert type="error" showIcon message={error} className="mb-2" />}
            <label className="sc-label d-none d-lg-block mb-1" htmlFor="review-note">Note pour l'acheteur <span className="fw-normal text-secondary">(facultatif)</span></label>
            <Input.TextArea id="review-note" autoSize={{ minRows: 1, maxRows: 4 }} maxLength={500} className="review-note"
              value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note pour l'acheteur : négocier à 2,90…" />
            <div className="review-decisions">
              {DECISIONS.map((s) => (
                <button key={s} type="button" disabled={saving} onClick={() => decide(s)} className={`review-decision decision-${s}`}>
                  <span className="review-decision-label">{DECISION_UI[s].icon} {STATUS[s].label}</span>
                  <span className="review-decision-hint">{DECISION_UI[s].hint}</span>
                </button>
              ))}
            </div>
            <Button block size="large" className="review-skip" disabled={saving} onClick={() => setIndex((i) => i + 1)}>
              Passer (décider plus tard) <ArrowRightOutlined />
            </Button>
            <div className="review-keys">
              Raccourcis : {DECISIONS.map((s) => <span key={s}><kbd>{DECISION_UI[s].key}</kbd> {STATUS[s].label}</span>)}
              <span><kbd>←</kbd> <kbd>→</kbd> produit</span>
            </div>
          </section>
        </Col>
      </Row>
    </div>
  );
}

// What a buyer sees: the queue, read-only.
function PendingList({ products }) {
  if (products.length === 0) return <Empty description="Aucun produit en attente de décision." className="py-4" />;
  return (
    <>
      <div className="review-list-head">{products.length} produit{products.length > 1 ? 's' : ''} en attente · les plus anciens d'abord</div>
      <div className="d-grid gap-2">{products.map((p) => <ProductRow key={p.id} product={p} />)}</div>
    </>
  );
}

function ProductRow({ product: p, children }) {
  return (
    <div className={`review-row ${p.status === 'REJETE' ? 'is-rejected' : ''}`}>
      <div className="d-flex gap-3">
        <ProductThumb src={p.cover_thumb} size={64} className="review-thumb" />
        <div className="flex-grow-1 overflow-hidden">
          <div className="d-flex justify-content-between gap-2">
            <Link to={`/produits/${p.id}`} className="review-row-name text-truncate">{p.name}</Link>
            <Tag color={STATUS[p.status].color} className="m-0 flex-shrink-0">{STATUS[p.status].label}</Tag>
          </div>
          <div className="small text-secondary text-truncate">
            {p.supplier_name || 'Sans fournisseur'}{p.booth_code ? ` · Booth ${boothLabel(p.booth_phase, p.booth_code)}` : ''}
          </div>
          <div className="review-row-price">{priceLine(p)}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

// The latest decisions, newest first, with the boss's note. The boss can send one back to the queue.
function DecidedList({ boss, reload }) {
  const [products, setProducts] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_BASE_URL}/products`);
      setProducts(data.data
        .filter((p) => p.status !== 'A_ETUDIER')
        .sort((a, b) => (b.decided_at || '').localeCompare(a.decided_at || '')));
    } catch (err) {
      setError(apiError(err, 'Erreur lors du chargement des produits'));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const reopen = async (p) => {
    setError(null);
    try {
      await axios.put(`${API_BASE_URL}/products/${p.id}/decision`, { status: 'A_ETUDIER' });
      await Promise.all([load(), reload()]);
    } catch (err) {
      setError(apiError(err, "La décision n'a pas été annulée"));
    }
  };

  if (error) return <Alert type="error" showIcon message={error} />;
  if (!products) return <div className="text-center py-5"><Spin /></div>;
  if (products.length === 0) return <Empty description="Aucune décision pour l'instant." className="py-4" />;
  return (
    <>
      <div className="review-list-head">{products.length} décision{products.length > 1 ? 's' : ''} · les plus récentes d'abord</div>
      <div className="d-grid gap-2">
        {products.map((p) => (
          <ProductRow key={p.id} product={p}>
            {p.decision_note && <div className="review-note-box"><span>Note :</span> « {p.decision_note} »</div>}
            <div className="review-row-foot">
              <span>Par <strong>{p.decided_by_name || '—'}</strong>{p.decided_at && ` · ${formatDateTime(p.decided_at)}`}</span>
              {boss && <Button type="link" size="small" className="p-0" icon={<UndoOutlined />} onClick={() => reopen(p)}>Revoir</Button>}
            </div>
          </ProductRow>
        ))}
      </div>
    </>
  );
}
