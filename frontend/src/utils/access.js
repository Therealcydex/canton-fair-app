// Mirrors backend/utils/access.js. In the browser these checks are for comfort only
// (hide a menu, disable a button): the server refuses on its own.
export const isAdmin = (user) => user?.role === 'ADMIN';
// D62: a company viewer only reads the booths shared with its company.
export const isViewer = (user) => user?.role === 'LECTEUR';
