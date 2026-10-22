// D66: the admin shares a supplier with some of Tarek's companies; the viewers (LECTEUR) of any
// of them read it, with its contacts, booths and products, and the server refuses every write
// they try. A user belongs to several companies. Also the supplier filters phase, hall and the
// provinces in use.
const { api, expect, check, login, PREFIX } = require('./lib');

module.exports = async (ctx) => {
  const { tokens, companies, adminToken: ADMIN, password } = ctx;
  const A = tokens.buyerA;

  // A user has any number of companies; a viewer needs at least one.
  const viewer = { name: `${PREFIX} lecteur`, username: `${PREFIX}_viewer`, password, role: 'LECTEUR' };
  expect('viewer without company', await api('POST', '/users', { token: ADMIN, body: viewer }), 400);
  expect('viewer with an empty company list', await api('POST', '/users', { token: ADMIN, body: { ...viewer, company_ids: [] } }), 400);
  expect('companies not a list', await api('POST', '/users', { token: ADMIN, body: { ...viewer, company_ids: companies.B } }), 400);
  expect('an unknown company', await api('POST', '/users', { token: ADMIN, body: { ...viewer, company_ids: [companies.B, 999999] } }), 400);
  const viewerId = expect('viewer of companies A and B', await api('POST', '/users', {
    token: ADMIN, body: { ...viewer, company_ids: [companies.B, companies.A, companies.B] },
  }), 200).body.data.id;
  const stored = (await api('GET', `/users/${viewerId}`, { token: ADMIN })).body.data;
  check('the user has both companies', stored.company_ids.join() === [companies.A, companies.B].sort((x, y) => x - y).join());
  const V = await login(viewer.username, password);
  check('/me gives the viewer its companies', (await api('GET', '/me', { token: V })).body.data.companies.length === 2);
  expect('an edit without company_ids keeps them', await api('PUT', `/users/${viewerId}`, { token: ADMIN, body: { name: `${PREFIX} lecteur 2` } }), 200);
  check('companies kept', (await api('GET', `/users/${viewerId}`, { token: ADMIN })).body.data.company_ids.length === 2);
  expect('a viewer cannot lose its last company', await api('PUT', `/users/${viewerId}`, { token: ADMIN, body: { company_ids: [] } }), 400);
  expect('the admin keeps only company B', await api('PUT', `/users/${viewerId}`, { token: ADMIN, body: { company_ids: [companies.B] } }), 200);
  const byCompany = (await api('GET', `/users?company_id=${companies.B}`, { token: ADMIN })).body.data;
  check('the user filter by company finds it', byCompany.some((u) => u.id === viewerId));

  // Data: two suppliers, booths, a product and a contact.
  const provinces = (await api('GET', '/lists/provinces', { token: A })).body.data;
  const province = provinces[provinces.length - 1].id;
  const shared = expect('supplier to share', await api('POST', '/suppliers', { token: A, body: { name: `${PREFIX} Fournisseur partagé`, phone: '+86 20 1234', province_id: province } }), 200).body.data.id;
  const other = expect('supplier not shared', await api('POST', '/suppliers', { token: A, body: { name: `${PREFIX} Fournisseur privé` } }), 200).body.data.id;
  expect('a contact', await api('POST', `/suppliers/${shared}/contacts`, { token: A, body: { name: `${PREFIX} Mme Li` } }), 200);
  const base = { phase: 2, hall: 17, floor: 1, letter: 'Z', comment: `${PREFIX} lecteur` };
  const sharedBooth = expect('booth of the shared supplier', await api('POST', '/booths', { token: A, body: { ...base, num_start: 91, supplier_id: shared } }), 200).body.data.id;
  const otherBooth = expect('booth of the other supplier', await api('POST', '/booths', { token: A, body: { ...base, num_start: 93, hall: 16, supplier_id: other } }), 200).body.data.id;
  expect('product at the shared booth', await api('POST', '/products', { token: A, body: { name: `${PREFIX} Produit partagé`, booth_id: sharedBooth, price: '2.50' } }), 200);

  // Supplier filters (D66): phase and hall through the booths; provinces in use.
  const ids = async (query) => (await api('GET', `/suppliers?q=${PREFIX}&${query}`, { token: A })).body.data.map((s) => s.id);
  check('phase 2 finds both', (await ids('phase=2')).length === 2);
  check('hall 17 finds the shared one', (await ids('hall=17')).join() === String(shared));
  check('phase 2 and hall 16 finds the other', (await ids('phase=2&hall=16')).join() === String(other));
  check('phase 1 finds none', (await ids('phase=1')).length === 0);
  expect('phase 4', await api('GET', '/suppliers?phase=4', { token: A }), 400);
  expect('hall 19', await api('GET', '/suppliers?hall=19', { token: A }), 400);
  const used = expect('provinces in use', await api('GET', '/suppliers/provinces', { token: A }), 200).body.data;
  check('the province of a supplier is in use', used.some((p) => p.id === province));
  check('only provinces in use', used.length < provinces.length);

  // Only the admin shares, with real companies.
  expect('buyer shares a supplier', await api('PUT', `/suppliers/${shared}`, { token: A, body: { share_company_ids: [companies.B] } }), 403);
  expect('buyer creates a shared supplier', await api('POST', '/suppliers', { token: A, body: { name: `${PREFIX} x`, share_company_ids: [companies.B] } }), 403);
  expect('shares not a list', await api('PUT', `/suppliers/${shared}`, { token: ADMIN, body: { share_company_ids: 3 } }), 400);
  expect('share with an unknown company', await api('PUT', `/suppliers/${shared}`, { token: ADMIN, body: { share_company_ids: [999999] } }), 400);
  check('a refused share changes nothing', (await api('GET', `/suppliers/${shared}`, { token: A })).body.data.shared_company_ids.length === 0);
  expect('admin shares the supplier with A and B', await api('PUT', `/suppliers/${shared}`, { token: ADMIN, body: { share_company_ids: [companies.B, companies.A, companies.B] } }), 200);
  const got = (await api('GET', `/suppliers/${shared}`, { token: A })).body.data;
  check('the supplier knows its companies', got.shared_company_ids.length === 2 && got.shared_company_ids.includes(companies.B));
  expect('a buyer edit without shares keeps them', await api('PUT', `/suppliers/${shared}`, { token: A, body: { notes: `${PREFIX} modifié` } }), 200);
  check('shares kept', (await api('GET', `/suppliers/${shared}`, { token: A })).body.data.shared_company_ids.length === 2);
  check('the list gives the shares too', (await api('GET', `/suppliers?q=${PREFIX}`, { token: A })).body.data.find((s) => s.id === shared).shared_company_ids.length === 2);
  check('booths no longer take shares', (await api('PUT', `/booths/${otherBooth}`, { token: ADMIN, body: { share_company_ids: [companies.B] } })).status === 200);

  // The viewer (company B only) reads the shared supplier and what hangs from it.
  const list = expect('viewer lists its suppliers', await api('GET', '/suppliers', { token: V }), 200).body.data;
  check('only the shared supplier, without its shares', list.some((s) => s.id === shared) && !list.some((s) => s.id === other)
    && list.every((s) => s.shared_company_ids === undefined));
  const one = expect('viewer opens the shared supplier', await api('GET', `/suppliers/${shared}`, { token: V }), 200).body.data;
  check('with its contacts and products, without the decision',
    one.contacts.length === 1 && one.products.length === 1 && one.products[0].price === '2.50' && one.products[0].status === undefined);
  check('a buyer gets no embedded products', (await api('GET', `/suppliers/${shared}`, { token: A })).body.data.products === undefined);
  expect('viewer opens a supplier not shared', await api('GET', `/suppliers/${other}`, { token: V }), 404);
  check('viewer provinces: those of its suppliers', (await api('GET', '/suppliers/provinces', { token: V })).body.data.every((p) => p.id === province));
  const booths = expect('viewer lists its booths', await api('GET', '/booths', { token: V }), 200).body.data;
  check('only the shared supplier\'s booths', booths.some((b) => b.id === sharedBooth) && !booths.some((b) => b.id === otherBooth));
  const booth = expect('viewer opens the shared booth', await api('GET', `/booths/${sharedBooth}`, { token: V }), 200).body.data;
  check('the booth comes with its product and supplier', booth.products.length === 1 && booth.supplier.id === shared);
  expect('viewer opens a booth not shared', await api('GET', `/booths/${otherBooth}`, { token: V }), 404);

  // The viewer changes nothing and reads nothing else.
  expect('viewer edits the supplier', await api('PUT', `/suppliers/${shared}`, { token: V, body: { notes: 'x' } }), 403);
  expect('viewer deletes the supplier', await api('DELETE', `/suppliers/${shared}`, { token: V }), 403);
  expect('viewer creates a supplier', await api('POST', '/suppliers', { token: V, body: { name: `${PREFIX} x` } }), 403);
  expect('viewer reads the contacts route', await api('GET', `/suppliers/${shared}/contacts`, { token: V }), 403);
  expect('viewer adds a contact', await api('POST', `/suppliers/${shared}/contacts`, { token: V, body: { name: 'x' } }), 403);
  expect('viewer edits the booth', await api('PUT', `/booths/${sharedBooth}`, { token: V, body: { comment: 'x' } }), 403);
  expect('viewer marks it visited', await api('PATCH', `/booths/${sharedBooth}/visited`, { token: V, body: { visited: true } }), 403);
  for (const url of ['/products', '/contacts', '/dashboard', '/companies', '/users', '/fair-plan']) {
    expect(`viewer reads ${url}`, await api('GET', url, { token: V }), 403);
  }
  expect('viewer reads the reference lists', await api('GET', '/lists/provinces', { token: V }), 200);

  // Unsharing hides it at once; deleting the supplier removes its shares (FK cascade).
  expect('admin unshares company B', await api('PUT', `/suppliers/${shared}`, { token: ADMIN, body: { share_company_ids: [companies.A] } }), 200);
  expect('the viewer no longer sees it', await api('GET', `/suppliers/${shared}`, { token: V }), 404);
  expect('the viewer joins company A again', await api('PUT', `/users/${viewerId}`, { token: ADMIN, body: { company_ids: [companies.A, companies.B] } }), 200);
  expect('it sees it through company A', await api('GET', `/suppliers/${shared}`, { token: V }), 200);
  expect('delete the shared supplier', await api('DELETE', `/suppliers/${shared}`, { token: A }), 200);
  expect('delete the other supplier', await api('DELETE', `/suppliers/${other}`, { token: A }), 200);
  expect('delete the booths', await api('DELETE', `/booths/${sharedBooth}`, { token: A }), 200);
  expect('delete the other booth', await api('DELETE', `/booths/${otherBooth}`, { token: A }), 200);
};
