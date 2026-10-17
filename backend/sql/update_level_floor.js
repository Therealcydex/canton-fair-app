// D56: on the database of backend/.env, booths take floor 0 (CHECK 0-4 instead of 1-4) and
// users.level becomes a number from 1 to 5: the former job titles are converted (Acheteur = 2,
// Chef des achats = 4, Administrateur = 5), then the column becomes TINYINT with a CHECK. Each step
// runs only when the database still needs it, so the update is safe to run twice. It stops, without
// changing the column, if a level is left that is neither empty nor 1-5.
// Usage (from backend/): node sql/update_level_floor.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

const OLD_LEVELS = { Acheteur: 2, 'Chef des achats': 4, Administrateur: 5 };

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

  // The CHECK constraints of a table: [{ name, clause }]. MySQL 8 keeps the table name only in
  // TABLE_CONSTRAINTS, MariaDB in both.
  const checks = async (table) => (await conn.query(
    `SELECT t.CONSTRAINT_NAME AS name, c.CHECK_CLAUSE AS clause
     FROM information_schema.TABLE_CONSTRAINTS t
     JOIN information_schema.CHECK_CONSTRAINTS c
       ON c.CONSTRAINT_SCHEMA = t.CONSTRAINT_SCHEMA AND c.CONSTRAINT_NAME = t.CONSTRAINT_NAME
     WHERE t.CONSTRAINT_SCHEMA = ? AND t.TABLE_NAME = ? AND t.CONSTRAINT_TYPE = 'CHECK'`,
    [dbName, table]))[0];

  try {
    let run = 0;
    const step = async (name, sql, params) => { await conn.query(sql, params); console.log(`  ${name}`); run++; };

    // Booths: the floor CHECK 1-4 -> chk_booths_floor 0-4. MySQL makes the column's CHECK a table
    // constraint (booths_chk_N) that can be dropped; MariaDB keeps it in the column (named `floor`),
    // so the column is defined again without it.
    const boothChecks = await checks('booths');
    for (const c of boothChecks) {
      if (c.name === 'chk_booths_floor' || !/floor/i.test(c.clause)) continue;
      try {
        await step(`drop booths check ${c.name}`, `ALTER TABLE booths DROP CONSTRAINT \`${c.name}\``);
      } catch (err) {
        if (err.code !== 'ER_CANT_DROP_FIELD_OR_KEY') throw err; // MariaDB: a column's own CHECK
        await step(`booths.floor without its column check ${c.name}`, 'ALTER TABLE booths MODIFY floor TINYINT NOT NULL');
      }
    }
    if (!boothChecks.some((c) => c.name === 'chk_booths_floor')) {
      await step('add chk_booths_floor', 'ALTER TABLE booths ADD CONSTRAINT chk_booths_floor CHECK (floor BETWEEN 0 AND 4)');
    }

    // Users: the job titles -> 1-5, then TINYINT.
    const [[col]] = await conn.query(
      `SELECT DATA_TYPE AS type FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'level'`, [dbName]);
    if (!col) throw new Error('users.level is missing: run npm run db:setup first');
    if (col.type !== 'tinyint') {
      await step('empty levels -> NULL', "UPDATE users SET level = NULL WHERE TRIM(level) = ''");
      for (const [title, n] of Object.entries(OLD_LEVELS)) {
        await step(`level "${title}" -> ${n}`, 'UPDATE users SET level = ? WHERE TRIM(level) = ?', [String(n), title]);
      }
      const [left] = await conn.query(
        "SELECT DISTINCT level FROM users WHERE level IS NOT NULL AND level NOT IN ('1', '2', '3', '4', '5')");
      if (left.length) {
        throw new Error(`levels to convert by hand first: ${left.map((r) => JSON.stringify(r.level)).join(', ')}`);
      }
      await step('users.level -> TINYINT', 'ALTER TABLE users MODIFY level TINYINT NULL');
    }
    if (!(await checks('users')).some((c) => c.name === 'chk_users_level')) {
      await step('add chk_users_level', 'ALTER TABLE users ADD CONSTRAINT chk_users_level CHECK (level BETWEEN 1 AND 5)');
    }

    console.log(run
      ? `update_level_floor: ${run} step(s) run on ${dbName}`
      : `booths and users already follow D56 on ${dbName}: nothing to do`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Level and floor update failed:', err.message);
  process.exit(1);
});
