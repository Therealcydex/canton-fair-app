const db = require('../config/db');
const { fail, handle, toId, clean, likeContains } = require('../utils/http');
const { validate } = require('../utils/validate');
const { loadSupplier, loadBooth } = require('../utils/scope');
const { saveImages, deleteImages, imageExtension } = require('../utils/upload');
const { loadAll: loadCategories, subtreeIds } = require('./CategoryController');
const { boothLocation } = require('./BoothController');

const INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];
const MAX_IMAGES_PER_PRODUCT = 20;

const PRODUCT_FIELDS = {
  name: { label: 'Nom', type: 'string', required: true, max: 150 },
  supplier_ref: { label: 'Référence fournisseur', type: 'string', max: 100 },
  description: { label: 'Description', type: 'text', max: 10000 },
  price_tnd: { label: 'Prix (TND)', type: 'decimal', precision: 12, scale: 3 },
  unit: { label: 'Unité', type: 'string', max: 30 },
  moq: { label: 'MOQ', type: 'int', min: 1, maxValue: 2147483647 },
  incoterm: { label: 'Incoterm', type: 'enum', values: INCOTERMS },
};

// Columns of a product row, with where it comes from and whether the caller owns it.
// D7: a product belongs to the company of its supplier; others see it only if shared.
const PRODUCT_SELECT = `
  SELECT p.id, p.supplier_id, s.name AS supplier_name, p.booth_id,
         b.phase, b.hall, b.level, b.letter, b.num_start, b.num_end,
         b.category_id, c.name AS category_name,
         p.created_by, u.name AS created_by_name,
         p.supplier_ref, p.name, p.description, p.price_tnd, p.unit, p.moq, p.incoterm,
         s.company_id AS owner_company_id, oc.name AS owner_company_name,
         (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.id LIMIT 1) AS cover_url,
         (SELECT COUNT(*) FROM product_images pi WHERE pi.product_id = p.id) AS images_count,
         (SELECT COUNT(*) FROM product_shares ps WHERE ps.product_id = p.id) AS shares_count
  FROM products p
  JOIN suppliers s ON s.id = p.supplier_id
  JOIN companies oc ON oc.id = s.company_id
  JOIN users u ON u.id = p.created_by
  LEFT JOIN booths b ON b.id = p.booth_id
  LEFT JOIN categories c ON c.id = b.category_id`;

// Adds the booth location and "own" flag; hides who else a product is shared with from
// companies that only receive it.
const present = (user) => (p) => {
  const own = p.owner_company_id === user.company_id;
  const { owner_company_id, phase, hall, level, letter, num_start, num_end, ...rest } = p;
  return {
    ...rest,
    own,
    booth_location: p.booth_id ? boothLocation({ hall, level, letter, num_start, num_end }) : null,
    booth_phase: p.booth_id ? phase : null,
    shares_count: own ? p.shares_count : undefined,
    owner_company_name: own ? undefined : p.owner_company_name,
  };
};

// Loads a product the caller may READ: their own or shared with their company.
async function loadReadable(rawId, user) {
  const id = toId(rawId);
  if (!id) return { status: 400, message: 'Identifiant invalide' };
  const [[p]] = await db.query(
    `${PRODUCT_SELECT} WHERE p.id = ? AND (s.company_id = ? OR EXISTS
       (SELECT 1 FROM product_shares ps WHERE ps.product_id = p.id AND ps.company_id = ?))`,
    [id, user.company_id, user.company_id]
  );
  if (p) return { row: p };
  const [[exists]] = await db.query('SELECT id FROM products WHERE id = ?', [id]);
  return exists
    ? { status: 403, message: "Ce produit n'appartient pas à votre société" }
    : { status: 404, message: 'Produit introuvable' };
}

// Loads a product the caller may CHANGE: only the owning company (D7). A company that
// receives a shared product gets a 403 explaining it is read only.
async function loadEditable(rawId, user) {
  const r = await loadReadable(rawId, user);
  if (!r.row) return r;
  if (r.row.owner_company_id !== user.company_id) {
    return { status: 403, message: 'Produit partagé par une autre société : lecture seule' };
  }
  return r;
}

