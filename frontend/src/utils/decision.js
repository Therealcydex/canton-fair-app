// D38: the decisions on a product, as the mobile app shows them (mobile/src/decision.ts).
// The server owns the rule (only the admin decides); the browser only displays it.
export const STATUS = {
  A_ETUDIER: { label: 'À étudier', color: 'default' },
  RETENU: { label: 'Retenu', color: 'green' },
  ECHANTILLON: { label: 'Échantillon', color: 'blue' },
  A_COMMANDER: { label: 'À commander', color: 'purple' },
  REJETE: { label: 'Rejeté', color: 'red' },
};

// The four decisions the admin picks from.
export const DECISIONS = ['RETENU', 'ECHANTILLON', 'A_COMMANDER', 'REJETE'];

// "2026-10-15 18:42:07" -> "15/10/2026 18:42" (stored as the time at the fair, never shifted).
export const formatDateTime = (s) => {
  const m = s ? /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/.exec(s) : null;
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : '—';
};
