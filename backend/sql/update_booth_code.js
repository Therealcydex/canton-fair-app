// D32: runs update_booth_code.sql on the database of backend/.env. Each "-- step:" of the file runs
// only when the booths table still needs it (checked in information_schema), so the update is
// safe to run twice and finishes a run that stopped half-way: ALTER TABLE cannot be rolled back.
// Usage (from backend/): node sql/update_booth_code.js
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

// The file's steps: { name, sql }, in order. "--" comments are dropped.
const steps = fs.readFileSync(path.join(__dirname, 'update_booth_code.sql'), 'utf8')
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
  const hasIndex = async (name) => !!(await one(
    `SELECT 1 AS x FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'booths' AND INDEX_NAME = ? LIMIT 1`, [name]));
  const column = (name) => one(
    `SELECT IS_NULLABLE AS nullable, GENERATION_EXPRESSION AS expr FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'booths' AND COLUMN_NAME = ?`, [name]);
  const hasCheck = async (name) => !!(await one(
    `SELECT 1 AS x FROM information_schema.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME = 'booths' AND CONSTRAINT_NAME = ?`, [name]));
  // The old code holds the phase: "2/12.1.A.22-24".
  const oldCode = async () => {
    const c = await column('booth_code');
    return !!c && String(c.expr || '').includes("'/'");
  };

  // D50: a code built before the numbers were padded ("10.3A8"): no "CONCAT('0'" in its expression.
  const unpadded = async () => {
    const c = await column('booth_code');
    return !!c && !String(c.expr || '').toLowerCase().replace(/\s+/g, '').includes("concat('0'");
  };

  // Whether each step is still needed.
  const needed = {
    'drop-old-unique': () => hasIndex('uq_booth_code'),
    'drop-old-code': oldCode,
    'letter-optional': async () => (await column('letter'))?.nullable === 'NO',
    'number-optional': async () => (await column('num_start'))?.nullable === 'NO',
    'pad-drop-index': async () => (await hasIndex('ix_booths_code')) && (await unpadded()),
    'pad-drop-code': unpadded,
    'add-code': async () => !(await column('booth_code')),
    'add-place-unique': async () => !(await hasIndex('uq_booth_place')),
    'add-code-index': async () => !(await hasIndex('ix_booths_code')),
    'add-place-check': async () => !(await hasCheck('chk_booth_place')),
    view: async () => true,
  };

  try {
    let run = 0;
    for (const step of steps) {
      if (!needed[step.name]) throw new Error(`unknown step "${step.name}" in update_booth_code.sql`);
      if (!(await needed[step.name]())) continue;
      await conn.query(step.sql);
      if (step.name !== 'view') {
        console.log(`  ${step.name}`);
        run++;
      }
    }
    const [[{ booths }]] = await conn.query('SELECT COUNT(*) AS booths FROM booths');
    console.log(run
      ? `update_booth_code.sql: ${run} step(s) run on ${dbName} (${booths} booths)`
      : `booths already uses the new booth code on ${dbName}: nothing to do (view refreshed)`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Booth code update failed:', err.message);
  process.exit(1);
});