// supplier_id (own company) and booth_id (a booth of that same supplier) need the database.
async function validateProduct(req, existing) {
  const v = validate(req.body, PRODUCT_FIELDS, existing);
  if (!v.values) return { status: 400, message: v.message };
  const p = v.values;
  if (p.incoterm) p.incoterm = p.incoterm.toUpperCase();

  const body = req.body || {};
  const supplierRaw = body.supplier_id !== undefined ? body.supplier_id : existing?.supplier_id;
  if (supplierRaw === undefined || supplierRaw === null || supplierRaw === '') {
    return { status: 400, message: 'Fournisseur : champ obligatoire' };
  }
  const s = await loadSupplier(supplierRaw, req.user);
  if (!s.row) return { status: s.status === 404 ? 400 : s.status, message: s.message };
  p.supplier_id = s.row.id;

  const boothRaw = body.booth_id !== undefined ? body.booth_id : existing?.booth_id;
  p.booth_id = null;
  if (boothRaw !== undefined && boothRaw !== null && boothRaw !== '') {
    const b = await loadBooth(boothRaw, req.user);
    if (!b.row) return { status: b.status === 404 ? 400 : b.status, message: b.message };
    if (b.row.supplier_id !== p.supplier_id) {
      return { status: 400, message: "Ce stand n'est pas celui de ce fournisseur" };
    }
    p.booth_id = b.row.id;
  }
  return { values: p };
}

// scope=own (default): products of the company. scope=shared: products shared with it.
// Filters: supplier_id, booth_id, category_id (booth category, with sub-categories), q.
exports.list = handle('Product list', async (req, res) => {
  const user = req.user;
  const params = [];
  let where;
  if (req.query.scope === 'shared') {
    where = 's.company_id <> ? AND EXISTS (SELECT 1 FROM product_shares ps WHERE ps.product_id = p.id AND ps.company_id = ?)';
    params.push(user.company_id, user.company_id);
  } else if (!req.query.scope || req.query.scope === 'own') {
    where = 's.company_id = ?';
    params.push(user.company_id);
  } else {
    return fail(res, 400, 'Filtre scope invalide (own ou shared)');
  }
  for (const key of ['supplier_id', 'booth_id']) {
    if (req.query[key] !== undefined && req.query[key] !== '') {
      const n = toId(req.query[key]);
      if (!n) return fail(res, 400, `Filtre ${key} invalide`);
      where += ` AND p.${key} = ?`;
      params.push(n);
    }
  }
  if (req.query.category_id) {
    const categoryId = toId(req.query.category_id);
    if (!categoryId) return fail(res, 400, 'Filtre category_id invalide');
    where += ' AND b.category_id IN (?)';
    params.push(subtreeIds(await loadCategories(), categoryId));
  }
  const q = clean(req.query.q);
  if (q) {
    where += ' AND (p.name LIKE ? OR p.supplier_ref LIKE ? OR p.description LIKE ?)';
    params.push(likeContains(q), likeContains(q), likeContains(q));
  }
  const [rows] = await db.query(`${PRODUCT_SELECT} WHERE ${where} ORDER BY p.id DESC LIMIT 500`, params);
  res.json({ success: true, data: rows.map(present(user)) });
});

exports.getById = handle('Product getById', async (req, res) => {
  const r = await loadReadable(req.params.id, req.user);
  if (!r.row) return fail(res, r.status, r.message);
  const [images] = await db.query(
    'SELECT id, image_url FROM product_images WHERE product_id = ? ORDER BY id', [r.row.id]
  );
  const product = { ...present(req.user)(r.row), images };
  if (product.own) {
    const [shares] = await db.query(
      `SELECT c.id AS company_id, c.name AS company_name FROM product_shares ps
       JOIN companies c ON c.id = ps.company_id WHERE ps.product_id = ? ORDER BY c.name`,
      [r.row.id]
    );
    product.shares = shares;
  }
  res.json({ success: true, data: product });
});

