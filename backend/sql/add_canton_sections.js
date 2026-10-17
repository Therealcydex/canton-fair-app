// D41: adds the 140th fair's missing exhibition sections (canton_fair_sections_140.sql) to the
// canton_fair_category table of the database of backend/.env. Each row is added only if its
// section is not there yet, so it is safe to run twice; existing rows are never changed.
// Usage (from backend/): node sql/add_canton_sections.js
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

// Statements of the file: "--" comments dropped, cut on ";" (the values hold neither).
const statements = fs.readFileSync(path.join(__dirname, 'canton_fair_sections_140.sql'), 'utf8')
  .split(/\r?\n/) // a Windows checkout has CRLF: "." stops at "\r", so the comment would stay
  .map((line) => line.replace(/--.*$/, ''))
  .join('\n')
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean);

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
  try {
    let added = 0;
    for (const statement of statements) {
      const [r] = await conn.query(statement);
      added += r.affectedRows || 0;
    }
    const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM canton_fair_category');
    console.log(added
      ? `canton_fair_sections_140.sql: ${added} section(s) added on ${dbName} (${n} rows)`
      : `canton_fair_category already has the 140th fair's sections on ${dbName}: nothing to do (${n} rows)`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Adding the Canton Fair sections failed:', err.message);
  process.exit(1);
});
