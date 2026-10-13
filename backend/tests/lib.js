// Helpers for the API scenario scripts (node tests/run.js, backend running on PORT).
// Every scenario checks the refused request AND the legitimate one (guide §8.3).
// Test data is named with the TEST prefix and deleted by cleanup(); row counts are compared.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

const BASE = `http://localhost:${process.env.PORT || 3000}/api`;
const PREFIX = 'TEST';
const TABLES = [
  'companies', 'users', 'categories', 'suppliers', 'contacts', 'booths',
  'booth_visits', 'products', 'product_images', 'product_shares',
];

let failures = 0;
let passes = 0;

async function api(method, url, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const res = await fetch(BASE + url, { method, headers, body: payload });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
  return { status: res.status, body: json };
}

// Checks the status code (and, for refusals, the response shape). Returns the response.
function expect(label, res, status) {
  const shapeOk = status < 400
    ? res.body.success === true
    : res.body.success === false && typeof res.body.message === 'string' && !/sql|ER_/i.test(res.body.message);
  if (res.status === status && shapeOk) {
    passes++;
    console.log(`  ok   ${label} -> ${status}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}: expected ${status}, got ${res.status} ${JSON.stringify(res.body).slice(0, 200)}`);
  }
  return res;
}

function check(label, condition, detail = '') {
  if (condition) { passes++; console.log(`  ok   ${label}`); }
  else { failures++; console.log(`  FAIL ${label} ${detail}`); }
}

async function login(username, password) {
  const r = await api('POST', '/login', { body: { username, password } });
  if (!r.body.token) throw new Error(`login ${username} failed: ${JSON.stringify(r.body)}`);
  return r.body.token;
}

const connect = () => mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME,
});

async function counts(conn) {
  const out = {};
  for (const t of TABLES) {
    const [[row]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${t}\``);
    out[t] = row.n;
  }
  return out;
}

// Deletes every row created by the scenarios: companies and categories named TEST…,
// users named test…, and everything that hangs from them.
async function cleanup(conn) {
  const like = `${PREFIX}%`;
  const companyIds = `SELECT id FROM companies WHERE name LIKE '${like}'`;
  const supplierIds = `SELECT id FROM suppliers WHERE company_id IN (${companyIds}) OR name LIKE '${like}'`;
  const statements = [
    `DELETE FROM products WHERE supplier_id IN (${supplierIds})`,
    `DELETE FROM booth_visits WHERE booth_id IN (SELECT id FROM booths WHERE supplier_id IN (${supplierIds}))`,
    `DELETE FROM booth_visits WHERE user_id IN (SELECT id FROM users WHERE username LIKE '${like}')`,
    `DELETE FROM booths WHERE supplier_id IN (${supplierIds})`,
    `DELETE FROM suppliers WHERE id IN (SELECT id FROM (${supplierIds}) s)`,
    `DELETE FROM users WHERE username LIKE '${like}' OR company_id IN (${companyIds})`,
    `DELETE FROM companies WHERE name LIKE '${like}'`,
  ];
  for (const s of statements) await conn.query(s);
  // Categories: children before parents.
  for (;;) {
    const [r] = await conn.query(
      `DELETE FROM categories WHERE name LIKE '${like}'
       AND id NOT IN (SELECT parent_id FROM (SELECT parent_id FROM categories WHERE parent_id IS NOT NULL) p)`
    );
    if (r.affectedRows === 0) break;
  }
}

const summary = () => ({ passes, failures });

module.exports = { api, expect, check, login, connect, counts, cleanup, summary, PREFIX, BASE };
