// One-off migration to schema v2: drops the 10 tables of schema v1 (sourcing_db_diagram.pdf)
// and their data, so that run_schema_setup.js can create the v2 tables. Nothing else is touched.
// Usage (from backend/): npm run db:drop-v1 -- --yes
// Safety: it only drops lowercase tables that still have the v1 shape, and refuses when the
// server compares table names without case (DROP TABLE users could then hit an ERP table USERS).
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

// Children first, so that no foreign key blocks a drop.
const V1_TABLES = ['product_shares', 'product_images', 'booth_visits', 'products', 'booths',
  'contacts', 'categories', 'suppliers', 'users', 'companies'];
// A v1 table is recognised by a column v2 does not have.
const V1_MARKER = { booth_visits: null, categories: 'depth', users: 'active', suppliers: 'company_id',
  booths: 'to_visit', products: 'price_tnd', companies: null, contacts: null,
  product_images: null, product_shares: null };

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
  });
  try {
    const [[{ db, lctn }]] = await conn.query('SELECT DATABASE() AS db, @@lower_case_table_names AS lctn');
    const [tables] = await conn.query(
      'SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE()'
    );
    const names = tables.map((r) => r.t);
    const exact = new Set(names);

    // Same name with another case (USERS next to users): only safe when names are case-sensitive.
    const clashes = V1_TABLES.filter((t) => names.some((n) => n !== t && n.toLowerCase() === t));
    if (clashes.length && Number(lctn) !== 0) {
      throw new Error(`lower_case_table_names=${lctn} and ${clashes.join(', ')} exist in another case: refused`);
    }

    const present = V1_TABLES.filter((t) => exact.has(t));
    if (!present.length) {
      console.log(`${db}: no v1 table left, nothing to do`);
      return;
    }
    // Refuse if the tables are already v2 (the marker column is gone).
    for (const t of present) {
      if (!V1_MARKER[t]) continue;
      const [cols] = await conn.query(
        'SELECT column_name AS c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?', [t]
      );
      if (!cols.some((r) => r.c === V1_MARKER[t])) {
        throw new Error(`${t} has no "${V1_MARKER[t]}" column: it is not a v1 table, nothing dropped`);
      }
    }

    console.log(`Database ${db} (lower_case_table_names=${lctn}), v1 tables: ${present.join(', ')}`);
    if (!process.argv.includes('--yes')) {
      console.log('Nothing dropped. Run again with --yes to drop them (their data is lost).');
      return;
    }
    for (const t of present) {
      await conn.query(`DROP TABLE \`${t}\``);
      console.log(`  dropped ${t}`);
    }
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Drop v1 failed:', err.message);
  process.exit(1);
});
