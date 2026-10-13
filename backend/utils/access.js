// Who may do what (docs/sourcing-spec.md, D4). Always called with req.user, never with client data.
const ADMIN_LEVEL = 4;
const MAX_LEVEL = 9;

const isSuperAdmin = (user) => user.role === 'SUPER_ADMIN';
const isCompanyAdmin = (user) => isSuperAdmin(user) || (parseInt(user.level) || 0) >= ADMIN_LEVEL;

module.exports = { ADMIN_LEVEL, MAX_LEVEL, isSuperAdmin, isCompanyAdmin };
