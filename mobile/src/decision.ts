// D38: the decisions on a product, as the web app shows them (frontend/src/utils/decision.js).
// The server owns the rule (only the admin decides); the app only displays it.
import type { ProductStatus } from './types';

export const STATUS: Record<ProductStatus, { label: string; badge: string; button: string }> = {
  A_ETUDIER: { label: 'À étudier', badge: 'bg-slate-100 text-slate-700', button: '' },
  RETENU: { label: 'Retenu', badge: 'bg-green-100 text-green-800', button: 'bg-green-600 text-white active:bg-green-700' },
  ECHANTILLON: { label: 'Échantillon', badge: 'bg-blue-100 text-blue-800', button: 'bg-blue-600 text-white active:bg-blue-700' },
  A_COMMANDER: { label: 'À commander', badge: 'bg-violet-100 text-violet-800', button: 'bg-violet-600 text-white active:bg-violet-700' },
  REJETE: { label: 'Rejeté', badge: 'bg-red-100 text-red-800', button: 'bg-white text-red-600 border border-red-300 active:bg-red-50' },
};

// The four decisions the boss picks from at the review.
export const DECISIONS: ProductStatus[] = ['RETENU', 'ECHANTILLON', 'A_COMMANDER', 'REJETE'];

export const isAdmin = (user?: { role: string } | null) => user?.role === 'ADMIN';

// "2026-10-15 18:42:07" -> "15/10 18:42" (stored as the time at the fair, never shifted).
export const shortDate = (s?: string | null) => {
  const m = s ? /^\d{4}-(\d{2})-(\d{2}) (\d{2}):(\d{2})/.exec(s) : null;
  return m ? `${m[2]}/${m[1]} ${m[3]}:${m[4]}` : '';
};
