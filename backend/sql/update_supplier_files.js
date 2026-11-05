// D75: a supplier's catalogues (PDF) and photos. Two tables, both tied to suppliers.
// Existing suppliers are left with none. Safe to run twice.
// Usage (from backend/): node sql/update_supplier_files.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

const CATALOGS = `CREATE TABLE supplier_catalogs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  supplier_id INT NOT NULL,
  file_name VARCHAR(200) NOT NULL,
  file_url VARCHAR(255) NOT NULL,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

const IMAGES = `CREATE TABLE supplier_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  supplier_id INT NOT NULL,
  image_data MEDIUMTEXT NOT NULL,
  thumb_data MEDIUMTEXT NOT NULL,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

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

  try {
    let run = 0;
    if (!(await exists('supplier_catalogs'))) {
      await conn.query(CATALOGS);
      console.log('  add supplier_catalogs');
      run++;
    }
    if (!(await exists('supplier_images'))) {
      await conn.query(IMAGES);
      console.log('  add supplier_images');
      run++;
    }
    console.log(run
      ? `update_supplier_files: ${run} step(s) run on ${dbName}`
      : `supplier catalogues and photos already stored on ${dbName}: nothing to do`);
    console.log('  (Base64 catalogues -> disk: npm run db:update-supplier-catalog-files)');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Supplier files update failed:', err.message);
  process.exit(1);
});
