const db = require('../config/db');
const { fail, handle, toId, clean, likeContains } = require('../utils/http');

// Every contact of every supplier, in one table (BF17). Read only: contacts are created,
// changed and deleted through /api/suppliers/:id/contacts, where their rules live.

const QR_PHOTO = "c.wechat_qr LIKE '/uploads/wechat/%'"; // D33: a photo, not an older text

// Builds the WHERE clause of the list and of the export from the same query string, so both
// always return the same contacts. Returns { where, params } or { message } for a 400.
function filters(query) {
  const params = [];
  let where = '1=1';
  const q = clean(query.q);
  if (q) {
    where += ' AND (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR s.name LIKE ?)';
    params.push(likeContains(q), likeContains(q), likeContains(q), likeContains(q));
  }
  if (query.supplier_id !== undefined && query.supplier_id !== '') {
    const supplierId = toId(query.supplier_id);
    if (!supplierId) return { message: 'Filtre supplier_id invalide' };
    where += ' AND c.supplier_id = ?';
    params.push(supplierId);
  }
  if (query.has_qr !== undefined && query.has_qr !== '') {
    if (query.has_qr === '1') where += ` AND ${QR_PHOTO}`;
    else if (query.has_qr === '0') where += ` AND (c.wechat_qr IS NULL OR NOT ${QR_PHOTO})`;
    else return { message: 'Filtre has_qr invalide (0 ou 1)' };
  }
  return { where, params };
}

const loadContacts = (f) =>
  db.query(
    `SELECT c.id, c.supplier_id, s.name AS supplier_name, c.name, c.phone, c.email, c.wechat_qr
     FROM contacts c JOIN suppliers s ON s.id = c.supplier_id
     WHERE ${f.where}
     ORDER BY s.name, c.name IS NULL, c.name, c.id LIMIT 2000`,
    f.params
  );

exports.list = handle('Contact list all', async (req, res) => {
  const f = filters(req.query);
  if (!f.where) return fail(res, 400, f.message);
  const [rows] = await loadContacts(f);
  res.json({ success: true, data: rows });
});

// A phone number ("+86 138 0000 1111", "-5") is digits, spaces and + - ( ) . only: it cannot run.
const PLAIN_NUMBER = /^[+-][\d\s().+-]*$/;

// One CSV cell: always quoted, quotes doubled, and a leading = + - @ neutralised so a
// spreadsheet never runs it as a formula (phone numbers are left as they are).
const cell = (value) => {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=@\t\r]/.test(s) || (/^[+-]/.test(s) && !PLAIN_NUMBER.test(s))) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

// The same contacts as the list, as a CSV file Excel opens in French: ";" separator,
// UTF-8 with a BOM, CRLF line ends. The QR column holds the full address of the photo.
exports.exportCsv = handle('Contact export', async (req, res) => {
  const f = filters(req.query);
  if (!f.where) return fail(res, 400, f.message);
  const [rows] = await loadContacts(f);
  const origin = `${req.protocol}://${req.get('host')}`;
  const header = ['N° contact', 'N° fournisseur', 'Fournisseur', 'Nom', 'Téléphone', 'E-mail', 'QR code WeChat'];
  const lines = [header.map(cell).join(';')];
  for (const c of rows) {
    const qr = c.wechat_qr && c.wechat_qr.startsWith('/uploads/') ? origin + c.wechat_qr : c.wechat_qr;
    lines.push([c.id, c.supplier_id, c.supplier_name, c.name, c.phone, c.email, qr].map(cell).join(';'));
  }
  const date = new Date().toISOString().slice(0, 10);
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="contacts-${date}.csv"`);
  res.set('Access-Control-Expose-Headers', 'Content-Disposition'); // the web app reads the name
  res.send(`﻿${lines.join('\r\n')}\r\n`);
});
