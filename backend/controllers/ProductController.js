const db = require('../config/db');
const { fail, handle, toId, clean, likeContains } = require('../utils/http');
const { validate } = require('../utils/validate');
const { loadProduct } = require('../utils/scope');
const { parseDataImage } = require('../utils/dataImage');
const { readCategoryName, categoryIn, listCategories, addCategory } = require('../utils/categories');

// D61: the photos are stored as Base64 in the database, resized by the app before sending
// (about 1280 px for the photo, 200 px for the thumbnail shown in the lists).
const MAX_IMAGES_PER_PRODUCT = 10;
const MAX_PHOTO_BYTES = 1.5 * 1024 * 1024;
const MAX_THUMB_BYTES = 100 * 1024;

// D38: the decision on a product. A new product is "A_ETUDIER" until the admin (the boss) decides
// at the evening review; "A_ETUDIER" again undoes a decision.
const PENDING = 'A_ETUDIER';
const STATUSES = [PENDING, 'RETENU', 'ECHANTILLON', 'A_COMMANDER', 'REJETE'];
const DECISION_FIELDS = {
  status: { label: 'Décision', type: 'enum', required: true, values: STATUSES },
  note: { label: 'Note', type: 'text', max: 500 },
};
const DEFAULT_SHIPPING_TYPE = 'FOB';
const DEFAULT_CURRENCY = 'USD';
const CURRENCIES = ['USD', 'TND', 'CNY'];

const PRODUCT_FIELDS = {
  name: { label: 'Nom', type: 'string', required: true, max: 200 },
  supplier_ref: { label: 'Référence fournisseur', type: 'string', max: 100 },
  description: { label: 'Description', type: 'text', max: 10000 },
  price: { label: 'Prix', type: 'decimal', precision: 12, scale: 2 },
  currency: { label: 'Devise', type: 'enum', values: CURRENCIES },
  unit: { label: 'Unité', type: 'string', max: 30 },
  moq: { label: 'MOQ', type: 'int', min: 1, maxValue: 2147483647 },
  shipping_type: { label: 'Type d\'expédition', type: 'string', max: 3, upper: true },
};

// v_products adds the shipping type name. D62: products are no longer shared (booths are).
const PRODUCT_SELECT = `
  SELECT v.*, s.name AS supplier_name,
         (SELECT pi.thumb_data FROM product_images pi WHERE pi.product_id = v.id ORDER BY pi.id LIMIT 1) AS cover_thumb,
         (SELECT COUNT(*) FROM product_images pi WHERE pi.product_id = v.id) AS images_count
  FROM v_products v
  LEFT JOIN suppliers s ON s.id = v.supplier_id`;

const present = (row) => (row ? { ...row, categories_products: row.categories_products || null } : row);

// supplier_id (optional in v2) and shipping_type (a code of shipping_types) need the database.
async function validateProduct(req, existing) {
  const v = validate(req.body, PRODUCT_FIELDS, existing);
  if (!v.values) return { status: 400, message: v.message };
  const p = v.values;

  p.shipping_type = p.shipping_type || DEFAULT_SHIPPING_TYPE;
  const [[st]] = await db.query('SELECT code FROM shipping_types WHERE code = ?', [p.shipping_type]);
  if (!st) return { status: 400, message: "Type d'expédition inconnu (EXW, FOB, CIF…)" };
  p.currency = p.currency || DEFAULT_CURRENCY;

  const body = req.body || {};
  const supplierRaw = body.supplier_id !== undefined ? body.supplier_id : existing?.supplier_id;
  p.supplier_id = null;
  if (supplierRaw !== undefined && supplierRaw !== null && supplierRaw !== '') {
    const supplierId = toId(supplierRaw);
    if (!supplierId) return { status: 400, message: 'Fournisseur invalide' };
    const [[s]] = await db.query('SELECT id FROM suppliers WHERE id = ?', [supplierId]);
    if (!s) return { status: 400, message: 'Fournisseur introuvable' };
    p.supplier_id = supplierId;
  }

  // D43: the booth where the product was found (optional). It must be a booth of the product's
  // supplier; a product without a supplier takes the booth's.
  const boothRaw = body.booth_id !== undefined ? body.booth_id : existing?.booth_id;
  p.booth_id = null;
  if (boothRaw !== undefined && boothRaw !== null && boothRaw !== '') {
    const boothId = toId(boothRaw);
    if (!boothId) return { status: 400, message: 'Booth invalide' };
    const [[booth]] = await db.query('SELECT id, supplier_id, phase, booth_code FROM booths WHERE id = ?', [boothId]);
    if (!booth) return { status: 400, message: 'Booth introuvable' };
    if (booth.supplier_id && p.supplier_id && booth.supplier_id !== p.supplier_id) {
      return { status: 400, message: `Le booth Ph${booth.phase} ${booth.booth_code} est celui d'un autre fournisseur` };
    }
    if (!p.supplier_id && booth.supplier_id) p.supplier_id = booth.supplier_id;
    p.booth_id = boothId;
  }
  return { values: p };
}

