// D69: suppliers.categories_suppliers stores the names a supplier uses (separated by commas, or NULL).
// D72: those names come from categories_products. This script does not create a second list.
// An earlier version created supplier_categories and categories_suppliers; the link table is
// dropped here, and update_product_categories.js copies categories_suppliers then drops it.
// Safe to run twice.
// Usage (from backend/): node sql/update_supplier_categories.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

// Same text as v_suppliers in create_sourcing_schema.sql.
const VIEW = `CREATE OR REPLACE VIEW v_suppliers AS
SELECT s.id, s.name, s.phone, s.email, s.website, s.address, s.province_id, s.rating, s.notes,
       s.cantonfair_url, s.categories_suppliers, p.name_en AS province,
       (SELECT COUNT(*) FROM booths b WHERE b.supplier_id = s.id) AS nbr_booths,
       (SELECT ROUND(100 * SUM(b.visited) / NULLIF(COUNT(*), 0))
          FROM booths b WHERE b.supplier_id = s.id) AS booth_visit_pct
FROM suppliers s
LEFT JOIN china_province p ON p.id = s.province_id`;

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

  const exists = async (table) => (await conn.query(
    `SELECT 1 AS x FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [dbName, table]
  ))[0][0];
  const columns = async (table) => (await conn.query(
    `SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`,
    [dbName, table]
  ))[0].map((r) => r.name);

  try {
    let run = 0;
    if (await exists('supplier_categories')) {
      await conn.query('DROP TABLE supplier_categories');
      console.log('  drop supplier_categories');
      run++;
    }
    if (!(await columns('suppliers')).includes('categories_suppliers')) {
      await conn.query('ALTER TABLE suppliers ADD COLUMN categories_suppliers TEXT NULL');
      console.log('  add suppliers.categories_suppliers');
      run++;
    }
    await conn.query(VIEW);
    console.log(run
      ? `update_supplier_categories: ${run} step(s) run on ${dbName}`
      : `supplier categories already stored on ${dbName}: nothing to do (view refreshed)`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Supplier categories update failed:', err.message);
  process.exit(1);
});
