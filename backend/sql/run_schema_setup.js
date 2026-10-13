// Creates sourcing_db (if missing), runs create_sourcing_schema.sql, then seeds the
// super-admin user from SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD in backend/.env.
// Usage (from backend/): node sql/run_schema_setup.js
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

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
  });

  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await conn.query(`USE \`${dbName}\``);

    const sql = fs.readFileSync(path.join(__dirname, 'create_sourcing_schema.sql'), 'utf8');
    const statements = sql
      .split('\n')
      .map((line) => line.replace(/--.*$/, ''))
      .join('\n')
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await conn.query(statement);
    }
    console.log(`Schema OK: ${statements.length} statements run on ${dbName}`);

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
      `INSERT INTO users (company_id, name, username, password_hash, level, role, active)
       VALUES (1, 'Administrateur', ?, ?, 9, 'SUPER_ADMIN', 1)`,
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
