import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Alert, Button, Empty, Image, Input, Segmented, Spin, Tag } from 'antd';
import { API_BASE_URL } from '../../config/config';
import ProductThumb from '../../components/ProductThumb';
import { useAuth } from '../../context/AuthContext';
import { isAdmin } from '../../utils/access';
import { apiError } from '../../utils/apiError';
import { DECISIONS, STATUS, formatDateTime } from '../../utils/decision';
import { boothLabel, formatPrice } from '../../utils/format';
import PageHeader from '../../components/PageHeader';

const priceLine = (p) => [
  `${formatPrice(p.price)}${p.unit ? ` / ${p.unit}` : ''}`,
  p.moq && `MOQ ${p.moq}`,
  p.shipping_type,
].filter(Boolean).join(' · ');

const by = (name, date) => [name, date && formatDateTime(date)].filter(Boolean).join(' · ') || '—';

// D38: "Revue du soir". The boss (admin) goes through the products recorded by the buyers, one at
// a time, and decides: kept, sample, to order or rejected, with a note. The buyers see the queue
// and the decisions. The server refuses a decision from anyone but the admin.
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

  const decided = review ? Object.entries(review.counts).filter(([s]) => s !== 'A_ETUDIER').reduce((n, [, c]) => n + c, 0) : 0;

  return (
    <div className="review">
      <PageHeader title="Revue du soir" chip="Décisions"
        subtitle={boss ? 'Décidez des produits saisis par les acheteurs, un par un' : "Les produits en attente de la décision de l'administrateur"} />
      <Segmented block size="large" className="mb-3" value={tab} onChange={setTab}
        options={[
          { value: 'pending', label: `À décider (${review ? review.counts.A_ETUDIER ?? 0 : '…'})` },
          { value: 'decided', label: `Décidés (${review ? decided : '…'})` },
        ]} />
      {error && <Alert type="error" showIcon message={error} className="mb-3" />}
      {!review && !error && <div className="text-center py-5"><Spin /></div>}
      {review && tab === 'pending' && (boss ? <BossQueue review={review} reload={load} /> : <PendingList products={review.pending} />)}
      {review && tab === 'decided' && <DecidedList boss={boss} reload={load} />}
    </div>
  );
}

