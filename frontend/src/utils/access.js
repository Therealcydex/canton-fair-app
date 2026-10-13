// Mirrors backend/utils/access.js. In the browser these checks are for comfort only
// (hide a menu, disable a button): the server refuses on its own.
export const ADMIN_LEVEL = 4;

export const isSuperAdmin = (user) => user?.role === 'SUPER_ADMIN';
export const isCompanyAdmin = (user) => isSuperAdmin(user) || (parseInt(user?.level) || 0) >= ADMIN_LEVEL;
