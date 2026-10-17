// Display helpers shared by the booth and product screens.

// "12.50" (DECIMAL as a string, never a float) -> "12,50". No currency: schema v2 does not store one.
export const formatPrice = (s) => (s === null || s === undefined || s === '' ? '—' : String(s).replace('.', ','));

// D53: a booth as the boss reads it, phase first: "Ph1 3.1E12-13".
export const boothLabel = (phase, code) => (code ? `Ph${phase} ${code}` : '');
