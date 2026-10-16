import { useEffect, useMemo, useState } from 'react';
import { api } from '../config/api';
import { AREAS } from '../halls';
import { Card, ErrorBox, Loading, Page } from '../components/ui';

interface PlanRow {
  phase: number;
  category: string;
  section: string;
  area: string | null; // D48: A, B, C or D; null when the section has no halls
  halls: string | null;
}

const PHASES = [
  { phase: 1, label: 'Phase 1', dates: '15-19 oct.' },
  { phase: 2, label: 'Phase 2', dates: '23-27 oct.' },
  { phase: 3, label: 'Phase 3', dates: '31 oct.-4 nov.' },
];

// D42: "Plan des halls": which halls hold each exhibition section in this session, by phase, laid
// out like the official plan (D48): Zone A, D, C, B, each section with its codes in that zone (a
// section in two zones shows in both). Read only (D51): it is the official plan.
export default function FairPlanPage() {
  const [phase, setPhase] = useState(1);
  const [rows, setRows] = useState<PlanRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<PlanRow[]>('/fair-plan', 'Erreur lors du chargement du plan').then(setRows).catch((e: Error) => setError(e.message));
  }, []);

  // The sections of the chosen phase, by zone as on the plan; sections without halls come last.
  const groups = useMemo(() => {
    const byKey = new Map<string, { title: string; rows: PlanRow[] }>();
    for (const area of [...AREAS, '?', 'none']) {
      byKey.set(area, { title: area === '?' ? 'Autres' : area === 'none' ? 'Sans hall' : `Zone ${area}`, rows: [] });
    }
    for (const r of (rows || []).filter((x) => x.phase === phase)) {
      const key = !r.halls ? 'none' : byKey.has(r.area || '') ? (r.area as string) : '?';
      byKey.get(key)?.rows.push(r);
    }
    return [...byKey.entries()].filter(([, g]) => g.rows.length);
  }, [rows, phase]);

  return (
    <Page title="Plan des halls" back>
      <div className="grid grid-cols-3 rounded-lg bg-slate-200 p-1 text-sm">
        {PHASES.map((p) => (
          <button key={p.phase} onClick={() => setPhase(p.phase)}
            className={`rounded-md py-1.5 leading-tight ${phase === p.phase ? 'bg-white font-semibold shadow-sm' : 'text-slate-600'}`}>
            {p.label}<span className="block text-xs font-normal text-slate-500">{p.dates}</span>
          </button>
        ))}
      </div>
      <p className="px-1 text-xs text-slate-500">Plan officiel de la 140e session (site Canton Fair 365).</p>
      <ErrorBox message={error} />
      {!rows && !error && <Loading />}
      {groups.map(([area, group]) => (
        <section key={area} className="space-y-2">
          <h2 className="label px-1 font-sans">{group.title}</h2>
          <Card className="divide-y divide-slate-100 p-0">
            {group.rows.map((s) => (
              <div key={s.section} className="p-3">
                <span className="block text-sm font-medium">{s.section}</span>
                <span className={`block text-sm ${s.halls ? 'text-slate-700' : 'text-slate-400'}`}>{s.halls || '—'}</span>
              </div>
            ))}
          </Card>
        </section>
      ))}
    </Page>
  );
}
