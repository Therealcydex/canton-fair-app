// Loaders for one record by its id (route param or body field). Since schema v2 every user of
// the group sees every supplier, booth and product: there is no company check, only 400/404.
// They return { row } or { status, message } for the refusal.
const db = require('../config/db');
const { toId } = require('./http');

async function loadOne(sql, rawId, notFound) {
  const id = toId(rawId);
  if (!id) return { status: 400, message: 'Identifiant invalide' };
  const [[row]] = await db.query(sql, [id]);
  if (!row) return { status: 404, message: notFound };
  return { row };
}

const loadSupplier = (id) => loadOne('SELECT * FROM suppliers WHERE id = ?', id, 'Fournisseur introuvable');
const loadBooth = (id) => loadOne('SELECT * FROM booths WHERE id = ?', id, 'Booth introuvable');
const loadProduct = (id) => loadOne('SELECT * FROM products WHERE id = ?', id, 'Produit introuvable');
const loadCompany = (id) => loadOne('SELECT * FROM companies WHERE id = ?', id, 'Société introuvable');

// D66: a list of company ids from a request body (the companies of a user, those a supplier is
// shared with). Returns { ids } (duplicates removed) or { message } for a 400.
async function loadCompanyIds(raw, label) {
  if (!Array.isArray(raw)) return { message: `${label} : liste de sociétés attendue` };
  const ids = [...new Set(raw.map(toId))];
  if (ids.includes(null)) return { message: `${label} : société invalide` };
  if (ids.length) {
    const [found] = await db.query('SELECT id FROM companies WHERE id IN (?)', [ids]);
    if (found.length !== ids.length) return { message: `${label} : société introuvable` };
  }
  return { ids };
}

// "1,3" from a GROUP_CONCAT subquery -> [1, 3].
const idList = (value) => (value ? String(value).split(',').map(Number) : []);

module.exports = { loadSupplier, loadBooth, loadProduct, loadCompany, loadCompanyIds, idList };
