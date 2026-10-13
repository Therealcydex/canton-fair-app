const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { fail, handle, toId, clean } = require('../utils/http');
const { MAX_LEVEL, isSuperAdmin } = require('../utils/access');

const MIN_PASSWORD = 8;
const USER_COLUMNS = `u.id, u.company_id, c.name AS company_name, u.name, u.username,
                      u.level, u.role, u.active`;

// Loads a user and checks the caller may manage it: the super-admin manages everyone,
// a company admin only the users of their own company.
// Returns { user } or { status, message } for the refusal.
async function loadManageable(req) {
  const id = toId(req.params.id);
  if (!id) return { status: 400, message: 'Identifiant invalide' };
  const [[user]] = await db.query(
    `SELECT ${USER_COLUMNS} FROM users u JOIN companies c ON c.id = u.company_id WHERE u.id = ?`,
    [id]
  );
  if (!user) return { status: 404, message: 'Utilisateur introuvable' };
  if (!isSuperAdmin(req.user) && user.company_id !== req.user.company_id) {
    return { status: 403, message: "Cet utilisateur n'appartient pas à votre société" };
  }
  return { user };
}

// Validates the fields of a create or an update. `existing` is the user being edited
// (undefined on create). Returns { values } or { status, message }.
async function validate(req, existing) {
  const b = req.body || {};
  const caller = req.user;
  const superAdmin = isSuperAdmin(caller);
  const refuse = (status, message) => ({ status, message });

  const name = clean(b.name) ?? existing?.name ?? null;
  if (!name) return refuse(400, 'Le nom est obligatoire');
  if (name.length > 100) return refuse(400, 'Le nom dépasse 100 caractères');

  const username = clean(b.username) ?? existing?.username ?? null;
  if (!username) return refuse(400, "Le nom d'utilisateur est obligatoire");
  if (!/^[\w.-]{3,50}$/.test(username)) {
    return refuse(400, "Nom d'utilisateur : 3 à 50 caractères (lettres, chiffres, . _ -)");
  }

  const level = b.level === undefined ? existing?.level ?? 1 : Number(b.level);
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) {
    return refuse(400, `Le niveau doit être un entier entre 1 et ${MAX_LEVEL}`);
  }
  // A company admin cannot give a level above their own.
  if (!superAdmin && level > caller.level) {
    return refuse(403, 'Vous ne pouvez pas attribuer un niveau supérieur au vôtre');
  }

  const role = (clean(b.role) ?? existing?.role ?? 'ACHETEUR').toUpperCase();
  if (role.length > 50) return refuse(400, 'Le rôle dépasse 50 caractères');
  if (role === 'SUPER_ADMIN' && !superAdmin) {
    return refuse(403, 'Seul le super-administrateur peut attribuer ce rôle');
  }

  // Company: chosen by the super-admin only; a company admin works in their own company.
  let companyId = existing?.company_id ?? caller.company_id;
  if (superAdmin && b.company_id !== undefined) {
    companyId = toId(b.company_id);
    if (!companyId) return refuse(400, 'Société invalide');
    const [[company]] = await db.query('SELECT id FROM companies WHERE id = ?', [companyId]);
    if (!company) return refuse(400, 'Société introuvable');
  }

  const active = b.active === undefined ? existing?.active ?? 1 : (b.active ? 1 : 0);

  let password = null;
  if (b.password !== undefined && b.password !== null && b.password !== '') {
    password = String(b.password);
    if (password.length < MIN_PASSWORD) {
      return refuse(400, `Le mot de passe doit contenir au moins ${MIN_PASSWORD} caractères`);
    }
  } else if (!existing) {
    return refuse(400, 'Le mot de passe est obligatoire');
  }

  const [[dup]] = await db.query('SELECT id FROM users WHERE username = ? AND id <> ?', [
    username, existing?.id ?? 0,
  ]);
  if (dup) return refuse(409, "Ce nom d'utilisateur est déjà pris");

  return { values: { name, username, level, role, companyId, active, password } };
}

exports.list = handle('User list', async (req, res) => {
  const params = [];
  let where = '1=1';
  if (!isSuperAdmin(req.user)) {
    where += ' AND u.company_id = ?';
    params.push(req.user.company_id);
  } else if (toId(req.query.company_id)) {
    // A filter, not an identity: the super-admin may narrow the list to one company.
    where += ' AND u.company_id = ?';
    params.push(toId(req.query.company_id));
  }
  const [rows] = await db.query(
    `SELECT ${USER_COLUMNS} FROM users u JOIN companies c ON c.id = u.company_id
     WHERE ${where} ORDER BY c.name, u.name`,
    params
  );
  res.json({ success: true, data: rows });
});

exports.getById = handle('User getById', async (req, res) => {
  const r = await loadManageable(req);
  if (!r.user) return fail(res, r.status, r.message);
  res.json({ success: true, data: r.user });
});

exports.create = handle('User create', async (req, res) => {
  const r = await validate(req);
  if (!r.values) return fail(res, r.status, r.message);
  const v = r.values;
  const hash = await bcrypt.hash(v.password, 10);
  const [ins] = await db.query(
    `INSERT INTO users (company_id, name, username, password_hash, level, role, active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [v.companyId, v.name, v.username, hash, v.level, v.role, v.active]
  );
  res.json({ success: true, data: { id: ins.insertId } });
});

exports.update = handle('User update', async (req, res) => {
  const loaded = await loadManageable(req);
  if (!loaded.user) return fail(res, loaded.status, loaded.message);
  const existing = loaded.user;

  // A company admin cannot edit a user whose level is above their own.
  if (!isSuperAdmin(req.user) && existing.level > req.user.level) {
    return fail(res, 403, 'Vous ne pouvez pas modifier un utilisateur de niveau supérieur au vôtre');
  }

  const r = await validate(req, existing);
  if (!r.values) return fail(res, r.status, r.message);
  const v = r.values;

  // Protect the caller from locking themselves out.
  if (existing.id === req.user.id) {
    if (!v.active) return fail(res, 409, 'Vous ne pouvez pas désactiver votre propre compte');
    if (v.level !== existing.level || v.role !== existing.role || v.companyId !== existing.company_id) {
      return fail(res, 409, 'Vous ne pouvez pas modifier votre propre niveau, rôle ou société');
    }
  }

  const sets = ['company_id = ?', 'name = ?', 'username = ?', 'level = ?', 'role = ?', 'active = ?'];
  const params = [v.companyId, v.name, v.username, v.level, v.role, v.active];
  if (v.password) {
    sets.push('password_hash = ?');
    params.push(await bcrypt.hash(v.password, 10));
  }
  params.push(existing.id);
  await db.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);
  res.json({ success: true, data: { id: existing.id } });
});
