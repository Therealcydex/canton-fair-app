// Who may do what (docs/sourcing-spec.md, D29). Always called with req.user, never with client data.
// Every active user reads and writes the suppliers, booths and products of the group;
// the admin also manages the companies and the users (sign-up validation).
const ADMIN_ROLE = 'ADMIN';
const BUYER_ROLE = 'ACHETEUR';
const ROLES = [ADMIN_ROLE, BUYER_ROLE];

const isAdmin = (user) => user.role === ADMIN_ROLE;

module.exports = { ADMIN_ROLE, BUYER_ROLE, ROLES, isAdmin };
