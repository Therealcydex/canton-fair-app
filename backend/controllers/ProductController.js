const db = require('../config/db');
const { fail, handle, toId, clean, likeContains } = require('../utils/http');
const { validate } = require('../utils/validate');
const { loadProduct } = require('../utils/scope');
const { saveImages, deleteImages, imageExtension } = require('../utils/upload');

const MAX_IMAGES_PER_PRODUCT = 20;

// D38: the decision on a product. A new product is "A_ETUDIER" until the admin (the boss) decides
// at the evening review; "A_ETUDIER" again undoes a decision.
const PENDING = 'A_ETUDIER';
const STATUSES = [PENDING, 'RETENU', 'ECHANTILLON', 'A_COMMANDER', 'REJETE'];
const DECISION_FIELDS = {
  status: { label: 'Décision', type: 'enum', required: true, values: STATUSES },
  note: { label: 'Note', type: 'text', max: 500 },
};
const DEFAULT_SHIPPING_TYPE = 'FOB';

const PRODUCT_FIELDS = {
  name: { label: 'Nom', type: 'string', required: true, max: 200 },
  supplier_ref: { label: 'Référence fournisseur', type: 'string', max: 100 },
  description: { label: 'Description', type: 'text', max: 10000 },
  price: { label: 'Prix', type: 'decimal', precision: 12, scale: 2 },
  unit: { label: 'Unité', type: 'string', max: 30 },
  moq: { label: 'MOQ', type: 'int', min: 1, maxValue: 2147483647 },
  shipping_type: { label: 'Type d\'expédition', type: 'string', max: 3, upper: true },
};

// v_products adds the shipping type name and the companies the product is shared with;
// shared_company_ids ("1,3") lets the web list pre-fill its share dialog (D40).
const PRODUCT_SELECT = `
  SELECT v.*, s.name AS supplier_name,
         (SELECT GROUP_CONCAT(ps.company_id ORDER BY ps.company_id) FROM product_shares ps WHERE ps.product_id = v.id) AS shared_company_ids,
         (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = v.id ORDER BY pi.id LIMIT 1) AS cover_url,
         (SELECT COUNT(*) FROM product_images pi WHERE pi.product_id = v.id) AS images_count
  FROM v_products v
  LEFT JOIN suppliers s ON s.id = v.supplier_id`;

// supplier_id (optional in v2) and shipping_type (a code of shipping_types) need the database.
async function validateProduct(req, existing) {
  const v = validate(req.body, PRODUCT_FIELDS, existing);
  if (!v.values) return { status: 400, message: v.message };
  const p = v.values;

  p.shipping_type = p.shipping_type || DEFAULT_SHIPPING_TYPE;
  const [[st]] = await db.query('SELECT code FROM shipping_types WHERE code = ?', [p.shipping_type]);
  if (!st) return { status: 400, message: "Type d'expédition inconnu (EXW, FOB, CIF…)" };

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

// Every product of the group. Filters: supplier_id, shipping_type, shared_with (a company id),
// mine=1 (shared with the caller's company), shared=1|0 (D40), status (D38), booth_id (D43),
// q (name, reference, description).
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
  let sharedWith = null;
  if (req.query.mine === '1') {
    if (!req.user.company_id) return res.json({ success: true, data: [] }); // no company, nothing shared with it
    sharedWith = req.user.company_id;
  } else if (req.query.shared_with) {
    sharedWith = toId(req.query.shared_with);
    if (!sharedWith) return fail(res, 400, 'Filtre shared_with invalide');
  }
  if (sharedWith) {
    where += ' AND EXISTS (SELECT 1 FROM product_shares ps WHERE ps.product_id = v.id AND ps.company_id = ?)';
    params.push(sharedWith);
  }
  // D40: shared=1 keeps the products shared with at least one company, shared=0 the others.
  if (req.query.shared !== undefined) {
    if (!['0', '1'].includes(req.query.shared)) return fail(res, 400, 'Filtre shared invalide');
    where += ` AND ${req.query.shared === '1' ? '' : 'NOT '}EXISTS (SELECT 1 FROM product_shares ps WHERE ps.product_id = v.id)`;
  }
  const q = clean(req.query.q);
  if (q) {
    where += ' AND (v.name LIKE ? OR v.supplier_ref LIKE ? OR v.description LIKE ?)';
    params.push(likeContains(q), likeContains(q), likeContains(q));
  }
  const [rows] = await db.query(`${PRODUCT_SELECT} WHERE ${where} ORDER BY v.id DESC LIMIT 500`, params);
  res.json({ success: true, data: rows });
});

