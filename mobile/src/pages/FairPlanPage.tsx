import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, jsonBody } from '../config/api';
import { useAuth } from '../authContext';
import { isAdmin } from '../decision';
import { Card, ErrorBox, Loading, Page, inputClass } from '../components/ui';

interface PlanRow {
  phase: number;
  category: string;
  section: string;
  halls: string | null;
}

const PHASES = [
  { phase: 1, label: 'Phase 1', dates: '15-19 oct.' },
  { phase: 2, label: 'Phase 2', dates: '23-27 oct.' },
  { phase: 3, label: 'Phase 3', dates: '31 oct.-4 nov.' },
];

// D42: "Plan des halls": which halls hold each exhibition section in this session, by phase. The
// admin taps a section to type its halls from the official printed plan; the others read it.
export default function FairPlanPage() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [phase, setPhase] = useState(1);
  const [rows, setRows] = useState<PlanRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null); // the section being edited
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => api<PlanRow[]>('/fair-plan', 'Erreur lors du chargement du plan')
    .then(setRows).catch((e: Error) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  // The sections of the chosen phase, under their category.
  const groups = useMemo(() => {
    const map = new Map<string, PlanRow[]>();
    for (const r of (rows || []).filter((x) => x.phase === phase)) map.set(r.category, [...(map.get(r.category) || []), r]);
    return [...map.entries()];
  }, [rows, phase]);

  const save = async (e: FormEvent, row: PlanRow) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api('/fair-plan', "Les halls n'ont pas été enregistrés", {
        method: 'PUT', body: jsonBody({ phase: row.phase, section: row.section, halls: value.trim() }),
      });
      await load();
      setEditing(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page title="Plan des halls" back>
      <div className="grid grid-cols-3 rounded-lg bg-slate-200 p-1 text-sm">
        {PHASES.map((p) => (
          <button key={p.phase} onClick={() => { setPhase(p.phase); setEditing(null); }}
            className={`rounded-md py-1.5 leading-tight ${phase === p.phase ? 'bg-white font-semibold shadow-sm' : 'text-slate-600'}`}>
            {p.label}<span className="block text-xs font-normal text-slate-500">{p.dates}</span>
          </button>
        ))}
      </div>
      <p className="px-1 text-xs text-slate-500">
        {admin ? 'Touchez une section pour saisir ses halls depuis le plan officiel de cette session.' : "Halls saisis par l'administrateur depuis le plan officiel de la session."}
      </p>
      <ErrorBox message={error} />
      {!rows && !error && <Loading />}
      {groups.map(([category, sections]) => (
        <section key={category} className="space-y-2">
          <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-slate-500">{category}</h2>
          <Card className="divide-y divide-slate-100 p-0">
            {sections.map((s) => (editing === s.section ? (
              <form key={s.section} onSubmit={(e) => save(e, s)} className="space-y-2 p-3">
                <p className="text-sm font-medium">{s.section}</p>
                <input className={inputClass} value={value} onChange={(e) => setValue(e.target.value)} maxLength={255}
                  inputMode="decimal" placeholder="ex. 14.3, 14.4, 15.4" aria-label={`Halls de ${s.section}`} autoFocus />
                <div className="flex gap-4 text-sm">
                  <button type="submit" disabled={saving} className="font-semibold text-blue-700">{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
                  <button type="button" onClick={() => setEditing(null)} className="text-slate-600">Annuler</button>
                </div>
              </form>
            ) : (
              <button key={s.section} type="button" disabled={!admin}
                onClick={() => { setEditing(s.section); setValue(s.halls || ''); setError(null); }}
                className="flex w-full items-center justify-between gap-3 p-3 text-left disabled:cursor-default">
                <span className="min-w-0 text-sm">{s.section}</span>
                <span className={`shrink-0 text-right text-sm ${s.halls ? 'font-semibold' : 'text-slate-400'}`}>{s.halls || (admin ? 'Ajouter' : '—')}</span>
              </button>
            )))}
          </Card>
        </section>
      ))}
    </Page>
  );
}
