// BF10-BF14: products (price, shipping type), photos, sharing with Tarek's companies.
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

const fileOf = (url) => path.join(UPLOAD_ROOT, url.replace(/^\/uploads\//, ''));

module.exports = async (ctx) => {
  const { tokens, companies } = ctx;
  const A = tokens.buyerA;
  const B = tokens.buyerB;
  const supplier = (await api('POST', '/suppliers', { token: A, body: { name: `${PREFIX} Product supplier` } })).body.data.id;

  // Products (BF10)
  expect('no token', await api('GET', '/products'), 401);
  expect('product without name', await api('POST', '/products', { token: A, body: { supplier_id: supplier } }), 400);
  expect('unknown supplier', await api('POST', '/products', { token: A, body: { name: `${PREFIX} X`, supplier_id: 999999 } }), 400);
  expect('price with 3 decimals', await api('POST', '/products', { token: A, body: { name: `${PREFIX} X`, price: '1.234' } }), 400);
  expect('negative price', await api('POST', '/products', { token: A, body: { name: `${PREFIX} X`, price: '-5' } }), 400);
  expect('price over DECIMAL(12,2)', await api('POST', '/products', { token: A, body: { name: `${PREFIX} X`, price: '12345678901' } }), 400);
  expect('MOQ 0', await api('POST', '/products', { token: A, body: { name: `${PREFIX} X`, moq: 0 } }), 400);
  expect('unknown shipping type', await api('POST', '/products', { token: A, body: { name: `${PREFIX} X`, shipping_type: 'XYZ' } }), 400);

  const p1 = expect('create product (comma price, lowercase shipping type)', await api('POST', '/products', {
    token: A, body: { name: `${PREFIX} Ruban LED`, supplier_id: supplier, supplier_ref: 'BW-1', price: '12,5', unit: 'rouleau', moq: 500, shipping_type: 'cif' },
  }), 200);
  const id = p1.body.data.id;
  const got = expect('another user reads it', await api('GET', `/products/${id}`, { token: B }), 200);
  check('exact price, shipping name from v_products, supplier name',
    got.body.data.price === '12.50' && got.body.data.shipping_type === 'CIF'
    && got.body.data.shipping_name === 'Cost, Insurance and Freight' && got.body.data.supplier_name === `${PREFIX} Product supplier`);
  const p2 = expect('product without supplier, shipping type by default', await api('POST', '/products', { token: B, body: { name: `${PREFIX} Vase` } }), 200);
  const got2 = await api('GET', `/products/${p2.body.data.id}`, { token: B });
  check('default shipping type is FOB', got2.body.data.shipping_type === 'FOB' && got2.body.data.supplier_id === null);

  expect('update keeps the rules', await api('PUT', `/products/${id}`, { token: B, body: { moq: -1 } }), 400);
  expect('update product', await api('PUT', `/products/${id}`, { token: B, body: { price: '13.99' } }), 200);
  check('update kept the other fields', (await api('GET', `/products/${id}`, { token: A })).body.data.supplier_ref === 'BW-1');

  // List and filters (BF12)
  const bySupplier = expect('filter by supplier', await api('GET', `/products?supplier_id=${supplier}`, { token: A }), 200);
  check('only the supplier\'s product', bySupplier.body.data.length === 1 && bySupplier.body.data[0].id === id);
  const byShipping = expect('filter by shipping type', await api('GET', '/products?shipping_type=cif&q=Ruban', { token: A }), 200);
  check('shipping filter keeps the product', byShipping.body.data.some((p) => p.id === id));
  expect('invalid supplier filter', await api('GET', '/products?supplier_id=x', { token: A }), 400);

  // Photos (BF11)
  expect('no photo sent', await api('POST', `/products/${id}/images`, { token: A, form: new FormData() }), 400);
  expect('a text file named .png', await api('POST', `/products/${id}/images`, { token: A, form: form([['x.png', Buffer.from('hello'), 'image/png']]) }), 400);
  expect('photo of unknown product', await api('POST', '/products/999999/images', { token: A, form: form([['a.png', PNG, 'image/png']]) }), 404);
  const up = expect('add 2 photos', await api('POST', `/products/${id}/images`, { token: B, form: form([['a.png', PNG, 'image/png'], ['b.png', PNG, 'image/png']]) }), 200);
  const [img1, img2] = up.body.data;
  check('photo files exist', fs.existsSync(fileOf(img1.image_url)) && fs.existsSync(fileOf(img2.image_url)));
  const served = await fetch(BASE.replace(/\/api$/, '') + img1.image_url);
  check('photo is served', served.status === 200);
  expect('delete a photo', await api('DELETE', `/products/${id}/images/${img1.id}`, { token: A }), 200);
  check('its file is deleted', !fs.existsSync(fileOf(img1.image_url)));
  expect('delete it again', await api('DELETE', `/products/${id}/images/${img1.id}`, { token: A }), 404);

  // D62: products are no longer shared (booths are): the share routes and filters are gone.
  expect('product share route removed', await api('POST', `/products/${id}/shares`, { token: A, body: { company_id: companies.B } }), 404);
  expect('product share list route removed', await api('PUT', `/products/${id}/shares`, { token: A, body: { company_ids: [] } }), 404);
  expect('bulk product share route removed', await api('POST', '/products/shares', { token: A, body: {} }), 404);
  const detail = expect('product detail', await api('GET', `/products/${id}`, { token: A }), 200);
  check('no shares in the product', detail.body.data.shares === undefined && detail.body.data.shared_with === undefined);

  // Deleting the supplier deletes its products and their photo files (D28).
  expect('delete supplier with a product', await api('DELETE', `/suppliers/${supplier}`, { token: A }), 200);
  expect('its product is gone', await api('GET', `/products/${id}`, { token: A }), 404);
  check('its photo file is deleted', !fs.existsSync(fileOf(img2.image_url)));
  expect('delete product', await api('DELETE', `/products/${p2.body.data.id}`, { token: B }), 200);
};
