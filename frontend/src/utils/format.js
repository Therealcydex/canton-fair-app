// Display helpers shared by the booth and product screens.

// D67: a product's price is in USD, TND or CNY (dollar, dinar, yuan).
export const CURRENCIES = [
  { value: 'USD', label: 'Dollar (USD)' },
  { value: 'TND', label: 'Dinar tunisien (TND)' },
  { value: 'CNY', label: 'Yuan (CNY)' },
];

// "12.50" (DECIMAL as a string, never a float) -> "12,50 USD".
export const formatPrice = (s, currency) => {
  if (s === null || s === undefined || s === '') return '—';
  const amount = String(s).replace('.', ',');
  return currency ? `${amount} ${currency}` : amount;
};

// D53: a booth as the boss reads it, phase first: "Ph1 3.1E12-13".
export const boothLabel = (phase, code) => (code ? `Ph${phase} ${code}` : '');
