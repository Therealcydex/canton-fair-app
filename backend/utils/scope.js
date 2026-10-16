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

module.exports = { loadSupplier, loadBooth, loadProduct, loadCompany };