// D38: the evening review. The products still waiting for a decision, oldest first (the queue
// empties as the boss decides), and the number of products in each status.
exports.review = handle('Product review', async (req, res) => {
  const [pending] = await db.query(
    `${PRODUCT_SELECT} WHERE v.status = ? ORDER BY v.created_at, v.id LIMIT 500`, [PENDING]);
  const [rows] = await db.query('SELECT status, COUNT(*) AS n FROM products GROUP BY status');
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const r of rows) counts[r.status] = Number(r.n);
  res.json({ success: true, data: { pending, counts } });
});

// With its photos and the companies it is shared with.
async function productDetail(id) {
  const [[product]] = await db.query(`${PRODUCT_SELECT} WHERE v.id = ?`, [id]);
  const [images] = await db.query('SELECT id, image_url FROM product_images WHERE product_id = ? ORDER BY id', [id]);
  const [shares] = await db.query(
    `SELECT c.id AS company_id, c.name AS company_name, c.branch AS company_branch
     FROM product_shares ps JOIN companies c ON c.id = ps.company_id
     WHERE ps.product_id = ? ORDER BY c.name, c.branch`,
    [id]
  );
  return { ...product, images, shares };
}

exports.getById = handle('Product getById', async (req, res) => {
  const r = await loadProduct(req.params.id);
  if (!r.row) return fail(res, r.status, r.message);
  res.json({ success: true, data: await productDetail(r.row.id) });
});

