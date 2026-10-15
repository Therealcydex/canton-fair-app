// D42: the hall plan (everyone reads it, the admin fills it) and the supplier's Canton Fair page.
const { api, expect, check, PREFIX } = require('./lib');

module.exports = async (ctx) => {
  const { tokens, adminToken: admin } = ctx;
  const A = tokens.buyerA;

  // Hall plan
  expect('plan without token', await api('GET', '/fair-plan'), 401);
  const all = expect('plan (a buyer may read it)', await api('GET', '/fair-plan', { token: A }), 200).body.data;
  // D48: one row per section and area, in the plan's order (areas A, D, C, B).
  check('every section of the 3 phases', new Set(all.map((s) => `${s.phase}|${s.section}`)).size >= 58
    && [1, 2, 3].every((p) => all.some((s) => s.phase === p)));
  const p1 = expect('plan of phase 1', await api('GET', '/fair-plan?phase=1', { token: A }), 200).body.data;
  check('20 sections in phase 1', new Set(p1.map((s) => s.section)).size === 20 && p1.every((s) => s.phase === 1));
  const order = p1.filter((s) => s.area).map((s) => s.area);
  check('areas in the order A, D, C, B', order.join('') === [...order].sort((a, b) => 'ADCB'.indexOf(a) - 'ADCB'.indexOf(b)).join(''));
  expect('invalid phase filter', await api('GET', '/fair-plan?phase=4', { token: A }), 400);

  // D48: the test writes a section the official plan leaves empty, so a value loaded by the plan
  // script is never marked as typed by an admin.
  const p3 = (await api('GET', '/fair-plan?phase=3', { token: A })).body.data;
  const target = p3.find((s) => s.section === 'Rural Vitalization');
  check('the test section is empty', !!target && target.halls === null);
  const body = { phase: 3, section: 'Rural Vitalization', halls: `${PREFIX} 14.3, 14.4` };
  expect('plan update without token', await api('PUT', '/fair-plan', { body }), 401);
  expect('a buyer cannot fill the plan', await api('PUT', '/fair-plan', { token: A, body }), 403);
  expect('phase missing', await api('PUT', '/fair-plan', { token: admin, body: { ...body, phase: undefined } }), 400);
  expect('section missing', await api('PUT', '/fair-plan', { token: admin, body: { ...body, section: ' ' } }), 400);
  expect('section of another phase', await api('PUT', '/fair-plan', { token: admin, body: { ...body, phase: 2 } }), 404);
  expect('halls without a number', await api('PUT', '/fair-plan', { token: admin, body: { ...body, halls: 'TEST somewhere' } }), 400);
  expect('halls too long', await api('PUT', '/fair-plan', { token: admin, body: { ...body, halls: `1${'x'.repeat(255)}` } }), 400);
  expect('admin sets the halls', await api('PUT', '/fair-plan', { token: admin, body }), 200);
  const after = (await api('GET', '/fair-plan?phase=3', { token: A })).body.data.find((s) => s.section === 'Rural Vitalization');
  check('halls saved, with who and when', after.halls === body.halls && after.area === 'C'
    && !!after.updated_by_name && !!after.updated_at);
  expect('admin sets halls in two areas', await api('PUT', '/fair-plan', { token: admin, body: { ...body, halls: `${PREFIX} 9.0(outdoor), ${PREFIX} 14.3` } }), 200);
  const split = (await api('GET', '/fair-plan?phase=3', { token: A })).body.data.filter((s) => s.section === 'Rural Vitalization');
  check('the server splits them by area', split.length === 2
    && split.some((s) => s.area === 'B' && s.halls === `${PREFIX} 9.0(outdoor)`) && split.some((s) => s.area === 'C' && s.halls === `${PREFIX} 14.3`));
  expect('admin clears them', await api('PUT', '/fair-plan', { token: admin, body: { ...body, halls: '' } }), 200);
  const cleared = (await api('GET', '/fair-plan?phase=3', { token: A })).body.data.filter((s) => s.section === 'Rural Vitalization');
  check('halls cleared', cleared.length === 1 && cleared[0].halls === null && cleared[0].area === null);

  // The supplier's page on the fair's site
  const page = 'https://www.cantonfair.org.cn/en-US/shops/451234#/';
  expect('a page of another site', await api('POST', '/suppliers', { token: A, body: { name: `${PREFIX} Lien`, cantonfair_url: 'https://evil-cantonfair.org.cn.example.com/x' } }), 400);
  expect('a look-alike host', await api('POST', '/suppliers', { token: A, body: { name: `${PREFIX} Lien`, cantonfair_url: 'https://xcantonfair.org/x' } }), 400);
  expect('not a link', await api('POST', '/suppliers', { token: A, body: { name: `${PREFIX} Lien`, cantonfair_url: 'javascript:alert(1)' } }), 400);
  const s = expect('supplier with its fair page', await api('POST', '/suppliers', { token: A, body: { name: `${PREFIX} Lien`, cantonfair_url: page } }), 200);
  const got = (await api('GET', `/suppliers/${s.body.data.id}`, { token: A })).body.data;
  check('the page is kept and returned', got.cantonfair_url === page);
  expect('edit another field keeps it', await api('PUT', `/suppliers/${s.body.data.id}`, { token: A, body: { phone: '+86 1' } }), 200);
  check('still there', (await api('GET', `/suppliers/${s.body.data.id}`, { token: A })).body.data.cantonfair_url === page);
  expect('remove the page', await api('PUT', `/suppliers/${s.body.data.id}`, { token: A, body: { cantonfair_url: '' } }), 200);
  check('page removed', (await api('GET', `/suppliers/${s.body.data.id}`, { token: A })).body.data.cantonfair_url === null);
  expect('cantonfair.org also accepted', await api('PUT', `/suppliers/${s.body.data.id}`, { token: A, body: { cantonfair_url: 'https://365.cantonfair.org/x' } }), 200);
};
