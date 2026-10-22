// Creates the database (if missing), runs the schema files in order, then seeds the admin
// user from SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD in backend/.env. Safe to run twice.
// Usage (from backend/): node sql/run_schema_setup.js
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

// In this order: the lists, then the tables that reference them.
const FILES = ['china_provinces.sql', 'canton_fair_categories.sql', 'canton_fair_sections_140.sql', 'create_sourcing_schema.sql'];

// Splits a file into statements: drops "--" comments, then cuts on ";".
// The files keep ";" and "--" out of their string values.
const statementsOf = (file) =>
  fs.readFileSync(path.join(__dirname, file), 'utf8')
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

  // Own connection instead of config/db.js: the pool needs the database to exist already.
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    charset: 'utf8mb4',
  });

  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await conn.query(`USE \`${dbName}\``);

    for (const file of FILES) {
      let run = 0;
      for (const statement of statementsOf(file)) {
        // canton_fair_category has no natural key: fill it only while it is empty.
        if (file === 'canton_fair_categories.sql' && /^INSERT INTO canton_fair_category/i.test(statement)) {
          const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM canton_fair_category');
          if (n > 0) continue;
        }
        await conn.query(statement);
        run++;
      }
      console.log(`${file}: ${run} statements run on ${dbName}`);
    }

    const username = process.env.SEED_ADMIN_USERNAME;
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!username || !password) {
      console.warn('SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD not set: no admin user created');
      return;
    }
    const [[existing]] = await conn.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      console.log(`Admin user "${username}" already exists`);
      return;
    }
    const hash = await bcrypt.hash(password, 10);
    await conn.query(
      `INSERT INTO users (name, username, password_hash, level, role, is_active)
       VALUES ('Administrateur', ?, ?, 5, 'ADMIN', 1)`,
      [username, hash]
    );
    console.log(`Admin user "${username}" created`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Schema setup failed:', err.message);
  process.exit(1);
});
