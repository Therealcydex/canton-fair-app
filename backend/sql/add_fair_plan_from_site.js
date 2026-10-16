// D48: loads the hall plan of the 140th fair (fair_plan_140.js, read on the official plan) into
// section_halls on the database of backend/.env: one row per section and area, with its rank in
// the area. A section an admin corrected (a row with updated_by) is kept as it is; the others are
// rewritten, so it is safe to run twice. Run update_fair_plan.js (D42/D48) first.
// Usage (from backend/): node sql/add_fair_plan_from_site.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
const { areaOf, splitCodes } = require('../utils/halls');
const plan = require('./fair_plan_140');

async function main() {
  const dbName = process.env.DB_NAME;
  if (!dbName || !/^\w+$/.test(dbName)) {
    throw new Error('DB_NAME is missing or invalid in backend/.env');
  }

  // The rows of each section, with their rank in their area; every code must belong to its area.
  const sections = new Map(); // "phase|section" -> [{ area, halls, position }]
  const ranks = new Map(); // "phase|area" -> last rank
  for (const [phase, area, section, halls] of plan) {
    const wrong = splitCodes(halls).find((code) => areaOf(code) !== area);
    if (wrong) throw new Error(`${section}: "${wrong}" is not in area ${area}`);
    const rankKey = `${phase}|${area}`;
    const position = (ranks.get(rankKey) || 0) + 1;
    ranks.set(rankKey, position);
    const key = `${phase}|${section}`;
    sections.set(key, [...(sections.get(key) || []), { area, halls, position }]);
  }

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: dbName,
    charset: 'utf8mb4',
  });
  try {
    const [known] = await conn.query(
      'SELECT DISTINCT CAST(SUBSTRING(phase, 7, 1) AS UNSIGNED) AS phase, section FROM canton_fair_category');
    const knownKeys = new Set(known.map((r) => `${r.phase}|${r.section}`));
    const unknown = [...sections.keys()].filter((k) => !knownKeys.has(k));
    if (unknown.length) throw new Error(`sections not in canton_fair_category: ${unknown.join(', ')}`);

    const count = { added: 0, updated: 0, same: 0, kept: 0 };
    await conn.beginTransaction();
    for (const [key, rows] of sections) {
      const [phase, section] = [Number(key.split('|')[0]), key.slice(key.indexOf('|') + 1)];
      const [old] = await conn.query(
        'SELECT area, halls, position, updated_by FROM section_halls WHERE phase = ? AND section = ? ORDER BY area',
        [phase, section]
      );
      if (old.some((r) => r.updated_by)) {
        count.kept++;
        continue;
      }
      const same = old.length === rows.length && rows.every((r) => old.some((o) =>
        o.area === r.area && o.halls === r.halls && o.position === r.position));
      if (same) {
        count.same++;
        continue;
      }
      await conn.query('DELETE FROM section_halls WHERE phase = ? AND section = ?', [phase, section]);
      for (const r of rows) {
        await conn.query(
          'INSERT INTO section_halls (phase, section, area, halls, position, updated_by) VALUES (?, ?, ?, ?, ?, NULL)',
          [phase, section, r.area, r.halls, r.position]
        );
      }
      if (old.length) count.updated++;
      else count.added++;
    }
    await conn.commit();
    console.log(`fair_plan_140 on ${dbName}: ${count.added} section(s) added, ${count.updated} updated, `
      + `${count.same} unchanged, ${count.kept} corrected by an admin and kept`);
  } catch (e) {
    await conn.rollback().catch(() => {});
    throw e;
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Loading the fair plan failed:', err.message);
  process.exit(1);
});
