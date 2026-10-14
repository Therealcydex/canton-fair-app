// BF10-BF14: products, photos, sharing.
const fs = require('fs');
const path = require('path');
const { api, expect, check, PREFIX, BASE } = require('./lib');
const { UPLOAD_ROOT } = require('../utils/upload');

// Smallest valid PNG (1x1 pixel).
const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082',
  'hex'
);

const form = (files) => {
  const f = new FormData();
  for (const [name, buffer, type] of files) f.append('images', new Blob([buffer], { type }), name);
  return f;
};

module.exports = async (ctx) => {
  const { tokens, companies } = ctx;
  const A = tokens.buyerA;
  const B = tokens.buyerB;

  const sA = (await api('POST', '/suppliers', { token: A, body: { name: `${PREFIX} Product supplier A` } })).body.data.id;
  const sA2 = (await api('POST', '/suppliers', { token: A, body: { name: `${PREFIX} Product supplier A2` } })).body.data.id;
  const sB = (await api('POST', '/suppliers', { token: B, body: { name: `${PREFIX} Product supplier B` } })).body.data.id;
  const boothA = (await api('POST', '/booths', { token: A, body: { supplier_id: sA, phase: 1, hall: 9, level: 1, letter: 'A', num_start: 1 } })).body.data.id;
  const boothA2 = (await api('POST', '/booths', { token: A, body: { supplier_id: sA2, phase: 1, hall: 9, level: 1, letter: 'A', num_start: 2 } })).body.data.id;

  // Products (BF10)
  expect('product without name', await api('POST', '/products', { token: A, body: { supplier_id: sA } }), 400);
  expect('product without supplier', await api('POST', '/products', { token: A, body: { name: 'X' } }), 400);
  expect('product for other company supplier', await api('POST', '/products', { token: A, body: { name: 'X', supplier_id: sB } }), 403);
  expect('product on another supplier\'s booth', await api('POST', '/products', { token: A, body: { name: 'X', supplier_id: sA, booth_id: boothA2 } }), 400);
  expect('price with 4 decimals', await api('POST', '/products', { token: A, body: { name: 'X', supplier_id: sA, price_tnd: '1.2345' } }), 400);
  expect('negative price', await api('POST', '/products', { token: A, body: { name: 'X', supplier_id: sA, price_tnd: '-5' } }), 400);
  expect('MOQ 0', await api('POST', '/products', { token: A, body: { name: 'X', supplier_id: sA, moq: 0 } }), 400);
  expect('unknown incoterm', await api('POST', '/products', { token: A, body: { name: 'X', supplier_id: sA, incoterm: 'XYZ' } }), 400);

  const p1 = expect('create product (author from token)', await api('POST', '/products', {
    token: A,
    body: {
      name: `${PREFIX} LED strip 5m`, supplier_id: sA, booth_id: boothA, supplier_ref: 'LS-500',
      price_tnd: '12,500', unit: 'pièce', moq: 500, incoterm: 'FOB', created_by: ctx.users.buyerB,
    },
  }), 200).body.data.id;
  let prod = expect('read own product', await api('GET', `/products/${p1}`, { token: A }), 200).body.data;
  check('price kept exactly as 12.500', prod.price_tnd === '12.500', prod.price_tnd);
  check('author is the token owner', prod.created_by === ctx.users.buyerA);
  check('booth location and own flag', prod.booth_location === '9.1 A1' && prod.own === true);
  expect('read product of other company (not shared)', await api('GET', `/products/${p1}`, { token: B }), 403);
  expect('read unknown product', await api('GET', '/products/999999', { token: A }), 404);
  expect('edit product of other company', await api('PUT', `/products/${p1}`, { token: B, body: { name: 'pirate' } }), 403);
  expect('partial update', await api('PUT', `/products/${p1}`, { token: A, body: { price_tnd: '11.75' } }), 200);
  prod = (await api('GET', `/products/${p1}`, { token: A })).body.data;
  check('price updated, rest kept', prod.price_tnd === '11.750' && prod.moq === 500 && prod.booth_id === boothA);
  expect('move product to a booth of another supplier', await api('PUT', `/products/${p1}`, { token: A, body: { booth_id: boothA2 } }), 400);

  // List and filters (BF12)
  const p2 = (await api('POST', '/products', { token: A, body: { name: `${PREFIX} Desk lamp`, supplier_id: sA2, booth_id: boothA2 } })).body.data.id;
  await api('POST', '/products', { token: B, body: { name: `${PREFIX} B product`, supplier_id: sB } });
  const own = expect('list own products', await api('GET', '/products', { token: A }), 200).body.data;
  check('company A sees its 2 products only', own.length === 2 && own.every((p) => p.own));
  const bySupplier = (await api('GET', `/products?supplier_id=${sA2}`, { token: A })).body.data;
  check('filter by supplier', bySupplier.length === 1 && bySupplier[0].id === p2);
  const byText = (await api('GET', '/products?q=LS-500', { token: A })).body.data;
  check('search by supplier reference', byText.length === 1 && byText[0].id === p1);
  expect('invalid scope', await api('GET', '/products?scope=all', { token: A }), 400);

  // Photos (BF11)
  expect('upload without file', await api('POST', `/products/${p1}/images`, { token: A, form: new FormData() }), 400);
  expect('upload a fake image (HTML named .png)', await api('POST', `/products/${p1}/images`, {
    token: A, form: form([['evil.png', Buffer.from('<html><script>alert(1)</script></html>'), 'image/png']]),
  }), 400);
  expect('upload on other company product', await api('POST', `/products/${p1}/images`, { token: B, form: form([['a.png', PNG, 'image/png']]) }), 403);
  expect('upload too big', await api('POST', `/products/${p1}/images`, {
    token: A, form: form([['big.png', Buffer.concat([PNG, Buffer.alloc(9 * 1024 * 1024)]), 'image/png']]),
  }), 413);
  const up = expect('upload two photos', await api('POST', `/products/${p1}/images`, {
    token: A, form: form([['a.png', PNG, 'image/png'], ['b.png', PNG, 'image/png']]),
  }), 200).body.data;
  check('two photos stored', up.length === 2 && up.every((i) => /^\/uploads\/products\/[0-9a-f]{32}\.png$/.test(i.image_url)));
  const served = await fetch(BASE.replace(/\/api$/, '') + up[0].image_url);
  check('photo served as image/png with nosniff',
    served.ok && served.headers.get('content-type') === 'image/png' && served.headers.get('x-content-type-options') === 'nosniff');
  const file0 = path.join(UPLOAD_ROOT, up[0].image_url.replace('/uploads/', ''));
  expect('delete photo of other company product', await api('DELETE', `/products/${p1}/images/${up[0].id}`, { token: B }), 403);
  expect('delete photo', await api('DELETE', `/products/${p1}/images/${up[0].id}`, { token: A }), 200);
  check('photo file removed from disk', !fs.existsSync(file0));
  prod = (await api('GET', `/products/${p1}`, { token: A })).body.data;
  check('cover is the remaining photo', prod.images.length === 1 && prod.cover_url === up[1].image_url);

  // Sharing (BF13, BF14)
  expect('share with own company', await api('POST', `/products/${p1}/shares`, { token: A, body: { company_id: companies.A } }), 400);
  expect('share with unknown company', await api('POST', `/products/${p1}/shares`, { token: A, body: { company_id: 999999 } }), 400);
  expect('other company shares A product', await api('POST', `/products/${p1}/shares`, { token: B, body: { company_id: companies.B } }), 403);
  expect('share with company B', await api('POST', `/products/${p1}/shares`, { token: A, body: { company_id: companies.B } }), 200);
  expect('share twice is harmless', await api('POST', `/products/${p1}/shares`, { token: A, body: { company_id: companies.B } }), 200);

  const shared = expect('B lists products shared with it', await api('GET', '/products?scope=shared', { token: B }), 200).body.data;
  check('B sees the shared product, read only, with owner name',
    shared.length === 1 && shared[0].id === p1 && shared[0].own === false && shared[0].owner_company_name === `${PREFIX} Société A`);
  check('B does not see who else it is shared with', shared[0].shares_count === undefined);
  const bOwn = (await api('GET', '/products', { token: B })).body.data;
  check('shared product not in B\'s own list', bOwn.every((p) => p.id !== p1));
  const readByB = expect('B reads the shared product', await api('GET', `/products/${p1}`, { token: B }), 200).body.data;
  check('B gets photos but not the share list', readByB.images.length === 1 && readByB.shares === undefined);
  expect('B edits the shared product', await api('PUT', `/products/${p1}`, { token: B, body: { name: 'pirate' } }), 403);
  expect('B deletes the shared product', await api('DELETE', `/products/${p1}`, { token: B }), 403);
  expect('B adds a photo to the shared product', await api('POST', `/products/${p1}/images`, { token: B, form: form([['a.png', PNG, 'image/png']]) }), 403);
  const readByA = (await api('GET', `/products/${p1}`, { token: A })).body.data;
  check('owner sees the share list', readByA.shares.length === 1 && readByA.shares[0].company_id === companies.B);

  expect('unshare', await api('DELETE', `/products/${p1}/shares/${companies.B}`, { token: A }), 200);
  expect('unshare again', await api('DELETE', `/products/${p1}/shares/${companies.B}`, { token: A }), 404);
  expect('B no longer reads it', await api('GET', `/products/${p1}`, { token: B }), 403);

  // Deletes linked to products (D8, D16)
  expect('delete supplier that has products', await api('DELETE', `/suppliers/${sA2}`, { token: A }), 409);
  expect('delete booth with products', await api('DELETE', `/booths/${boothA2}`, { token: A }), 409);
  const lastFile = path.join(UPLOAD_ROOT, up[1].image_url.replace('/uploads/', ''));
  expect('delete product with its photos', await api('DELETE', `/products/${p1}`, { token: A }), 200);
  check('product photo files removed', !fs.existsSync(lastFile));
};