exports.create = handle('Product create', async (req, res) => {
  const v = await validateProduct(req);
  if (!v.values) return fail(res, v.status, v.message);
  const p = v.values;
  const [r] = await db.query(
    `INSERT INTO products (supplier_id, booth_id, supplier_ref, name, description, price, unit, moq, shipping_type, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [p.supplier_id, p.booth_id, p.supplier_ref, p.name, p.description, p.price, p.unit, p.moq, p.shipping_type, req.user.id]
  );
  res.json({ success: true, data: { id: r.insertId } });
});

exports.update = handle('Product update', async (req, res) => {
  const r = await loadProduct(req.params.id);
  if (!r.row) return fail(res, r.status, r.message);
  const v = await validateProduct(req, r.row);
  if (!v.values) return fail(res, v.status, v.message);
  const p = v.values;
  await db.query(
    `UPDATE products SET supplier_id = ?, booth_id = ?, supplier_ref = ?, name = ?, description = ?, price = ?,
            unit = ?, moq = ?, shipping_type = ? WHERE id = ?`,
    [p.supplier_id, p.booth_id, p.supplier_ref, p.name, p.description, p.price, p.unit, p.moq, p.shipping_type, r.row.id]
  );
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

// Images and shares go with the product (FK cascade); D28: the photo files are deleted after.
exports.remove = handle('Product remove', async (req, res) => {
  const r = await loadProduct(req.params.id);
  if (!r.row) return fail(res, r.status, r.message);
  const [images] = await db.query('SELECT image_url FROM product_images WHERE product_id = ?', [r.row.id]);
  await db.query('DELETE FROM products WHERE id = ?', [r.row.id]);
  await deleteImages(images.map((i) => i.image_url));
  res.json({ success: true, data: { id: r.row.id } });
});

// --- Photos (BF11) ----------------------------------------------------------

exports.addImages = handle('Product addImages', async (req, res) => {
  const r = await loadProduct(req.params.id);
  if (!r.row) return fail(res, r.status, r.message);
  const files = req.files || [];
  if (files.length === 0) return fail(res, 400, 'Aucune photo reçue (champ « images »)');
  const bad = files.find((f) => !imageExtension(f.buffer));
  if (bad) return fail(res, 400, `« ${bad.originalname} » n'est pas une photo JPEG, PNG ou WebP`);
  const [[{ n }]] = await db.query('SELECT COUNT(*) AS n FROM product_images WHERE product_id = ?', [r.row.id]);
  if (n + files.length > MAX_IMAGES_PER_PRODUCT) {
    return fail(res, 409, `Un produit a au plus ${MAX_IMAGES_PER_PRODUCT} photos (${n} déjà)`);
  }

  const urls = await saveImages(files, 'products');
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    for (const url of urls) {
      await conn.query('INSERT INTO product_images (product_id, image_url) VALUES (?, ?)', [r.row.id, url]);
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    await deleteImages(urls); // no orphan files when the rows could not be written
    throw e;
  } finally {
    conn.release();
  }
  const [images] = await db.query('SELECT id, image_url FROM product_images WHERE product_id = ? ORDER BY id', [r.row.id]);
  res.json({ success: true, data: images });
});

exports.removeImage = handle('Product removeImage', async (req, res) => {
  const r = await loadProduct(req.params.id);
  if (!r.row) return fail(res, r.status, r.message);
  const imageId = toId(req.params.imageId);
  if (!imageId) return fail(res, 400, 'Identifiant invalide');
  const [[image]] = await db.query('SELECT id, image_url FROM product_images WHERE id = ? AND product_id = ?', [imageId, r.row.id]);
  if (!image) return fail(res, 404, 'Photo introuvable');
  await db.query('DELETE FROM product_images WHERE id = ?', [image.id]);
  await deleteImages([image.image_url]);
  res.json({ success: true, data: { id: image.id } });
});

// --- Sharing with Tarek's companies (BF13) -----------------------------------

exports.share = handle('Product share', async (req, res) => {
  const r = await loadProduct(req.params.id);
  if (!r.row) return fail(res, r.status, r.message);
  const companyId = toId(req.body?.company_id);
  if (!companyId) return fail(res, 400, 'Société : champ obligatoire');
  const [[company]] = await db.query('SELECT id FROM companies WHERE id = ?', [companyId]);
  if (!company) return fail(res, 404, 'Société introuvable');
  // Sharing twice with the same company is harmless: it stays shared once.
  await db.query('INSERT IGNORE INTO product_shares (product_id, company_id) VALUES (?, ?)', [r.row.id, companyId]);
  res.json({ success: true, data: (await productDetail(r.row.id)).shares });
});

// Replaces the whole list in one transaction: { company_ids: [1, 3] } (the web multi-select).
exports.setShares = handle('Product setShares', async (req, res) => {
  const r = await loadProduct(req.params.id);
  if (!r.row) return fail(res, r.status, r.message);
  const raw = req.body?.company_ids;
  if (!Array.isArray(raw)) return fail(res, 400, 'company_ids : liste de sociétés attendue');
  const ids = [...new Set(raw.map(toId))];
  if (ids.includes(null)) return fail(res, 400, 'company_ids : identifiant invalide');
  if (ids.length) {
    const [found] = await db.query('SELECT id FROM companies WHERE id IN (?)', [ids]);
    if (found.length !== ids.length) return fail(res, 404, 'Société introuvable');
  }
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM product_shares WHERE product_id = ?', [r.row.id]);
    for (const id of ids) {
      await conn.query('INSERT INTO product_shares (product_id, company_id) VALUES (?, ?)', [r.row.id, id]);
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  res.json({ success: true, data: (await productDetail(r.row.id)).shares });
});

// D40: shares several products at once, in one transaction (the web "Partager avec…" on a
// selection): { product_ids: [..], company_ids: [..], mode: 'add' | 'replace' }. "add" keeps
// the existing shares and needs at least one company; "replace" sets exactly that list (an
// empty list removes every share of these products).
const MAX_BULK_PRODUCTS = 500;
exports.shareMany = handle('Product shareMany', async (req, res) => {
  const body = req.body || {};
  const mode = body.mode;
  if (!['add', 'replace'].includes(mode)) return fail(res, 400, 'mode : « add » ou « replace » attendu');
  if (!Array.isArray(body.product_ids) || !body.product_ids.length) return fail(res, 400, 'product_ids : au moins un produit attendu');
  if (body.product_ids.length > MAX_BULK_PRODUCTS) return fail(res, 400, `product_ids : ${MAX_BULK_PRODUCTS} produits au plus`);
  if (!Array.isArray(body.company_ids)) return fail(res, 400, 'company_ids : liste de sociétés attendue');
  const productIds = [...new Set(body.product_ids.map(toId))];
  const companyIds = [...new Set(body.company_ids.map(toId))];
  if (productIds.includes(null)) return fail(res, 400, 'product_ids : identifiant invalide');
  if (companyIds.includes(null)) return fail(res, 400, 'company_ids : identifiant invalide');
  if (mode === 'add' && !companyIds.length) return fail(res, 400, 'Choisissez au moins une société');

  const [products] = await db.query('SELECT id FROM products WHERE id IN (?)', [productIds]);
  if (products.length !== productIds.length) return fail(res, 404, 'Produit introuvable');
  if (companyIds.length) {
    const [found] = await db.query('SELECT id FROM companies WHERE id IN (?)', [companyIds]);
    if (found.length !== companyIds.length) return fail(res, 404, 'Société introuvable');
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    if (mode === 'replace') await conn.query('DELETE FROM product_shares WHERE product_id IN (?)', [productIds]);
    const pairs = productIds.flatMap((p) => companyIds.map((c) => [p, c]));
    if (pairs.length) await conn.query('INSERT IGNORE INTO product_shares (product_id, company_id) VALUES ?', [pairs]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  res.json({ success: true, data: { products: productIds.length } });
});

exports.unshare = handle('Product unshare', async (req, res) => {
  const r = await loadProduct(req.params.id);
  if (!r.row) return fail(res, r.status, r.message);
  const companyId = toId(req.params.companyId);
  if (!companyId) return fail(res, 400, 'Identifiant invalide');
  const [del] = await db.query('DELETE FROM product_shares WHERE product_id = ? AND company_id = ?', [r.row.id, companyId]);
  if (del.affectedRows === 0) return fail(res, 404, "Ce produit n'est pas partagé avec cette société");
  res.json({ success: true, data: (await productDetail(r.row.id)).shares });
});
