const db = require('../config/db');
const { fail, handle, clean } = require('../utils/http');
const { AREAS, splitByArea } = require('../utils/halls');

// D42/D48: the hall plan of the fair, laid out like the official plan
// (365.cantonfair.org.cn/en-US/exhibition-hall-map): for each exhibition section of
// canton_fair_category, its codes in each area (A, D, C, B) with its rank there. The 140th plan
// is loaded by sql/add_fair_plan_from_site.js; the admin can correct a section.

const PHASE_OF = 'CAST(SUBSTRING(phase, 7, 1) AS UNSIGNED)'; // "Phase 2 (Oct.23 - 27)" -> 2

// One row per section and area, in the plan's order (area A, D, C, B, then rank); a section
// without halls comes once, with area and halls null. phase=1..3 narrows it to one phase.
exports.list = handle('Fair plan list', async (req, res) => {
  const params = [];
  let where = '1=1';
  if (req.query.phase !== undefined) {
    if (!/^[1-3]$/.test(String(req.query.phase))) return fail(res, 400, 'Filtre phase invalide');
    where = 's.phase = ?';
    params.push(Number(req.query.phase));
  }
  const [rows] = await db.query(
    `SELECT s.phase, s.category, s.section, NULLIF(h.area, '') AS area, h.halls, h.position,
            h.updated_at, u.name AS updated_by_name
     FROM (SELECT DISTINCT ${PHASE_OF} AS phase, category, section FROM canton_fair_category) s
     LEFT JOIN section_halls h ON h.phase = s.phase AND h.section = s.section
     LEFT JOIN users u ON u.id = h.updated_by
     WHERE ${where}
     ORDER BY s.phase, h.halls IS NULL, FIELD(h.area, ?, ?, ?, ?, '') , h.position IS NULL, h.position,
              s.category, s.section`,
    [...params, ...AREAS]
  );
  res.json({ success: true, data: rows });
});

// The admin sets all the codes of one section (requireAdmin): { phase, section, halls }. The
// server splits them by area and keeps the section's rank in each area it was already in. Empty
// halls clear the section.
exports.setHalls = handle('Fair plan setHalls', async (req, res) => {
  const body = req.body || {};
  const phase = Number(body.phase);
  if (![1, 2, 3].includes(phase)) return fail(res, 400, 'Phase : 1, 2 ou 3');
  const section = clean(body.section);
  if (!section) return fail(res, 400, 'Section : champ obligatoire');
  const halls = clean(body.halls);
  if (halls && halls.length > 255) return fail(res, 400, 'Halls : 255 caractères au maximum');
  // eslint-disable-next-line no-control-regex
  if (halls && /[\u0000-\u001f\u007f]/.test(halls)) return fail(res, 400, 'Halls : caractères non autorisés');
  if (halls && !/\d/.test(halls)) return fail(res, 400, 'Halls : numéros de hall attendus (ex. 14.3, 15.4)');

  const [[known]] = await db.query(
    `SELECT section FROM canton_fair_category WHERE ${PHASE_OF} = ? AND section = ? LIMIT 1`, [phase, section]);
  if (!known) return fail(res, 404, `Section inconnue pour la phase ${phase}`);

  const parts = halls ? splitByArea(halls) : [];
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [old] = await conn.query('SELECT area, position FROM section_halls WHERE phase = ? AND section = ?', [phase, known.section]);
    const rank = new Map(old.map((r) => [r.area, r.position]));
    await conn.query('DELETE FROM section_halls WHERE phase = ? AND section = ?', [phase, known.section]);
    for (const p of parts) {
      await conn.query(
        'INSERT INTO section_halls (phase, section, area, halls, position, updated_by) VALUES (?, ?, ?, ?, ?, ?)',
        [phase, known.section, p.area, p.halls, rank.get(p.area) ?? null, req.user.id]
      );
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  res.json({ success: true, data: { phase, section: known.section, areas: parts } });
});