// Every product of the group. Filters: supplier_id, shipping_type, status (D38), booth_id (D43),
// q (name, reference, description).
// D68: the revue gallery. Thumbnails only — a full photo is loaded with the product when a
// slide is opened. Newest products first, then each product's photos in the order they were added.
// "1,2" from the gallery supplier filter. [] means no filter; null means the filter is invalid.
function idFilter(raw) {
  if (raw === undefined || raw === '' || raw === null) return [];
  const parts = Array.isArray(raw) ? raw : String(raw).split(',');
  const ids = [...new Set(parts.map(toId))];
  if (ids.includes(null)) return null;
  return ids;
}

exports.gallery = handle('Product gallery', async (req, res) => {
  const params = [];
  let where = '1=1';
  const products = await categoryIn(db, 'p.categories_products', req.query.categories_products);
  if (products.error) return fail(res, 400, 'Filtre categories_products invalide');
  where += products.sql;
  params.push(...products.params);
  const supplierIds = idFilter(req.query.supplier_ids);
  if (supplierIds === null) return fail(res, 400, 'Filtre supplier_ids invalide');
  if (supplierIds.length) {
    where += ' AND p.supplier_id IN (?)';
    params.push(supplierIds);
  }
  const [rows] = await db.query(`
    SELECT pi.id, pi.product_id, p.name, pi.thumb_data
    FROM product_images pi
    JOIN products p ON p.id = pi.product_id
    WHERE ${where}
    ORDER BY p.id DESC, pi.id
    LIMIT 1000`, params);
  res.json({ success: true, data: rows });
});

exports.list = handle('Product list', async (req, res) => {
  const params = [];
  let where = '1=1';
  if (req.query.supplier_id) {
    const supplierId = toId(req.query.supplier_id);
    if (!supplierId) return fail(res, 400, 'Filtre supplier_id invalide');
    where += ' AND v.supplier_id = ?';
    params.push(supplierId);
  }
  if (req.query.booth_id) {
    const boothId = toId(req.query.booth_id);
    if (!boothId) return fail(res, 400, 'Filtre booth_id invalide');
    where += ' AND v.booth_id = ?';
    params.push(boothId);
  }
  if (req.query.shipping_type) {
    where += ' AND v.shipping_type = ?';
    params.push(String(req.query.shipping_type).toUpperCase());
  }
  if (req.query.status) {
    const status = String(req.query.status).toUpperCase();
    if (!STATUSES.includes(status)) return fail(res, 400, 'Filtre status invalide');
    where += ' AND v.status = ?';
    params.push(status);
  }
  const q = clean(req.query.q);
  if (q) {
    where += ' AND (v.name LIKE ? OR v.supplier_ref LIKE ? OR v.description LIKE ?)';
    params.push(likeContains(q), likeContains(q), likeContains(q));
  }
  const categories = await categoryIn(db, 'v.categories_products', req.query.categories_products);
  if (categories.error) return fail(res, 400, 'Filtre categories_products invalide');
  where += categories.sql;
  params.push(...categories.params);
  const [rows] = await db.query(`${PRODUCT_SELECT} WHERE ${where} ORDER BY v.id DESC LIMIT 500`, params);
  res.json({ success: true, data: rows.map(present) });
});

// D38: the evening review. The products still waiting for a decision, oldest first (the queue
// empties as the boss decides), and the number of products in each status.
exports.review = handle('Product review', async (req, res) => {
  const [pending] = await db.query(
    `${PRODUCT_SELECT} WHERE v.status = ? ORDER BY v.created_at, v.id LIMIT 500`, [PENDING]);
  const [rows] = await db.query('SELECT status, COUNT(*) AS n FROM products GROUP BY status');
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const r of rows) counts[r.status] = Number(r.n);
  res.json({ success: true, data: { pending: pending.map(present), counts } });
});

exports.listCategories = handle('Product categories', async (req, res) => {
  res.json({ success: true, data: await listCategories(db, 'categories_products') });
});

exports.addCategory = handle('Product category create', async (req, res) => {
  const r = await addCategory(db, 'categories_products', req.body?.name);
  if (r.status) return fail(res, r.status, r.message);
  res.json({ success: true, data: r.data });
});

