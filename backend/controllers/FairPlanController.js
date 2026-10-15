const db = require('../config/db');
const { fail, handle, clean } = require('../utils/http');

// D42: the hall plan of the fair: for each exhibition section of canton_fair_category, the halls
// of the current session ("14.3, 14.4, 15.4"). The plan changes from one session to the next and
// the fair's site only shows an older one, so the admin types it from the official printed plan.

const PHASE_OF = 'CAST(SUBSTRING(phase, 7, 1) AS UNSIGNED)'; // "Phase 2 (Oct.23 - 27)" -> 2

// Every section, with its halls when known. phase=1..3 narrows it to one phase.
exports.list = handle('Fair plan list', async (req, res) => {
  const params = [];
  let where = '1=1';
  if (req.query.phase !== undefined) {
    if (!/^[1-3]$/.test(String(req.query.phase))) return fail(res, 400, 'Filtre phase invalide');
    where = 's.phase = ?';
    params.push(Number(req.query.phase));
  }
  const [rows] = await db.query(
    `SELECT s.phase, s.category, s.section, h.halls, h.updated_at, u.name AS updated_by_name
     FROM (SELECT DISTINCT ${PHASE_OF} AS phase, category, section FROM canton_fair_category) s
     LEFT JOIN section_halls h ON h.phase = s.phase AND h.section = s.section
     LEFT JOIN users u ON u.id = h.updated_by
     WHERE ${where}
     ORDER BY s.phase, s.category, s.section`,
    params
  );
  res.json({ success: true, data: rows });
});

// The admin sets the halls of one section (requireAdmin): { phase, section, halls }. Empty halls
// clear them.
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

  if (halls) {
    await db.query(
      `INSERT INTO section_halls (phase, section, halls, updated_by) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE halls = VALUES(halls), updated_by = VALUES(updated_by)`,
      [phase, known.section, halls, req.user.id]
    );
  } else {
    await db.query('DELETE FROM section_halls WHERE phase = ? AND section = ?', [phase, known.section]);
  }
  res.json({ success: true, data: { phase, section: known.section, halls: halls || null } });
});
