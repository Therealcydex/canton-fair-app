import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, fileUrl, jsonBody } from '../config/api';
import { formatPrice } from '../format';
import { STATUS } from '../decision';
import type { Booth, Product } from '../types';
import { Badge, Button, Card, ErrorBox, Loading, Notice, Page } from '../components/ui';

// Booth on the fair floor: mark it visited (it leaves the "to visit" list), see and add the
// products of its supplier.
export default function BoothPage() {
  const { id } = useParams();
  const [booth, setBooth] = useState<Booth | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const b = await api<Booth>(`/booths/${id}`, 'Erreur lors du chargement du booth');
      setBooth(b);
      // D43: the products found at this booth, and the other products of its supplier.
      const [here, ofSupplier] = await Promise.all([
        api<Product[]>(`/products?booth_id=${b.id}`, 'Erreur lors du chargement des produits'),
        b.supplier_id ? api<Product[]>(`/products?supplier_id=${b.supplier_id}`, 'Erreur lors du chargement des produits') : [],
      ]);
      setProducts([...here, ...ofSupplier.filter((p) => !here.some((h) => h.id === p.id))]);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const setVisited = async (visited: boolean) => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await api(`/booths/${id}/visited`, "Erreur lors de l'enregistrement", { method: 'PATCH', body: jsonBody({ visited }) });
      setNotice(visited ? 'Booth marqué visité' : 'Booth remis à visiter');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const here = booth ? products.filter((p) => p.booth_id === booth.id) : [];
  const others = booth ? products.filter((p) => p.booth_id !== booth.id) : [];

  if (!booth) return <Page title="Booth" back>{error ? <ErrorBox message={error} /> : <Loading />}</Page>;

  return (
    <Page title={`Booth ${booth.booth_code}`} back>
      <Card>
        <div className="flex items-start justify-between gap-2">
          <p className="font-display text-4xl font-bold leading-tight text-blue-700">{booth.booth_code}</p>
          {booth.visited
            ? <Badge className="mt-2 bg-green-100 text-green-800">Visité</Badge>
            : <Badge className="mt-2 bg-orange-100 text-orange-800">À visiter</Badge>}
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <Badge className="bg-slate-100 text-slate-700">Phase {booth.phase}</Badge>
          {booth.zone && <Badge className="bg-slate-100 text-slate-700">Zone {booth.zone}</Badge>}
          {booth.hall && <Badge className="bg-slate-100 text-slate-700">Hall {booth.hall} · étage {booth.floor}</Badge>}
          {booth.letter && <Badge className="bg-slate-100 text-slate-700">Allée {booth.letter}</Badge>}
        </div>
        <p className="mt-2 text-sm text-slate-600">{booth.sub_category ? `${booth.category} › ${booth.sub_category}` : 'Sans catégorie'}</p>
        <p className="label mt-3">Fournisseur</p>
        {booth.supplier_id
          ? <Link to={`/fournisseurs/${booth.supplier_id}`} className="text-lg font-semibold text-blue-700">{booth.supplier_name} ›</Link>
          : <p className="text-lg font-semibold">Sans fournisseur</p>}
        {booth.comment && <p className="mt-2 whitespace-pre-wrap text-sm">{booth.comment}</p>}
      </Card>

      <ErrorBox message={error} />
      <Notice message={notice} />

      {booth.visited
        ? <Button variant="secondary" className="w-full" disabled={saving} onClick={() => setVisited(false)}>Remettre à visiter</Button>
        : <Button className="w-full" disabled={saving} onClick={() => setVisited(true)}>Marquer visité</Button>}

      <div className="flex items-center justify-between px-1 pt-2">
        <h2 className="label font-sans">Produits de ce booth ({here.length})</h2>
        <Link to={`/produits/nouveau?${booth.supplier_id ? `supplier=${booth.supplier_id}&` : ''}booth=${booth.id}`}
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white">+ Produit</Link>
      </div>
      {here.length === 0 && <p className="px-1 text-sm text-slate-500">Aucun produit enregistré à ce booth.</p>}
      {[...here, ...others].map((p, i) => (
        <div key={p.id}>
          {i === here.length && <h2 className="label px-1 pb-2 pt-3 font-sans">Autres produits du fournisseur ({others.length})</h2>}
          <Card className="flex gap-3">
            {p.cover_url
              ? <img src={fileUrl(p.cover_url)} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
              : <div className="h-16 w-16 shrink-0 rounded-lg bg-slate-100" />}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <span className="truncate font-medium">{p.name}</span>
                <Badge className={`shrink-0 ${STATUS[p.status].badge}`}>{STATUS[p.status].label}</Badge>
              </div>
              <div className="text-sm text-slate-600">
                {formatPrice(p.price)}{p.unit ? ` / ${p.unit}` : ''}{p.moq ? ` · MOQ ${p.moq}` : ''}{p.shipping_type ? ` · ${p.shipping_type}` : ''}
              </div>
              {p.supplier_ref && <div className="text-xs text-slate-500">Réf. {p.supplier_ref}</div>}
              {p.decision_note && <div className="text-sm text-slate-800">« {p.decision_note} »</div>}
              {p.booth_code && p.booth_id !== booth.id && <div className="text-xs text-slate-500">Booth {p.booth_code}</div>}
            </div>
          </Card>
        </div>
      ))}
    </Page>
  );
}
