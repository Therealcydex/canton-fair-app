import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, fileUrl, jsonBody } from '../config/api';
import { formatPrice } from '../format';
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
      const b = await api<Booth>(`/booths/${id}`, 'Erreur lors du chargement du stand');
      setBooth(b);
      setProducts(b.supplier_id
        ? await api<Product[]>(`/products?supplier_id=${b.supplier_id}`, 'Erreur lors du chargement des produits')
        : []);
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
      setNotice(visited ? 'Stand marqué visité' : 'Stand remis à visiter');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!booth) return <Page title="Stand" back>{error ? <ErrorBox message={error} /> : <Loading />}</Page>;

  return (
    <Page title={`Stand ${booth.booth_code}`} back>
      <Card>
        {booth.supplier_id
          ? <Link to={`/fournisseurs/${booth.supplier_id}`} className="text-lg font-semibold text-blue-700">{booth.supplier_name}</Link>
          : <p className="text-lg font-semibold">Sans fournisseur</p>}
        <p className="text-sm text-slate-600">
          Phase {booth.phase} · {booth.sub_category ? `${booth.category} › ${booth.sub_category}` : 'Sans catégorie'}
        </p>
        {booth.visited
          ? <Badge className="mt-2 bg-green-100 text-green-800">Visité</Badge>
          : <Badge className="mt-2 bg-orange-100 text-orange-800">À visiter</Badge>}
        {booth.comment && <p className="mt-2 whitespace-pre-wrap text-sm">{booth.comment}</p>}
      </Card>

      <ErrorBox message={error} />
      <Notice message={notice} />

      {booth.visited
        ? <Button variant="secondary" className="w-full" disabled={saving} onClick={() => setVisited(false)}>Remettre à visiter</Button>
        : <Button className="w-full" disabled={saving} onClick={() => setVisited(true)}>Marquer visité</Button>}

      {booth.supplier_id && (
        <>
          <div className="flex items-center justify-between px-1 pt-2">
            <h2 className="font-semibold">Produits du fournisseur ({products.length})</h2>
            <Link to={`/produits/nouveau?supplier=${booth.supplier_id}&stand=${booth.id}`}
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
                  {formatPrice(p.price)}{p.unit ? ` / ${p.unit}` : ''}{p.moq ? ` · MOQ ${p.moq}` : ''}{p.shipping_type ? ` · ${p.shipping_type}` : ''}
                </div>
                {p.supplier_ref && <div className="text-xs text-slate-500">Réf. {p.supplier_ref}</div>}
              </div>
            </Card>
          ))}
        </>
      )}
    </Page>
  );
}