// The boss's queue: one product at a time, big buttons, the note, and "Annuler" for the last one.
function BossQueue({ review, reload }) {
  const [index, setIndex] = useState(0);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [last, setLast] = useState(null); // { product, status }
  const [images, setImages] = useState([]);

  const queue = review.pending;
  const product = queue[index];
  const productId = product?.id;

  // A new product on screen: empty note, and all its photos (the list only has the cover).
  useEffect(() => {
    setNote('');
    setError(null);
    setImages([]);
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

  const decide = async (status) => {
    if (!product) return;
    if (await send(product.id, status, { note: note.trim() || null }, "La décision n'a pas été enregistrée")) {
      setLast({ product, status });
      await reload(); // the product leaves the queue; the same index now shows the next one
    }
  };

  const undo = async () => {
    if (!last) return;
    if (await send(last.product.id, 'A_ETUDIER', {}, "La décision n'a pas été annulée")) {
      setLast(null);
      const r = await reload();
      // The queue is oldest first: show the product again at its place.
      setIndex(Math.max(0, r?.pending.findIndex((p) => p.id === last.product.id) ?? 0));
    }
  };

  const undoBar = last && (
    <div className="review-undo">
      <span className="text-truncate">« {last.product.name} » : {STATUS[last.status].label}</span>
      <Button type="link" size="small" disabled={saving} onClick={undo}>Annuler</Button>
    </div>
  );

  if (queue.length === 0) {
    return <>{undoBar}<Empty description="Aucun produit à décider. Bonne soirée !" className="py-4" /></>;
  }
  if (!product) {
    return (
      <>
        {undoBar}
        <div className="sc-panel p-3 text-center">
          <p>Vous avez passé {queue.length > 1 ? `les ${queue.length} produits restants` : 'le produit restant'}.</p>
          <Button block onClick={() => setIndex(0)}>Reprendre au début</Button>
        </div>
      </>
    );
  }

  const photos = images.length ? images.map((i) => i.image_data) : product.cover_thumb ? [product.cover_thumb] : [];
  return (
    <div className="review-queue">
      {undoBar}
      <div className="small text-secondary mb-2">Produit {index + 1} sur {queue.length}</div>
      <section className="sc-panel p-3 mb-3">
        {photos.length > 0 ? (
          <div className="review-photos">
            <Image.PreviewGroup>
              {photos.map((src, i) => <Image key={i} src={src} alt="" className="review-photo" />)}
            </Image.PreviewGroup>
          </div>
        ) : (
          <div className="review-nophoto">Pas de photo</div>
        )}
        <h2 className="h5 mt-3 mb-1"><Link to={`/produits/${product.id}`} className="text-body">{product.name}</Link></h2>
        <div className="small">
          {product.supplier_id
            ? <Link to={`/fournisseurs/${product.supplier_id}`}>{product.supplier_name}</Link>
            : <span className="text-secondary">Sans fournisseur</span>}
          {product.booth_id && <> · <Link to={`/booths/${product.booth_id}`}>Booth {boothLabel(product.booth_phase, product.booth_code)}</Link></>}
        </div>
        <p className="fs-6 fw-semibold my-2">{priceLine(product)}</p>
        {product.supplier_ref && <p className="small text-secondary mb-1">Réf. {product.supplier_ref}</p>}
        {product.description && <p className="small mb-1" style={{ whiteSpace: 'pre-line' }}>{product.description}</p>}
        <p className="small text-secondary mb-0">Saisi par {by(product.created_by_name, product.created_at)}</p>
      </section>

      {error && <Alert type="error" showIcon message={error} className="mb-3" />}
      <Input.TextArea rows={2} maxLength={500} className="mb-3" value={note} onChange={(e) => setNote(e.target.value)}
        placeholder="Note pour l'acheteur (facultatif) : négocier à 2,90…" />
      <div className="review-decisions">
        {DECISIONS.map((s) => (
          <button key={s} type="button" disabled={saving} onClick={() => decide(s)} className={`review-decision decision-${s}`}>
            {STATUS[s].label}
          </button>
        ))}
      </div>
      <Button block size="large" className="mt-2" disabled={saving} onClick={() => setIndex((i) => i + 1)}>
        Passer (décider plus tard)
      </Button>
    </div>
  );
}

// What a buyer sees: the queue, read-only.
function PendingList({ products }) {
  if (products.length === 0) return <Empty description="Aucun produit en attente de décision." className="py-4" />;
  return <div className="d-grid gap-2">{products.map((p) => <ProductRow key={p.id} product={p} />)}</div>;
}

function ProductRow({ product: p, children }) {
  return (
    <div className="review-row">
      <ProductThumb src={p.cover_thumb} size={64} className="review-thumb" />
      <div className="flex-grow-1 overflow-hidden">
        <div className="d-flex justify-content-between gap-2">
          <Link to={`/produits/${p.id}`} className="fw-semibold text-body text-truncate">{p.name}</Link>
          <Tag color={STATUS[p.status].color} className="m-0 flex-shrink-0">{STATUS[p.status].label}</Tag>
        </div>
        <div className="small text-secondary text-truncate">
          {p.supplier_name || 'Sans fournisseur'}{p.booth_code ? ` · Booth ${boothLabel(p.booth_phase, p.booth_code)}` : ''} · {priceLine(p)}
        </div>
        {children}
      </div>
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
    <div className="d-grid gap-2">
      {products.map((p) => (
        <ProductRow key={p.id} product={p}>
          {p.decision_note && <div className="small">« {p.decision_note} »</div>}
          <div className="d-flex justify-content-between align-items-center small text-secondary">
            <span>{by(p.decided_by_name, p.decided_at)}</span>
            {boss && <Button type="link" size="small" className="p-0" onClick={() => reopen(p)}>Revoir</Button>}
          </div>
        </ProductRow>
      ))}
    </div>
  );
}
