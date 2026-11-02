const db = require('../config/db');
const { fail, handle, toId, clean, likeContains } = require('../utils/http');
const { validate } = require('../utils/validate');
const { loadSupplier, loadCompanyIds, idList } = require('../utils/scope');
const { deleteImages, imageExtension, saveImages } = require('../utils/upload');
const { parseDataImage } = require('../utils/dataImage');
const { parseDataPdf } = require('../utils/dataPdf');
const { isAdmin, isViewer, sharedWithViewer } = require('../utils/access');
const { parseCategories, storedCategories, readCategoryNames, categoryMatch, listCategories, addCategory } = require('../utils/categories');

// D63: the contact's photo, resized by the app to about 256 px.
const MAX_AVATAR_BYTES = 100 * 1024;
const MAX_IMAGES = 30;
const MAX_PHOTO_BYTES = 1.5 * 1024 * 1024;
const MAX_THUMB_BYTES = 100 * 1024;
const MAX_PDF_BYTES = 32 * 1024 * 1024;

const SUPPLIER_FIELDS = {
  name: { label: 'Nom', type: 'string', required: true, max: 200 },
  phone: { label: 'Téléphone', type: 'string', max: 50 },
  email: { label: 'E-mail', type: 'email', max: 150 },
  website: { label: 'Site web', type: 'string', max: 255 },
  cantonfair_url: { label: 'Lien du salon', type: 'string', max: 255 },
  address: { label: 'Adresse', type: 'text', max: 2000 },
  province_id: { label: 'Province', type: 'int', min: 1 },
  rating: { label: 'Note', type: 'int', min: 1, maxValue: 5 },
  notes: { label: 'Notes', type: 'text', max: 5000 },
};

const CONTACT_FIELDS = {
  name: { label: 'Nom', type: 'string', max: 150 },
  phone: { label: 'Téléphone', type: 'string', max: 50 },
  email: { label: 'E-mail', type: 'email', max: 150 },
};

// D33: contacts.wechat_qr holds the link of a photo of the contact's WeChat QR code
// ("/uploads/wechat/<random>.png"), set only through POST .../wechat-qr. An older text value
// (a WeChat id typed by hand) is kept and shown as text.
const WECHAT_FOLDER = 'wechat';
const isQrPhoto = (value) => typeof value === 'string' && value.startsWith(`/uploads/${WECHAT_FOLDER}/`);
const qrFiles = (rows) => rows.map((r) => r.wechat_qr).filter(isQrPhoto);

// v_suppliers adds the province name, the number of booths and the % of them visited.
// supplier_no: the supplier's number shown in the apps, 1, 2, 3… in creation order without the
// gaps left by deleted suppliers (the id keeps them and stays internal). Same as in ContactController.
// D66: shared_company_ids, the companies the supplier is shared with, for the buyers and the
// admin only (a viewer does not learn which other companies read it). A subquery, so
// v_suppliers keeps no GROUP BY (D23).
// D72: categories_suppliers holds several names from categories_products, separated by commas, or NULL.
const supplierSelect = (viewer) => `
  SELECT v.*,
         (SELECT COUNT(*) FROM suppliers s2 WHERE s2.id <= v.id) AS supplier_no,
         (SELECT COUNT(*) FROM contacts c WHERE c.supplier_id = v.id) AS contacts_count,
         (SELECT COUNT(*) FROM products p WHERE p.supplier_id = v.id) AS products_count
         ${viewer ? '' : `, (SELECT GROUP_CONCAT(ss.company_id ORDER BY ss.company_id)
             FROM supplier_shares ss WHERE ss.supplier_id = v.id) AS shared_company_ids`}
  FROM v_suppliers v`;
const withShareIds = (row) => (row.shared_company_ids === undefined ? row : { ...row, shared_company_ids: idList(row.shared_company_ids) });
const present = (row) => ({ ...withShareIds(row), categories_suppliers: parseCategories(row.categories_suppliers) });

