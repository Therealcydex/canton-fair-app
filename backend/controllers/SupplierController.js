const db = require('../config/db');
const { fail, handle, toId, clean, likeContains } = require('../utils/http');
const { validate } = require('../utils/validate');
const { loadSupplier } = require('../utils/scope');
const { deleteImages } = require('../utils/upload');

const SUPPLIER_FIELDS = {
  name: { label: 'Nom', type: 'string', required: true, max: 200 },
  phone: { label: 'Téléphone', type: 'string', max: 50 },
  email: { label: 'E-mail', type: 'email', max: 150 },
  website: { label: 'Site web', type: 'string', max: 255 },
  address: { label: 'Adresse', type: 'text', max: 2000 },
  province_id: { label: 'Province', type: 'int', min: 1 },
  rating: { label: 'Note', type: 'int', min: 1, maxValue: 5 },
  notes: { label: 'Notes', type: 'text', max: 5000 },
};

const CONTACT_FIELDS = {
  name: { label: 'Nom', type: 'string', max: 150 },
  phone: { label: 'Téléphone', type: 'string', max: 50 },
  email: { label: 'E-mail', type: 'email', max: 150 },
  wechat_qr: { label: 'WeChat', type: 'string', max: 255 },
};

// v_suppliers adds the province name, the number of booths and the % of them visited.
const SUPPLIER_SELECT = `
  SELECT v.*,
         (SELECT COUNT(*) FROM contacts c WHERE c.supplier_id = v.id) AS contacts_count,
         (SELECT COUNT(*) FROM products p WHERE p.supplier_id = v.id) AS products_count
  FROM v_suppliers v`;

// Validates a supplier; province_id must be a row of china_province.
async function validateSupplier(body, existing) {
  const v = validate(body, SUPPLIER_FIELDS, existing);
  if (!v.values) return v;
  if (v.values.province_id) {
    const [[p]] = await db.query('SELECT id FROM china_province WHERE id = ?', [v.values.province_id]);
    if (!p) return { message: 'Province introuvable' };
  }
  return v;
}

// Every supplier of the group, filtered by name (q) and province_id.
exports.list = handle('Supplier list', async (req, res) => {
  const params = [];
  let where = '1=1';
  const q = clean(req.query.q);
  if (q) {
    where += ' AND v.name LIKE ?';
    params.push(likeContains(q));
  }
  if (req.query.province_id) {
    const provinceId = toId(req.query.province_id);
    if (!provinceId) return fail(res, 400, 'Filtre province_id invalide');
    where += ' AND v.province_id = ?';
    params.push(provinceId);
  }
  const [rows] = await db.query(`${SUPPLIER_SELECT} WHERE ${where} ORDER BY v.name LIMIT 500`, params);
  res.json({ success: true, data: rows });
});

exports.getById = handle('Supplier getById', async (req, res) => {
  const r = await loadSupplier(req.params.id);
  if (!r.row) return fail(res, r.status, r.message);
  const [[supplier]] = await db.query(`${SUPPLIER_SELECT} WHERE v.id = ?`, [r.row.id]);
  const [contacts] = await db.query(
    'SELECT id, name, phone, email, wechat_qr FROM contacts WHERE supplier_id = ? ORDER BY name',
    [r.row.id]
  );
  res.json({ success: true, data: { ...supplier, contacts } });
});

exports.create = handle('Supplier create', async (req, res) => {
  const v = await validateSupplier(req.body);
  if (!v.values) return fail(res, 400, v.message);
  const s = v.values;
  const [r] = await db.query(
    `INSERT INTO suppliers (name, phone, email, website, address, province_id, rating, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [s.name, s.phone, s.email, s.website, s.address, s.province_id, s.rating, s.notes]
  );
  res.json({ success: true, data: { id: r.insertId } });
});

exports.update = handle('Supplier update', async (req, res) => {
  const r = await loadSupplier(req.params.id);
  if (!r.row) return fail(res, r.status, r.message);
  const v = await validateSupplier(req.body, r.row);
  if (!v.values) return fail(res, 400, v.message);
  const s = v.values;
  await db.query(
    `UPDATE suppliers SET name = ?, phone = ?, email = ?, website = ?, address = ?, province_id = ?,
            rating = ?, notes = ? WHERE id = ?`,
    [s.name, s.phone, s.email, s.website, s.address, s.province_id, s.rating, s.notes, r.row.id]
  );
  res.json({ success: true, data: { id: r.row.id } });
});

// Schema v2: deleting a supplier deletes its contacts and products (with their photos and
// shares) and leaves its booths without a supplier. D28: the photo files are deleted too.
exports.remove = handle('Supplier remove', async (req, res) => {
  const r = await loadSupplier(req.params.id);
  if (!r.row) return fail(res, r.status, r.message);
  const [images] = await db.query(
    `SELECT pi.image_url FROM product_images pi JOIN products p ON p.id = pi.product_id
     WHERE p.supplier_id = ?`,
    [r.row.id]
  );
  await db.query('DELETE FROM suppliers WHERE id = ?', [r.row.id]);
  await deleteImages(images.map((i) => i.image_url));
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

// A contact needs at least one of name, phone, e-mail or WeChat (every column is optional in v2).
function validateContact(body, existing) {
  const v = validate(body, CONTACT_FIELDS, existing);
  if (!v.values) return v;
  const c = v.values;
  if (!c.name && !c.phone && !c.email && !c.wechat_qr) {
    return { message: 'Renseignez au moins le nom, le téléphone, l\'e-mail ou le WeChat du contact' };
  }
  return v;
}

exports.listContacts = handle('Contact list', async (req, res) => {
  const r = await loadContact(req);
  if (!r.supplier) return fail(res, r.status, r.message);
  const [rows] = await db.query(
    'SELECT id, name, phone, email, wechat_qr FROM contacts WHERE supplier_id = ? ORDER BY name',
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
    'INSERT INTO contacts (supplier_id, name, phone, email, wechat_qr) VALUES (?, ?, ?, ?, ?)',
    [r.supplier.id, c.name, c.phone, c.email, c.wechat_qr]
  );
  res.json({ success: true, data: { id: ins.insertId } });
});

exports.updateContact = handle('Contact update', async (req, res) => {
  const r = await loadContact(req);
  if (!r.contact) return fail(res, r.status, r.message);
  const v = validateContact(req.body, r.contact);
  if (!v.values) return fail(res, 400, v.message);
  const c = v.values;
  await db.query('UPDATE contacts SET name = ?, phone = ?, email = ?, wechat_qr = ? WHERE id = ?', [
    c.name, c.phone, c.email, c.wechat_qr, r.contact.id,
  ]);
  res.json({ success: true, data: { id: r.contact.id } });
});

exports.removeContact = handle('Contact remove', async (req, res) => {
  const r = await loadContact(req);
  if (!r.contact) return fail(res, r.status, r.message);
  await db.query('DELETE FROM contacts WHERE id = ?', [r.contact.id]);
  res.json({ success: true, data: { id: r.contact.id } });
});
