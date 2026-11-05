// D77: supplier catalogues move from Base64 in the database to files under uploads/catalogs/.
// Existing Base64 rows are written to disk, then file_data becomes file_url. Safe to run twice.
// Usage (from backend/): node sql/update_supplier_catalog_files.js
const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');
const CATALOG_DIR = path.join(UPLOAD_ROOT, 'catalogs');
const PREFIX = /^data:application\/pdf;base64,([A-Za-z0-9+/]+={0,2})$/;

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
  const cols = async () => (await conn.query(
    `SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'supplier_catalogs'`,
    [dbName]
  ))[0].map((r) => r.name);
  const hasTable = (await conn.query(
    `SELECT 1 AS x FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'supplier_catalogs'`,
    [dbName]
  ))[0][0];

  try {
    if (!hasTable) {
      console.log('supplier_catalogs missing: run db:update-supplier-files first');
      return;
    }
    let names = await cols();
    let run = 0;
    if (names.includes('file_url') && !names.includes('file_data')) {
      console.log(`supplier catalogues already on disk on ${dbName}: nothing to do`);
      return;
    }
    if (!names.includes('file_url')) {
      await conn.query('ALTER TABLE supplier_catalogs ADD COLUMN file_url VARCHAR(255) NULL AFTER file_name');
      console.log('  add supplier_catalogs.file_url');
      run++;
      names = await cols();
    }
    if (names.includes('file_data')) {
      await fs.mkdir(CATALOG_DIR, { recursive: true });
      const [rows] = await conn.query('SELECT id, file_data FROM supplier_catalogs WHERE file_url IS NULL');
      let written = 0;
      for (const row of rows) {
        const m = typeof row.file_data === 'string' ? PREFIX.exec(row.file_data) : null;
        if (!m) {
          await conn.query('DELETE FROM supplier_catalogs WHERE id = ?', [row.id]);
          continue;
        }
        const name = `${crypto.randomBytes(16).toString('hex')}.pdf`;
        await fs.writeFile(path.join(CATALOG_DIR, name), Buffer.from(m[1], 'base64'));
        await conn.query('UPDATE supplier_catalogs SET file_url = ? WHERE id = ?',
          [`/uploads/catalogs/${name}`, row.id]);
        written++;
      }
      if (written) console.log(`  ${written} catalogue(s) written to uploads/catalogs/`);
      await conn.query('ALTER TABLE supplier_catalogs DROP COLUMN file_data');
      console.log('  drop supplier_catalogs.file_data');
      run++;
    }
    await conn.query('ALTER TABLE supplier_catalogs MODIFY file_url VARCHAR(255) NOT NULL');
    console.log(run
      ? `update_supplier_catalog_files: ${run} step(s) run on ${dbName}`
      : `supplier catalogues already on disk on ${dbName}: nothing to do`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Supplier catalogue files update failed:', err.message);
  process.exit(1);
});