// D71: the same categories on every selected product. The list replaces what each product had.
exports.assignCategories = handle('Product assign categories', async (req, res) => {
  const rawIds = req.body?.ids;
  if (!Array.isArray(rawIds) || !rawIds.length) return fail(res, 400, 'Produits : sélectionnez au moins un produit');
  const ids = [...new Set(rawIds.map(toId))];
  if (ids.includes(null) || ids.length > 500) return fail(res, 400, 'Produits : produit invalide');
  const category = await readCategoryName(db, req.body?.categories_products);
  if (category.status) return fail(res, category.status, category.message);
  if (category.name === undefined) return fail(res, 400, 'Catégorie : une seule catégorie');
  const [found] = await db.query('SELECT id FROM products WHERE id IN (?)', [ids]);
  if (found.length !== ids.length) return fail(res, 404, 'Produit introuvable');
  await db.query('UPDATE products SET categories_products = ? WHERE id IN (?)', [category.name, ids]);
  res.json({ success: true, data: { ids, categories_products: category.name } });
});

// D61: the photos of a request body, [{ data, thumb }] in images_add, checked one by one.
// Returns { images } or { message }.
function readImages(raw) {
  if (raw === undefined || raw === null) return { images: [] };
  if (!Array.isArray(raw)) return { message: 'Photos : liste attendue' };
  if (raw.length > MAX_IMAGES_PER_PRODUCT) return { message: `Un produit a au plus ${MAX_IMAGES_PER_PRODUCT} photos` };
  const images = [];
  for (const [i, img] of raw.entries()) {
    const label = `Photo ${i + 1}`;
    const data = parseDataImage(img?.data, MAX_PHOTO_BYTES, label);
    if (!data.value) return { message: data.message };
    const thumb = parseDataImage(img?.thumb ?? img?.data, MAX_THUMB_BYTES, `${label} (vignette)`);
    if (!thumb.value) return { message: thumb.message };
    images.push([data.value, thumb.value]);
  }
  return { images };
}

// images_remove: ids of photos of this product. Returns { ids } or { status, message }.
async function readRemovals(raw, productId) {
  if (raw === undefined || raw === null) return { ids: [] };
  if (!Array.isArray(raw)) return { status: 400, message: 'Photos à retirer : liste attendue' };
  const ids = [...new Set(raw.map(toId))];
  if (ids.includes(null)) return { status: 400, message: 'Photos à retirer : identifiant invalide' };
  if (!ids.length) return { ids };
  const [found] = await db.query('SELECT id FROM product_images WHERE product_id = ? AND id IN (?)', [productId, ids]);
  if (found.length !== ids.length) return { status: 404, message: 'Photo introuvable' };
  return { ids };
}

// Writes the product row and its photo changes in one transaction; returns the product id.
async function writeProduct(sql, params, productId, images, removeIds) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.query(sql, params);
    const id = productId || r.insertId;
    if (removeIds.length) await conn.query('DELETE FROM product_images WHERE product_id = ? AND id IN (?)', [id, removeIds]);
    if (images.length) {
      await conn.query('INSERT INTO product_images (product_id, image_data, thumb_data) VALUES ?', [images.map(([d, t]) => [id, d, t])]);
    }
    const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM product_images WHERE product_id = ?', [id]);
    if (n > MAX_IMAGES_PER_PRODUCT) {
      await conn.rollback();
      return { status: 409, message: `Un produit a au plus ${MAX_IMAGES_PER_PRODUCT} photos` };
    }
    await conn.commit();
    return { id };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

const imagesOf = async (id) => (await db.query(
  'SELECT id, image_data, thumb_data FROM product_images WHERE product_id = ? ORDER BY id', [id]))[0];

// With its photos.
async function productDetail(id) {
  const [[product]] = await db.query(`${PRODUCT_SELECT} WHERE v.id = ?`, [id]);
  return { ...present(product), images: await imagesOf(id) };
}

exports.getById = handle('Product getById', async (req, res) => {
  const r = await loadProduct(req.params.id);
  if (!r.row) return fail(res, r.status, r.message);
  res.json({ success: true, data: await productDetail(r.row.id) });
});

