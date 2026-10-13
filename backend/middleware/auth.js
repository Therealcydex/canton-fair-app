const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { fail } = require('../utils/http');

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
// account or a changed level takes effect at once (D9), and puts it in req.user.
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
      'SELECT id, company_id, name, username, level, role, active FROM users WHERE id = ?',
      [payload.id]
    );
    if (!user || !user.active) return fail(res, 401, 'Compte inexistant ou désactivé');
    req.user = user;
    next();
  } catch (error) {
    console.error('[auth] requireAuth', error);
    fail(res, 500, 'Erreur interne du serveur');
  }
};

// 403 when the caller's level is below n (the super-admin always passes).
const requireLevel = (n) => (req, res, next) => {
  if (req.user.role === 'SUPER_ADMIN' || (parseInt(req.user.level) || 0) >= n) return next();
  return fail(res, 403, "Vous n'avez pas les droits nécessaires");
};

const requireSuperAdmin = (req, res, next) => {
  if (req.user.role === 'SUPER_ADMIN') return next();
  return fail(res, 403, 'Action réservée au super-administrateur');
};

module.exports = { signToken, requireAuth, requireLevel, requireSuperAdmin };
