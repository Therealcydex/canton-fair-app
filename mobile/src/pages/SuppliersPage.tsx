import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../config/api';
import type { Supplier } from '../types';
import { Card, ErrorBox, Loading, Page, inputClass } from '../components/ui';

// Supplier lookup; the search runs on the server (name).
export default function SuppliersPage() {
  const [q, setQ] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setError(null);
      api<Supplier[]>(`/suppliers${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`, 'Erreur lors du chargement des fournisseurs')
        .then(setSuppliers)
        .catch((e: Error) => setError(e.message));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <Page title="Fournisseurs"
      action={<Link to="/fournisseurs/nouveau" className="rounded bg-blue-600 px-2 py-1 text-sm">+ Fournisseur</Link>}>
      <input className={inputClass} placeholder="Rechercher un fournisseur" value={q} onChange={(e) => setQ(e.target.value)} />
      <ErrorBox message={error} />
      {!suppliers && !error && <Loading />}
      {suppliers?.length === 0 && <p className="py-8 text-center text-slate-500">Aucun fournisseur.</p>}
      {suppliers?.map((s) => (
        <Link key={s.id} to={`/fournisseurs/${s.id}`} className="block">
          <Card className="active:bg-slate-50">
            <div className="font-medium">{s.name}</div>
            <div className="text-sm text-slate-500">
              {[s.province, s.rating ? '★'.repeat(s.rating) : null, `${s.nbr_booths} booth(s)`, `${s.products_count} produit(s)`].filter(Boolean).join(' · ')}
            </div>
          </Card>
        </Link>
      ))}
    </Page>
  );
}
