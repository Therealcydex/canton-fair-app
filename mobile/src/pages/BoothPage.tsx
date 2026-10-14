import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, fileUrl, jsonBody } from '../config/api';
import { VISIT_STATUS, formatDateTime, formatPrice } from '../format';
import type { Booth, Product, Visit, VisitStatus } from '../types';
import { Badge, Button, Card, ErrorBox, Loading, Notice, Page, inputClass } from '../components/ui';

type BoothDetail = Booth & { visits: Visit[] };

// Booth on the fair floor: record the visit, see and add the products found there.
// The rules (who may edit, "visite" takes the booth off the list) are the server's (D14).
export default function BoothPage() {
  const { id } = useParams();
  const [booth, setBooth] = useState<BoothDetail | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [b, p] = await Promise.all([
        api<BoothDetail>(`/booths/${id}`, 'Erreur lors du chargement du stand'),
        api<Product[]>(`/products?booth_id=${id}`, 'Erreur lors du chargement des produits'),
      ]);
      setBooth(b);
      setProducts(p);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const record = async (status: VisitStatus) => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await api(`/booths/${id}/visits`, "Erreur lors de l'enregistrement de la visite", {
        method: 'POST',
        body: jsonBody({ status, comment: comment.trim() || null }),
      });
      setComment('');
      setNotice(`Visite enregistrée : ${VISIT_STATUS[status].label.toLowerCase()}`);
      await load();
    } catch (e) {
      setError((e as Error).message); // the comment stays so it can be sent again
    } finally {
      setSaving(false);
    }
  };

  if (!booth) return <Page title="Stand" back>{error ? <ErrorBox message={error} /> : <Loading />}</Page>;

  return (
    <Page title={`Stand ${booth.location}`} back>
      <Card>
        <Link to={`/fournisseurs/${booth.supplier_id}`} className="text-lg font-semibold text-blue-700">{booth.supplier_name}</Link>
        <p className="text-sm text-slate-600">
          {booth.phase ? `Phase ${booth.phase} · ` : ''}{booth.category_name || 'Sans catégorie'}
        </p>
        {booth.to_visit ? <Badge className="mt-2 bg-orange-100 text-orange-800">À visiter</Badge> : null}
        {booth.comment && <p className="mt-2 whitespace-pre-wrap text-sm">{booth.comment}</p>}
      </Card>

      <ErrorBox message={error} />
      <Notice message={notice} />

      <Card className="space-y-2">
        <h2 className="font-semibold">Enregistrer la visite</h2>
        <textarea className={inputClass} rows={2} placeholder="Commentaire (facultatif)" value={comment}
          onChange={(e) => setComment(e.target.value)} />
        <div className="grid grid-cols-3 gap-2">
          <Button disabled={saving} onClick={() => record('visite')}>Visité</Button>
          <Button variant="secondary" disabled={saving} onClick={() => record('prevu')}>Prévu</Button>
          <Button variant="secondary" disabled={saving} onClick={() => record('annule')}>Annulé</Button>
        </div>
      </Card>

      <div className="flex items-center justify-between px-1 pt-2">
        <h2 className="font-semibold">Produits ({products.length})</h2>
        <Link to={`/produits/nouveau?supplier=${booth.supplier_id}&booth=${booth.id}`}
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white">+ Produit</Link>
      </div>
      {products.map((p) => (
        <Card key={p.id} className="flex gap-3">
          {p.cover_url
            ? <img src={fileUrl(p.cover_url)} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
            : <div className="h-16 w-16 shrink-0 rounded-lg bg-slate-100" />}
          <div className="min-w-0">
            <div className="truncate font-medium">{p.name}</div>
            <div className="text-sm text-slate-600">
              {formatPrice(p.price_tnd)}{p.unit ? ` / ${p.unit}` : ''}{p.moq ? ` · MOQ ${p.moq}` : ''}{p.incoterm ? ` · ${p.incoterm}` : ''}
            </div>
            {p.supplier_ref && <div className="text-xs text-slate-500">Réf. {p.supplier_ref}</div>}
          </div>
        </Card>
      ))}

      <h2 className="px-1 pt-2 font-semibold">Visites ({booth.visits.length})</h2>
      {booth.visits.map((v) => (
        <Card key={v.id}>
          <div className="flex items-center justify-between">
            <Badge className={VISIT_STATUS[v.status].className}>{VISIT_STATUS[v.status].label}</Badge>
            <span className="text-sm text-slate-500">{formatDateTime(v.visited_at)} · {v.user_name}</span>
          </div>
          {v.comment && <p className="mt-1 whitespace-pre-wrap text-sm">{v.comment}</p>}
        </Card>
      ))}
    </Page>
  );
}
