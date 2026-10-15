const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { fail, handle, toId, clean } = require('../utils/http');
const { ROLES, BUYER_ROLE } = require('../utils/access');
const { MIN_PASSWORD, USERNAME_RE } = require('./AuthController');

// Admin only (routes/userRoutes.js).
const USER_COLUMNS = `u.id, u.company_id, c.name AS company_name, c.branch AS company_branch,
                      u.name, u.username, u.level, u.role, u.is_active, u.created_at`;
const USER_FROM = 'FROM users u LEFT JOIN companies c ON c.id = u.company_id';

async function loadUser(rawId) {
  const id = toId(rawId);
  if (!id) return { status: 400, message: 'Identifiant invalide' };
  const [[user]] = await db.query(`SELECT ${USER_COLUMNS} ${USER_FROM} WHERE u.id = ?`, [id]);
  if (!user) return { status: 404, message: 'Utilisateur introuvable' };
  return { user };
}

// Validates the fields of a create or an update; `existing` fills what the body leaves out.
// Returns { values } or { status, message }.
async function validateUser(body, existing) {
  const b = body || {};
  const refuse = (status, message) => ({ status, message });
  const pick = (key) => (b[key] !== undefined ? b[key] : existing?.[key]);

  const name = clean(pick('name'));
  if (!name) return refuse(400, 'Le nom est obligatoire');
  if (name.length > 150) return refuse(400, 'Le nom dépasse 150 caractères');

  const username = clean(pick('username'));
  if (!username) return refuse(400, "Le nom d'utilisateur est obligatoire");
  if (!USERNAME_RE.test(username)) {
    return refuse(400, "Nom d'utilisateur : 3 à 50 caractères (lettres, chiffres, . _ -)");
  }

  const level = clean(pick('level'));
  if (level && level.length > 50) return refuse(400, 'Le niveau dépasse 50 caractères');

  const role = (clean(pick('role')) || BUYER_ROLE).toUpperCase();
  if (!ROLES.includes(role)) return refuse(400, `Rôle : ${ROLES.join(' ou ')}`);

  const companyRaw = pick('company_id');
  let companyId = null;
  if (companyRaw !== undefined && companyRaw !== null && companyRaw !== '') {
    companyId = toId(companyRaw);
    if (!companyId) return refuse(400, 'Société invalide');
    const [[company]] = await db.query('SELECT id FROM companies WHERE id = ?', [companyId]);
    if (!company) return refuse(400, 'Société introuvable');
  }

  const activeRaw = pick('is_active');
  const isActive = activeRaw === undefined || activeRaw === null ? 1
    : activeRaw === true || activeRaw === 1 || activeRaw === '1' || activeRaw === 'true' ? 1 : 0;

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

  return { values: { name, username, level, role, companyId, isActive, password } };
}

// pending=1: sign-ups waiting for validation (inactive), newest first. company_id: a filter.
exports.list = handle('User list', async (req, res) => {
  const params = [];
  let where = '1=1';
  const pending = req.query.pending === '1';
  if (pending) where += ' AND u.is_active = 0';
  if (req.query.company_id) {
    const companyId = toId(req.query.company_id);
    if (!companyId) return fail(res, 400, 'Filtre company_id invalide');
    where += ' AND u.company_id = ?';
    params.push(companyId);
  }
  const order = pending ? 'u.created_at DESC, u.id DESC' : 'u.is_active, c.name, u.name';
  const [rows] = await db.query(`SELECT ${USER_COLUMNS} ${USER_FROM} WHERE ${where} ORDER BY ${order}`, params);
  res.json({ success: true, data: rows });
});

exports.getById = handle('User getById', async (req, res) => {
  const r = await loadUser(req.params.id);
  if (!r.user) return fail(res, r.status, r.message);
  res.json({ success: true, data: r.user });
});

exports.create = handle('User create', async (req, res) => {
  const r = await validateUser(req.body);
  if (!r.values) return fail(res, r.status, r.message);
  const v = r.values;
  const hash = await bcrypt.hash(v.password, 10);
  const [ins] = await db.query(
    `INSERT INTO users (name, username, password_hash, level, role, is_active, company_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [v.name, v.username, hash, v.level, v.role, v.isActive, v.companyId]
  );
  res.json({ success: true, data: { id: ins.insertId } });
});

// Also how the admin activates or deactivates an account: { is_active: 1 | 0 }.
exports.update = handle('User update', async (req, res) => {
  const loaded = await loadUser(req.params.id);
  if (!loaded.user) return fail(res, loaded.status, loaded.message);
  const existing = loaded.user;
  const r = await validateUser(req.body, existing);
  if (!r.values) return fail(res, r.status, r.message);
  const v = r.values;

  // Protect the admin from locking themselves out.
  if (existing.id === req.user.id) {
    if (!v.isActive) return fail(res, 409, 'Vous ne pouvez pas désactiver votre propre compte');
    if (v.role !== existing.role) return fail(res, 409, 'Vous ne pouvez pas modifier votre propre rôle');
  }

  const sets = ['name = ?', 'username = ?', 'level = ?', 'role = ?', 'is_active = ?', 'company_id = ?'];
  const params = [v.name, v.username, v.level, v.role, v.isActive, v.companyId];
  if (v.password) {
    sets.push('password_hash = ?');
    params.push(await bcrypt.hash(v.password, 10));
  }
  params.push(existing.id);
  await db.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);
  res.json({ success: true, data: { id: existing.id } });
});

// Refuses a sign-up, or removes an account. Nothing references users in schema v2.
exports.remove = handle('User remove', async (req, res) => {
  const loaded = await loadUser(req.params.id);
  if (!loaded.user) return fail(res, loaded.status, loaded.message);
  if (loaded.user.id === req.user.id) return fail(res, 409, 'Vous ne pouvez pas supprimer votre propre compte');
  await db.query('DELETE FROM users WHERE id = ?', [loaded.user.id]);
  res.json({ success: true, data: { id: loaded.user.id } });
});
