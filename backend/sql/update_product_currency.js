// D67: products take a currency (USD, TND or CNY; USD for the existing products) and v_products
// gives it. Safe to run twice.
// Usage (from backend/): node sql/update_product_currency.js
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

const VIEW = fs.readFileSync(path.join(__dirname, 'create_sourcing_schema.sql'), 'utf8')
  .match(/CREATE OR REPLACE VIEW v_products AS[\s\S]*?;/)[0].replace(/;$/, '');

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

  try {
    let run = 0;
    const step = async (name, sql) => { await conn.query(sql); console.log(`  ${name}`); run++; };

    if (!(await one(`SELECT 1 AS x FROM information_schema.COLUMNS
                     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products' AND COLUMN_NAME = 'currency'`, []))) {
      await step('add products.currency (USD for the existing products)',
        `ALTER TABLE products ADD COLUMN currency CHAR(3) NOT NULL DEFAULT 'USD' AFTER price`);
    }
    if (!(await one(`SELECT 1 AS x FROM information_schema.TABLE_CONSTRAINTS
                     WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME = 'products' AND CONSTRAINT_NAME = 'chk_product_currency'`, []))) {
      await step('add chk_product_currency',
        `ALTER TABLE products ADD CONSTRAINT chk_product_currency CHECK (currency IN ('USD', 'TND', 'CNY'))`);
    }
    await conn.query(VIEW);

    console.log(run
      ? `update_product_currency: ${run} step(s) run on ${dbName}`
      : `products already have their currency on ${dbName}: nothing to do (v_products refreshed)`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Product currency update failed:', err.message);
  process.exit(1);
});
