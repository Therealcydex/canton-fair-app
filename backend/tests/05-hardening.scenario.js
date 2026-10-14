// Hardening (D21): login and sign-up attempt limits, body size, headers.
const { EventEmitter } = require('events');
const { api, expect, check, PREFIX, BASE } = require('./lib');
const { MAX_FAILURES, signupLimiter, MAX_SIGNUPS } = require('../middleware/loginLimiter');

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
  expect('other usernames are not blocked', await api('POST', '/login', { body: { username: `${PREFIX}_buyerA`, password: ctx.password } }), 200);

  // The sign-up limit is checked in this process (exhausting it on the running server would
  // block the next runs for 15 minutes): fake requests from one address.
  const ip = `test-${Date.now()}`;
  const run = (status) => {
    const res = new EventEmitter();
    let refused = null;
    res.status = (s) => ({ json: (b) => { refused = { s, b }; } });
    let passed = false;
    signupLimiter({ ip }, res, () => { passed = true; });
    if (passed) { res.statusCode = status; res.emit('finish'); }
    return refused;
  };
  for (let i = 0; i < 5; i++) run(400);
  check('invalid sign-up forms are not counted', run(200) === null);
  for (let i = 1; i < MAX_SIGNUPS; i++) run(i % 2 ? 200 : 409);
  const blocked = run(200);
  check(`sign-up refused (429) after ${MAX_SIGNUPS} accounts or taken usernames`, blocked?.s === 429 && blocked.b.success === false);

  const big = JSON.stringify({ name: 'x'.repeat(1024 * 1024 + 10) });
  expect('JSON body over 1 MB', await api('POST', '/suppliers', { token: ctx.tokens.buyerA, body: big }), 413);

  const res = await fetch(`${BASE}/me`);
  check('no X-Powered-By header', res.headers.get('x-powered-by') === null);
};
