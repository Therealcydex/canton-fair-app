// D66: runs update_supplier_shares.sql on the database of backend/.env. Each "-- step:" of the
// file runs only when the database still needs it (checked in information_schema), so the
// update is safe to run twice and finishes a run that stopped half-way.
// Usage (from backend/): node sql/update_supplier_shares.js
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

// The file's steps: { name, sql }, in order. "--" comments are dropped.
const steps = fs.readFileSync(path.join(__dirname, 'update_supplier_shares.sql'), 'utf8')
  .split(/^-- step: /m)
  .slice(1)
  .map((block) => {
    const [name, ...rest] = block.split(/\r?\n/);
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
  const hasTable = async (table) => !!(await one(
    'SELECT 1 AS x FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?', [table]));
  const hasColumn = async (table, name) => !!(await one(
    'SELECT 1 AS x FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?', [table, name]));

  // Whether each step is still needed. The copies run while their source is there: INSERT
  // IGNORE only adds what is missing.
  const needed = {
    'add-user-companies': async () => !(await hasTable('user_companies')),
    'copy-user-company': async () => hasColumn('users', 'company_id'),
    'add-supplier-shares': async () => !(await hasTable('supplier_shares')),
    'copy-booth-shares': async () => hasTable('booth_shares'),
  };

  try {
    let run = 0;
    for (const step of steps) {
      if (!needed[step.name]) throw new Error(`unknown step "${step.name}" in update_supplier_shares.sql`);
      if (!(await needed[step.name]())) continue;
      if (step.name === 'copy-booth-shares') {
        const [[{ n }]] = await conn.query(
          'SELECT COUNT(*) AS n FROM booth_shares bs JOIN booths b ON b.id = bs.booth_id WHERE b.supplier_id IS NULL');
        if (n) console.log(`    ${n} share(s) of booths without a supplier not copied`);
      }
      const [r] = await conn.query(step.sql);
      console.log(`  ${step.name}${step.name.startsWith('copy-') ? `: ${r.affectedRows} row(s) added` : ''}`);
      run++;
    }
    console.log(run
      ? `update_supplier_shares.sql: ${run} step(s) run on ${dbName}`
      : `${dbName} is already up to date: nothing to do`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Supplier shares update failed:', err.message);
  process.exit(1);
});
