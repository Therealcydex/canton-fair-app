const db = require('../config/db');
const { fail, handle } = require('../utils/http');
const { validate } = require('../utils/validate');
const { loadCompany } = require('../utils/scope');

const COMPANY_FIELDS = {
  name: { label: 'Nom de la société', type: 'string', required: true, max: 150 },
  branch: { label: 'Branche', type: 'string', max: 150 },
};

// Every logged-in user can list companies (needed to choose whom to share a product with).
exports.list = handle('Company list', async (req, res) => {
  const [rows] = await db.query(
    `SELECT c.id, c.name, c.branch,
            (SELECT COUNT(*) FROM users u WHERE u.company_id = c.id) AS users_count,
            (SELECT COUNT(*) FROM product_shares ps WHERE ps.company_id = c.id) AS shared_products_count
     FROM companies c ORDER BY c.name, c.branch`
  );
  res.json({ success: true, data: rows });
});

// D25: name + branch is unique (a NULL branch is compared with <=>, which UNIQUE does not do).
async function duplicate(name, branch, id = 0) {
  const [[dup]] = await db.query(
    'SELECT id FROM companies WHERE name = ? AND branch <=> ? AND id <> ?', [name, branch, id]
  );
  return !!dup;
}

exports.create = handle('Company create', async (req, res) => {
  const v = validate(req.body, COMPANY_FIELDS);
  if (!v.values) return fail(res, 400, v.message);
  const { name, branch } = v.values;
  if (await duplicate(name, branch)) return fail(res, 409, 'Cette société (et branche) existe déjà');
  const [r] = await db.query('INSERT INTO companies (name, branch) VALUES (?, ?)', [name, branch]);
  res.json({ success: true, data: { id: r.insertId, name, branch } });
});

exports.update = handle('Company update', async (req, res) => {
  const c = await loadCompany(req.params.id);
  if (!c.row) return fail(res, c.status, c.message);
  const v = validate(req.body, COMPANY_FIELDS, c.row);
  if (!v.values) return fail(res, 400, v.message);
  const { name, branch } = v.values;
  if (await duplicate(name, branch, c.row.id)) return fail(res, 409, 'Cette société (et branche) existe déjà');
  await db.query('UPDATE companies SET name = ?, branch = ? WHERE id = ?', [name, branch, c.row.id]);
  res.json({ success: true, data: { id: c.row.id, name, branch } });
});

// Its users stay, without a company (FK SET NULL); its shares go (FK CASCADE on product_shares).
// The admin cannot delete their own company.
exports.remove = handle('Company remove', async (req, res) => {
  const c = await loadCompany(req.params.id);
  if (!c.row) return fail(res, c.status, c.message);
  if (c.row.id === req.user.company_id) return fail(res, 409, 'Vous ne pouvez pas supprimer votre propre société');
  await db.query('DELETE FROM companies WHERE id = ?', [c.row.id]);
  res.json({ success: true, data: { id: c.row.id } });
});