// D75: any web address. A missing scheme is read as https. javascript: and other schemes are refused.
function webUrl(value) {
  if (!value) return { value: null };
  const text = String(value).trim();
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
  let url;
  try {
    url = new URL(candidate);
  } catch {
    return { message: 'Lien du salon : adresse web attendue (https://…)' };
  }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.')) {
    return { message: 'Lien du salon : adresse web attendue (https://…)' };
  }
  const stored = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  if (stored.length > 255) return { message: 'Lien du salon : 255 caractères au maximum' };
  return { value: stored };
}

// Validates a supplier; province_id must be a row of china_province.
async function validateSupplier(body, existing) {
  const v = validate(body, SUPPLIER_FIELDS, existing);
  if (!v.values) return v;
  const link = webUrl(v.values.cantonfair_url);
  if (link.message) return { message: link.message };
  v.values.cantonfair_url = link.value;
  if (v.values.province_id) {
    const [[p]] = await db.query('SELECT id FROM china_province WHERE id = ?', [v.values.province_id]);
    if (!p) return { message: 'Province introuvable' };
  }
  return v;
}

// The WHERE clause that limits a viewer to its shared suppliers (D66), or none for the others.
const scopeOf = (req) => (isViewer(req.user)
  ? { where: ` AND ${sharedWithViewer('v.id')}`, params: [req.user.id] }
  : { where: '', params: [] });

// Every supplier of the group, filtered by name or phone (q, D40) and province_id. D66: phase
// and hall keep the suppliers with a booth there (both given: a booth in that hall at that phase).
exports.list = handle('Supplier list', async (req, res) => {
  const scope = scopeOf(req);
  const params = [...scope.params];
  let where = `1=1${scope.where}`;
  const q = clean(req.query.q);
  if (q) {
    where += ' AND (v.name LIKE ? OR v.phone LIKE ?)';
    params.push(likeContains(q), likeContains(q));
  }
  if (req.query.province_id) {
    const provinceId = toId(req.query.province_id);
    if (!provinceId) return fail(res, 400, 'Filtre province_id invalide');
    where += ' AND v.province_id = ?';
    params.push(provinceId);
  }
  const booth = [];
  for (const [key, max] of [['phase', 3], ['hall', 21]]) {
    if (req.query[key] === undefined || req.query[key] === '') continue;
    const n = toId(req.query[key]);
    if (!n || n > max) return fail(res, 400, `Filtre ${key} invalide`);
    booth.push(`b.${key} = ?`);
    params.push(n);
  }
  if (booth.length) where += ` AND EXISTS (SELECT 1 FROM booths b WHERE b.supplier_id = v.id AND ${booth.join(' AND ')})`;
  const categories = await categoryMatch(db, 'categories_products', 'v.categories_suppliers', req.query.categories_suppliers);
  if (categories.error) return fail(res, 400, 'Filtre categories_suppliers invalide');
  where += categories.sql;
  params.push(...categories.params);
  const [rows] = await db.query(`${supplierSelect(isViewer(req.user))} WHERE ${where} ORDER BY v.name LIMIT 500`, params);
  res.json({ success: true, data: rows.map(present) });
});

// D66: the provinces of at least one supplier (of the viewer's shared suppliers for a viewer),
// for the province filter of the supplier list.
exports.provinces = handle('Supplier provinces', async (req, res) => {
  const scope = scopeOf(req);
  const [rows] = await db.query(
    `SELECT p.id, p.name_en, p.name_zh FROM china_province p
     WHERE EXISTS (SELECT 1 FROM suppliers v WHERE v.province_id = p.id${scope.where})
     ORDER BY p.name_en`, scope.params);
  res.json({ success: true, data: rows });
});

// D69: the supplier categories (the list the forms and the filter use).
exports.listCategories = handle('Supplier categories', async (req, res) => {
  res.json({ success: true, data: await listCategories(db, 'categories_products') });
});

exports.addCategory = handle('Supplier category create', async (req, res) => {
  const r = await addCategory(db, 'categories_products', req.body?.name);
  if (r.status) return fail(res, r.status, r.message);
  res.json({ success: true, data: r.data });
});

