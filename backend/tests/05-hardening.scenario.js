// Hardening (D21, D74): a wrong password can be tried again at once. Body size and headers stay.
const { api, expect, check, PREFIX, BASE } = require('./lib');

module.exports = async (ctx) => {
  const target = `${PREFIX}_bf${Date.now()}`;
  expect('a wrong password', await api('POST', '/login', { body: { username: target, password: 'essai' } }), 401);
  expect('another wrong password is still accepted as an attempt', await api('POST', '/login', { body: { username: target, password: 'encore' } }), 401);
  expect('a real login still works', await api('POST', '/login', { body: { username: `${PREFIX}_buyerA`, password: ctx.password } }), 200);

  const big = (mb) => JSON.stringify({ name: 'x'.repeat(mb * 1024 * 1024 + 10) });
  expect('JSON body over 1 MB', await api('POST', '/companies', { token: ctx.adminToken, body: big(1) }), 413);
  // D61: larger bodies only where Base64 images travel.
  expect('supplier body over 2 MB', await api('POST', '/suppliers', { token: ctx.tokens.buyerA, body: big(2) }), 413);
  expect('product body over 25 MB', await api('POST', '/products', { token: ctx.tokens.buyerA, body: big(25) }), 413);

  const res = await fetch(`${BASE}/me`);
  check('no X-Powered-By header', res.headers.get('x-powered-by') === null);
};
