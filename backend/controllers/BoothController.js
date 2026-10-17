const db = require('../config/db');
const { fail, handle, toId, clean, likeContains } = require('../utils/http');
const { validate } = require('../utils/validate');
const { padBoothNumbers } = require('../utils/halls');
const { loadBooth } = require('../utils/scope');
const { isAdmin, isViewer } = require('../utils/access');

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
// D53: the booth as the apps show it, phase first: "Ph1 3.1E12-13".
const boothLabel = (phase, code) => `Ph${phase} ${code}`;

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
  if (overlap) return { status: 409, message: `Cet emplacement chevauche le booth ${boothLabel(b.phase, overlap.booth_code)}` };
  return { values: b };
}

// D62: share_company_ids, the companies the booth is shared with (the whole list). Only the admin
// shares. Returns { ids } (null when the body leaves the shares as they are) or { status, message }.
async function readShares(req) {
  const raw = req.body?.share_company_ids;
  if (raw === undefined) return { ids: null };
  if (!isAdmin(req.user)) return { status: 403, message: "Seul l'administrateur partage un booth" };
  if (!Array.isArray(raw)) return { status: 400, message: 'Partager avec : liste de sociétés attendue' };
  const ids = [...new Set(raw.map(toId))];
  if (ids.includes(null)) return { status: 400, message: 'Partager avec : société invalide' };
  if (ids.length) {
    const [found] = await db.query('SELECT id FROM companies WHERE id IN (?)', [ids]);
    if (found.length !== ids.length) return { status: 400, message: 'Partager avec : société introuvable' };
  }
  return { ids };
}

// Writes the booth and, when given, its shares in one transaction. A duplicate booth
// (uq_booth_place) that slipped between the check and the write (two users at the same moment)
// still ends in a 409. Returns the booth id, or null once the refusal is sent.
async function writeBooth(req, res, b, shares, sql, params, existingId) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.query(sql, params);
    const id = existingId || r.insertId;
    if (shares !== null) {
      await conn.query('DELETE FROM booth_shares WHERE booth_id = ?', [id]);
      if (shares.length) {
        await conn.query('INSERT INTO booth_shares (booth_id, company_id, shared_by) VALUES ?',
          [shares.map((c) => [id, c, req.user.id])]);
      }
    }
    await conn.commit();
    return id;
  } catch (e) {
    await conn.rollback();
    if (e.code === 'ER_DUP_ENTRY') {
      fail(res, 409, `Le booth ${boothLabel(b.phase, boothCode(b))} existe déjà`);
      return null;
    }
    throw e;
  } finally {
    conn.release();
  }
}

// shared_company_ids ("1,3"): the companies the booth is shared with (D62), for the admin's
// table and form. A subquery, so v_booths keeps no GROUP BY (D23).
const SHARED_IDS = '(SELECT GROUP_CONCAT(bs.company_id ORDER BY bs.company_id) FROM booth_shares bs WHERE bs.booth_id = v.id) AS shared_company_ids';
const SHARED_WITH_COMPANY = 'EXISTS (SELECT 1 FROM booth_shares bs WHERE bs.booth_id = v.id AND bs.company_id = ?)';

// Every booth of the group. Filters: supplier_id, phase, hall, floor, category_id,
// visited (0 = the "to visit" list), q (booth code or supplier name). D62: a viewer (LECTEUR)
// only gets the booths shared with its company.
exports.list = handle('Booth list', async (req, res) => {
  const params = [];
  let where = '1=1';
  if (isViewer(req.user)) {
    where += ` AND ${SHARED_WITH_COMPANY}`;
    params.push(req.user.company_id);
  }
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
  let q = clean(req.query.q);
  // D53: "Ph1 3.1E12" finds the booth 3.1E12 of phase 1 (the label the apps show).
  const ph = q && /^ph\s*([1-3])\b\s*(.*)$/i.exec(q);
  if (ph) {
    where += ' AND v.phase = ?';
    params.push(Number(ph[1]));
    q = ph[2].trim();
  }
  if (q) {
    // D50: "10.3A8" finds the booth 10.3A08 (numbers stored on 2 digits).
    where += ' AND (v.booth_code LIKE ? OR v.booth_code LIKE ? OR v.supplier_name LIKE ?)';
    params.push(likeContains(q), likeContains(padBoothNumbers(q)), likeContains(q));
  }
  // nbr_products: the products found at the booth (D43), shown in the booth table (D49).
  const [rows] = await db.query(
    `SELECT v.*, (SELECT COUNT(*) FROM products p WHERE p.booth_id = v.id) AS nbr_products, ${SHARED_IDS}
     FROM v_booths v WHERE ${where}
     ORDER BY v.phase, v.hall, v.floor, v.letter, v.num_start LIMIT 1000`,
    params
  );
  res.json({ success: true, data: rows });
});

