import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, jsonBody } from '../config/api';
import type { Booth } from '../types';
import { Icon } from '../components/icons';
import { Badge, Card, ErrorBox, Loading, Page, inputClass } from '../components/ui';

const hallOf = (b: Booth) => `Phase ${b.phase} · Hall ${b.hall}`;

// "À visiter" (planning) or all booths, grouped by phase and hall, as walked on the fair floor.
// Planning (D39): every booth is loaded so each hall shows its progress; the round ✓ marks a booth
// visited from the list (tap again to undo), and the visited booths go to the bottom or are hidden.
export default function BoothsPage({ planning }: { planning: boolean }) {
  const [booths, setBooths] = useState<Booth[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [hideVisited, setHideVisited] = useState(false);
  const [saving, setSaving] = useState<number[]>([]);

  useEffect(() => {
    setBooths(null);
    setError(null);
    api<Booth[]>('/booths', 'Erreur lors du chargement des booths')
      .then(setBooths)
      .catch((e: Error) => setError(e.message));
  }, [planning]);

  const groups = useMemo(() => {
    const text = q.trim().toLowerCase();
    const list = (booths || []).filter((b) => !text
      || (b.supplier_name || '').toLowerCase().includes(text) || b.booth_code.toLowerCase().includes(text));
    const map = new Map<string, Booth[]>();
    for (const b of list) map.set(hallOf(b), [...(map.get(hallOf(b)) || []), b]);
    return [...map.entries()].map(([label, rows]) => {
      const hall = (booths || []).filter((b) => hallOf(b) === label);
      const done = hall.filter((b) => b.visited).length;
      const shown = !planning ? rows
        : hideVisited ? rows.filter((b) => !b.visited)
          : [...rows.filter((b) => !b.visited), ...rows.filter((b) => b.visited)];
      return { label, rows: shown, done, total: hall.length };
    }).filter((g) => g.rows.length > 0);
  }, [booths, q, planning, hideVisited]);

  const doneCount = (booths || []).filter((b) => b.visited).length;
  const todoCount = (booths || []).length - doneCount;

  // The list changes at once; a refusal puts the booth back and shows the server's message.
  const toggleVisited = async (booth: Booth) => {
    const visited = !booth.visited;
    const setOne = (v: boolean) => setBooths((list) => list && list.map((b) => (b.id === booth.id ? { ...b, visited: v ? 1 : 0 } : b)));
    setError(null);
    setSaving((ids) => [...ids, booth.id]);
    setOne(visited);
    try {
      await api(`/booths/${booth.id}/visited`, "Erreur lors de l'enregistrement", { method: 'PATCH', body: jsonBody({ visited }) });
    } catch (e) {
      setOne(!visited);
      setError((e as Error).message);
    } finally {
      setSaving((ids) => ids.filter((id) => id !== booth.id));
    }
  };

  const empty = !planning ? 'Aucun booth.'
    : (booths || []).length === 0 ? 'Aucun booth à visiter.'
      : todoCount === 0 && hideVisited && !q.trim() ? 'Tous les booths sont visités.' : 'Aucun booth trouvé.';

  return (
    <Page title={planning ? 'À visiter' : 'Booths'} subtitle="Complexe de Pazhou"
      action={(
        <Link to="/plan" className="flex items-center gap-1 rounded-md bg-white/10 px-2.5 py-1.5 text-sm font-medium active:bg-white/20">
          <Icon name="map" size={16} />Plan des halls
        </Link>
      )}>
      <input className={inputClass} placeholder="Fournisseur ou code du booth" value={q} onChange={(e) => setQ(e.target.value)} />
      <ErrorBox message={error} />
      {!booths && !error && <Loading />}
      {planning && booths && booths.length > 0 && (
        <Card className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm text-slate-600">
              <span className="font-display text-2xl font-bold text-slate-900">{todoCount}</span> à visiter · {doneCount} visité{doneCount > 1 ? 's' : ''}
            </div>
            <button type="button" onClick={() => setHideVisited((h) => !h)}
              className="min-h-[36px] rounded-full border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 active:bg-slate-100">
              {hideVisited ? 'Afficher visités' : 'Masquer visités'}
            </button>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.round((doneCount / booths.length) * 100)}%` }} />
          </div>
        </Card>
      )}
      {booths && groups.length === 0 && <p className="py-8 text-center text-slate-500">{empty}</p>}
      {groups.map((g) => (
        <section key={g.label} className="space-y-2">
          <div className="space-y-1.5 px-1 pt-1">
            <h2 className="flex justify-between font-sans">
              <span className="label">{g.label}</span>
              {planning && <span className="text-xs font-semibold text-slate-600">{g.total - g.done} restant{g.total - g.done > 1 ? 's' : ''}</span>}
            </h2>
            {planning && (
              <div className="h-1 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-green-600" style={{ width: `${Math.round((g.done / g.total) * 100)}%` }} />
              </div>
            )}
          </div>
          {g.rows.map((b) => (
            <Card key={b.id} className={`flex items-center gap-3 ${planning && b.visited ? 'opacity-70' : ''}`}>
              <Link to={`/booths/${b.id}`} className="flex min-w-0 flex-1 items-center gap-3 active:opacity-70">
                <div className={`w-28 shrink-0 font-display font-bold text-blue-700 ${planning ? 'text-lg' : ''}`}>{b.booth_code}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{b.supplier_name || 'Sans fournisseur'}</div>
                  <div className="truncate text-sm text-slate-500">{b.sub_category || 'Sans catégorie'}</div>
                </div>
              </Link>
              {planning ? (
                <button type="button" onClick={() => toggleVisited(b)} disabled={saving.includes(b.id)}
                  aria-label={b.visited ? 'Remettre à visiter' : 'Marquer comme visité'} aria-pressed={!!b.visited}
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 disabled:opacity-50 ${b.visited
                    ? 'border-green-600 bg-green-600 text-white'
                    : 'border-slate-300 bg-white text-slate-300 active:bg-slate-100'}`}>
                  <Icon name="check" size={24} />
                </button>
              ) : (b.visited
                ? <Badge className="bg-green-100 text-green-800">Visité</Badge>
                : <Badge className="bg-orange-100 text-orange-800">À visiter</Badge>)}
            </Card>
          ))}
        </section>
      ))}
    </Page>
  );
}
