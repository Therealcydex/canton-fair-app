// D32: runs update_booth_code.sql on the database of backend/.env, once. A table already on the
// new code (it has the uq_booth_place key) is left alone, so it is safe to run twice.
// Usage (from backend/): node sql/update_booth_code.js
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

// Same splitting as run_schema_setup.js: drops "--" comments, then cuts on ";".
const statements = fs.readFileSync(path.join(__dirname, 'update_booth_code.sql'), 'utf8')
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
    const [[{ n }]] = await conn.query(
      `SELECT COUNT(*) AS n FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'booths' AND INDEX_NAME = 'uq_booth_place'`,
      [dbName]
    );
    if (n > 0) {
      console.log(`booths already uses the new booth code on ${dbName}: nothing to do`);
      return;
    }
    for (const statement of statements) await conn.query(statement);
    const [[{ booths }]] = await conn.query('SELECT COUNT(*) AS booths FROM booths');
    console.log(`update_booth_code.sql: ${statements.length} statements run on ${dbName} (${booths} booths recoded)`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Booth code update failed:', err.message);
  process.exit(1);
});
