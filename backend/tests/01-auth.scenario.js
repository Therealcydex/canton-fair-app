// BF01-BF03: login, companies, users.
const { api, expect, check, login, PREFIX } = require('./lib');

module.exports = async (ctx) => {
  const { tokens, users, companies, superToken, password } = ctx;

  // Login (BF01)
  expect('login without fields', await api('POST', '/login', { body: {} }), 400);
  expect('login with wrong password', await api('POST', '/login', { body: { username: `${PREFIX}_adminA`, password: 'faux' } }), 401);
  expect('login with unknown user', await api('POST', '/login', { body: { username: 'inconnu', password: 'x' } }), 401);
  expect('malformed JSON', await api('POST', '/login', { body: '{bad' }), 400);
  const ok = await api('POST', '/login', { body: { username: `${PREFIX}_adminA`, password } });
  check('login returns token and user without password',
    ok.status === 200 && ok.body.token && ok.body.user && !('password_hash' in ok.body.user));

  // Token
  expect('no token', await api('GET', '/me'), 401);
  expect('forged token', await api('GET', '/me', { token: 'abc.def.ghi' }), 401);
  const me = expect('me with token', await api('GET', '/me', { token: tokens.buyerA }), 200);
  check('me is the token owner', me.body.data?.id === users.buyerA);
  expect('unknown API route', await api('GET', '/nowhere', { token: tokens.buyerA }), 404);

  // Companies (BF02)
  expect('buyer lists companies', await api('GET', '/companies', { token: tokens.buyerA }), 200);
  expect('company admin creates a company', await api('POST', '/companies', { token: tokens.adminA, body: { name: `${PREFIX} X` } }), 403);
  expect('empty company name', await api('POST', '/companies', { token: superToken, body: { name: ' ' } }), 400);
  expect('duplicate company name', await api('POST', '/companies', { token: superToken, body: { name: `${PREFIX} Société A` } }), 409);
  const c = expect('super-admin creates a company', await api('POST', '/companies', { token: superToken, body: { name: `${PREFIX} Temp` } }), 200);
  expect('rename company', await api('PUT', `/companies/${c.body.data.id}`, { token: superToken, body: { name: `${PREFIX} Temp 2` } }), 200);
  expect('delete company in use', await api('DELETE', `/companies/${companies.A}`, { token: superToken }), 409);
  expect('delete unknown company', await api('DELETE', '/companies/999999', { token: superToken }), 404);
  expect('delete empty company', await api('DELETE', `/companies/${c.body.data.id}`, { token: superToken }), 200);

  // Users (BF03)
  expect('buyer lists users', await api('GET', '/users', { token: tokens.buyerA }), 403);
  const list = expect('admin lists users', await api('GET', '/users', { token: tokens.adminA }), 200);
  check('admin sees only own company', list.body.data.every((u) => u.company_id === companies.A));
  check('no password hash in user list', list.body.data.every((u) => !('password_hash' in u)));
  expect('admin reads user of other company', await api('GET', `/users/${users.buyerB}`, { token: tokens.adminA }), 403);
  expect('admin edits user of other company', await api('PUT', `/users/${users.buyerB}`, { token: tokens.adminA, body: { name: 'pirate' } }), 403);
  expect('admin gives level above own', await api('POST', '/users', { token: tokens.adminA, body: { name: 'X', username: `${PREFIX}_x1`, password, level: 9 } }), 403);
  expect('admin gives SUPER_ADMIN role', await api('POST', '/users', { token: tokens.adminA, body: { name: 'X', username: `${PREFIX}_x1`, password, role: 'super_admin' } }), 403);
  expect('short password', await api('POST', '/users', { token: tokens.adminA, body: { name: 'X', username: `${PREFIX}_x1`, password: 'court' } }), 400);
  expect('duplicate username', await api('POST', '/users', { token: tokens.adminA, body: { name: 'X', username: `${PREFIX}_buyerB`, password } }), 409);
  const created = expect('admin creates user (company_id in body ignored)',
    await api('POST', '/users', { token: tokens.adminA, body: { name: 'X', username: `${PREFIX}_x1`, password, company_id: companies.B } }), 200);
  const got = await api('GET', `/users/${created.body.data.id}`, { token: tokens.adminA });
  check('new user is in the admin\'s company', got.body.data?.company_id === companies.A);

  expect('admin deactivates self', await api('PUT', `/users/${users.adminA}`, { token: tokens.adminA, body: { active: false } }), 409);
  expect('admin changes own level', await api('PUT', `/users/${users.adminA}`, { token: tokens.adminA, body: { level: 2 } }), 409);

  // Deactivation takes effect on the next request, not at token expiry.
  expect('deactivate buyer', await api('PUT', `/users/${users.buyerA}`, { token: tokens.adminA, body: { active: false } }), 200);
  expect('deactivated buyer token refused', await api('GET', '/me', { token: tokens.buyerA }), 401);
  expect('deactivated buyer login refused', await api('POST', '/login', { body: { username: `${PREFIX}_buyerA`, password } }), 403);
  expect('reactivate buyer', await api('PUT', `/users/${users.buyerA}`, { token: tokens.adminA, body: { active: true } }), 200);
  tokens.buyerA = await login(`${PREFIX}_buyerA`, password);
};
