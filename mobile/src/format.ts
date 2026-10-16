// Display helpers, same output as the web app (frontend/src/utils/format.js).

// "12.50" (DECIMAL as a string, never a float) -> "12,50". Schema v2 stores no currency.
export const formatPrice = (s?: string | null) => (s ? s.replace('.', ',') : '—');

// Company with its branch: "Groupe - Tunis".
export const companyLabel = (c: { name: string; branch: string | null }) => (c.branch ? `${c.name} - ${c.branch}` : c.name);
