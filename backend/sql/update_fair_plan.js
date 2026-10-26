// D42: runs update_fair_plan.sql on the database of backend/.env. Each "-- step:" of the
// file runs only when the database still needs it (checked in information_schema), so the
// update is safe to run twice and finishes a run that stopped half-way.
// Usage (from backend/): node sql/update_fair_plan.js
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

// The file's steps: { name, sql }, in order. "--" comments are dropped.
const steps = fs.readFileSync(path.join(__dirname, 'update_fair_plan.sql'), 'utf8')
  .split(/^-- step: /m)
  .slice(1)
  .map((block) => {
    const [name, ...rest] = block.split('\n');
    const sql = rest.map((line) => line.replace(/--.*$/, '')).join('\n').trim().replace(/;\s*$/, '');
    return { name: name.trim(), sql };
  });

async function main() {
  const dbName = process.env.DB_NAME;
  if (!dbName || !/^\w+$/.test(dbName)) {
    throw new Error('DB_NAME is missing or invalid in backend/.env');
  }
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: dbName,
    charset: 'utf8mb4',
  });

  const one = async (sql, params) => (await conn.query(sql, [dbName, ...params]))[0][0];
  const hasColumn = async (table, name) => !!(await one(
    `SELECT 1 AS x FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`, [table, name]));
  const hasTable = async (name) => !!(await one(
    `SELECT 1 AS x FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`, [name]));

  // Whether each step is still needed.
  const needed = {
    'add-supplier-link': async () => !(await hasColumn('suppliers', 'cantonfair_url')),
    'add-section-halls': async () => !(await hasTable('section_halls')),
    'add-hall-area': async () => !(await hasColumn('section_halls', 'area')),
    'hall-area-key': async () => !(await one(
      `SELECT 1 AS x FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'section_halls' AND CONSTRAINT_NAME = 'PRIMARY' AND COLUMN_NAME = 'area'`, [])),
    view: async () => true,
  };

  try {
    let run = 0;
    for (const step of steps) {
      if (!needed[step.name]) throw new Error(`unknown step "${step.name}" in update_fair_plan.sql`);
      if (!(await needed[step.name]())) continue;
      await conn.query(step.sql);
      if (step.name === 'view' && await hasColumn('suppliers', 'categories_suppliers')) {
        // D69: the step above is the view from before the supplier category column. Put it back.
        await conn.query(`CREATE OR REPLACE VIEW v_suppliers AS
          SELECT s.id, s.name, s.phone, s.email, s.website, s.address, s.province_id, s.rating, s.notes,
                 s.cantonfair_url, s.categories_suppliers, p.name_en AS province,
                 (SELECT COUNT(*) FROM booths b WHERE b.supplier_id = s.id) AS nbr_booths,
                 (SELECT ROUND(100 * SUM(b.visited) / NULLIF(COUNT(*), 0))
                    FROM booths b WHERE b.supplier_id = s.id) AS booth_visit_pct
          FROM suppliers s
          LEFT JOIN china_province p ON p.id = s.province_id`);
      }
      if (step.name !== 'view') {
        console.log(`  ${step.name}`);
        run++;
      }
    }
    console.log(run
      ? `update_fair_plan.sql: ${run} step(s) run on ${dbName}`
      : `${dbName} already has the supplier link and the hall plan: nothing to do (view refreshed)`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Fair plan update failed:', err.message);
  process.exit(1);
});
