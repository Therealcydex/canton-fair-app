// D70: product categories. categories_products is the list, one column (the name).
// products.categories_products stores the names a product uses (a JSON array, or NULL).
// Existing products are left with none. Safe to run twice.
// Usage (from backend/): node sql/update_product_categories.js
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
  const has = async (sql, params) => (await conn.query(sql, [dbName, ...params]))[0][0];

  try {
    let run = 0;
    if (!(await has(
      `SELECT 1 AS x FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      ['categories_products']
    ))) {
      await conn.query(`CREATE TABLE categories_products (
        name VARCHAR(150) NOT NULL PRIMARY KEY
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      console.log('  add categories_products (name only)');
      run++;
    }
    if (!(await has(
      `SELECT 1 AS x FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products' AND COLUMN_NAME = ?`,
      ['categories_products']
    ))) {
      await conn.query('ALTER TABLE products ADD COLUMN categories_products TEXT NULL');
      console.log('  add products.categories_products');
      run++;
    }
    await conn.query(VIEW);
    console.log(run
      ? `update_product_categories: ${run} step(s) run on ${dbName}`
      : `product categories already stored on ${dbName}: nothing to do (view refreshed)`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Product categories update failed:', err.message);
  process.exit(1);
});
