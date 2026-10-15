const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { signToken } = require('../middleware/auth');
const { fail, handle, clean } = require('../utils/http');

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
    return fail(res, 403, "Compte désactivé : contactez l'administrateur");
  }

  res.json({ success: true, token: signToken(user), user: publicUser(user) });
});

exports.me = handle('Auth me', async (req, res) => {
  const [[user]] = await db.query(`${USER_SELECT} WHERE u.id = ?`, [req.user.id]);
  res.json({ success: true, data: publicUser(user) });
});

module.exports.MIN_PASSWORD = MIN_PASSWORD;
module.exports.USERNAME_RE = USERNAME_RE;
