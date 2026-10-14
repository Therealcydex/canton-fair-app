const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { signToken } = require('../middleware/auth');
const { fail, handle, clean, toId } = require('../utils/http');
const { BUYER_ROLE } = require('../utils/access');

const MIN_PASSWORD = 8;
const USERNAME_RE = /^[\w.-]{3,50}$/;

const publicUser = (u) => ({
  id: u.id, company_id: u.company_id, company_name: u.company_name, company_branch: u.company_branch,
  name: u.name, username: u.username, level: u.level, role: u.role,
});

const USER_SELECT = `
  SELECT u.id, u.company_id, c.name AS company_name, c.branch AS company_branch, u.name, u.username,
         u.password_hash, u.level, u.role, u.is_active
  FROM users u LEFT JOIN companies c ON c.id = u.company_id`;

exports.login = handle('Auth login', async (req, res) => {
  const username = clean(req.body?.username);
  const password = req.body?.password;
  if (!username || !password) return fail(res, 400, "Nom d'utilisateur et mot de passe obligatoires");
  if (!process.env.JWT_SECRET) return fail(res, 500, 'Authentification indisponible (configuration serveur)');

  const [[user]] = await db.query(`${USER_SELECT} WHERE u.username = ?`, [username]);
  // Same message for an unknown user and a wrong password: do not reveal which usernames exist.
  if (!user || !(await bcrypt.compare(String(password), user.password_hash))) {
    return fail(res, 401, "Nom d'utilisateur ou mot de passe incorrect");
  }
  if (!user.is_active) {
    return fail(res, 403, "Compte inactif : il doit être validé par l'administrateur");
  }

  res.json({ success: true, token: signToken(user), user: publicUser(user) });
});

exports.me = handle('Auth me', async (req, res) => {
  const [[user]] = await db.query(`${USER_SELECT} WHERE u.id = ?`, [req.user.id]);
  res.json({ success: true, data: publicUser(user) });
});

// --- Sign-up (BF16) -----------------------------------------------------------

// Public: the companies a new user can choose from. Names only.
exports.signupCompanies = handle('Signup companies', async (req, res) => {
  const [rows] = await db.query('SELECT id, name, branch FROM companies ORDER BY name, branch');
  res.json({ success: true, data: rows });
});

// Public: creates an INACTIVE buyer account. The admin activates it (and may change its
// role, level and company) before it can log in. Role and activation never come from the body.
exports.signup = handle('Signup', async (req, res) => {
  const b = req.body || {};
  const name = clean(b.name);
  const username = clean(b.username);
  const password = b.password === undefined || b.password === null ? '' : String(b.password);
  if (!name) return fail(res, 400, 'Le nom est obligatoire');
  if (name.length > 150) return fail(res, 400, 'Le nom dépasse 150 caractères');
  if (!username) return fail(res, 400, "Le nom d'utilisateur est obligatoire");
  if (!USERNAME_RE.test(username)) {
    return fail(res, 400, "Nom d'utilisateur : 3 à 50 caractères (lettres, chiffres, . _ -)");
  }
  if (password.length < MIN_PASSWORD) {
    return fail(res, 400, `Le mot de passe doit contenir au moins ${MIN_PASSWORD} caractères`);
  }
  if (password.length > 200) return fail(res, 400, 'Le mot de passe dépasse 200 caractères');
  const companyId = toId(b.company_id);
  if (!companyId) return fail(res, 400, 'Société : champ obligatoire');
  const [[company]] = await db.query('SELECT id FROM companies WHERE id = ?', [companyId]);
  if (!company) return fail(res, 400, 'Société introuvable');

  const [[dup]] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
  if (dup) return fail(res, 409, "Ce nom d'utilisateur est déjà pris");

  const hash = await bcrypt.hash(password, 10);
  try {
    const [r] = await db.query(
      `INSERT INTO users (name, username, password_hash, level, role, is_active, company_id)
       VALUES (?, ?, ?, NULL, ?, 0, ?)`,
      [name, username, hash, BUYER_ROLE, companyId]
    );
    res.json({ success: true, data: { id: r.insertId, pending: true } });
  } catch (e) {
    // Two sign-ups with the same username at the same moment: the unique key decides.
    if (e.code === 'ER_DUP_ENTRY') return fail(res, 409, "Ce nom d'utilisateur est déjà pris");
    throw e;
  }
});

module.exports.MIN_PASSWORD = MIN_PASSWORD;
module.exports.USERNAME_RE = USERNAME_RE;
