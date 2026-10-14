// Display helpers, same output as the web app (frontend/src/utils/format.js).
import type { VisitStatus } from './types';

export const VISIT_STATUS: Record<VisitStatus, { label: string; className: string }> = {
  prevu: { label: 'Prévu', className: 'bg-blue-100 text-blue-800' },
  visite: { label: 'Visité', className: 'bg-green-100 text-green-800' },
  annule: { label: 'Annulé', className: 'bg-slate-200 text-slate-700' },
};

// "2026-10-16 10:30:00" (the time at the fair) -> "16/10 10:30".
export const formatDateTime = (s?: string | null) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(s || '');
  return m ? `${m[3]}/${m[2]} ${m[4]}:${m[5]}` : '—';
};

// "12.500" (DECIMAL as a string, never a float) -> "12,500 TND".
export const formatPrice = (s?: string | null) => (s ? `${s.replace('.', ',')} TND` : '—');
