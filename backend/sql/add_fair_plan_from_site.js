// D45: loads the hall plan read on the fair's site (fair_plan_from_site.sql) into section_halls on
// the database of backend/.env. A section whose halls are already set is skipped (INSERT IGNORE),
// so it is safe to run twice and never overwrites what the admin typed.
// Usage (from backend/): node sql/add_fair_plan_from_site.js
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

// Statements of the file: "--" comments dropped, cut on ";" (the values hold neither).
const statements = fs.readFileSync(path.join(__dirname, 'fair_plan_from_site.sql'), 'utf8')
  .split('\n')
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
    const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM section_halls');
    console.log(added
      ? `fair_plan_from_site.sql: halls of ${added} section(s) added on ${dbName}, ${statements.length - 1 - added} already set (${n} sections with halls)`
      : `every section of fair_plan_from_site.sql already has its halls on ${dbName}: nothing to do (${n} sections with halls)`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Loading the fair plan failed:', err.message);
  process.exit(1);
});
