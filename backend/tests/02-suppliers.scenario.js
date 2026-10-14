// BF04-BF05: suppliers (province from the list, rating) and their contacts. Reference lists.
const { api, expect, check, PREFIX } = require('./lib');

module.exports = async (ctx) => {
  const { tokens } = ctx;
  const A = tokens.buyerA;
  const B = tokens.buyerB;

  // Reference lists
  expect('lists need a token', await api('GET', '/lists/provinces'), 401);
  const provinces = expect('province list', await api('GET', '/lists/provinces', { token: A }), 200);
  check('23 provinces', provinces.body.data.length === 23);
  const guangdong = provinces.body.data.find((p) => p.name_en === 'Guangdong');
  check('Chinese names are intact', guangdong?.name_zh === '广东');
  const ships = expect('shipping types', await api('GET', '/lists/shipping-types', { token: A }), 200);
  check('11 Incoterms', ships.body.data.length === 11 && ships.body.data.some((s) => s.code === 'FOB'));
  const cats = expect('Canton categories of phase 2', await api('GET', '/lists/canton-categories?phase=2', { token: A }), 200);
  check('only phase 2 rows', cats.body.data.length > 0 && cats.body.data.every((c) => c.phase.startsWith('Phase 2 ')));

  // Suppliers (BF04)
  expect('no token', await api('GET', '/suppliers'), 401);
  expect('supplier without name', await api('POST', '/suppliers', { token: A, body: { phone: '1' } }), 400);
  expect('rating 6', await api('POST', '/suppliers', { token: A, body: { name: `${PREFIX} S`, rating: 6 } }), 400);
  expect('rating 0', await api('POST', '/suppliers', { token: A, body: { name: `${PREFIX} S`, rating: 0 } }), 400);
  expect('invalid e-mail', await api('POST', '/suppliers', { token: A, body: { name: `${PREFIX} S`, email: 'pas-un-mail' } }), 400);
  expect('unknown province', await api('POST', '/suppliers', { token: A, body: { name: `${PREFIX} S`, province_id: 99999 } }), 400);
  expect('name over 200 characters', await api('POST', '/suppliers', { token: A, body: { name: `${PREFIX} ${'x'.repeat(200)}` } }), 400);
  const s = expect('create supplier', await api('POST', '/suppliers', {
    token: A, body: { name: `${PREFIX} Shenzhen 100%_Lighting`, province_id: guangdong.id, rating: 4, email: 'a@b.cn' },
  }), 200);
  const id = s.body.data.id;

  const got = expect('another user of the group reads it', await api('GET', `/suppliers/${id}`, { token: B }), 200);
  check('province name and booth stats from v_suppliers',
    got.body.data.province === 'Guangdong' && got.body.data.nbr_booths === 0 && got.body.data.booth_visit_pct === null);
  const search = expect('search with LIKE wildcards', await api('GET', `/suppliers?q=${encodeURIComponent('100%_')}`, { token: A }), 200);
  check('wildcards matched literally', search.body.data.length === 1 && search.body.data[0].id === id);
  const byProvince = expect('filter by province', await api('GET', `/suppliers?province_id=${guangdong.id}`, { token: A }), 200);
  check('filter keeps the supplier', byProvince.body.data.some((x) => x.id === id));
  expect('invalid province filter', await api('GET', '/suppliers?province_id=abc', { token: A }), 400);

  expect('partial update keeps the rules', await api('PUT', `/suppliers/${id}`, { token: B, body: { rating: 9 } }), 400);
  expect('update supplier', await api('PUT', `/suppliers/${id}`, { token: B, body: { rating: 5, province_id: null } }), 200);
  const updated = await api('GET', `/suppliers/${id}`, { token: A });
  check('update kept the name and cleared the province',
    updated.body.data.name === `${PREFIX} Shenzhen 100%_Lighting` && updated.body.data.province_id === null && updated.body.data.rating === 5);
  expect('unknown supplier', await api('GET', '/suppliers/999999', { token: A }), 404);
  expect('invalid id', await api('GET', '/suppliers/abc', { token: A }), 400);

  // Contacts (BF05)
  expect('empty contact', await api('POST', `/suppliers/${id}/contacts`, { token: A, body: {} }), 400);
  expect('contact with invalid e-mail', await api('POST', `/suppliers/${id}/contacts`, { token: A, body: { name: 'Li', email: 'x' } }), 400);
  expect('contact of unknown supplier', await api('POST', '/suppliers/999999/contacts', { token: A, body: { name: 'Li' } }), 404);
  const c = expect('create contact', await api('POST', `/suppliers/${id}/contacts`, { token: A, body: { name: 'Mr Li', wechat_qr: 'li_wechat' } }), 200);
  expect('contact with only a phone', await api('POST', `/suppliers/${id}/contacts`, { token: A, body: { phone: '+86 1' } }), 200);
  expect('update contact', await api('PUT', `/suppliers/${id}/contacts/${c.body.data.id}`, { token: B, body: { phone: '+86 2' } }), 200);
  expect('contact of another supplier', await api('PUT', `/suppliers/${id + 100000}/contacts/${c.body.data.id}`, { token: A, body: { name: 'X' } }), 404);
  const list = expect('list contacts', await api('GET', `/suppliers/${id}/contacts`, { token: A }), 200);
  check('two contacts', list.body.data.length === 2);
  expect('delete contact', await api('DELETE', `/suppliers/${id}/contacts/${c.body.data.id}`, { token: A }), 200);
  expect('delete it again', await api('DELETE', `/suppliers/${id}/contacts/${c.body.data.id}`, { token: A }), 404);

  ctx.supplierId = id;
};
