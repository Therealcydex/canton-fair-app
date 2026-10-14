import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../config/api';
import type { Booth } from '../types';
import { Badge, Card, ErrorBox, Loading, Page, inputClass } from '../components/ui';

// "À visiter" (planning: visited = 0) or all booths, grouped by phase and hall, as walked on the fair floor.
export default function BoothsPage({ planning }: { planning: boolean }) {
  const [booths, setBooths] = useState<Booth[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    setBooths(null);
    setError(null);
    api<Booth[]>(`/booths${planning ? '?visited=0' : ''}`, 'Erreur lors du chargement des stands')
      .then(setBooths)
      .catch((e: Error) => setError(e.message));
  }, [planning]);

  const groups = useMemo(() => {
    const text = q.trim().toLowerCase();
    const list = (booths || []).filter((b) => !text
      || (b.supplier_name || '').toLowerCase().includes(text) || b.booth_code.toLowerCase().includes(text));
    const map = new Map<string, Booth[]>();
    for (const b of list) {
      const key = `Phase ${b.phase} · Hall ${b.hall}`;
      map.set(key, [...(map.get(key) || []), b]);
    }
    return [...map.entries()];
  }, [booths, q]);

  return (
    <Page title={planning ? 'À visiter' : 'Stands'}>
      <input className={inputClass} placeholder="Fournisseur ou code du stand" value={q} onChange={(e) => setQ(e.target.value)} />
      <ErrorBox message={error} />
      {!booths && !error && <Loading />}
      {booths && groups.length === 0 && (
        <p className="py-8 text-center text-slate-500">{planning ? 'Aucun stand à visiter.' : 'Aucun stand.'}</p>
      )}
      {groups.map(([group, list]) => (
        <section key={group} className="space-y-2">
          <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-slate-500">{group}</h2>
          {list.map((b) => (
            <Link key={b.id} to={`/stands/${b.id}`} className="block">
              <Card className="flex items-center gap-3 active:bg-slate-50">
                <div className="w-28 shrink-0 font-bold">{b.booth_code}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{b.supplier_name || 'Sans fournisseur'}</div>
                  <div className="truncate text-sm text-slate-500">{b.sub_category || 'Sans catégorie'}</div>
                </div>
                {!planning && (b.visited
                  ? <Badge className="bg-green-100 text-green-800">Visité</Badge>
                  : <Badge className="bg-orange-100 text-orange-800">À visiter</Badge>)}
              </Card>
            </Link>
          ))}
        </section>
      ))}
    </Page>
  );
}
