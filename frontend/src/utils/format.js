// Display helpers shared by the booth and product screens.

// "12.50" (DECIMAL as a string, never a float) -> "12,50". No currency: schema v2 does not store one.
export const formatPrice = (s) => (s === null || s === undefined || s === '' ? '—' : String(s).replace('.', ','));
