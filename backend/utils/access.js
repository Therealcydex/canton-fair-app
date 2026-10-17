// Who may do what (docs/sourcing-spec.md, D29, D62). Always called with req.user, never with client data.
// Every active buyer reads and writes the suppliers, booths and products of the group; the admin
// also manages the companies and the users, and shares booths with companies. A viewer (LECTEUR,
// D62) belongs to a company and only reads the booths shared with it.
const ADMIN_ROLE = 'ADMIN';
const BUYER_ROLE = 'ACHETEUR';
const VIEWER_ROLE = 'LECTEUR';
const ROLES = [ADMIN_ROLE, BUYER_ROLE, VIEWER_ROLE];

const isAdmin = (user) => user.role === ADMIN_ROLE;
const isViewer = (user) => user.role === VIEWER_ROLE;

module.exports = { ADMIN_ROLE, BUYER_ROLE, VIEWER_ROLE, ROLES, isAdmin, isViewer };
