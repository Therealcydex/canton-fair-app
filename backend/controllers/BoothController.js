const db = require('../config/db');
const { fail, handle, toId, clean, likeContains } = require('../utils/http');
const { validate } = require('../utils/validate');
const { padBoothNumbers } = require('../utils/halls');
const { loadBooth } = require('../utils/scope');

// The limits of the CHECK constraints and column types of schema v2, checked here first so the
// user gets a French message instead of a database error.
const BOOTH_FIELDS = {
  phase: { label: 'Phase', type: 'int', required: true, min: 1, maxValue: 3 },
  hall: { label: 'Hall', type: 'int', required: true, min: 1, maxValue: 127 },
  floor: { label: 'Étage', type: 'int', required: true, min: 1, maxValue: 4 },
  letter: { label: 'Lettre', type: 'string', max: 1, upper: true },
  num_start: { label: 'Numéro de début', type: 'int', min: 1, maxValue: 32767 },
  num_end: { label: 'Numéro de fin', type: 'int', min: 1, maxValue: 32767 },
  visited: { label: 'Visité', type: 'bool' },
  comment: { label: 'Commentaire', type: 'text', max: 5000 },
};

// D32: "11.3J26", "14.3I16-17" or "9.1": the same text as the generated column booth_code.
// The same code as the generated column booth_code (D32, D50: numbers on 2 digits, 10.3A08-23).
const two = (n) => String(n).padStart(2, '0');
const boothCode = (b) =>
  `${b.hall}.${b.floor}${b.letter === null ? '' : `${b.letter}${two(b.num_start)}${b.num_end === null ? '' : `-${two(b.num_end)}`}`}`;

// Validates a booth body. supplier_id and category_id need the database.
// Returns { values } or { status, message }.
async function validateBooth(req, existing) {
  const v = validate(req.body, BOOTH_FIELDS, existing);
  if (!v.values) return { status: 400, message: v.message };
  const b = v.values;
  // D27: always uppercase, so "a" and "A" cannot make two codes for one place.
  if (b.letter !== null && !/^[A-Z]$/.test(b.letter)) return { status: 400, message: 'Lettre : une lettre de A à Z' };
  // D32: the letter and the number go together ("11.3J26"); without both, only the hall and
  // floor are known ("9.1").
  if ((b.letter === null) !== (b.num_start === null)) {
    return { status: 400, message: 'La lettre et le numéro vont ensemble : donnez les deux, ou aucun des deux' };
  }
  if (b.num_start === null && b.num_end !== null) {
    return { status: 400, message: 'Un numéro de fin demande une lettre et un numéro de début' };
  }
  // A single booth has no end number ("22", not "22-22").
  if (b.num_end !== null && b.num_end === b.num_start) b.num_end = null;
  if (b.num_end !== null && b.num_end < b.num_start) {
    return { status: 400, message: 'Le numéro de fin doit être supérieur ou égal au numéro de début' };
  }

  const body = req.body || {};
  const pick = (key) => (body[key] !== undefined ? body[key] : existing?.[key]);

  b.supplier_id = null;
  const supplierRaw = pick('supplier_id');
  if (supplierRaw !== undefined && supplierRaw !== null && supplierRaw !== '') {
    const supplierId = toId(supplierRaw);
    if (!supplierId) return { status: 400, message: 'Fournisseur invalide' };
    const [[s]] = await db.query('SELECT id FROM suppliers WHERE id = ?', [supplierId]);
    if (!s) return { status: 400, message: 'Fournisseur introuvable' };
    b.supplier_id = supplierId;
  }

  b.category_id = null;
  const categoryRaw = pick('category_id');
  if (categoryRaw !== undefined && categoryRaw !== null && categoryRaw !== '') {
    const categoryId = toId(categoryRaw);
    if (!categoryId) return { status: 400, message: 'Catégorie invalide' };
    const [[cat]] = await db.query('SELECT id, phase FROM canton_fair_category WHERE id = ?', [categoryId]);
    if (!cat) return { status: 400, message: 'Catégorie introuvable' };
    // D30: the category list is per fair phase ("Phase 2 (Oct.23 - 27)").
    if (!cat.phase.startsWith(`Phase ${b.phase} `)) {
      return { status: 400, message: `Cette catégorie appartient à la ${cat.phase.split(' (')[0].toLowerCase()}, pas à la phase ${b.phase}` };
    }
    b.category_id = categoryId;
  }

  // D26, D32: two booths of one phase cannot overlap at the same place ("12.1A22-24" and
  // "12.1A23" are the same booth). A booth known only by "9.1" overlaps nothing.
  if (b.letter === null) return { values: b };
  const end = b.num_end ?? b.num_start;
  const [[overlap]] = await db.query(
    `SELECT booth_code FROM booths
     WHERE id <> ? AND phase = ? AND hall = ? AND floor = ? AND letter = ?
       AND num_start <= ? AND COALESCE(num_end, num_start) >= ?
     LIMIT 1`,
    [existing?.id ?? 0, b.phase, b.hall, b.floor, b.letter, end, b.num_start]
  );
  if (overlap) return { status: 409, message: `Cet emplacement chevauche le booth ${overlap.booth_code} (phase ${b.phase})` };
  return { values: b };
}

