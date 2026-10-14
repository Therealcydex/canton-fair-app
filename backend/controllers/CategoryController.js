const db = require('../config/db');
const { fail, handle, toId, clean } = require('../utils/http');

// D12: at most 4 levels (depth 0 to 3).
const MAX_DEPTH = 3;

const loadAll = async (conn = db) => {
  const [rows] = await conn.query('SELECT id, parent_id, name, depth FROM categories ORDER BY depth, name');
  return rows;
};

// Ids of a category and all its descendants.
const subtreeIds = (all, rootId) => {
  const ids = [rootId];
  for (let i = 0; i < ids.length; i++) {
    for (const c of all) if (c.parent_id === ids[i]) ids.push(c.id);
  }
  return ids;
};

// Height of a subtree: 0 for a leaf.
const subtreeHeight = (all, rootId) => {
  const children = all.filter((c) => c.parent_id === rootId);
  return children.length ? 1 + Math.max(...children.map((c) => subtreeHeight(all, c.id))) : 0;
};

// Validates name and parent. Returns { name, parentId, depth } or { status, message }.
async function validateCategory(body, all, existing) {
  const name = clean(body?.name) ?? existing?.name ?? null;
  if (!name) return { status: 400, message: 'Le nom de la catégorie est obligatoire' };
  if (name.length > 100) return { status: 400, message: 'Le nom dépasse 100 caractères' };

  let parentId = existing ? existing.parent_id : null;
  if (body && body.parent_id !== undefined) {
    parentId = body.parent_id === null || body.parent_id === '' ? null : toId(body.parent_id);
    if (body.parent_id !== null && body.parent_id !== '' && !parentId) {
      return { status: 400, message: 'Catégorie parente invalide' };
    }
  }

  let depth = 0;
  if (parentId) {
    const parent = all.find((c) => c.id === parentId);
    if (!parent) return { status: 400, message: 'Catégorie parente introuvable' };
    if (existing && subtreeIds(all, existing.id).includes(parentId)) {
      return { status: 409, message: 'Une catégorie ne peut pas être placée sous elle-même ou sous une de ses sous-catégories' };
    }
    depth = parent.depth + 1;
  }
  const height = existing ? subtreeHeight(all, existing.id) : 0;
  if (depth + height > MAX_DEPTH) {
    return { status: 409, message: `L'arborescence est limitée à ${MAX_DEPTH + 1} niveaux` };
  }

  const sibling = all.find((c) => c.parent_id === parentId && c.id !== existing?.id
    && c.name.localeCompare(name, 'fr', { sensitivity: 'base' }) === 0);
  if (sibling) return { status: 409, message: 'Une catégorie de même nom existe déjà à cet endroit' };

  return { name, parentId, depth };
}

// Flat list; the client builds the tree from parent_id. Readable by every logged-in user.
exports.list = handle('Category list', async (req, res) => {
  res.json({ success: true, data: await loadAll() });
});

exports.create = handle('Category create', async (req, res) => {
  const all = await loadAll();
  const v = await validateCategory(req.body, all);
  if (v.status) return fail(res, v.status, v.message);
  const [r] = await db.query('INSERT INTO categories (parent_id, name, depth) VALUES (?, ?, ?)', [
    v.parentId, v.name, v.depth,
  ]);
  res.json({ success: true, data: { id: r.insertId } });
});

// Rename and/or move. Moving shifts the depth of the whole subtree, in one transaction.
exports.update = handle('Category update', async (req, res) => {
  const id = toId(req.params.id);
  if (!id) return fail(res, 400, 'Identifiant invalide');
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const all = await loadAll(conn);
    const existing = all.find((c) => c.id === id);
    if (!existing) {
      await conn.rollback();
      return fail(res, 404, 'Catégorie introuvable');
    }
    const v = await validateCategory(req.body, all, existing);
    if (v.status) {
      await conn.rollback();
      return fail(res, v.status, v.message);
    }
    await conn.query('UPDATE categories SET name = ?, parent_id = ? WHERE id = ?', [v.name, v.parentId, id]);
    const shift = v.depth - existing.depth;
    if (shift !== 0) {
      await conn.query('UPDATE categories SET depth = depth + ? WHERE id IN (?)', [shift, subtreeIds(all, id)]);
    }
    await conn.commit();
    res.json({ success: true, data: { id } });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
});

// Refused while the category has sub-categories or booths: no booth silently loses its category.
exports.remove = handle('Category remove', async (req, res) => {
  const id = toId(req.params.id);
  if (!id) return fail(res, 400, 'Identifiant invalide');
  const [[cat]] = await db.query('SELECT id FROM categories WHERE id = ?', [id]);
  if (!cat) return fail(res, 404, 'Catégorie introuvable');
  const [[usage]] = await db.query(
    `SELECT (SELECT COUNT(*) FROM categories WHERE parent_id = ?) AS children,
            (SELECT COUNT(*) FROM booths WHERE category_id = ?) AS booths`,
    [id, id]
  );
  if (usage.children > 0) return fail(res, 409, 'Supprimez ou déplacez d’abord ses sous-catégories');
  if (usage.booths > 0) return fail(res, 409, 'Cette catégorie est utilisée par des stands');
  await db.query('DELETE FROM categories WHERE id = ?', [id]);
  res.json({ success: true, data: { id } });
});

module.exports.subtreeIds = subtreeIds;
module.exports.loadAll = loadAll;
