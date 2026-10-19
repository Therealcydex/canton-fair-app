// D64: on the database of backend/.env, booths take an edition (the session of the fair, 140 by
// default, so the existing booths become booths of the 140th), the unique place becomes unique per
// edition, and v_booths gives the edition. Each step runs only when the database still needs it,
// so the update is safe to run twice.
// Usage (from backend/): node sql/update_booth_edition.js
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

// v_booths as create_sourcing_schema.sql defines it, so the two cannot drift apart.
const VIEW = fs.readFileSync(path.join(__dirname, 'create_sourcing_schema.sql'), 'utf8')
  .match(/CREATE OR REPLACE VIEW v_booths AS[\s\S]*?;/)[0].replace(/;$/, '');

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

  try {
    let run = 0;
    const step = async (name, sql) => { await conn.query(sql); console.log(`  ${name}`); run++; };

    if (!(await one(`SELECT 1 AS x FROM information_schema.COLUMNS
                     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'booths' AND COLUMN_NAME = 'edition'`, []))) {
      await step('add booths.edition (140 for the existing booths)',
        'ALTER TABLE booths ADD COLUMN edition SMALLINT NOT NULL DEFAULT 140 AFTER id');
    }
    if (!(await one(`SELECT 1 AS x FROM information_schema.TABLE_CONSTRAINTS
                     WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME = 'booths' AND CONSTRAINT_NAME = 'chk_booths_edition'`, []))) {
      await step('add chk_booths_edition',
        'ALTER TABLE booths ADD CONSTRAINT chk_booths_edition CHECK (edition BETWEEN 1 AND 999)');
    }
    if (!(await one(`SELECT 1 AS x FROM information_schema.STATISTICS
                     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'booths' AND INDEX_NAME = 'uq_booth_place' AND COLUMN_NAME = 'edition'`, []))) {
      await step('uq_booth_place per edition',
        `ALTER TABLE booths DROP INDEX uq_booth_place,
         ADD UNIQUE KEY uq_booth_place (edition, phase, hall, floor, letter, num_start)`);
    }
    await conn.query(VIEW);

    console.log(run
      ? `update_booth_edition: ${run} step(s) run on ${dbName}`
      : `booths already have their edition on ${dbName}: nothing to do (v_booths refreshed)`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Booth edition update failed:', err.message);
  process.exit(1);
});
