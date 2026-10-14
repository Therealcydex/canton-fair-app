const db = require('../config/db');
const { fail, handle, toId, clean, likeContains } = require('../utils/http');
const { validate } = require('../utils/validate');
const { loadSupplier, loadBooth } = require('../utils/scope');
const { isCompanyAdmin } = require('../utils/access');
const { loadAll: loadCategories, subtreeIds } = require('./CategoryController');

const BOOTH_FIELDS = {
  phase: { label: 'Phase', type: 'int', min: 1, maxValue: 9 },
  hall: { label: 'Hall', type: 'int', required: true, min: 1, maxValue: 127 },
  level: { label: 'Étage', type: 'int', min: 0, maxValue: 9 },
  letter: { label: 'Lettre', type: 'string', max: 1, upper: true },
  num_start: { label: 'Numéro de début', type: 'int', required: true, min: 1, maxValue: 9999 },
  num_end: { label: 'Numéro de fin', type: 'int', min: 1, maxValue: 9999 },
  to_visit: { label: 'À visiter', type: 'bool' },
  comment: { label: 'Commentaire', type: 'text', max: 5000 },
};

const VISIT_STATUSES = ['prevu', 'visite', 'annule'];
const VISIT_FIELDS = {
  status: { label: 'Statut', type: 'enum', values: VISIT_STATUSES },
  visited_at: { label: 'Date de visite', type: 'datetime' },
  comment: { label: 'Commentaire', type: 'text', max: 5000 },
};

// "12.2 F35-36": hall.level, letter, number range. Same format on web and mobile.
const boothLocation = (b) => {
  const hall = b.level !== null && b.level !== undefined ? `${b.hall}.${b.level}` : `${b.hall}`;
  const nums = b.num_end && b.num_end !== b.num_start ? `${b.num_start}-${b.num_end}` : `${b.num_start}`;
  return `${hall} ${b.letter || ''}${nums}`;
};

// Local time of the server, "YYYY-MM-DD HH:MM:SS" (the fair's time when the server runs there).
const nowLocal = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

const BOOTH_SELECT = `
  SELECT b.id, b.supplier_id, s.name AS supplier_name, b.category_id, c.name AS category_name,
         b.phase, b.hall, b.level, b.letter, b.num_start, b.num_end, b.to_visit, b.comment,
         (SELECT COUNT(*) FROM booth_visits v WHERE v.booth_id = b.id) AS visits_count,
         (SELECT COUNT(*) FROM products p WHERE p.booth_id = b.id) AS products_count,
         (SELECT v.status FROM booth_visits v WHERE v.booth_id = b.id
            ORDER BY v.visited_at IS NULL, v.visited_at DESC, v.id DESC LIMIT 1) AS last_status,
         (SELECT MAX(v.visited_at) FROM booth_visits v WHERE v.booth_id = b.id AND v.status = 'visite') AS last_visited_at
  FROM booths b
  JOIN suppliers s ON s.id = b.supplier_id
  LEFT JOIN categories c ON c.id = b.category_id`;

const withLocation = (rows) => rows.map((b) => ({ ...b, location: boothLocation(b) }));

// Validates a booth body. supplier_id and category_id are checked here because they need
// the database (supplier of the caller's company, existing category).
// Returns { values } or { status, message }.
async function validateBooth(req, existing) {
  const v = validate(req.body, BOOTH_FIELDS, existing);
  if (!v.values) return { status: 400, message: v.message };
  const b = v.values;
  if (b.letter && !/^[A-Z]$/.test(b.letter)) return { status: 400, message: 'Lettre : une lettre de A à Z' };
  if (b.num_end === null) b.num_end = b.num_start;
  if (b.num_end < b.num_start) {
    return { status: 400, message: 'Le numéro de fin doit être supérieur ou égal au numéro de début' };
  }

  const body = req.body || {};
  const supplierRaw = body.supplier_id !== undefined ? body.supplier_id : existing?.supplier_id;
  if (supplierRaw === undefined || supplierRaw === null || supplierRaw === '') {
    return { status: 400, message: 'Fournisseur : champ obligatoire' };
  }
  const s = await loadSupplier(supplierRaw, req.user);
  if (!s.row) return { status: s.status === 404 ? 400 : s.status, message: s.message };
  b.supplier_id = s.row.id;

  const categoryRaw = body.category_id !== undefined ? body.category_id : existing?.category_id;
  b.category_id = null;
  if (categoryRaw !== undefined && categoryRaw !== null && categoryRaw !== '') {
    const categoryId = toId(categoryRaw);
    if (!categoryId) return { status: 400, message: 'Catégorie invalide' };
    const [[cat]] = await db.query('SELECT id FROM categories WHERE id = ?', [categoryId]);
    if (!cat) return { status: 400, message: 'Catégorie introuvable' };
    b.category_id = categoryId;
  }

  // D13: two booths of the same company cannot overlap at the same place.
  const [[overlap]] = await db.query(
    `SELECT b.id, s.name AS supplier_name FROM booths b JOIN suppliers s ON s.id = b.supplier_id
     WHERE s.company_id = ? AND b.id <> ?
       AND b.phase <=> ? AND b.hall = ? AND b.level <=> ? AND b.letter <=> ?
       AND b.num_start <= ? AND b.num_end >= ?
     LIMIT 1`,
    [req.user.company_id, existing?.id ?? 0, b.phase, b.hall, b.level, b.letter, b.num_end, b.num_start]
  );
  if (overlap) {
    return { status: 409, message: `Cet emplacement chevauche le stand de ${overlap.supplier_name}` };
  }
  return { values: b };
}

