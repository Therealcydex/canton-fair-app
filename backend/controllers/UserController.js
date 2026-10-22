const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { fail, handle, toId, clean } = require('../utils/http');
const { ROLES, BUYER_ROLE, VIEWER_ROLE } = require('../utils/access');
const { loadCompanyIds, idList } = require('../utils/scope');
const { MIN_PASSWORD, USERNAME_RE } = require('./AuthController');

// Admin only (routes/userRoutes.js). D66: company_ids, the user's companies.
const USER_COLUMNS = `u.id, u.name, u.username, u.level, u.role, u.is_active, u.created_at,
  (SELECT GROUP_CONCAT(uc.company_id ORDER BY uc.company_id) FROM user_companies uc WHERE uc.user_id = u.id) AS company_ids`;
const USER_FROM = 'FROM users u';
const withCompanyIds = (u) => ({ ...u, company_ids: idList(u.company_ids) });

async function loadUser(rawId) {
  const id = toId(rawId);
  if (!id) return { status: 400, message: 'Identifiant invalide' };
  const [[user]] = await db.query(`SELECT ${USER_COLUMNS} ${USER_FROM} WHERE u.id = ?`, [id]);
  if (!user) return { status: 404, message: 'Utilisateur introuvable' };
  return { user: withCompanyIds(user) };
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

  // D56: the level is a number from 1 to 5, or none.
  const levelRaw = clean(pick('level'));
  if (levelRaw && !/^[1-5]$/.test(levelRaw)) return refuse(400, 'Le niveau va de 1 à 5');
  const level = levelRaw ? Number(levelRaw) : null;

  const role = (clean(pick('role')) || BUYER_ROLE).toUpperCase();
  if (!ROLES.includes(role)) return refuse(400, `Rôle : ${ROLES.join(' ou ')}`);

  // D66: the user's companies, any number of them (left out on an update: they stay).
  const companiesRaw = pick('company_ids');
  const companies = await loadCompanyIds(companiesRaw ?? [], 'Sociétés');
  if (!companies.ids) return refuse(400, companies.message);
  const companyIds = companies.ids;
  // D62, D66: a viewer reads the suppliers shared with its companies, so it needs one.
  if (role === VIEWER_ROLE && !companyIds.length) return refuse(400, 'Un lecteur doit appartenir à au moins une société');

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

  return { values: { name, username, level, role, companyIds, isActive, password } };
}

// Writes the user row and its companies in one transaction; returns the user id.
async function writeUser(sql, params, existingId, companyIds) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.query(sql, params);
    const id = existingId || r.insertId;
    await conn.query('DELETE FROM user_companies WHERE user_id = ?', [id]);
    if (companyIds.length) {
      await conn.query('INSERT INTO user_companies (user_id, company_id) VALUES ?', [companyIds.map((c) => [id, c])]);
    }
    await conn.commit();
    return id;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
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
    where += ' AND EXISTS (SELECT 1 FROM user_companies uc WHERE uc.user_id = u.id AND uc.company_id = ?)';
    params.push(companyId);
  }
  const order = pending ? 'u.created_at DESC, u.id DESC' : 'u.is_active, u.name';
  const [rows] = await db.query(`SELECT ${USER_COLUMNS} ${USER_FROM} WHERE ${where} ORDER BY ${order}`, params);
  res.json({ success: true, data: rows.map(withCompanyIds) });
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
  const id = await writeUser(
    `INSERT INTO users (name, username, password_hash, level, role, is_active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [v.name, v.username, hash, v.level, v.role, v.isActive], null, v.companyIds
  );
  res.json({ success: true, data: { id } });
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

  const sets = ['name = ?', 'username = ?', 'level = ?', 'role = ?', 'is_active = ?'];
  const params = [v.name, v.username, v.level, v.role, v.isActive];
  if (v.password) {
    sets.push('password_hash = ?');
    params.push(await bcrypt.hash(v.password, 10));
  }
  params.push(existing.id);
  await writeUser(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params, existing.id, v.companyIds);
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
