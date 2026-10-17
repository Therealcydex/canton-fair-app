// Helpers for the API scenario scripts (node tests/run.js, backend running on PORT).
// Every scenario checks the refused request AND the legitimate one (guide §8.3).
// Test data is named with the TEST prefix and deleted by cleanup(); row counts are compared.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
const { deleteImages } = require('../utils/upload');

const BASE = `http://localhost:${process.env.PORT || 3000}/api`;
const PREFIX = 'TEST';
const TABLES = [
  'companies', 'users', 'suppliers', 'contacts', 'booths', 'products', 'product_images', 'product_shares', 'booth_shares', 'section_halls',
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
    : res.body.success === false && typeof res.body.message === 'string' && !/\bsql\b/i.test(res.body.message) && !/\bER_[A-Z_]+/.test(res.body.message);
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

// Deletes every row created by the scenarios: companies, suppliers, products named TEST…,
// booths whose comment starts with TEST, users whose username starts with TEST, and what hangs
// from them (contacts, photos and shares go with their supplier or product through the FKs).
async function cleanup(conn) {
  const like = `${PREFIX}%`;
  const supplierIds = 'SELECT id FROM suppliers WHERE name LIKE ?';
  const productWhere = `name LIKE ? OR supplier_id IN (${supplierIds})`;
  const [images] = await conn.query(
    `SELECT image_url FROM product_images WHERE product_id IN (SELECT id FROM products WHERE ${productWhere})`,
    [like, like]
  );
  const [qrs] = await conn.query(
    `SELECT wechat_qr FROM contacts WHERE wechat_qr LIKE '/uploads/%' AND supplier_id IN (${supplierIds})`, [like]
  );
  await deleteImages([...images.map((i) => i.image_url), ...qrs.map((q) => q.wechat_qr)]);
  await conn.query(`DELETE FROM products WHERE ${productWhere}`, [like, like]);
  await conn.query(`DELETE FROM booths WHERE comment LIKE ? OR supplier_id IN (${supplierIds})`, [like, like]);
  await conn.query('DELETE FROM suppliers WHERE name LIKE ?', [like]);
  await conn.query('DELETE FROM section_halls WHERE halls LIKE ?', [like]); // D42: test halls
  await conn.query('DELETE FROM users WHERE username LIKE ?', [like]);
  await conn.query('DELETE FROM companies WHERE name LIKE ?', [like]);
}

const summary = () => ({ passes, failures });

module.exports = { api, expect, check, login, connect, counts, cleanup, summary, PREFIX, BASE };
