const { clean } = require('./http');

// D72: categories_products is the only list (one column, the name). A product stores one of
// those names. A supplier stores several, separated by commas, or NULL.
const LISTS = {
  categories_products: 'categories_products',
};

const parseCategories = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  const text = String(value).trim();
  if (!text) return [];
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map((n) => String(n).trim()).filter(Boolean);
    } catch { /* an older row may already be a comma-separated list */ }
  }
  return text.split(',').map((n) => n.trim()).filter(Boolean);
};

const storedCategories = (names) => (names && names.length ? names.join(',') : null);

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

// One category name from the body. undefined: the field was left out. null: clear it.
async function readCategoryName(db, raw) {
  if (raw === undefined) return { name: undefined };
  if (raw === null || raw === '') return { name: null };
  if (typeof raw !== 'string') return { status: 400, message: 'Catégorie : une seule catégorie' };
  const name = clean(raw);
  if (!name || name.includes(',') || name.length > 150) return { status: 400, message: 'Catégorie : catégorie invalide' };
  const [[found]] = await db.query('SELECT name FROM categories_products WHERE name = ?', [name]);
  if (!found) return { status: 400, message: 'Catégorie : catégorie introuvable' };
  return { name: found.name };
}

// A product has one category. The filter keeps the products whose category is any of the names.
async function categoryIn(db, column, raw) {
  const names = categoryFilter(raw);
  if (names === null) return { error: true };
  if (!names.length) return { sql: '', params: [] };
  const [found] = await db.query('SELECT name FROM categories_products WHERE name IN (?)', [names]);
  if (!found.length) return { sql: ' AND 1 = 0', params: [] };
  return { sql: ` AND ${column} IN (?)`, params: [found.map((r) => r.name)] };
}
async function categoryMatch(db, list, column, raw) {
  const names = categoryFilter(raw);
  if (names === null) return { error: true };
  if (!names.length) return { sql: '', params: [] };
  const [found] = await db.query(`SELECT name FROM ${LISTS[list]} WHERE name IN (?)`, [names]);
  if (!found.length) return { sql: ' AND 1 = 0', params: [] };
  return {
    sql: ` AND (${found.map(() => `FIND_IN_SET(?, ${column})`).join(' OR ')})`,
    params: found.map((r) => r.name),
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
  parseCategories, storedCategories, readCategoryNames, readCategoryName, categoryMatch, categoryIn, listCategories, addCategory,
};
