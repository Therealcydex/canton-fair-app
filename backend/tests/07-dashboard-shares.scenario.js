// D40: the web home page figures and the supplier search by phone. D66: the shares counted are
// the suppliers shared with companies (neither products nor booths are shared).
const { api, expect, check, PREFIX } = require('./lib');

module.exports = async (ctx) => {
  const { tokens, companies, adminToken } = ctx;
  const A = tokens.buyerA;
  const B = tokens.buyerB;

  // Dashboard
  expect('dashboard without token', await api('GET', '/dashboard'), 401);
  const before = expect('dashboard (any user)', await api('GET', '/dashboard', { token: B }), 200).body.data;
  check('dashboard has the totals, three phases and the companies',
    Number.isInteger(before.suppliers) && Number.isInteger(before.products_week) && before.phases.length === 3
    && before.phases.every((p) => Number.isInteger(p.planned) && Number.isInteger(p.visited))
    && before.companies.some((c) => c.id === companies.A) && Number.isInteger(before.suppliers_shared));

  // Supplier search by phone
  const supplier = expect('create supplier', await api('POST', '/suppliers', {
    token: A, body: { name: `${PREFIX} Fournisseur tableau`, phone: '+86 574 9911 4477' },
  }), 200).body.data.id;
  const byPhone = expect('search suppliers by phone', await api('GET', '/suppliers?q=9911%204477', { token: B }), 200);
  check('the phone finds the supplier', byPhone.body.data.some((s) => s.id === supplier));

  // Two products, and the supplier shared with company B (D66)
  for (const n of [1, 2]) {
    expect(`product ${n}`, await api('POST', '/products', { token: A, body: { name: `${PREFIX} Lot ${n}`, supplier_id: supplier } }), 200);
  }
  expect('supplier shared with B', await api('PUT', `/suppliers/${supplier}`, { token: adminToken, body: { share_company_ids: [companies.B] } }), 200);

  const after = (await api('GET', '/dashboard', { token: A })).body.data;
  check('the dashboard counts the new supplier, products and supplier share',
    after.suppliers === before.suppliers + 1 && after.products === before.products + 2
    && after.products_week === before.products_week + 2 && after.shares === before.shares + 1
    && after.suppliers_shared === before.suppliers_shared + 1
    && after.companies.find((c) => c.id === companies.B).shared === 1);
  const list = (await api('GET', '/companies', { token: A })).body.data;
  check('the company list counts its shared suppliers', Number(list.find((c) => c.id === companies.B).shared_suppliers_count) === 1);

  expect('delete supplier', await api('DELETE', `/suppliers/${supplier}`, { token: A }), 200);
};
