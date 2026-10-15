import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api, fileUrl, jsonBody } from '../config/api';
import { useAuth } from '../authContext';
import type { Product, ProductImage, ProductStatus, Review } from '../types';
import { formatPrice } from '../format';
import { DECISIONS, STATUS, isAdmin, shortDate } from '../decision';
import { Badge, Button, Card, ErrorBox, Loading, Page, inputClass } from '../components/ui';

const priceLine = (p: Product) =>
  `${formatPrice(p.price)}${p.unit ? ` / ${p.unit}` : ''}${p.moq ? ` · MOQ ${p.moq}` : ''}${p.shipping_type ? ` · ${p.shipping_type}` : ''}`;

const recorded = (p: Product) => [p.created_by_name, shortDate(p.created_at)].filter(Boolean).join(' · ');

// D38: "Revue du soir". The boss (admin) goes through the products recorded by the buyers, one at
// a time, and decides: kept, sample, to order or rejected, with a note. The buyers see the queue
// and the decisions. The server refuses a decision from anyone but the admin.
export default function ReviewPage() {
  const { user } = useAuth();
  const boss = isAdmin(user);
  const [tab, setTab] = useState<'pending' | 'decided'>('pending');
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    return api<Review>('/products/review', 'Erreur lors du chargement de la revue')
      .then((r) => { setReview(r); return r; })
      .catch((e: Error) => { setError(e.message); return undefined; });
  }, []);
  useEffect(() => { load(); }, [load]);

  const decided = review ? Object.entries(review.counts).filter(([s]) => s !== 'A_ETUDIER').reduce((n, [, c]) => n + c, 0) : 0;

  return (
    <Page title="Revue du soir">
      <div className="grid grid-cols-2 rounded-lg bg-slate-200 p-1 text-sm">
        {(['pending', 'decided'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-md py-2 font-medium ${tab === t ? 'bg-white shadow-sm' : 'text-slate-600'}`}>
            {t === 'pending' ? `À décider (${review?.counts.A_ETUDIER ?? '…'})` : `Décidés (${review ? decided : '…'})`}
          </button>
        ))}
      </div>
      <ErrorBox message={error} />
      {!review && !error && <Loading />}
      {review && tab === 'pending' && (boss
        ? <BossQueue review={review} reload={load} />
        : <PendingList products={review.pending} />)}
      {review && tab === 'decided' && <DecidedList boss={boss} reload={load} />}
    </Page>
  );
}

// The boss's queue: one product at a time, big buttons, the note, and "undo" for the last one.
function BossQueue({ review, reload }: { review: Review; reload: () => Promise<Review | undefined> }) {
  const [index, setIndex] = useState(0);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<{ product: Product; status: ProductStatus } | null>(null);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [zoom, setZoom] = useState<string | null>(null);

  const queue = review.pending;
  const product = queue[index];
  const productId = product?.id;

  // A new product on screen: empty note, and all its photos (the list only has the cover).
  useEffect(() => {
    setNote('');
    setError(null);
    setImages([]);
    if (!productId) return;
    let live = true;
    api<{ images: ProductImage[] }>(`/products/${productId}`, 'Erreur')
      .then((d) => { if (live) setImages(d.images); })
      .catch(() => {}); // the cover from the list is still shown
    return () => { live = false; };
  }, [productId]);

  const decide = async (status: ProductStatus) => {
    if (!product) return;
    setSaving(true);
    setError(null);
    try {
      await api(`/products/${product.id}/decision`, "La décision n'a pas été enregistrée", {
        method: 'PUT', body: jsonBody({ status, note: note.trim() || null }),
      });
      setLast({ product, status });
      await reload(); // the product leaves the queue; the same index now shows the next one
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const undo = async () => {
    if (!last) return;
    setSaving(true);
    setError(null);
    try {
      await api(`/products/${last.product.id}/decision`, "La décision n'a pas été annulée", {
        method: 'PUT', body: jsonBody({ status: 'A_ETUDIER' }),
      });
      setLast(null);
      const r = await reload();
      // The queue is oldest first: show the product again at its place.
      setIndex(Math.max(0, r?.pending.findIndex((p) => p.id === last.product.id) ?? 0));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const undoBar = last && (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm text-white">
      <span className="min-w-0 truncate">« {last.product.name} » : {STATUS[last.status].label}</span>
      <button onClick={undo} disabled={saving} className="shrink-0 font-semibold text-amber-300">Annuler</button>
    </div>
  );

  if (queue.length === 0) {
    return (
      <>
        {undoBar}
        <p className="py-8 text-center text-slate-500">Aucun produit à décider. Bonne soirée !</p>
      </>
    );
  }
  if (!product) {
    return (
      <>
        {undoBar}
        <Card className="space-y-3 text-center">
          <p>Vous avez passé les {queue.length} produit(s) restant(s).</p>
          <Button variant="secondary" className="w-full" onClick={() => setIndex(0)}>Reprendre au début</Button>
        </Card>
      </>
    );
  }

  const photos = images.length ? images.map((i) => i.image_url) : product.cover_url ? [product.cover_url] : [];
  return (
    <>
      {undoBar}
      <p className="px-1 text-sm text-slate-500">Produit {index + 1} sur {queue.length}</p>
      <Card className="space-y-3">
        {photos.length > 0 ? (
          <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1">
            {photos.map((url) => (
              <button key={url} type="button" onClick={() => setZoom(url)} className={`${photos.length > 1 ? 'shrink-0' : 'w-full'} snap-start`} aria-label="Agrandir la photo">
                <img src={fileUrl(url)} alt="" className={`${photos.length > 1 ? 'w-64' : 'w-full'} h-56 rounded-lg object-cover`} />
              </button>
            ))}
          </div>
        ) : (
          <div className="flex h-24 items-center justify-center rounded-lg bg-slate-100 text-sm text-slate-500">Pas de photo</div>
        )}
        <div>
          <h2 className="text-lg font-semibold">{product.name}</h2>
          {product.supplier_id
            ? <Link to={`/fournisseurs/${product.supplier_id}`} className="text-sm text-blue-700">{product.supplier_name}</Link>
            : <p className="text-sm text-slate-500">Sans fournisseur</p>}
        </div>
        <p className="text-base font-medium">{priceLine(product)}</p>
        {product.supplier_ref && <p className="text-sm text-slate-600">Réf. {product.supplier_ref}</p>}
        {product.description && <p className="whitespace-pre-line text-sm text-slate-700">{product.description}</p>}
        <p className="text-xs text-slate-500">Saisi par {recorded(product) || '—'}</p>
      </Card>

      <ErrorBox message={error} />
      <textarea className={inputClass} rows={2} maxLength={500} placeholder="Note pour l'acheteur (facultatif) : négocier à 2,90…"
        value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        {DECISIONS.map((s) => (
          <button key={s} onClick={() => decide(s)} disabled={saving}
            className={`min-h-[52px] rounded-lg px-3 font-semibold disabled:opacity-50 ${STATUS[s].button}`}>
            {STATUS[s].label}
          </button>
        ))}
      </div>
      <Button variant="secondary" className="w-full" disabled={saving} onClick={() => setIndex((i) => i + 1)}>
        Passer (décider plus tard)
      </Button>

      {zoom && (
        <button type="button" onClick={() => setZoom(null)} aria-label="Fermer"
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/90 p-2">
          <img src={fileUrl(zoom)} alt="" className="max-h-full max-w-full object-contain" />
        </button>
      )}
    </>
  );
}

// What a buyer sees: the queue, read-only.
function PendingList({ products }: { products: Product[] }) {
  if (products.length === 0) return <p className="py-8 text-center text-slate-500">Aucun produit en attente de décision.</p>;
  return (
    <>
      <p className="px-1 text-sm text-slate-500">Ces produits attendent la décision de l'administrateur.</p>
      {products.map((p) => <ProductRow key={p.id} product={p} />)}
    </>
  );
}

function ProductRow({ product: p, children }: { product: Product; children?: ReactNode }) {
  return (
    <Card className="flex gap-3">
      {p.cover_url
        ? <img src={fileUrl(p.cover_url)} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
        : <div className="h-16 w-16 shrink-0 rounded-lg bg-slate-100" />}
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-start justify-between gap-2">
          <span className="truncate font-medium">{p.name}</span>
          <Badge className={`shrink-0 ${STATUS[p.status].badge}`}>{STATUS[p.status].label}</Badge>
        </div>
        <div className="truncate text-sm text-slate-600">{p.supplier_name || 'Sans fournisseur'} · {priceLine(p)}</div>
        {children}
      </div>
    </Card>
  );
}

// The latest decisions, newest first, with the boss's note. The boss can send one back to the queue.
function DecidedList({ boss, reload }: { boss: boolean; reload: () => Promise<Review | undefined> }) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => api<Product[]>('/products', 'Erreur lors du chargement des produits')
    .then((all) => setProducts(all
      .filter((p) => p.status !== 'A_ETUDIER')
      .sort((a, b) => (b.decided_at || '').localeCompare(a.decided_at || ''))))
    .catch((e: Error) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const reopen = async (p: Product) => {
    setError(null);
    try {
      await api(`/products/${p.id}/decision`, "La décision n'a pas été annulée", { method: 'PUT', body: jsonBody({ status: 'A_ETUDIER' }) });
      await Promise.all([load(), reload()]);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (error) return <ErrorBox message={error} />;
  if (!products) return <Loading />;
  if (products.length === 0) return <p className="py-8 text-center text-slate-500">Aucune décision pour l'instant.</p>;
  return (
    <>
      {products.map((p) => (
        <ProductRow key={p.id} product={p}>
          {p.decision_note && <p className="text-sm text-slate-800">« {p.decision_note} »</p>}
          <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
            <span>{[p.decided_by_name, shortDate(p.decided_at)].filter(Boolean).join(' · ')}</span>
            {boss && <button onClick={() => reopen(p)} className="font-medium text-blue-700">Revoir</button>}
          </div>
        </ProductRow>
      ))}
    </>
  );
}
