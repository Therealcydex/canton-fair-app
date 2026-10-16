// Mirrors backend/utils/access.js. In the browser these checks are for comfort only
// (hide a menu, disable a button): the server refuses on its own.
export const isAdmin = (user) => user?.role === 'ADMIN';
