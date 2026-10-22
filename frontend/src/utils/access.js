// Mirrors backend/utils/access.js. In the browser these checks are for comfort only
// (hide a menu, disable a button): the server refuses on its own.
export const isAdmin = (user) => user?.role === 'ADMIN';
// D62, D66: a company viewer only reads the suppliers shared with its companies (their contacts,
// booths and products).
export const isViewer = (user) => user?.role === 'LECTEUR';