// Booths of the caller's company. Filters: supplier_id, phase, hall, category_id (with its
// sub-categories), to_visit, q (supplier name).
exports.list = handle('Booth list', async (req, res) => {
  const params = [req.user.company_id];
  let where = 's.company_id = ?';
  for (const key of ['supplier_id', 'phase', 'hall']) {
    if (req.query[key] !== undefined && req.query[key] !== '') {
      const n = toId(req.query[key]);
      if (!n) return fail(res, 400, `Filtre ${key} invalide`);
      where += ` AND b.${key} = ?`;
      params.push(n);
    }
  }
  if (req.query.category_id) {
    const categoryId = toId(req.query.category_id);
    if (!categoryId) return fail(res, 400, 'Filtre category_id invalide');
    where += ' AND b.category_id IN (?)';
    params.push(subtreeIds(await loadCategories(), categoryId));
  }
  if (req.query.to_visit === '1' || req.query.to_visit === '0') {
    where += ' AND b.to_visit = ?';
    params.push(Number(req.query.to_visit));
  }
  const q = clean(req.query.q);
  if (q) {
    where += ' AND s.name LIKE ?';
    params.push(likeContains(q));
  }
  const [rows] = await db.query(
    `${BOOTH_SELECT} WHERE ${where}
     ORDER BY b.phase IS NULL, b.phase, b.hall, b.level, b.letter, b.num_start LIMIT 1000`,
    params
  );
  res.json({ success: true, data: withLocation(rows) });
});

// Visit log of the caller's company; mine=1 limits it to the caller's own visits.
exports.listVisits = handle('Visit list', async (req, res) => {
  const params = [req.user.company_id];
  let where = 's.company_id = ?';
  if (req.query.mine === '1') {
    where += ' AND v.user_id = ?';
    params.push(req.user.id);
  }
  if (req.query.status) {
    if (!VISIT_STATUSES.includes(req.query.status)) return fail(res, 400, 'Filtre status invalide');
    where += ' AND v.status = ?';
    params.push(req.query.status);
  }
  const [rows] = await db.query(
    `SELECT v.id, v.booth_id, v.user_id, u.name AS user_name, v.visited_at, v.status, v.comment,
            b.phase, b.hall, b.level, b.letter, b.num_start, b.num_end,
            s.id AS supplier_id, s.name AS supplier_name
     FROM booth_visits v
     JOIN booths b ON b.id = v.booth_id
     JOIN suppliers s ON s.id = b.supplier_id
     JOIN users u ON u.id = v.user_id
     WHERE ${where}
     ORDER BY v.visited_at IS NULL, v.visited_at DESC, v.id DESC LIMIT 500`,
    params
  );
  res.json({ success: true, data: withLocation(rows) });
});

exports.getById = handle('Booth getById', async (req, res) => {
  const r = await loadBooth(req.params.id, req.user);
  if (!r.row) return fail(res, r.status, r.message);
  const [[booth]] = await db.query(`${BOOTH_SELECT} WHERE b.id = ?`, [r.row.id]);
  const [visits] = await db.query(
    `SELECT v.id, v.user_id, u.name AS user_name, v.visited_at, v.status, v.comment
     FROM booth_visits v JOIN users u ON u.id = v.user_id
     WHERE v.booth_id = ? ORDER BY v.visited_at IS NULL, v.visited_at DESC, v.id DESC`,
    [r.row.id]
  );
  res.json({ success: true, data: { ...withLocation([booth])[0], visits } });
});

