import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../config/api';
import { formatPrice } from '../format';
import type { Booth, Product, Supplier } from '../types';
import { Badge, Card, ErrorBox, Loading, Page } from '../components/ui';

// Supplier lookup on the fair floor: contacts (tap to call or write), booths, products.
export default function SupplierPage() {
  const { id } = useParams();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [booths, setBooths] = useState<Booth[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<Supplier>(`/suppliers/${id}`, 'Erreur lors du chargement du fournisseur'),
      api<Booth[]>(`/booths?supplier_id=${id}`, 'Erreur lors du chargement des stands'),
      api<Product[]>(`/products?supplier_id=${id}`, 'Erreur lors du chargement des produits'),
    ])
      .then(([s, b, p]) => { setSupplier(s); setBooths(b); setProducts(p); })
      .catch((e: Error) => setError(e.message));
  }, [id]);

  if (!supplier) return <Page title="Fournisseur" back>{error ? <ErrorBox message={error} /> : <Loading />}</Page>;

  return (
    <Page title={supplier.name} back
      action={<Link to={`/produits/nouveau?supplier=${supplier.id}`} className="rounded bg-blue-600 px-2 py-1 text-sm">+ Produit</Link>}>
      <Card className="space-y-1 text-sm">
        {(supplier.province || supplier.rating) && <p>{[supplier.province, supplier.rating ? '★'.repeat(supplier.rating) : null].filter(Boolean).join(' · ')}</p>}
        <p className="text-slate-600">{supplier.nbr_booths ? `${supplier.booth_visit_pct} % des ${supplier.nbr_booths} stand(s) visités` : 'Aucun stand'}</p>
        {supplier.phone && <p><a className="text-blue-700" href={`tel:${supplier.phone}`}>{supplier.phone}</a></p>}
        {supplier.email && <p><a className="text-blue-700" href={`mailto:${supplier.email}`}>{supplier.email}</a></p>}
        {supplier.address && <p className="text-slate-600">{supplier.address}</p>}
        {supplier.notes && <p className="whitespace-pre-wrap text-slate-600">{supplier.notes}</p>}
      </Card>

      <h2 className="px-1 pt-2 font-semibold">Contacts ({supplier.contacts?.length || 0})</h2>
      {supplier.contacts?.map((c) => (
        <Card key={c.id} className="text-sm">
          {c.name && <p className="font-medium">{c.name}</p>}
          {c.phone && <p><a className="text-blue-700" href={`tel:${c.phone}`}>{c.phone}</a></p>}
          {c.email && <p><a className="text-blue-700" href={`mailto:${c.email}`}>{c.email}</a></p>}
          {c.wechat_qr && <p className="text-slate-600">WeChat : {c.wechat_qr}</p>}
        </Card>
      ))}

      <h2 className="px-1 pt-2 font-semibold">Stands ({booths.length})</h2>
      {booths.map((b) => (
        <Link key={b.id} to={`/stands/${b.id}`} className="block">
          <Card className="flex items-center justify-between active:bg-slate-50">
            <span className="font-bold">{b.booth_code}</span>
            {b.visited
              ? <Badge className="bg-green-100 text-green-800">Visité</Badge>
              : <Badge className="bg-orange-100 text-orange-800">À visiter</Badge>}
          </Card>
        </Link>
      ))}

      <h2 className="px-1 pt-2 font-semibold">Produits ({products.length})</h2>
      {products.map((p) => (
        <Card key={p.id} className="text-sm">
          <p className="font-medium">{p.name}</p>
          <p className="text-slate-600">{formatPrice(p.price)}{p.unit ? ` / ${p.unit}` : ''}{p.moq ? ` · MOQ ${p.moq}` : ''}{p.shipping_type ? ` · ${p.shipping_type}` : ''}</p>
        </Card>
      ))}
    </Page>
  );
}
