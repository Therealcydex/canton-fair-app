const db = require('../config/db');
const { handle } = require('../utils/http');

// D40: the figures of the web "Accueil" page, for the whole group (every user sees them, as
// every user sees every supplier, booth and product). Counts only, in one round trip each.
exports.summary = handle('Dashboard summary', async (req, res) => {
  const [[totals]] = await db.query(
    `SELECT (SELECT COUNT(*) FROM suppliers) AS suppliers,
            (SELECT COUNT(*) FROM products) AS products,
            (SELECT COUNT(*) FROM products WHERE created_at >= NOW() - INTERVAL 7 DAY) AS products_week,
            (SELECT COUNT(*) FROM supplier_shares) AS shares,
            (SELECT COUNT(DISTINCT supplier_id) FROM supplier_shares) AS suppliers_shared`
  );
  // Booths planned and visited in each phase of the fair; a phase without booths still shows.
  const [booths] = await db.query(
    'SELECT phase, COUNT(*) AS planned, SUM(visited) AS visited FROM booths GROUP BY phase'
  );
  // The fair's dates of each phase, from the Canton Fair category list ("Phase 2 (Oct.23 - 27)").
  const [labels] = await db.query('SELECT DISTINCT phase FROM canton_fair_category');
  const phases = [1, 2, 3].map((phase) => {
    const b = booths.find((r) => Number(r.phase) === phase);
    const label = labels.map((l) => l.phase).find((l) => l.startsWith(`Phase ${phase} `));
    return {
      phase,
      dates: label ? (/\(([^)]*)\)/.exec(label) || [])[1] || null : null,
      planned: b ? Number(b.planned) : 0,
      visited: b ? Number(b.visited) : 0,
    };
  });
  const [companies] = await db.query(
    `SELECT c.id, c.name, c.branch,
            (SELECT COUNT(*) FROM supplier_shares ss WHERE ss.company_id = c.id) AS shared
     FROM companies c ORDER BY c.name, c.branch`
  );
  res.json({
    success: true,
    data: {
      suppliers: Number(totals.suppliers),
      products: Number(totals.products),
      products_week: Number(totals.products_week),
      shares: Number(totals.shares),
      suppliers_shared: Number(totals.suppliers_shared), // D66: suppliers are shared, no longer booths
      phases,
      companies: companies.map((c) => ({ ...c, shared: Number(c.shared) })),
    },
  });
});
