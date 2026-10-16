const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { fail } = require('../utils/http');
const { isAdmin } = require('../utils/access');

// No default secret: without JWT_SECRET every protected route refuses the request.
const secret = () => process.env.JWT_SECRET;

// Signs a token with the caller's identity. Never the password.
const signToken = (user) =>
  jwt.sign(
    { id: user.id, company_id: user.company_id, name: user.name, level: user.level, role: user.role },
    secret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
  );

// Checks "Authorization: Bearer <token>", then reloads the user so that a deactivated
// account or a changed role takes effect at once (D9), and puts it in req.user.
const requireAuth = async (req, res, next) => {
  if (!secret()) return fail(res, 401, 'Authentification indisponible (configuration serveur)');
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return fail(res, 401, 'Veuillez vous connecter');

  let payload;
  try {
    payload = jwt.verify(token, secret());
  } catch {
    return fail(res, 401, 'Session expirée, veuillez vous reconnecter');
  }

  try {
    const [[user]] = await db.query(
      'SELECT id, company_id, name, username, level, role, is_active FROM users WHERE id = ?',
      [payload.id]
    );
    if (!user || !user.is_active) return fail(res, 401, 'Compte inexistant ou désactivé');
    req.user = user;
    next();
  } catch (error) {
    console.error('[auth] requireAuth', error);
    fail(res, 500, 'Erreur interne du serveur');
  }
};

// 403 unless the caller is the admin (companies, users, sign-up validation).
const requireAdmin = (req, res, next) => {
  if (isAdmin(req.user)) return next();
  return fail(res, 403, "Action réservée à l'administrateur");
};

module.exports = { signToken, requireAuth, requireAdmin };
