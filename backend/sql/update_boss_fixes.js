// D61-D63: runs update_boss_fixes.sql on the database of backend/.env. Each "-- step:" of the
// file runs only when the database still needs it (checked in information_schema), so the
// update is safe to run twice and finishes a run that stopped half-way.
// Usage (from backend/): node sql/update_boss_fixes.js
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
const { imageExtension, deleteImages } = require('../utils/upload');

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');
const MIME = { jpg: 'jpeg', png: 'png', webp: 'webp' };

// D61: each product photo file becomes a data URL in its row (the photo is also its thumbnail:
// the files saved so far are small enough). A missing or unreadable file drops its row.
// Returns the files to delete once the photos are in the database.
async function convertImages(conn) {
  const [rows] = await conn.query('SELECT id, image_url FROM product_images WHERE image_data IS NULL');
  const files = [];
  let dropped = 0;
  for (const r of rows) {
    const file = path.join(UPLOAD_ROOT, String(r.image_url).replace(/^\/uploads\//, ''));
    const buffer = file.startsWith(UPLOAD_ROOT) && fs.existsSync(file) ? fs.readFileSync(file) : null;
    const ext = buffer && imageExtension(buffer);
    if (!ext) {
      await conn.query('DELETE FROM product_images WHERE id = ?', [r.id]);
      console.log(`    photo ${r.id} (${r.image_url}): file missing or not an image, row dropped`);
      dropped++;
      continue;
    }
    const data = `data:image/${MIME[ext]};base64,${buffer.toString('base64')}`;
    await conn.query('UPDATE product_images SET image_data = ?, thumb_data = ? WHERE id = ?', [data, data, r.id]);
    files.push(r.image_url);
  }
  console.log(`    ${files.length} photo(s) converted, ${dropped} dropped`);
  return files;
}

// The file's steps: { name, sql }, in order. "--" comments are dropped.
const steps = fs.readFileSync(path.join(__dirname, 'update_boss_fixes.sql'), 'utf8')
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

  // Whether each step is still needed.
  const needed = {
    // D66 replaced booth_shares with supplier_shares.
    'add-booth-shares': async () => !(await hasTable('booth_shares')) && !(await hasTable('supplier_shares')),
    'add-image-data': async () => !(await hasColumn('product_images', 'image_data')),
    'convert-images': async () => hasColumn('product_images', 'image_url'),
    'drop-image-url': async () => hasColumn('product_images', 'image_url'),
    'add-contact-avatar': async () => !(await hasColumn('contacts', 'avatar')),
    view: async () => true,
  };

  let oldFiles = [];
  try {
    let run = 0;
    for (const step of steps) {
      if (!needed[step.name]) throw new Error(`unknown step "${step.name}" in update_boss_fixes.sql`);
      if (!(await needed[step.name]())) continue;
      if (step.name === 'convert-images') oldFiles = await convertImages(conn);
      else await conn.query(step.sql);
      if (step.name !== 'view') {
        console.log(`  ${step.name}`);
        run++;
      }
    }
    console.log(run
      ? `update_boss_fixes.sql: ${run} step(s) run on ${dbName}`
      : `${dbName} is already up to date: nothing to do (views refreshed)`);
  } finally {
    await conn.end();
  }
  // Only once image_url is gone (the photos are in the database for good).
  if (oldFiles.length) {
    await deleteImages(oldFiles);
    console.log(`  ${oldFiles.length} old photo file(s) deleted from uploads/`);
  }
}

main().catch((err) => {
  console.error('Boss fixes update failed:', err.message);
  process.exit(1);
});
