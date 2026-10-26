const { clean } = require('./http');

// D69 / D70: a category list is one column (name). The chosen names are stored on the row as a
// JSON array, or NULL. The table name is one of these, never taken from the request.
const LISTS = {
  categories_suppliers: 'categories_suppliers',
  categories_products: 'categories_products',
};

const parseCategories = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
};

const storedCategories = (names) => (names && names.length ? JSON.stringify(names) : null);

// Comma-separated names from a list filter. [] means no filter; null means the filter is invalid.
function categoryFilter(raw) {
  if (raw === undefined || raw === '' || raw === null) return [];
  const parts = Array.isArray(raw) ? raw : String(raw).split(',');
  const names = parts.map((n) => clean(n));
  if (names.some((n) => !n || n.length > 150)) return null;
  return [...new Set(names)];
}

// The names from the body. Missing: null (leave the column). [] clears it.
async function readCategoryNames(db, list, raw) {
  const table = LISTS[list];
  if (raw === undefined) return { names: null };
  if (!Array.isArray(raw)) return { status: 400, message: 'Catégories : liste attendue' };
  const names = [...new Set(raw.map((n) => clean(n)))];
  if (names.some((n) => !n || n.includes(',') || n.length > 150)) {
    return { status: 400, message: 'Catégories : catégorie invalide' };
  }
  if (!names.length) return { names: [] };
  const [found] = await db.query(`SELECT name FROM ${table} WHERE name IN (?)`, [names]);
  const byLower = new Map(found.map((r) => [r.name.toLowerCase(), r.name]));
  if (names.some((n) => !byLower.has(n.toLowerCase()))) {
    return { status: 400, message: 'Catégories : catégorie introuvable' };
  }
  return {
    names: [...new Set(names.map((n) => byLower.get(n.toLowerCase())))].sort((a, b) => a.localeCompare(b, 'fr')),
  };
}

// Adds the filter to a WHERE clause. A supplier or product matches when it has any of the names.
async function categoryMatch(db, list, column, raw) {
  const names = categoryFilter(raw);
  if (names === null) return { error: true };
  if (!names.length) return { sql: '', params: [] };
  const [found] = await db.query(`SELECT name FROM ${LISTS[list]} WHERE name IN (?)`, [names]);
  if (!found.length) return { sql: ' AND 1 = 0', params: [] };
  return {
    sql: ` AND (${found.map(() => `JSON_CONTAINS(${column}, ?)`).join(' OR ')})`,
    params: found.map((r) => JSON.stringify(r.name)),
  };
}

async function listCategories(db, list) {
  const [rows] = await db.query(`SELECT name FROM ${LISTS[list]} ORDER BY name`);
  return rows;
}

async function addCategory(db, list, rawName) {
  const table = LISTS[list];
  const name = clean(rawName);
  if (!name) return { status: 400, message: 'Catégorie : champ obligatoire' };
  if (name.length > 150) return { status: 400, message: 'Catégorie : 150 caractères au maximum' };
  if (name.includes(',') || /[\u0000-\u001f\u007f]/.test(name)) {
    return { status: 400, message: 'Catégorie : caractères non autorisés' };
  }
  const [[existing]] = await db.query(`SELECT name FROM ${table} WHERE name = ?`, [name]);
  if (existing) return { data: existing };
  try {
    await db.query(`INSERT INTO ${table} (name) VALUES (?)`, [name]);
    return { data: { name } };
  } catch (e) {
    if (e.code !== 'ER_DUP_ENTRY') throw e;
    const [[row]] = await db.query(`SELECT name FROM ${table} WHERE name = ?`, [name]);
    if (!row) throw e;
    return { data: row };
  }
}

module.exports = {
  parseCategories, storedCategories, readCategoryNames, categoryMatch, listCategories, addCategory,
};
