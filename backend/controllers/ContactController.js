const db = require('../config/db');
const { fail, handle, toId, clean, likeContains } = require('../utils/http');

// Every contact of every supplier, in one table (BF17). Read only: contacts are created,
// changed and deleted through /api/suppliers/:id/contacts, where their rules live.

// D33/D34: a QR code is a photo or a scanned link; any other text is an older typed WeChat id.
const HAS_QR = "(c.wechat_qr LIKE '/uploads/wechat/%' OR c.wechat_qr LIKE 'http://%' OR c.wechat_qr LIKE 'https://%')";

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
    if (query.has_qr === '1') where += ` AND ${HAS_QR}`;
    else if (query.has_qr === '0') where += ` AND (c.wechat_qr IS NULL OR NOT ${HAS_QR})`;
    else return { message: 'Filtre has_qr invalide (0 ou 1)' };
  }
  return { where, params };
}

// supplier_no: the supplier's number, 1, 2, 3… in creation order without the gaps left by
// deleted suppliers (the id keeps them and stays internal). Same as in SupplierController.
const loadContacts = (f) =>
  db.query(
    `SELECT c.id, c.supplier_id, s.name AS supplier_name,
            (SELECT COUNT(*) FROM suppliers s2 WHERE s2.id <= s.id) AS supplier_no,
            c.name, c.phone, c.email, c.wechat_qr, c.avatar
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
// "N°" is the line number (1, 2, 3…): the contact's id keeps the gaps left by deleted contacts.
exports.exportCsv = handle('Contact export', async (req, res) => {
  const f = filters(req.query);
  if (!f.where) return fail(res, 400, f.message);
  const [rows] = await loadContacts(f);
  const origin = `${req.protocol}://${req.get('host')}`;
  const header = ['N°', 'N° fournisseur', 'Fournisseur', 'Nom', 'Téléphone', 'E-mail', 'QR code WeChat'];
  const lines = [header.map(cell).join(';')];
  for (const [i, c] of rows.entries()) {
    const qr = c.wechat_qr && c.wechat_qr.startsWith('/uploads/') ? origin + c.wechat_qr : c.wechat_qr;
    lines.push([i + 1, c.supplier_no, c.supplier_name, c.name, c.phone, c.email, qr].map(cell).join(';'));
  }
  const date = new Date().toISOString().slice(0, 10);
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="contacts-${date}.csv"`);
  res.set('Access-Control-Expose-Headers', 'Content-Disposition'); // the web app reads the name
  res.send(`﻿${lines.join('\r\n')}\r\n`);
});
