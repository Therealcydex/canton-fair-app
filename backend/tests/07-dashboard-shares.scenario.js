// D40: the web home page figures, the supplier search by phone, the "shared or not" product
// filter and sharing several products at once.
const { api, expect, check, PREFIX } = require('./lib');

module.exports = async (ctx) => {
  const { tokens, companies } = ctx;
  const A = tokens.buyerA;
  const B = tokens.buyerB;

  // Dashboard
  expect('dashboard without token', await api('GET', '/dashboard'), 401);
  const before = expect('dashboard (any user)', await api('GET', '/dashboard', { token: B }), 200).body.data;
  check('dashboard has the totals, three phases and the companies',
    Number.isInteger(before.suppliers) && Number.isInteger(before.products_week) && before.phases.length === 3
    && before.phases.every((p) => Number.isInteger(p.planned) && Number.isInteger(p.visited))
    && before.companies.some((c) => c.id === companies.A));

  // Supplier search by phone
  const supplier = expect('create supplier', await api('POST', '/suppliers', {
    token: A, body: { name: `${PREFIX} Fournisseur tableau`, phone: '+86 574 9911 4477' },
  }), 200).body.data.id;
  const byPhone = expect('search suppliers by phone', await api('GET', '/suppliers?q=9911%204477', { token: B }), 200);
  check('the phone finds the supplier', byPhone.body.data.some((s) => s.id === supplier));

  // Bulk sharing: refusals
  const p1 = expect('product 1', await api('POST', '/products', { token: A, body: { name: `${PREFIX} Lot 1`, supplier_id: supplier } }), 200).body.data.id;
  const p2 = expect('product 2', await api('POST', '/products', { token: A, body: { name: `${PREFIX} Lot 2`, supplier_id: supplier } }), 200).body.data.id;
  const body = { product_ids: [p1, p2], company_ids: [companies.A], mode: 'add' };
  expect('bulk share without token', await api('POST', '/products/shares', { body }), 401);
  expect('bulk share, unknown mode', await api('POST', '/products/shares', { token: A, body: { ...body, mode: 'merge' } }), 400);
  expect('bulk share, no product', await api('POST', '/products/shares', { token: A, body: { ...body, product_ids: [] } }), 400);
  expect('bulk share, invalid product id', await api('POST', '/products/shares', { token: A, body: { ...body, product_ids: [p1, 'x'] } }), 400);
  expect('bulk share, add with no company', await api('POST', '/products/shares', { token: A, body: { ...body, company_ids: [] } }), 400);
  expect('bulk share, company_ids not a list', await api('POST', '/products/shares', { token: A, body: { ...body, company_ids: 3 } }), 400);
  expect('bulk share, unknown product', await api('POST', '/products/shares', { token: A, body: { ...body, product_ids: [p1, 999999] } }), 404);
  expect('bulk share, unknown company', await api('POST', '/products/shares', { token: A, body: { ...body, company_ids: [999999] } }), 404);
  const untouched = (await api('GET', `/products?supplier_id=${supplier}&shared=1`, { token: A })).body.data;
  check('a refused bulk share changes nothing', untouched.length === 0);

  // Bulk sharing: add, then replace
  expect('bulk share, add', await api('POST', '/products/shares', { token: A, body }), 200);
  expect('product 1 also shared with B', await api('POST', `/products/${p1}/shares`, { token: A, body: { company_id: companies.B } }), 200);
  expect('bulk share, add again (no duplicate)', await api('POST', '/products/shares', { token: B, body }), 200);
  const added = (await api('GET', `/products?supplier_id=${supplier}`, { token: A })).body.data;
  const ids = (id) => added.find((p) => p.id === id).shared_company_ids;
  check('add keeps the existing shares', ids(p1) === [companies.A, companies.B].sort((a, b) => a - b).join(',') && ids(p2) === String(companies.A));

  expect('bulk share, replace', await api('POST', '/products/shares', { token: A, body: { ...body, company_ids: [companies.B], mode: 'replace' } }), 200);
  const replaced = (await api('GET', `/products?supplier_id=${supplier}&shared=1`, { token: A })).body.data;
  check('replace sets exactly the list', replaced.length === 2 && replaced.every((p) => p.shared_company_ids === String(companies.B)));

  // The shared filter
  expect('bulk share, replace with nothing (unshare product 2)', await api('POST', '/products/shares', {
    token: A, body: { product_ids: [p2], company_ids: [], mode: 'replace' },
  }), 200);
  const shared = (await api('GET', `/products?supplier_id=${supplier}&shared=1`, { token: A })).body.data.map((p) => p.id);
  const notShared = (await api('GET', `/products?supplier_id=${supplier}&shared=0`, { token: A })).body.data.map((p) => p.id);
  check('shared=1 / shared=0 split the products', shared.join() === String(p1) && notShared.join() === String(p2));
  expect('invalid shared filter', await api('GET', '/products?shared=yes', { token: A }), 400);

  const after = (await api('GET', '/dashboard', { token: A })).body.data;
  check('the dashboard counts the new supplier, products and share',
    after.suppliers === before.suppliers + 1 && after.products === before.products + 2
    && after.products_week === before.products_week + 2 && after.shares === before.shares + 1
    && after.companies.find((c) => c.id === companies.B).shared === 1);

  expect('delete supplier', await api('DELETE', `/suppliers/${supplier}`, { token: A }), 200);
};