// D62: a viewer only opens a booth shared with its company (404 otherwise, as if it did not
// exist). It cannot read the products or suppliers routes, so its booth comes with the products
// found there (no decision, which stays internal) and the supplier's contact details.
exports.getById = handle('Booth getById', async (req, res) => {
  const r = await loadBooth(req.params.id);
  if (!r.row) return fail(res, r.status, r.message);
  const viewer = isViewer(req.user);
  const [[booth]] = await db.query(
    `SELECT v.*, ${SHARED_IDS} FROM v_booths v WHERE v.id = ?${viewer ? ` AND ${SHARED_WITH_COMPANY}` : ''}`,
    viewer ? [r.row.id, req.user.company_id] : [r.row.id]);
  if (!booth) return fail(res, 404, 'Booth introuvable');
  if (viewer) {
    const [products] = await db.query(
      `SELECT p.id, p.name, p.supplier_ref, p.description, p.price, p.unit, p.moq, p.shipping_type,
              (SELECT pi.thumb_data FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.id LIMIT 1) AS cover_thumb
       FROM products p WHERE p.booth_id = ? ORDER BY p.name`, [booth.id]);
    const [[supplier]] = booth.supplier_id
      ? await db.query('SELECT id, name, phone, email, website, cantonfair_url FROM suppliers WHERE id = ?', [booth.supplier_id])
      : [[null]];
    if (supplier) {
      [supplier.contacts] = await db.query(
        'SELECT id, name, phone, email, wechat_qr, avatar FROM contacts WHERE supplier_id = ? ORDER BY name', [supplier.id]);
    }
    booth.products = products;
    booth.supplier = supplier || null;
  }
  res.json({ success: true, data: booth });
});

exports.create = handle('Booth create', async (req, res) => {
  const v = await validateBooth(req);
  if (!v.values) return fail(res, v.status, v.message);
  const b = v.values;
  const shares = await readShares(req);
  if (shares.status) return fail(res, shares.status, shares.message);
  const id = await writeBooth(req, res, b, shares.ids,
    `INSERT INTO booths (phase, hall, floor, letter, num_start, num_end, category_id, supplier_id, visited, comment)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [b.phase, b.hall, b.floor, b.letter, b.num_start, b.num_end, b.category_id, b.supplier_id, b.visited, b.comment]
  );
  if (id) res.json({ success: true, data: { id, phase: b.phase, booth_code: boothCode(b) } });
});

exports.update = handle('Booth update', async (req, res) => {
  const loaded = await loadBooth(req.params.id);
  if (!loaded.row) return fail(res, loaded.status, loaded.message);
  const v = await validateBooth(req, loaded.row);
  if (!v.values) return fail(res, v.status, v.message);
  const b = v.values;
  const shares = await readShares(req);
  if (shares.status) return fail(res, shares.status, shares.message);
  const id = await writeBooth(req, res, b, shares.ids,
    `UPDATE booths SET phase = ?, hall = ?, floor = ?, letter = ?, num_start = ?, num_end = ?,
            category_id = ?, supplier_id = ?, visited = ?, comment = ? WHERE id = ?`,
    [b.phase, b.hall, b.floor, b.letter, b.num_start, b.num_end, b.category_id, b.supplier_id, b.visited, b.comment, loaded.row.id],
    loaded.row.id
  );
  if (id) res.json({ success: true, data: { id, phase: b.phase, booth_code: boothCode(b) } });
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
