// BF10-BF12: products (price, shipping type) and their photos, stored as Base64 (D61).
// D62: products are no longer shared.
const { api, expect, check, PREFIX } = require('./lib');

// Smallest valid PNG (1x1 pixel).
const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082',
  'hex'
);

// D61: a photo as the app sends it, a Base64 data URL.
const dataUrl = (buffer, type = 'image/png') => `data:${type};base64,${buffer.toString('base64')}`;
const PHOTO = { data: dataUrl(PNG), thumb: dataUrl(PNG) };

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
  check('default currency is USD', got.body.data.currency === 'USD' && got2.body.data.currency === 'USD');
  expect('unknown currency', await api('POST', '/products', { token: A, body: { name: `${PREFIX} X`, currency: 'EUR' } }), 400);
  expect('currency TND', await api('PUT', `/products/${id}`, { token: A, body: { currency: 'TND' } }), 200);
  check('TND stored', (await api('GET', `/products/${id}`, { token: A })).body.data.currency === 'TND');
  expect('currency CNY', await api('PUT', `/products/${id}`, { token: A, body: { currency: 'CNY' } }), 200);

  expect('update keeps the rules', await api('PUT', `/products/${id}`, { token: B, body: { moq: -1 } }), 400);
  expect('update product', await api('PUT', `/products/${id}`, { token: B, body: { price: '13.99' } }), 200);
  check('update kept the other fields', (await api('GET', `/products/${id}`, { token: A })).body.data.supplier_ref === 'BW-1');
  check('a new product has no category', (await api('GET', `/products/${id}`, { token: A })).body.data.categories_products === null);

  // D72: one category per product, from the shared categories_products list.
  expect('category without a name', await api('POST', '/products/categories', { token: A, body: {} }), 400);
  const cat = expect('create a product category', await api('POST', '/products/categories', { token: A, body: { name: `${PREFIX} Lighting` } }), 200);
  const again = expect('the same product category', await api('POST', '/products/categories', { token: B, body: { name: `${PREFIX} Lighting` } }), 200);
  check('the same name is the same category', again.body.data.name === cat.body.data.name);
  expect('unknown product category', await api('PUT', `/products/${id}`, { token: A, body: { categories_products: `${PREFIX} Missing` } }), 400);
  expect('a product has one category', await api('PUT', `/products/${id}`, { token: A, body: { categories_products: [cat.body.data.name] } }), 400);
  expect('set the product category', await api('PUT', `/products/${id}`, { token: A, body: { categories_products: cat.body.data.name } }), 200);
  const byCategory = expect('filter products by category', await api('GET', `/products?categories_products=${encodeURIComponent(cat.body.data.name)}`, { token: A }), 200);
  check('the category filter keeps the product', byCategory.body.data.some((p) => p.id === id));
  expect('a later edit keeps the product category', await api('PUT', `/products/${id}`, { token: B, body: { price: '14.00' } }), 200);
  check('product category stayed', (await api('GET', `/products/${id}`, { token: A })).body.data.categories_products === `${PREFIX} Lighting`);
  expect('assign a category with no product', await api('PUT', '/products/assign-categories', { token: A, body: { ids: [], categories_products: null } }), 400);
  expect('assign a category needs a token', await api('PUT', '/products/assign-categories', { body: { ids: [id], categories_products: null } }), 401);
  expect('assign an unknown product', await api('PUT', '/products/assign-categories', { token: A, body: { ids: [999999], categories_products: cat.body.data.name } }), 404);
  expect('assign the category to several products', await api('PUT', '/products/assign-categories', {
    token: A, body: { ids: [id, p2.body.data.id], categories_products: cat.body.data.name },
  }), 200);
  check('the other product received the category',
    (await api('GET', `/products/${p2.body.data.id}`, { token: A })).body.data.categories_products === `${PREFIX} Lighting`);

  // List and filters (BF12)
  const bySupplier = expect('filter by supplier', await api('GET', `/products?supplier_id=${supplier}`, { token: A }), 200);
  check('only the supplier\'s product', bySupplier.body.data.length === 1 && bySupplier.body.data[0].id === id);
  const byShipping = expect('filter by shipping type', await api('GET', '/products?shipping_type=cif&q=Ruban', { token: A }), 200);
  check('shipping filter keeps the product', byShipping.body.data.some((p) => p.id === id));
  expect('invalid supplier filter', await api('GET', '/products?supplier_id=x', { token: A }), 400);

  // Photos (BF11, D61): Base64 in JSON, checked by their content.
  expect('no photo sent', await api('POST', `/products/${id}/images`, { token: A, body: { images: [] } }), 400);
  expect('not a data URL', await api('POST', `/products/${id}/images`, { token: A, body: { images: [{ data: '/uploads/x.png' }] } }), 400);
  expect('text dressed as a PNG', await api('POST', `/products/${id}/images`, { token: A, body: { images: [{ data: dataUrl(Buffer.from('hello')) }] } }), 400);
  expect('a photo too heavy', await api('POST', `/products/${id}/images`, {
    token: A, body: { images: [{ data: dataUrl(Buffer.concat([PNG, Buffer.alloc(1600 * 1024)])) }] },
  }), 400);
  expect('a thumbnail too heavy', await api('POST', `/products/${id}/images`, {
    token: A, body: { images: [{ data: PHOTO.data, thumb: dataUrl(Buffer.concat([PNG, Buffer.alloc(120 * 1024)])) }] },
  }), 400);
  expect('photo of unknown product', await api('POST', '/products/999999/images', { token: A, body: { images: [PHOTO] } }), 404);
  const up = expect('add 2 photos', await api('POST', `/products/${id}/images`, { token: B, body: { images: [PHOTO, PHOTO] } }), 200);
  const [img1, img2] = up.body.data;
  check('photos are stored as data URLs', img1.image_data.startsWith('data:image/png;base64,') && img2.thumb_data.startsWith('data:image/png;base64,'));
  const listed = (await api('GET', `/products?q=${encodeURIComponent('Ruban')}`, { token: A })).body.data.find((p) => p.id === id);
  check('the list gives the thumbnail of the first photo', listed.cover_thumb === img1.thumb_data && Number(listed.images_count) === 2);
  expect('gallery without token', await api('GET', '/products/gallery'), 401);
  const gallery = expect('gallery of thumbnails', await api('GET', '/products/gallery', { token: A }), 200);
  const shot = gallery.body.data.find((img) => img.product_id === id);
  check('the gallery lists the photo, without the full image', shot && shot.thumb_data === img1.thumb_data && shot.image_data === undefined);
  const byProductCategory = expect('gallery filtered by product category', await api('GET', `/products/gallery?categories_products=${encodeURIComponent(`${PREFIX} Lighting`)}`, { token: A }), 200);
  check('the product category keeps the photo', byProductCategory.body.data.some((img) => img.product_id === id));
  const otherCategory = expect('a product category the photo does not have', await api('POST', '/products/categories', { token: A, body: { name: `${PREFIX} Gallery other` } }), 200);
  const missed = expect('gallery without that product category', await api('GET', `/products/gallery?categories_products=${encodeURIComponent(otherCategory.body.data.name)}`, { token: A }), 200);
  check('the other product category leaves the photo out', !missed.body.data.some((img) => img.product_id === id));
  const byGallerySupplier = expect('gallery filtered by supplier', await api('GET', `/products/gallery?supplier_ids=${supplier}`, { token: A }), 200);
  check('the supplier keeps the photo', byGallerySupplier.body.data.some((img) => img.product_id === id));
  const otherSupplier = expect('gallery of another supplier', await api('GET', '/products/gallery?supplier_ids=999999', { token: A }), 200);
  check('another supplier leaves the photo out', !otherSupplier.body.data.some((img) => img.product_id === id));
  expect('invalid gallery category filter', await api('GET', '/products/gallery?categories_products=,', { token: A }), 400);
  expect('invalid gallery supplier filter', await api('GET', '/products/gallery?supplier_ids=x', { token: A }), 400);
  expect('delete a photo', await api('DELETE', `/products/${id}/images/${img1.id}`, { token: A }), 200);
  expect('delete it again', await api('DELETE', `/products/${id}/images/${img1.id}`, { token: A }), 404);

  // D61: photos in the add and edit forms, written with the product in one transaction.
  expect('new product with a bad photo', await api('POST', '/products', {
    token: A, body: { name: `${PREFIX} Avec photo`, images_add: [{ data: 'x' }] },
  }), 400);
  const none = (await api('GET', `/products?q=${encodeURIComponent(`${PREFIX} Avec photo`)}`, { token: A })).body.data;
  check('a refused photo creates no product', none.length === 0);
  expect('more than 10 photos', await api('POST', '/products', {
    token: A, body: { name: `${PREFIX} Avec photo`, images_add: Array(11).fill(PHOTO) },
  }), 400);
  const withPhoto = expect('new product with 2 photos', await api('POST', '/products', {
    token: A, body: { name: `${PREFIX} Avec photo`, supplier_id: supplier, images_add: [PHOTO, { data: PHOTO.data }] },
  }), 200).body.data.id;
  const wp = (await api('GET', `/products/${withPhoto}`, { token: A })).body.data;
  check('created with its 2 photos (a missing thumbnail is the photo)', wp.images.length === 2 && wp.images[1].thumb_data === PHOTO.data);
  expect('edit: remove a photo of another product', await api('PUT', `/products/${withPhoto}`, { token: A, body: { images_remove: [img2.id] } }), 404);
  expect('edit: 9 more photos (11 in all)', await api('PUT', `/products/${withPhoto}`, { token: A, body: { images_add: Array(9).fill(PHOTO) } }), 409);
  check('a refused edit keeps the photos', (await api('GET', `/products/${withPhoto}`, { token: A })).body.data.images.length === 2);
  expect('edit: remove one, add one', await api('PUT', `/products/${withPhoto}`, {
    token: A, body: { name: `${PREFIX} Avec photo modifié`, images_remove: [wp.images[0].id], images_add: [PHOTO] },
  }), 200);
  const wp2 = (await api('GET', `/products/${withPhoto}`, { token: A })).body.data;
  check('edit applied with the photos', wp2.name === `${PREFIX} Avec photo modifié` && wp2.images.length === 2 && !wp2.images.some((i) => i.id === wp.images[0].id));
  const plain = (await api('GET', `/products/${p2.body.data.id}`, { token: A })).body.data;
  check('a product without photo has no thumbnail (the app shows its placeholder)', plain.cover_thumb === null && plain.images.length === 0);

  // D62: products are no longer shared (booths are): the share routes and filters are gone.
  expect('product share route removed', await api('POST', `/products/${id}/shares`, { token: A, body: { company_id: companies.B } }), 404);
  expect('product share list route removed', await api('PUT', `/products/${id}/shares`, { token: A, body: { company_ids: [] } }), 404);
  expect('bulk product share route removed', await api('POST', '/products/shares', { token: A, body: {} }), 404);
  const detail = expect('product detail', await api('GET', `/products/${id}`, { token: A }), 200);
  check('no shares in the product', detail.body.data.shares === undefined && detail.body.data.shared_with === undefined);

  // Deleting the supplier deletes its products and their photos (FK cascade).
  expect('delete supplier with a product', await api('DELETE', `/suppliers/${supplier}`, { token: A }), 200);
  expect('its product is gone', await api('GET', `/products/${id}`, { token: A }), 404);
  expect('the one with photos too', await api('GET', `/products/${withPhoto}`, { token: A }), 404);
  expect('delete product', await api('DELETE', `/products/${p2.body.data.id}`, { token: B }), 200);
};
