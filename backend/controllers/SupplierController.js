const db = require('../config/db');
const { fail, handle, toId, clean, likeContains } = require('../utils/http');
const { validate } = require('../utils/validate');
const { loadSupplier } = require('../utils/scope');

const SUPPLIER_FIELDS = {
  name: { label: 'Nom', type: 'string', required: true, max: 150 },
  phone: { label: 'Téléphone', type: 'string', max: 50 },
  email: { label: 'E-mail', type: 'email', max: 150 },
  website: { label: 'Site web', type: 'string', max: 200 },
  address: { label: 'Adresse', type: 'text', max: 2000 },
  province: { label: 'Province', type: 'string', max: 100 },
  rating: { label: 'Note', type: 'int', min: 1, maxValue: 5 },
  notes: { label: 'Notes', type: 'text', max: 5000 },
};

const CONTACT_FIELDS = {
  name: { label: 'Nom', type: 'string', required: true, max: 100 },
  phone: { label: 'Téléphone', type: 'string', max: 50 },
  email: { label: 'E-mail', type: 'email', max: 150 },
  wechat_qr: { label: 'WeChat', type: 'string', max: 255 },
};

const SUPPLIER_COLUMNS = 's.id, s.name, s.phone, s.email, s.website, s.address, s.province, s.rating, s.notes';

// Suppliers of the caller's company, filtered by name (q) and province.
exports.list = handle('Supplier list', async (req, res) => {
  const params = [req.user.company_id];
  let where = 's.company_id = ?';
  const q = clean(req.query.q);
  if (q) {
    where += ' AND s.name LIKE ?';
    params.push(likeContains(q));
  }
  const province = clean(req.query.province);
  if (province) {
    where += ' AND s.province = ?';
    params.push(province);
  }
  const [rows] = await db.query(
    `SELECT ${SUPPLIER_COLUMNS},
            (SELECT COUNT(*) FROM contacts c WHERE c.supplier_id = s.id) AS contacts_count,
            (SELECT COUNT(*) FROM booths b WHERE b.supplier_id = s.id) AS booths_count,
            (SELECT COUNT(*) FROM products p WHERE p.supplier_id = s.id) AS products_count
     FROM suppliers s WHERE ${where} ORDER BY s.name LIMIT 500`,
    params
  );
  res.json({ success: true, data: rows });
});

// Distinct provinces of the caller's suppliers (filter list).
exports.provinces = handle('Supplier provinces', async (req, res) => {
  const [rows] = await db.query(
    `SELECT DISTINCT province FROM suppliers
     WHERE company_id = ? AND province IS NOT NULL ORDER BY province`,
    [req.user.company_id]
  );
  res.json({ success: true, data: rows.map((r) => r.province) });
});

exports.getById = handle('Supplier getById', async (req, res) => {
  const r = await loadSupplier(req.params.id, req.user);
  if (!r.row) return fail(res, r.status, r.message);
  const [contacts] = await db.query(
    'SELECT id, name, phone, email, wechat_qr FROM contacts WHERE supplier_id = ? ORDER BY name',
    [r.row.id]
  );
  const { owner_company_id, company_id, ...supplier } = r.row;
  res.json({ success: true, data: { ...supplier, contacts } });
});

exports.create = handle('Supplier create', async (req, res) => {
  const v = validate(req.body, SUPPLIER_FIELDS);
  if (!v.values) return fail(res, 400, v.message);
  const s = v.values;
  // The company comes from the token, never from the body.
  const [r] = await db.query(
    `INSERT INTO suppliers (company_id, name, phone, email, website, address, province, rating, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.user.company_id, s.name, s.phone, s.email, s.website, s.address, s.province, s.rating, s.notes]
  );
  res.json({ success: true, data: { id: r.insertId } });
});

exports.update = handle('Supplier update', async (req, res) => {
  const r = await loadSupplier(req.params.id, req.user);
  if (!r.row) return fail(res, r.status, r.message);
  const v = validate(req.body, SUPPLIER_FIELDS, r.row);
  if (!v.values) return fail(res, 400, v.message);
  const s = v.values;
  await db.query(
    `UPDATE suppliers SET name = ?, phone = ?, email = ?, website = ?, address = ?, province = ?,
            rating = ?, notes = ? WHERE id = ?`,
    [s.name, s.phone, s.email, s.website, s.address, s.province, s.rating, s.notes, r.row.id]
  );
  res.json({ success: true, data: { id: r.row.id } });
});

// D8: contacts go with the supplier; refused while it still has booths or products.
exports.remove = handle('Supplier remove', async (req, res) => {
  const r = await loadSupplier(req.params.id, req.user);
  if (!r.row) return fail(res, r.status, r.message);
  const [[usage]] = await db.query(
    `SELECT (SELECT COUNT(*) FROM booths WHERE supplier_id = ?) AS booths,
            (SELECT COUNT(*) FROM products WHERE supplier_id = ?) AS products`,
    [r.row.id, r.row.id]
  );
  if (usage.booths > 0 || usage.products > 0) {
    return fail(res, 409, 'Impossible de supprimer un fournisseur qui a encore des stands ou des produits');
  }
  await db.query('DELETE FROM suppliers WHERE id = ?', [r.row.id]);
  res.json({ success: true, data: { id: r.row.id } });
});

// --- Contacts of a supplier -------------------------------------------------

// Loads the supplier (tenant check) and, when contactId is given, its contact.
async function loadContact(req) {
  const s = await loadSupplier(req.params.id, req.user);
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
  const v = validate(req.body, CONTACT_FIELDS);
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
  const v = validate(req.body, CONTACT_FIELDS, r.contact);
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