// D66: a viewer only opens a supplier shared with one of its companies (404 otherwise, as if it
// did not exist). It cannot read the products routes, so its supplier comes with its products
// (no decision, which stays internal).
exports.getById = handle('Supplier getById', async (req, res) => {
  const r = await loadSupplier(req.params.id);
  if (!r.row) return fail(res, r.status, r.message);
  const viewer = isViewer(req.user);
  const scope = scopeOf(req);
  const [[supplier]] = await db.query(`${supplierSelect(viewer)} WHERE v.id = ?${scope.where}`, [r.row.id, ...scope.params]);
  if (!supplier) return fail(res, 404, 'Fournisseur introuvable');
  const [contacts] = await db.query(
    'SELECT id, name, phone, email, wechat_qr, avatar FROM contacts WHERE supplier_id = ? ORDER BY name',
    [r.row.id]
  );
  const data = { ...present(supplier), contacts, ...(await filesOf(r.row.id)) };
  if (viewer) {
    [data.products] = await db.query(
      `SELECT p.id, p.name, p.supplier_ref, p.description, p.price, p.currency, p.unit, p.moq, p.shipping_type, st.name AS shipping_name,
              p.booth_id, b.booth_code, b.phase AS booth_phase,
              (SELECT pi.thumb_data FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.id LIMIT 1) AS cover_thumb
       FROM products p
       LEFT JOIN shipping_types st ON st.code = p.shipping_type
       LEFT JOIN booths b ON b.id = p.booth_id
       WHERE p.supplier_id = ? ORDER BY p.name`, [r.row.id]);
  }
  res.json({ success: true, data });
});

// D66: share_company_ids, the companies the supplier is shared with (the whole list). Only the
// admin shares. Returns { ids } (null when the body leaves the shares as they are) or { status, message }.
async function readShares(req) {
  const raw = req.body?.share_company_ids;
  if (raw === undefined) return { ids: null };
  if (!isAdmin(req.user)) return { status: 403, message: "Seul l'administrateur partage un fournisseur" };
  const r = await loadCompanyIds(raw, 'Partager avec');
  return r.ids ? r : { status: 400, message: r.message };
}

// D75: catalogues (PDF) and photos sent with the supplier. Missing from the body: nothing changes.
function readCatalogs(raw) {
  if (raw === undefined || raw === null) return { items: [] };
  if (!Array.isArray(raw)) return { status: 400, message: 'Catalogues : liste attendue' };
  const items = [];
  for (const [i, file] of raw.entries()) {
    const pdf = parseDataPdf(file?.data, file?.name, MAX_PDF_BYTES, `Catalogue ${i + 1}`);
    if (!pdf.value) return { status: 400, message: pdf.message };
    items.push([pdf.name, pdf.value]);
  }
  return { items };
}

function readImages(raw) {
  if (raw === undefined || raw === null) return { items: [] };
  if (!Array.isArray(raw)) return { status: 400, message: 'Images : liste attendue' };
  if (raw.length > MAX_IMAGES) return { status: 400, message: `Un fournisseur a au plus ${MAX_IMAGES} images` };
  const items = [];
  for (const [i, img] of raw.entries()) {
    const label = `Image ${i + 1}`;
    const data = parseDataImage(img?.data, MAX_PHOTO_BYTES, label);
    if (!data.value) return { status: 400, message: data.message };
    const thumb = parseDataImage(img?.thumb ?? img?.data, MAX_THUMB_BYTES, `${label} (vignette)`);
    if (!thumb.value) return { status: 400, message: thumb.message };
    items.push([data.value, thumb.value]);
  }
  return { items };
}

function readIdList(raw, label) {
  if (raw === undefined || raw === null) return { ids: [] };
  if (!Array.isArray(raw)) return { status: 400, message: `${label} : liste attendue` };
  const ids = [...new Set(raw.map(toId))];
  if (ids.includes(null)) return { status: 400, message: `${label} : identifiant invalide` };
  return { ids };
}

async function filesOf(supplierId) {
  const [catalogs] = await db.query(
    'SELECT id, file_name, file_data FROM supplier_catalogs WHERE supplier_id = ? ORDER BY id', [supplierId]
  );
  const [images] = await db.query(
    'SELECT id, image_data, thumb_data FROM supplier_images WHERE supplier_id = ? ORDER BY id', [supplierId]
  );
  return { catalogs, images };
}