// Runs a write; a duplicate booth (uq_booth_place) that slipped between the check and the write (two
// users at the same moment) still ends in a 409.
async function writeBooth(res, b, sql, params) {
  try {
    const [r] = await db.query(sql, params);
    return r;
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      fail(res, 409, `Le booth ${boothCode(b)} existe déjà`);
      return null;
    }
    throw e;
  }
}

// Every booth of the group. Filters: supplier_id, phase, hall, floor, category_id,
// visited (0 = the "to visit" list), q (booth code or supplier name).
exports.list = handle('Booth list', async (req, res) => {
  const params = [];
  let where = '1=1';
  for (const key of ['supplier_id', 'phase', 'hall', 'floor', 'category_id']) {
    if (req.query[key] !== undefined && req.query[key] !== '') {
      const n = toId(req.query[key]);
      if (!n) return fail(res, 400, `Filtre ${key} invalide`);
      where += ` AND v.${key} = ?`;
      params.push(n);
    }
  }
  if (req.query.visited !== undefined && req.query.visited !== '') {
    if (req.query.visited !== '0' && req.query.visited !== '1') return fail(res, 400, 'Filtre visited invalide (0 ou 1)');
    where += ' AND v.visited = ?';
    params.push(Number(req.query.visited));
  }
  const q = clean(req.query.q);
  if (q) {
    // D50: "10.3A8" finds the booth 10.3A08 (numbers stored on 2 digits).
    where += ' AND (v.booth_code LIKE ? OR v.booth_code LIKE ? OR v.supplier_name LIKE ?)';
    params.push(likeContains(q), likeContains(padBoothNumbers(q)), likeContains(q));
  }
  const [rows] = await db.query(
    `SELECT v.* FROM v_booths v WHERE ${where}
     ORDER BY v.phase, v.hall, v.floor, v.letter, v.num_start LIMIT 1000`,
    params
  );
  res.json({ success: true, data: rows });
});

exports.getById = handle('Booth getById', async (req, res) => {
  const r = await loadBooth(req.params.id);
  if (!r.row) return fail(res, r.status, r.message);
  const [[booth]] = await db.query('SELECT * FROM v_booths WHERE id = ?', [r.row.id]);
  res.json({ success: true, data: booth });
});

exports.create = handle('Booth create', async (req, res) => {
  const v = await validateBooth(req);
  if (!v.values) return fail(res, v.status, v.message);
  const b = v.values;
  const r = await writeBooth(res, b,
    `INSERT INTO booths (phase, hall, floor, letter, num_start, num_end, category_id, supplier_id, visited, comment)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [b.phase, b.hall, b.floor, b.letter, b.num_start, b.num_end, b.category_id, b.supplier_id, b.visited, b.comment]
  );
  if (r) res.json({ success: true, data: { id: r.insertId, booth_code: boothCode(b) } });
});

exports.update = handle('Booth update', async (req, res) => {
  const loaded = await loadBooth(req.params.id);
  if (!loaded.row) return fail(res, loaded.status, loaded.message);
  const v = await validateBooth(req, loaded.row);
  if (!v.values) return fail(res, v.status, v.message);
  const b = v.values;
  const r = await writeBooth(res, b,
    `UPDATE booths SET phase = ?, hall = ?, floor = ?, letter = ?, num_start = ?, num_end = ?,
            category_id = ?, supplier_id = ?, visited = ?, comment = ? WHERE id = ?`,
    [b.phase, b.hall, b.floor, b.letter, b.num_start, b.num_end, b.category_id, b.supplier_id, b.visited, b.comment, loaded.row.id]
  );
  if (r) res.json({ success: true, data: { id: loaded.row.id, booth_code: boothCode(b) } });
});

// Marks a booth visited or not: { visited: true | false }. Takes it off (or puts it back on)
// the "to visit" list.
exports.setVisited = handle('Booth setVisited', async (req, res) => {
  const loaded = await loadBooth(req.params.id);
  if (!loaded.row) return fail(res, loaded.status, loaded.message);
  const raw = req.body?.visited;
  if (![true, false, 0, 1, '0', '1'].includes(raw)) return fail(res, 400, 'Visité : true ou false attendu');
  const visited = raw === true || raw === 1 || raw === '1' ? 1 : 0;
  await db.query('UPDATE booths SET visited = ? WHERE id = ?', [visited, loaded.row.id]);
  res.json({ success: true, data: { id: loaded.row.id, visited } });
});

exports.remove = handle('Booth remove', async (req, res) => {
  const loaded = await loadBooth(req.params.id);
  if (!loaded.row) return fail(res, loaded.status, loaded.message);
  await db.query('DELETE FROM booths WHERE id = ?', [loaded.row.id]);
  res.json({ success: true, data: { id: loaded.row.id } });
});
