// D42: the hall plan (everyone reads it, the admin fills it) and the supplier's Canton Fair page.
const { api, expect, check, PREFIX } = require('./lib');

module.exports = async (ctx) => {
  const { tokens, adminToken: admin } = ctx;
  const A = tokens.buyerA;

  // Hall plan
  expect('plan without token', await api('GET', '/fair-plan'), 401);
  const all = expect('plan (a buyer may read it)', await api('GET', '/fair-plan', { token: A }), 200).body.data;
  check('every section of the 3 phases, once', all.length >= 58 && [1, 2, 3].every((p) => all.some((s) => s.phase === p))
    && new Set(all.map((s) => `${s.phase}|${s.section}`)).size === all.length);
  const p1 = expect('plan of phase 1', await api('GET', '/fair-plan?phase=1', { token: A }), 200).body.data;
  check('20 sections in phase 1', p1.length === 20 && p1.every((s) => s.phase === 1));
  expect('invalid phase filter', await api('GET', '/fair-plan?phase=4', { token: A }), 400);

  const target = p1.find((s) => s.section === 'Lighting Equipment');
  const original = target.halls; // a real value on this database: put back at the end
  const body = { phase: 1, section: 'Lighting Equipment', halls: `${PREFIX} 14.3, 14.4` };
  expect('plan update without token', await api('PUT', '/fair-plan', { body }), 401);
  expect('a buyer cannot fill the plan', await api('PUT', '/fair-plan', { token: A, body }), 403);
  expect('phase missing', await api('PUT', '/fair-plan', { token: admin, body: { ...body, phase: undefined } }), 400);
  expect('section missing', await api('PUT', '/fair-plan', { token: admin, body: { ...body, section: ' ' } }), 400);
  expect('section of another phase', await api('PUT', '/fair-plan', { token: admin, body: { ...body, phase: 2 } }), 404);
  expect('halls without a number', await api('PUT', '/fair-plan', { token: admin, body: { ...body, halls: 'TEST somewhere' } }), 400);
  expect('halls too long', await api('PUT', '/fair-plan', { token: admin, body: { ...body, halls: `1${'x'.repeat(255)}` } }), 400);
  expect('admin sets the halls', await api('PUT', '/fair-plan', { token: admin, body }), 200);
  const after = (await api('GET', '/fair-plan?phase=1', { token: A })).body.data.find((s) => s.section === 'Lighting Equipment');
  check('halls saved, with who and when', after.halls === body.halls && !!after.updated_by_name && !!after.updated_at);
  expect('admin clears them', await api('PUT', '/fair-plan', { token: admin, body: { ...body, halls: '' } }), 200);
  const cleared = (await api('GET', '/fair-plan?phase=1', { token: A })).body.data.find((s) => s.section === 'Lighting Equipment');
  check('halls cleared', cleared.halls === null);
  if (original) await api('PUT', '/fair-plan', { token: admin, body: { ...body, halls: original } });

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