exports.create = handle('Booth create', async (req, res) => {
  const v = await validateBooth(req);
  if (!v.values) return fail(res, v.status, v.message);
  const b = v.values;
  const [r] = await db.query(
    `INSERT INTO booths (supplier_id, category_id, phase, hall, level, letter, num_start, num_end, to_visit, comment)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [b.supplier_id, b.category_id, b.phase, b.hall, b.level, b.letter, b.num_start, b.num_end, b.to_visit, b.comment]
  );
  res.json({ success: true, data: { id: r.insertId } });
});

exports.update = handle('Booth update', async (req, res) => {
  const r = await loadBooth(req.params.id, req.user);
  if (!r.row) return fail(res, r.status, r.message);
  const v = await validateBooth(req, r.row);
  if (!v.values) return fail(res, v.status, v.message);
  const b = v.values;
  await db.query(
    `UPDATE booths SET supplier_id = ?, category_id = ?, phase = ?, hall = ?, level = ?, letter = ?,
            num_start = ?, num_end = ?, to_visit = ?, comment = ? WHERE id = ?`,
    [b.supplier_id, b.category_id, b.phase, b.hall, b.level, b.letter, b.num_start, b.num_end, b.to_visit, b.comment, r.row.id]
  );
  res.json({ success: true, data: { id: r.row.id } });
});

// Visits go with the booth; refused while products are attached to it.
exports.remove = handle('Booth remove', async (req, res) => {
  const r = await loadBooth(req.params.id, req.user);
  if (!r.row) return fail(res, r.status, r.message);
  const [[usage]] = await db.query('SELECT COUNT(*) AS n FROM products WHERE booth_id = ?', [r.row.id]);
  if (usage.n > 0) return fail(res, 409, 'Impossible de supprimer un stand auquel des produits sont rattachés');
  await db.query('DELETE FROM booths WHERE id = ?', [r.row.id]);
  res.json({ success: true, data: { id: r.row.id } });
});

// --- Visits of a booth -------------------------------------------------------

// Validates a visit. A "visite" without a date is dated now.
function validateVisit(body, existing) {
  const v = validate(body, VISIT_FIELDS, existing);
  if (!v.values) return v;
  if (!v.values.status) v.values.status = 'prevu';
  if (v.values.status === 'visite' && !v.values.visited_at) v.values.visited_at = nowLocal();
  return v;
}

// Runs the visit writes in one transaction (the visit and, for a "visite", the booth's to_visit flag: D14).
async function inTransaction(write) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const id = await write(conn);
    await conn.commit();
    return id;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

exports.createVisit = handle('Visit create', async (req, res) => {
  const r = await loadBooth(req.params.id, req.user);
  if (!r.row) return fail(res, r.status, r.message);
  const v = validateVisit(req.body);
  if (!v.values) return fail(res, 400, v.message);
  const visit = v.values;
  const id = await inTransaction(async (conn) => {
    // The author comes from the token, never from the body.
    const [ins] = await conn.query(
      'INSERT INTO booth_visits (booth_id, user_id, visited_at, status, comment) VALUES (?, ?, ?, ?, ?)',
      [r.row.id, req.user.id, visit.visited_at, visit.status, visit.comment]
    );
    if (visit.status === 'visite') await conn.query('UPDATE booths SET to_visit = 0 WHERE id = ?', [r.row.id]);
    return ins.insertId;
  });
  res.json({ success: true, data: { id } });
});

// Loads a visit of the booth and checks the caller may change it: its author or a company admin.
async function loadEditableVisit(req) {
  const r = await loadBooth(req.params.id, req.user);
  if (!r.row) return r;
  const visitId = toId(req.params.visitId);
  if (!visitId) return { status: 400, message: 'Identifiant invalide' };
  const [[visit]] = await db.query('SELECT * FROM booth_visits WHERE id = ? AND booth_id = ?', [visitId, r.row.id]);
  if (!visit) return { status: 404, message: 'Visite introuvable' };
  if (visit.user_id !== req.user.id && !isCompanyAdmin(req.user)) {
    return { status: 403, message: "Seul l'auteur de la visite ou un administrateur peut la modifier" };
  }
  return { booth: r.row, visit };
}

exports.updateVisit = handle('Visit update', async (req, res) => {
  const r = await loadEditableVisit(req);
  if (!r.visit) return fail(res, r.status, r.message);
  const v = validateVisit(req.body, r.visit);
  if (!v.values) return fail(res, 400, v.message);
  const visit = v.values;
  await inTransaction(async (conn) => {
    await conn.query('UPDATE booth_visits SET visited_at = ?, status = ?, comment = ? WHERE id = ?', [
      visit.visited_at, visit.status, visit.comment, r.visit.id,
    ]);
    if (visit.status === 'visite') await conn.query('UPDATE booths SET to_visit = 0 WHERE id = ?', [r.booth.id]);
    return r.visit.id;
  });
  res.json({ success: true, data: { id: r.visit.id } });
});

exports.removeVisit = handle('Visit remove', async (req, res) => {
  const r = await loadEditableVisit(req);
  if (!r.visit) return fail(res, r.status, r.message);
  await db.query('DELETE FROM booth_visits WHERE id = ?', [r.visit.id]);
  res.json({ success: true, data: { id: r.visit.id } });
});

module.exports.boothLocation = boothLocation;
