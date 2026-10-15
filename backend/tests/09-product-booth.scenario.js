// D43: the booth where a product was found. A booth of the product's supplier (or a booth without
// a supplier); a product without a supplier takes the booth's.
const { api, expect, check, PREFIX } = require('./lib');

module.exports = async (ctx) => {
  const A = ctx.tokens.buyerA;
  const s1 = (await api('POST', '/suppliers', { token: A, body: { name: `${PREFIX} Booth supplier 1` } })).body.data.id;
  const s2 = (await api('POST', '/suppliers', { token: A, body: { name: `${PREFIX} Booth supplier 2` } })).body.data.id;
  const place = { phase: 2, hall: 125, floor: 1, comment: `${PREFIX} product booth` };
  const b1 = (await api('POST', '/booths', { token: A, body: { ...place, letter: 'A', num_start: 1, supplier_id: s1 } })).body.data;
  const b2 = (await api('POST', '/booths', { token: A, body: { ...place, letter: 'B', num_start: 2 } })).body.data;
  check('test booths created', !!b1?.id && !!b2?.id);

  expect('invalid booth', await api('POST', '/products', { token: A, body: { name: `${PREFIX} P`, booth_id: 'x' } }), 400);
  expect('unknown booth', await api('POST', '/products', { token: A, body: { name: `${PREFIX} P`, booth_id: 999999 } }), 400);
  expect("another supplier's booth", await api('POST', '/products', { token: A, body: { name: `${PREFIX} P`, supplier_id: s2, booth_id: b1.id } }), 400);

  const p = expect('product from a booth, no supplier given', await api('POST', '/products', { token: A, body: { name: `${PREFIX} Théière`, booth_id: b1.id } }), 200);
  const id = p.body.data.id;
  const got = (await api('GET', `/products/${id}`, { token: A })).body.data;
  check("it takes the booth's supplier, and shows the booth code", got.supplier_id === s1 && got.booth_id === b1.id
    && got.booth_code === b1.booth_code && got.booth_phase === 2);
  const byBooth = expect('filter by booth', await api('GET', `/products?booth_id=${b1.id}`, { token: A }), 200);
  check('only the products of that booth', byBooth.body.data.length === 1 && byBooth.body.data[0].id === id);
  expect('invalid booth filter', await api('GET', '/products?booth_id=x', { token: A }), 400);

  expect('edit keeps the booth', await api('PUT', `/products/${id}`, { token: A, body: { price: '2.50' } }), 200);
  check('booth kept', (await api('GET', `/products/${id}`, { token: A })).body.data.booth_id === b1.id);
  expect('change the supplier but keep the old booth', await api('PUT', `/products/${id}`, { token: A, body: { supplier_id: s2 } }), 400);
  expect('a booth without supplier, with supplier 2', await api('PUT', `/products/${id}`, { token: A, body: { supplier_id: s2, booth_id: b2.id } }), 200);
  expect('remove the booth', await api('PUT', `/products/${id}`, { token: A, body: { booth_id: null } }), 200);
  check('booth removed', (await api('GET', `/products/${id}`, { token: A })).body.data.booth_id === null);

  expect('back on booth 2', await api('PUT', `/products/${id}`, { token: A, body: { booth_id: b2.id } }), 200);
  expect('delete booth 2', await api('DELETE', `/booths/${b2.id}`, { token: A }), 200);
  const after = (await api('GET', `/products/${id}`, { token: A })).body.data;
  check('deleting the booth keeps the product, without booth', after.id === id && after.booth_id === null && after.booth_code === null);
};