// D61: the photos come with the product (images_add), written in the same transaction.
exports.create = handle('Product create', async (req, res) => {
  const v = await validateProduct(req);
  if (!v.values) return fail(res, v.status, v.message);
  const img = readImages(req.body?.images_add);
  if (!img.images) return fail(res, 400, img.message);
  const category = await readCategoryName(db, req.body?.categories_products);
  if (category.status) return fail(res, category.status, category.message);
  const p = v.values;
  const w = await writeProduct(
    `INSERT INTO products (supplier_id, booth_id, supplier_ref, name, description, price, currency, unit, moq, shipping_type, categories_products, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [p.supplier_id, p.booth_id, p.supplier_ref, p.name, p.description, p.price, p.currency, p.unit, p.moq, p.shipping_type, category.name || null, req.user.id],
    null, img.images, []);
  if (!w.id) return fail(res, w.status, w.message);
  res.json({ success: true, data: { id: w.id } });
});

// D61: images_add and images_remove change the photos with the product, in one transaction.
exports.update = handle('Product update', async (req, res) => {
  const r = await loadProduct(req.params.id);
  if (!r.row) return fail(res, r.status, r.message);
  const v = await validateProduct(req, r.row);
  if (!v.values) return fail(res, v.status, v.message);
  const img = readImages(req.body?.images_add);
  if (!img.images) return fail(res, 400, img.message);
  const rm = await readRemovals(req.body?.images_remove, r.row.id);
  if (!rm.ids) return fail(res, rm.status, rm.message);
  const category = await readCategoryName(db, req.body?.categories_products);
  if (category.status) return fail(res, category.status, category.message);
  const p = v.values;
  const stored = category.name === undefined ? r.row.categories_products : category.name;
  const w = await writeProduct(
    `UPDATE products SET supplier_id = ?, booth_id = ?, supplier_ref = ?, name = ?, description = ?, price = ?,
            currency = ?, unit = ?, moq = ?, shipping_type = ?, categories_products = ? WHERE id = ?`,
    [p.supplier_id, p.booth_id, p.supplier_ref, p.name, p.description, p.price, p.currency, p.unit, p.moq, p.shipping_type, stored, r.row.id],
    r.row.id, img.images, rm.ids);
  if (!w.id) return fail(res, w.status, w.message);
  res.json({ success: true, data: { id: r.row.id } });
});

// D38: the admin's decision (route behind requireAdmin). Editing a product never changes it.
// "A_ETUDIER" puts the product back in the review queue and clears the decision.
exports.decide = handle('Product decide', async (req, res) => {
  const r = await loadProduct(req.params.id);
  if (!r.row) return fail(res, r.status, r.message);
  const v = validate(req.body, DECISION_FIELDS);
  if (!v.values) return fail(res, 400, v.message);
  const { status, note } = v.values;
  if (status === PENDING) {
    await db.query(
      'UPDATE products SET status = ?, decision_note = NULL, decided_by = NULL, decided_at = NULL WHERE id = ?',
      [PENDING, r.row.id]);
  } else {
    await db.query(
      'UPDATE products SET status = ?, decision_note = ?, decided_by = ?, decided_at = NOW() WHERE id = ?',
      [status, note, req.user.id, r.row.id]);
  }
  res.json({ success: true, data: await productDetail(r.row.id) });
});

// Its photos go with it (FK cascade): D61, they live in the database.
exports.remove = handle('Product remove', async (req, res) => {
  const r = await loadProduct(req.params.id);
  if (!r.row) return fail(res, r.status, r.message);
  await db.query('DELETE FROM products WHERE id = ?', [r.row.id]);
  res.json({ success: true, data: { id: r.row.id } });
});

// --- Photos (BF11, D61) -----------------------------------------------------

// Adds photos from the product page: { images: [{ data, thumb }] }. Returns all the photos.
exports.addImages = handle('Product addImages', async (req, res) => {
  const r = await loadProduct(req.params.id);
  if (!r.row) return fail(res, r.status, r.message);
  const raw = req.body?.images;
  if (!Array.isArray(raw) || !raw.length) return fail(res, 400, 'Aucune photo reçue');
  const img = readImages(raw);
  if (!img.images) return fail(res, 400, img.message);
  const w = await writeProduct('SELECT 1', [], r.row.id, img.images, []);
  if (!w.id) return fail(res, w.status, w.message);
  res.json({ success: true, data: await imagesOf(r.row.id) });
});

exports.removeImage = handle('Product removeImage', async (req, res) => {
  const r = await loadProduct(req.params.id);
  if (!r.row) return fail(res, r.status, r.message);
  const imageId = toId(req.params.imageId);
  if (!imageId) return fail(res, 400, 'Identifiant invalide');
  const [del] = await db.query('DELETE FROM product_images WHERE id = ? AND product_id = ?', [imageId, r.row.id]);
  if (!del.affectedRows) return fail(res, 404, 'Photo introuvable');
  res.json({ success: true, data: { id: imageId } });
});