exports.create = handle('Product create', async (req, res) => {
  const v = await validateProduct(req);
  if (!v.values) return fail(res, v.status, v.message);
  const p = v.values;
  // The author comes from the token, never from the body.
  const [r] = await db.query(
    `INSERT INTO products (supplier_id, booth_id, created_by, supplier_ref, name, description, price_tnd, unit, moq, incoterm)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [p.supplier_id, p.booth_id, req.user.id, p.supplier_ref, p.name, p.description, p.price_tnd, p.unit, p.moq, p.incoterm]
  );
  res.json({ success: true, data: { id: r.insertId } });
});

exports.update = handle('Product update', async (req, res) => {
  const r = await loadEditable(req.params.id, req.user);
  if (!r.row) return fail(res, r.status, r.message);
  const v = await validateProduct(req, r.row);
  if (!v.values) return fail(res, v.status, v.message);
  const p = v.values;
  await db.query(
    `UPDATE products SET supplier_id = ?, booth_id = ?, supplier_ref = ?, name = ?, description = ?,
            price_tnd = ?, unit = ?, moq = ?, incoterm = ? WHERE id = ?`,
    [p.supplier_id, p.booth_id, p.supplier_ref, p.name, p.description, p.price_tnd, p.unit, p.moq, p.incoterm, r.row.id]
  );
  res.json({ success: true, data: { id: r.row.id } });
});

// Images and shares go with the product (FK cascade); the photo files are deleted after.
exports.remove = handle('Product remove', async (req, res) => {
  const r = await loadEditable(req.params.id, req.user);
  if (!r.row) return fail(res, r.status, r.message);
  const [images] = await db.query('SELECT image_url FROM product_images WHERE product_id = ?', [r.row.id]);
  await db.query('DELETE FROM products WHERE id = ?', [r.row.id]);
  await deleteImages(images.map((i) => i.image_url));
  res.json({ success: true, data: { id: r.row.id } });
});

// --- Photos (BF11) ----------------------------------------------------------

exports.addImages = handle('Product addImages', async (req, res) => {
  const r = await loadEditable(req.params.id, req.user);
  if (!r.row) return fail(res, r.status, r.message);
  const files = req.files || [];
  if (files.length === 0) return fail(res, 400, 'Aucune photo reçue (champ « images »)');
  const bad = files.find((f) => !imageExtension(f.buffer));
  if (bad) return fail(res, 400, `« ${bad.originalname} » n'est pas une photo JPEG, PNG ou WebP`);
  if (r.row.images_count + files.length > MAX_IMAGES_PER_PRODUCT) {
    return fail(res, 409, `Un produit a au plus ${MAX_IMAGES_PER_PRODUCT} photos (${r.row.images_count} déjà)`);
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
  const r = await loadEditable(req.params.id, req.user);
  if (!r.row) return fail(res, r.status, r.message);
  const imageId = toId(req.params.imageId);
  if (!imageId) return fail(res, 400, 'Identifiant invalide');
  const [[image]] = await db.query('SELECT id, image_url FROM product_images WHERE id = ? AND product_id = ?', [imageId, r.row.id]);
  if (!image) return fail(res, 404, 'Photo introuvable');
  await db.query('DELETE FROM product_images WHERE id = ?', [image.id]);
  await deleteImages([image.image_url]);
  res.json({ success: true, data: { id: image.id } });
});

// --- Sharing (BF13) ---------------------------------------------------------

exports.share = handle('Product share', async (req, res) => {
  const r = await loadEditable(req.params.id, req.user);
  if (!r.row) return fail(res, r.status, r.message);
  const companyId = toId(req.body?.company_id);
  if (!companyId) return fail(res, 400, 'Société : champ obligatoire');
  if (companyId === req.user.company_id) return fail(res, 400, 'Le produit appartient déjà à votre société');
  const [[company]] = await db.query('SELECT id FROM companies WHERE id = ?', [companyId]);
  if (!company) return fail(res, 400, 'Société introuvable');
  // Sharing twice with the same company is harmless: it stays shared once.
  await db.query('INSERT IGNORE INTO product_shares (product_id, company_id) VALUES (?, ?)', [r.row.id, companyId]);
  res.json({ success: true, data: { product_id: r.row.id, company_id: companyId } });
});

exports.unshare = handle('Product unshare', async (req, res) => {
  const r = await loadEditable(req.params.id, req.user);
  if (!r.row) return fail(res, r.status, r.message);
  const companyId = toId(req.params.companyId);
  if (!companyId) return fail(res, 400, 'Identifiant invalide');
  const [del] = await db.query('DELETE FROM product_shares WHERE product_id = ? AND company_id = ?', [r.row.id, companyId]);
  if (del.affectedRows === 0) return fail(res, 404, "Ce produit n'est pas partagé avec cette société");
  res.json({ success: true, data: { product_id: r.row.id, company_id: companyId } });
});

module.exports.INCOTERMS = INCOTERMS;