async function readFiles(req) {
  const catalogs = readCatalogs(req.body?.catalogs_add);
  if (catalogs.status) return catalogs;
  const catalogIds = readIdList(req.body?.catalogs_remove, 'Catalogues à retirer');
  if (catalogIds.status) return catalogIds;
  const images = readImages(req.body?.images_add);
  if (images.status) return images;
  const imageIds = readIdList(req.body?.images_remove, 'Images à retirer');
  if (imageIds.status) return imageIds;
  return { catalogs: catalogs.items, catalogIds: catalogIds.ids, images: images.items, imageIds: imageIds.ids };
}

async function readCategories(req) {
  return readCategoryNames(db, 'categories_products', req.body?.categories_suppliers);
}

// Writes the supplier, its shares, and the catalogues and photos, in one transaction.
// Returns { id } or { status, message }.
async function writeSupplier(req, shares, sql, params, existingId, files) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.query(sql, params);
    const id = existingId || r.insertId;
    if (shares !== null) {
      await conn.query('DELETE FROM supplier_shares WHERE supplier_id = ?', [id]);
      if (shares.length) {
        await conn.query('INSERT INTO supplier_shares (supplier_id, company_id, shared_by) VALUES ?',
          [shares.map((c) => [id, c, req.user.id])]);
      }
    }
    if (files.catalogIds.length) {
      const [found] = await conn.query(
        'SELECT id FROM supplier_catalogs WHERE supplier_id = ? AND id IN (?)', [id, files.catalogIds]
      );
      if (found.length !== files.catalogIds.length) {
        await conn.rollback();
        return { status: 404, message: 'Catalogue introuvable' };
      }
      await conn.query('DELETE FROM supplier_catalogs WHERE supplier_id = ? AND id IN (?)', [id, files.catalogIds]);
    }
    if (files.catalogs.length) {
      await conn.query('INSERT INTO supplier_catalogs (supplier_id, file_name, file_data) VALUES ?',
        [files.catalogs.map(([name, data]) => [id, name, data])]);
    }
    if (files.imageIds.length) {
      const [found] = await conn.query(
        'SELECT id FROM supplier_images WHERE supplier_id = ? AND id IN (?)', [id, files.imageIds]
      );
      if (found.length !== files.imageIds.length) {
        await conn.rollback();
        return { status: 404, message: 'Image introuvable' };
      }
      await conn.query('DELETE FROM supplier_images WHERE supplier_id = ? AND id IN (?)', [id, files.imageIds]);
    }
    if (files.images.length) {
      await conn.query('INSERT INTO supplier_images (supplier_id, image_data, thumb_data) VALUES ?',
        [files.images.map(([data, thumb]) => [id, data, thumb])]);
    }
    const [[{ images }]] = await conn.query('SELECT COUNT(*) AS images FROM supplier_images WHERE supplier_id = ?', [id]);
    if (images > MAX_IMAGES) {
      await conn.rollback();
      return { status: 409, message: `Un fournisseur a au plus ${MAX_IMAGES} images` };
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

exports.create = handle('Supplier create', async (req, res) => {
  const v = await validateSupplier(req.body);
  if (!v.values) return fail(res, 400, v.message);
  const shares = await readShares(req);
  if (shares.status) return fail(res, shares.status, shares.message);
  const categories = await readCategories(req);
  if (categories.status) return fail(res, categories.status, categories.message);
  const files = await readFiles(req);
  if (files.status) return fail(res, files.status, files.message);
  const s = v.values;
  const written = await writeSupplier(req, shares.ids,
    `INSERT INTO suppliers (name, phone, email, website, cantonfair_url, address, province_id, rating, notes, categories_suppliers)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [s.name, s.phone, s.email, s.website, s.cantonfair_url, s.address, s.province_id, s.rating, s.notes, storedCategories(categories.names)],
    null, files
  );
  if (!written.id) return fail(res, written.status, written.message);
  res.json({ success: true, data: { id: written.id, name: s.name } });
});

exports.update = handle('Supplier update', async (req, res) => {
  const r = await loadSupplier(req.params.id);
  if (!r.row) return fail(res, r.status, r.message);
  const v = await validateSupplier(req.body, r.row);
  if (!v.values) return fail(res, 400, v.message);
  const shares = await readShares(req);
  if (shares.status) return fail(res, shares.status, shares.message);
  const categories = await readCategories(req);
  if (categories.status) return fail(res, categories.status, categories.message);
  const files = await readFiles(req);
  if (files.status) return fail(res, files.status, files.message);
  const s = v.values;
  const stored = categories.names === null ? r.row.categories_suppliers : storedCategories(categories.names);
  const written = await writeSupplier(req, shares.ids,
    `UPDATE suppliers SET name = ?, phone = ?, email = ?, website = ?, cantonfair_url = ?, address = ?,
            province_id = ?, rating = ?, notes = ?, categories_suppliers = ? WHERE id = ?`,
    [s.name, s.phone, s.email, s.website, s.cantonfair_url, s.address, s.province_id, s.rating, s.notes, stored, r.row.id],
    r.row.id, files
  );
  if (!written.id) return fail(res, written.status, written.message);
  res.json({ success: true, data: { id: r.row.id } });
});

// Schema v2: deleting a supplier deletes its contacts and products (with their photos and
// shares) and leaves its booths without a supplier. D28: the photo files are deleted too.
exports.remove = handle('Supplier remove', async (req, res) => {
  const r = await loadSupplier(req.params.id);
  if (!r.row) return fail(res, r.status, r.message);
  const [contacts] = await db.query('SELECT wechat_qr FROM contacts WHERE supplier_id = ?', [r.row.id]);
  await db.query('DELETE FROM suppliers WHERE id = ?', [r.row.id]);
  await deleteImages(qrFiles(contacts)); // D61: product photos are in the database
  res.json({ success: true, data: { id: r.row.id } });
});

// --- Contacts of a supplier -------------------------------------------------

// Loads the supplier and, when contactId is given, its contact.
async function loadContact(req) {
  const s = await loadSupplier(req.params.id);
  if (!s.row) return s;
  if (req.params.contactId === undefined) return { supplier: s.row };
  const contactId = toId(req.params.contactId);
  if (!contactId) return { status: 400, message: 'Identifiant invalide' };
  const [[contact]] = await db.query('SELECT * FROM contacts WHERE id = ? AND supplier_id = ?', [
    contactId, s.row.id,
  ]);
  if (!contact) return { status: 404, message: 'Contact introuvable' };
  return { supplier: s.row, contact };
}

// A contact needs at least one of name, phone, e-mail or WeChat QR code (every column is
// optional in v2). The QR code is not part of the body: it is added afterwards (D33).
// D63: avatar, a Base64 photo, or null to remove it; left out, the current one stays.
function validateContact(body, existing) {
  const v = validate(body, CONTACT_FIELDS, existing);
  if (!v.values) return v;
  const c = v.values;
  if (!c.name && !c.phone && !c.email && !existing?.wechat_qr) {
    return { message: 'Renseignez au moins le nom, le téléphone ou l\'e-mail du contact' };
  }
  const raw = body?.avatar;
  c.avatar = existing?.avatar ?? null;
  if (raw === null || raw === '') c.avatar = null;
  else if (raw !== undefined) {
    const img = parseDataImage(raw, MAX_AVATAR_BYTES, 'Photo du contact');
    if (!img.value) return { message: img.message };
    c.avatar = img.value;
  }
  return v;
}

exports.listContacts = handle('Contact list', async (req, res) => {
  const r = await loadContact(req);
  if (!r.supplier) return fail(res, r.status, r.message);
  const [rows] = await db.query(
    'SELECT id, name, phone, email, wechat_qr, avatar FROM contacts WHERE supplier_id = ? ORDER BY name',
    [r.supplier.id]
  );
  res.json({ success: true, data: rows });
});

exports.createContact = handle('Contact create', async (req, res) => {
  const r = await loadContact(req);
  if (!r.supplier) return fail(res, r.status, r.message);
  const v = validateContact(req.body);
  if (!v.values) return fail(res, 400, v.message);
  const c = v.values;
  const [ins] = await db.query(
    'INSERT INTO contacts (supplier_id, name, phone, email, avatar) VALUES (?, ?, ?, ?, ?)',
    [r.supplier.id, c.name, c.phone, c.email, c.avatar]
  );
  res.json({ success: true, data: { id: ins.insertId } });
});

exports.updateContact = handle('Contact update', async (req, res) => {
  const r = await loadContact(req);
  if (!r.contact) return fail(res, r.status, r.message);
  const v = validateContact(req.body, r.contact);
  if (!v.values) return fail(res, 400, v.message);
  const c = v.values;
  await db.query('UPDATE contacts SET name = ?, phone = ?, email = ?, avatar = ? WHERE id = ?', [
    c.name, c.phone, c.email, c.avatar, r.contact.id,
  ]);
  res.json({ success: true, data: { id: r.contact.id } });
});

exports.removeContact = handle('Contact remove', async (req, res) => {
  const r = await loadContact(req);
  if (!r.contact) return fail(res, r.status, r.message);
  await db.query('DELETE FROM contacts WHERE id = ?', [r.contact.id]);
  await deleteImages(qrFiles([r.contact]));
  res.json({ success: true, data: { id: r.contact.id } });
});

// --- WeChat QR code of a contact (D33) --------------------------------------

// One photo in the "images" field (JPEG, PNG or WebP, checked by its content). It replaces the
// previous QR code, whose file is deleted.
exports.setWechatQr = handle('Contact setWechatQr', async (req, res) => {
  const r = await loadContact(req);
  if (!r.contact) return fail(res, r.status, r.message);
  const files = req.files || [];
  if (files.length !== 1) return fail(res, 400, 'Envoyez une seule photo du QR code WeChat (champ « images »)');
  if (!imageExtension(files[0].buffer)) {
    return fail(res, 400, `« ${files[0].originalname} » n'est pas une photo JPEG, PNG ou WebP`);
  }
  const [url] = await saveImages(files, WECHAT_FOLDER);
  try {
    await db.query('UPDATE contacts SET wechat_qr = ? WHERE id = ?', [url, r.contact.id]);
  } catch (e) {
    await deleteImages([url]); // no orphan file when the row could not be written
    throw e;
  }
  await deleteImages(qrFiles([r.contact]));
  res.json({ success: true, data: { id: r.contact.id, wechat_qr: url } });
});

// D34: the content read by a QR scanner (for WeChat, a link such as https://u.wechat.com/...),
// stored as is; the apps draw the QR code again from it. It replaces the previous value, and the
// file of a previous photo is deleted. "/uploads/" is kept for photos.
exports.setWechatContent = handle('Contact setWechatContent', async (req, res) => {
  const r = await loadContact(req);
  if (!r.contact) return fail(res, r.status, r.message);
  const raw = req.body?.content;
  const content = typeof raw === 'string' ? raw.trim() : '';
  if (!content) return fail(res, 400, 'Contenu du QR code : champ obligatoire');
  if (content.length > 255) return fail(res, 400, 'Contenu du QR code : 255 caractères au maximum');
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(content)) return fail(res, 400, 'Contenu du QR code : caractères non autorisés');
  if (content.startsWith('/uploads/')) return fail(res, 400, 'Contenu du QR code invalide');
  await db.query('UPDATE contacts SET wechat_qr = ? WHERE id = ?', [content, r.contact.id]);
  await deleteImages(qrFiles([r.contact]));
  res.json({ success: true, data: { id: r.contact.id, wechat_qr: content } });
});

// Removes the QR code (photo or older text). Refused when it is all that identifies the contact.
exports.removeWechatQr = handle('Contact removeWechatQr', async (req, res) => {
  const r = await loadContact(req);
  if (!r.contact) return fail(res, r.status, r.message);
  const c = r.contact;
  if (!c.wechat_qr) return fail(res, 404, "Ce contact n'a pas de QR code WeChat");
  if (!c.name && !c.phone && !c.email) {
    return fail(res, 409, 'Le QR code est la seule information de ce contact : supprimez plutôt le contact');
  }
  await db.query('UPDATE contacts SET wechat_qr = NULL WHERE id = ?', [c.id]);
  await deleteImages(qrFiles([c]));
  res.json({ success: true, data: { id: c.id, wechat_qr: null } });
});
