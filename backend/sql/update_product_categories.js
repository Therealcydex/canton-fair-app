// D72: categories_products is the only list of category names (one column).
// A product stores one of those names (VARCHAR, or NULL). A supplier keeps several,
// in suppliers.categories_suppliers, separated by commas. Names already stored in the old
// categories_suppliers list are copied here, then that list is dropped. A product that had
// several names keeps the first. Safe to run twice.
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
    if (await has(
      `SELECT 1 AS x FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      ['categories_suppliers']
    )) {
      await conn.query(`INSERT IGNORE INTO categories_products (name)
        SELECT DISTINCT name FROM categories_suppliers WHERE name IS NOT NULL AND name <> ''`);
      await conn.query('DROP TABLE categories_suppliers');
      console.log('  categories_suppliers copied into categories_products, then dropped');
      run++;
    }
    const [[column]] = await conn.query(
      `SELECT DATA_TYPE AS type FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products' AND COLUMN_NAME = 'categories_products'`,
      [dbName]
    );
    if (!column) {
      await conn.query('ALTER TABLE products ADD COLUMN categories_products VARCHAR(150) NULL');
      console.log('  add products.categories_products');
      run++;
    } else if (column.type !== 'varchar') {
      const [rows] = await conn.query(
        'SELECT id, categories_products AS value FROM products WHERE categories_products IS NOT NULL AND categories_products <> \'\''
      );
      for (const row of rows) {
        let name = null;
        const raw = String(row.value).trim();
        if (raw.startsWith('[')) {
          try {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr) && typeof arr[0] === 'string' && arr[0].trim()) name = arr[0].trim().slice(0, 150);
          } catch { name = null; }
        } else if (raw !== 'null' && raw.length <= 150) {
          name = raw;
        }
        await conn.query('UPDATE products SET categories_products = ? WHERE id = ?', [name, row.id]);
      }
      await conn.query('ALTER TABLE products MODIFY categories_products VARCHAR(150) NULL');
      console.log('  products.categories_products is one name');
      run++;
    }
    const [supplierRows] = await conn.query(
      `SELECT id, categories_suppliers AS value FROM suppliers
       WHERE categories_suppliers IS NOT NULL AND categories_suppliers LIKE '[%'`
    );
    for (const row of supplierRows) {
      let names = [];
      try {
        const arr = JSON.parse(row.value);
        if (Array.isArray(arr)) names = arr.map((n) => String(n).trim()).filter(Boolean);
      } catch { names = []; }
      await conn.query('UPDATE suppliers SET categories_suppliers = ? WHERE id = ?', [
        names.length ? names.join(',') : null, row.id,
      ]);
    }
    if (supplierRows.length) {
      console.log('  suppliers.categories_suppliers stores several names, separated by commas');
      run++;
    }
    const [kept] = await conn.query(
      `SELECT categories_products AS name FROM products
       WHERE categories_products IS NOT NULL AND categories_products <> ''`
    );
    for (const row of kept) {
      await conn.query('INSERT IGNORE INTO categories_products (name) VALUES (?)', [String(row.name).slice(0, 150)]);
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
