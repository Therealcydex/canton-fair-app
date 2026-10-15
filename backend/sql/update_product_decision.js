// D38: runs update_product_decision.sql on the database of backend/.env. Each "-- step:" of the
// file runs only when the products table still needs it (checked in information_schema), so the
// update is safe to run twice and finishes a run that stopped half-way.
// Usage (from backend/): node sql/update_product_decision.js
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

// The file's steps: { name, sql }, in order. "--" comments are dropped.
const steps = fs.readFileSync(path.join(__dirname, 'update_product_decision.sql'), 'utf8')
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
  const hasColumn = async (name) => !!(await one(
    `SELECT 1 AS x FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products' AND COLUMN_NAME = ?`, [name]));
  const hasIndex = async (name) => !!(await one(
    `SELECT 1 AS x FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products' AND INDEX_NAME = ? LIMIT 1`, [name]));
  const hasConstraint = async (name) => !!(await one(
    `SELECT 1 AS x FROM information_schema.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME = 'products' AND CONSTRAINT_NAME = ?`, [name]));

  // Whether each step is still needed.
  const needed = {
    'add-status': async () => !(await hasColumn('status')),
    'add-decision-note': async () => !(await hasColumn('decision_note')),
    'add-decided-by': async () => !(await hasColumn('decided_by')),
    'add-decided-at': async () => !(await hasColumn('decided_at')),
    'add-created-by': async () => !(await hasColumn('created_by')),
    'add-created-at': async () => !(await hasColumn('created_at')),
    'add-status-index': async () => !(await hasIndex('ix_products_status')),
    'add-status-check': async () => !(await hasConstraint('chk_product_status')),
    'add-fk-decided-by': async () => !(await hasConstraint('fk_products_decided_by')),
    'add-fk-created-by': async () => !(await hasConstraint('fk_products_created_by')),
    view: async () => true,
  };

  try {
    let run = 0;
    for (const step of steps) {
      if (!needed[step.name]) throw new Error(`unknown step "${step.name}" in update_product_decision.sql`);
      if (!(await needed[step.name]())) continue;
      await conn.query(step.sql);
      if (step.name !== 'view') {
        console.log(`  ${step.name}`);
        run++;
      }
    }
    const [[{ products }]] = await conn.query('SELECT COUNT(*) AS products FROM products');
    console.log(run
      ? `update_product_decision.sql: ${run} step(s) run on ${dbName} (${products} products)`
      : `products already has the decision columns on ${dbName}: nothing to do (view refreshed)`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Product decision update failed:', err.message);
  process.exit(1);
});
