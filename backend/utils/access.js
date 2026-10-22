// Who may do what (docs/sourcing-spec.md, D29, D62, D66). Always called with req.user, never with client data.
// Every active buyer reads and writes the suppliers, booths and products of the group; the admin
// also manages the companies and the users, and shares suppliers with companies. A viewer
// (LECTEUR, D62) belongs to one or more companies and only reads the suppliers shared with one of
// them (D66), with their contacts, booths and products.
const ADMIN_ROLE = 'ADMIN';
const BUYER_ROLE = 'ACHETEUR';
const VIEWER_ROLE = 'LECTEUR';
const ROLES = [ADMIN_ROLE, BUYER_ROLE, VIEWER_ROLE];

const isAdmin = (user) => user.role === ADMIN_ROLE;
const isViewer = (user) => user.role === VIEWER_ROLE;

// D66: SQL condition "the supplier in `column` is shared with one of the viewer's companies".
// Its one parameter is the viewer's id (req.user.id).
const sharedWithViewer = (column) => `EXISTS (SELECT 1 FROM supplier_shares ss
  JOIN user_companies uc ON uc.company_id = ss.company_id
  WHERE ss.supplier_id = ${column} AND uc.user_id = ?)`;

module.exports = { ADMIN_ROLE, BUYER_ROLE, VIEWER_ROLE, ROLES, isAdmin, isViewer, sharedWithViewer };
