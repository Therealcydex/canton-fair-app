// D62: the admin shares a booth with one of Tarek's companies; that company's viewers (LECTEUR)
// only read the booths shared with it, and the server refuses every write they try.
const { api, expect, check, login, PREFIX } = require('./lib');

module.exports = async (ctx) => {
  const { tokens, companies, adminToken: ADMIN, password } = ctx;
  const A = tokens.buyerA;

  // A viewer needs a company.
  const viewer = { name: `${PREFIX} lecteur B`, username: `${PREFIX}_viewerB`, password, role: 'LECTEUR' };
  expect('viewer without company', await api('POST', '/users', { token: ADMIN, body: viewer }), 400);
  expect('viewer of company B', await api('POST', '/users', { token: ADMIN, body: { ...viewer, company_id: companies.B } }), 200);
  const V = await login(viewer.username, password);

  // Data: a supplier, two booths, a product found at the first one.
  const supplier = expect('supplier', await api('POST', '/suppliers', { token: A, body: { name: `${PREFIX} Fournisseur partagé`, phone: '+86 20 1234' } }), 200).body.data.id;
  const base = { phase: 1, hall: 18, floor: 1, letter: 'Z', supplier_id: supplier, comment: `${PREFIX} lecteur` };
  const shared = expect('booth to share', await api('POST', '/booths', { token: A, body: { ...base, num_start: 91 } }), 200).body.data.id;
  const other = expect('booth not shared', await api('POST', '/booths', { token: A, body: { ...base, num_start: 93 } }), 200).body.data.id;
  expect('product at the booth', await api('POST', '/products', { token: A, body: { name: `${PREFIX} Produit partagé`, booth_id: shared, price: '2.50' } }), 200);

  // Only the admin shares, with real companies.
  expect('buyer shares a booth', await api('PUT', `/booths/${shared}`, { token: A, body: { share_company_ids: [companies.B] } }), 403);
  expect('buyer creates a shared booth', await api('POST', '/booths', { token: A, body: { ...base, num_start: 95, share_company_ids: [companies.B] } }), 403);
  expect('shares not a list', await api('PUT', `/booths/${shared}`, { token: ADMIN, body: { share_company_ids: 3 } }), 400);
  expect('share with an unknown company', await api('PUT', `/booths/${shared}`, { token: ADMIN, body: { share_company_ids: [999999] } }), 400);
  const unshared = (await api('GET', `/booths/${shared}`, { token: A })).body.data;
  check('a refused share changes nothing', unshared.shared_company_ids === null);
  expect('admin shares the booth with B', await api('PUT', `/booths/${shared}`, { token: ADMIN, body: { share_company_ids: [companies.B, companies.B] } }), 200);
  const got = (await api('GET', `/booths/${shared}`, { token: A })).body.data;
  check('the booth knows its company', got.shared_company_ids === String(companies.B));
  expect('a buyer edit without shares keeps them', await api('PUT', `/booths/${shared}`, { token: A, body: { comment: `${PREFIX} lecteur, modifié` } }), 200);
  check('shares kept', (await api('GET', `/booths/${shared}`, { token: A })).body.data.shared_company_ids === String(companies.B));

  // The viewer reads only its shared booth.
  const list = expect('viewer lists its booths', await api('GET', '/booths', { token: V }), 200).body.data;
  check('only the shared booth', list.length >= 1 && list.some((b) => b.id === shared) && !list.some((b) => b.id === other));
  const one = expect('viewer opens the shared booth', await api('GET', `/booths/${shared}`, { token: V }), 200).body.data;
  check('it comes with its product and supplier, without the decision',
    one.products.length === 1 && one.products[0].price === '2.50' && one.products[0].status === undefined
    && one.supplier.name === `${PREFIX} Fournisseur partagé`);
  expect('viewer opens a booth not shared', await api('GET', `/booths/${other}`, { token: V }), 404);
  check('a buyer gets no embedded products', (await api('GET', `/booths/${shared}`, { token: A })).body.data.products === undefined);

  // The viewer changes nothing and reads nothing else.
  expect('viewer edits the booth', await api('PUT', `/booths/${shared}`, { token: V, body: { comment: 'x' } }), 403);
  expect('viewer marks it visited', await api('PATCH', `/booths/${shared}/visited`, { token: V, body: { visited: true } }), 403);
  expect('viewer deletes it', await api('DELETE', `/booths/${shared}`, { token: V }), 403);
  expect('viewer creates a booth', await api('POST', '/booths', { token: V, body: { ...base, num_start: 97 } }), 403);
  for (const url of ['/suppliers', `/suppliers/${supplier}`, '/products', '/contacts', '/dashboard', '/companies', '/users', '/fair-plan']) {
    expect(`viewer reads ${url}`, await api('GET', url, { token: V }), 403);
  }
  expect('viewer creates a supplier', await api('POST', '/suppliers', { token: V, body: { name: `${PREFIX} x` } }), 403);
  expect('viewer reads the reference lists', await api('GET', '/lists/provinces', { token: V }), 200);

  // Unsharing, then deleting the booth removes its shares (FK cascade).
  expect('admin unshares', await api('PUT', `/booths/${shared}`, { token: ADMIN, body: { share_company_ids: [] } }), 200);
  expect('the viewer no longer sees it', await api('GET', `/booths/${shared}`, { token: V }), 404);
  expect('admin shares it again', await api('PUT', `/booths/${shared}`, { token: ADMIN, body: { share_company_ids: [companies.A, companies.B] } }), 200);
  expect('delete the supplier (booths stay)', await api('DELETE', `/suppliers/${supplier}`, { token: A }), 200);
  expect('delete the shared booth', await api('DELETE', `/booths/${shared}`, { token: A }), 200);
  expect('delete the other booth', await api('DELETE', `/booths/${other}`, { token: A }), 200);
};
