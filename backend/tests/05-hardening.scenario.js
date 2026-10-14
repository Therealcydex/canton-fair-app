// Sprint 6 hardening (D21): login attempts limit, body size, headers.
const { api, expect, check, PREFIX, BASE } = require('./lib');
const { MAX_FAILURES } = require('../middleware/loginLimiter');

module.exports = async (ctx) => {
  // A username that does not exist: the limit applies per address + username.
  const target = `${PREFIX}_bf${Date.now()}`; // new name each run: a block lasts 15 minutes
  let all401 = true;
  for (let i = 0; i < MAX_FAILURES; i++) {
    const r = await api('POST', '/login', { body: { username: target, password: `essai${i}` } });
    if (r.status !== 401) all401 = false;
  }
  check(`${MAX_FAILURES} failed logins answer 401`, all401);
  expect('next attempt is refused (429)', await api('POST', '/login', { body: { username: target, password: 'x' } }), 429);
  expect('other usernames are not blocked', await api('POST', '/login', { body: { username: `${PREFIX}_adminA`, password: ctx.password } }), 200);

  const big = JSON.stringify({ name: 'x'.repeat(1024 * 1024 + 10) });
  expect('JSON body over 1 MB', await api('POST', '/suppliers', { token: ctx.tokens.buyerA, body: big }), 413);

  const res = await fetch(`${BASE}/me`);
  check('no X-Powered-By header', res.headers.get('x-powered-by') === null);
};
