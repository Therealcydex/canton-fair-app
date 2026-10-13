const db = require('../config/db');
const { fail, handle, toId, clean } = require('../utils/http');

// Returns the error message for an invalid company name, or null.
const nameError = (name) => {
  if (!name) return 'Le nom de la société est obligatoire';
  if (name.length > 100) return 'Le nom de la société dépasse 100 caractères';
  return null;
};

// Every logged-in user can list companies (needed to choose whom to share a product with).
exports.list = handle('Company list', async (req, res) => {
  const [rows] = await db.query('SELECT id, name FROM companies ORDER BY name');
  res.json({ success: true, data: rows });
});

exports.create = handle('Company create', async (req, res) => {
  const name = clean(req.body?.name);
  const error = nameError(name);
  if (error) return fail(res, 400, error);
  const [[dup]] = await db.query('SELECT id FROM companies WHERE name = ?', [name]);
  if (dup) return fail(res, 409, 'Une société porte déjà ce nom');
  const [r] = await db.query('INSERT INTO companies (name) VALUES (?)', [name]);
  res.json({ success: true, data: { id: r.insertId, name } });
});

exports.update = handle('Company update', async (req, res) => {
  const id = toId(req.params.id);
  if (!id) return fail(res, 400, 'Identifiant invalide');
  const name = clean(req.body?.name);
  const error = nameError(name);
  if (error) return fail(res, 400, error);
  const [[company]] = await db.query('SELECT id FROM companies WHERE id = ?', [id]);
  if (!company) return fail(res, 404, 'Société introuvable');
  const [[dup]] = await db.query('SELECT id FROM companies WHERE name = ? AND id <> ?', [name, id]);
  if (dup) return fail(res, 409, 'Une société porte déjà ce nom');
  await db.query('UPDATE companies SET name = ? WHERE id = ?', [name, id]);
  res.json({ success: true, data: { id, name } });
});

exports.remove = handle('Company remove', async (req, res) => {
  const id = toId(req.params.id);
  if (!id) return fail(res, 400, 'Identifiant invalide');
  const [[company]] = await db.query('SELECT id FROM companies WHERE id = ?', [id]);
  if (!company) return fail(res, 404, 'Société introuvable');
  const [[usage]] = await db.query(
    `SELECT (SELECT COUNT(*) FROM users WHERE company_id = ?) AS users,
            (SELECT COUNT(*) FROM suppliers WHERE company_id = ?) AS suppliers`,
    [id, id]
  );
  if (usage.users > 0 || usage.suppliers > 0) {
    return fail(res, 409, 'Impossible de supprimer une société qui a des utilisateurs ou des fournisseurs');
  }
  await db.query('DELETE FROM companies WHERE id = ?', [id]);
  res.json({ success: true, data: { id } });
});
