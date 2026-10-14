const db = require('../config/db');
const { handle } = require('../utils/http');

// Reference lists of schema v2, read only (they are filled by the scripts in backend/sql/).

exports.provinces = handle('List provinces', async (req, res) => {
  const [rows] = await db.query(
    'SELECT id, name_en, name_zh, capital, prc_administered FROM china_province ORDER BY name_en'
  );
  res.json({ success: true, data: rows });
});

exports.shippingTypes = handle('List shipping types', async (req, res) => {
  const [rows] = await db.query('SELECT code, name FROM shipping_types ORDER BY code');
  res.json({ success: true, data: rows });
});

// The Canton Fair categories (phase → category → section → sub-category), one row per
// sub-category. phase=2 or 3 narrows it to one fair phase.
exports.cantonCategories = handle('List canton categories', async (req, res) => {
  const params = [];
  let where = '1=1';
  if (/^[1-3]$/.test(req.query.phase || '')) {
    where += ' AND phase LIKE ?';
    params.push(`Phase ${req.query.phase} %`);
  }
  const [rows] = await db.query(
    `SELECT id, phase, category, section, sub_category FROM canton_fair_category
     WHERE ${where} ORDER BY phase, category, section, sub_category`,
    params
  );
  res.json({ success: true, data: rows });
});
