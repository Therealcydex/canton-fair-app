// Tenant rule (CLAUDE.md): suppliers, contacts, booths, visits and products belong to a
// company through suppliers.company_id. These loaders find a record and check it belongs to
// the caller's company. They return { row } or { status, message } for the refusal.
const db = require('../config/db');
const { toId } = require('./http');

async function loadOwned(sql, rawId, user, notFound, otherCompany) {
  const id = toId(rawId);
  if (!id) return { status: 400, message: 'Identifiant invalide' };
  const [[row]] = await db.query(sql, [id]);
  if (!row) return { status: 404, message: notFound };
  if (row.owner_company_id !== user.company_id) return { status: 403, message: otherCompany };
  return { row };
}

const loadSupplier = (id, user) =>
  loadOwned(
    'SELECT s.*, s.company_id AS owner_company_id FROM suppliers s WHERE s.id = ?',
    id, user, 'Fournisseur introuvable', "Ce fournisseur n'appartient pas à votre société"
  );

const loadBooth = (id, user) =>
  loadOwned(
    `SELECT b.*, s.company_id AS owner_company_id, s.name AS supplier_name
     FROM booths b JOIN suppliers s ON s.id = b.supplier_id WHERE b.id = ?`,
    id, user, 'Stand introuvable', "Ce stand n'appartient pas à votre société"
  );

const loadProduct = (id, user) =>
  loadOwned(
    `SELECT p.*, s.company_id AS owner_company_id
     FROM products p JOIN suppliers s ON s.id = p.supplier_id WHERE p.id = ?`,
    id, user, 'Produit introuvable', "Ce produit n'appartient pas à votre société"
  );

module.exports = { loadSupplier, loadBooth, loadProduct };
