// BF01-BF03: login, companies, users. No sign-up (D46): the admin creates the accounts.
const { api, expect, check, login, PREFIX } = require('./lib');

module.exports = async (ctx) => {
  const { tokens, users, companies, adminToken, password } = ctx;

  // Login (BF01)
  expect('login without fields', await api('POST', '/login', { body: {} }), 400);
  expect('login with wrong password', await api('POST', '/login', { body: { username: `${PREFIX}_buyerA`, password: 'faux' } }), 401);
  expect('login with unknown user', await api('POST', '/login', { body: { username: 'inconnu', password: 'x' } }), 401);
  expect('malformed JSON', await api('POST', '/login', { body: '{bad' }), 400);
  const ok = await api('POST', '/login', { body: { username: `${PREFIX}_buyerA`, password } });
  check('login returns token and user without password',
    ok.status === 200 && ok.body.token && ok.body.user && !('password_hash' in ok.body.user));
  check('login returns the company', ok.body.user?.company_id === companies.A);

  // Token
  expect('no token', await api('GET', '/me'), 401);
  expect('forged token', await api('GET', '/me', { token: 'abc.def.ghi' }), 401);
  const me = expect('me with token', await api('GET', '/me', { token: tokens.buyerA }), 200);
  check('me is the token owner', me.body.data?.id === users.buyerA);
  expect('unknown API route', await api('GET', '/nowhere', { token: tokens.buyerA }), 404);

  // No sign-up (D46): the public routes are gone; the admin creates the accounts.
  expect('sign-up route removed', await api('POST', '/signup', { body: { name: 'X', username: `${PREFIX}_signup1`, password } }), 404);
  expect('sign-up companies route removed', await api('GET', '/signup/companies'), 404);
  const created = expect('admin creates an inactive account', await api('POST', '/users', {
    token: adminToken,
    body: { name: `${PREFIX} Nouveau`, username: `${PREFIX}_new1`, password, level: 'Acheteur', company_id: companies.A, is_active: false },
  }), 200);
  const newId = created.body.data?.id;
  expect('inactive account cannot log in', await api('POST', '/login', { body: { username: `${PREFIX}_new1`, password } }), 403);
  expect('buyer lists inactive accounts', await api('GET', '/users?pending=1', { token: tokens.buyerA }), 403);
  expect('buyer activates an account', await api('PUT', `/users/${newId}`, { token: tokens.buyerA, body: { is_active: 1 } }), 403);
  const pending = expect('admin lists inactive accounts', await api('GET', '/users?pending=1', { token: adminToken }), 200);
  check('the inactive list has the new account and only inactive ones',
    pending.body.data.some((u) => u.id === newId) && pending.body.data.every((u) => u.is_active === 0));
  check('no password hash in user list', pending.body.data.every((u) => !('password_hash' in u)));
  expect('admin activates it', await api('PUT', `/users/${newId}`, { token: adminToken, body: { is_active: 1 } }), 200);
  check('activated user logs in', !!(await login(`${PREFIX}_new1`, password)));

  // Users (BF03, admin only)
  expect('buyer lists users', await api('GET', '/users', { token: tokens.buyerA }), 403);
  expect('buyer creates a user', await api('POST', '/users', { token: tokens.buyerA, body: { name: 'X', username: `${PREFIX}_x1`, password } }), 403);
  expect('unknown role', await api('POST', '/users', { token: adminToken, body: { name: 'X', username: `${PREFIX}_x1`, password, role: 'CHEF' } }), 400);
  expect('short password', await api('POST', '/users', { token: adminToken, body: { name: 'X', username: `${PREFIX}_x1`, password: 'court' } }), 400);
  expect('duplicate username', await api('POST', '/users', { token: adminToken, body: { name: 'X', username: `${PREFIX}_buyerB`, password } }), 409);
  expect('unknown company', await api('POST', '/users', { token: adminToken, body: { name: 'X', username: `${PREFIX}_x1`, password, company_id: 999999 } }), 400);
  expect('admin creates a user', await api('POST', '/users', { token: adminToken, body: { name: 'X', username: `${PREFIX}_x1`, password, company_id: companies.B } }), 200);

  const adminUser = (await api('GET', '/me', { token: adminToken })).body.data;
  expect('admin deactivates self', await api('PUT', `/users/${adminUser.id}`, { token: adminToken, body: { is_active: 0 } }), 409);
  expect('admin changes own role', await api('PUT', `/users/${adminUser.id}`, { token: adminToken, body: { role: 'ACHETEUR' } }), 409);
  expect('admin deletes self', await api('DELETE', `/users/${adminUser.id}`, { token: adminToken }), 409);

  // Deactivation takes effect on the next request, not at token expiry.
  expect('deactivate buyer', await api('PUT', `/users/${users.buyerA}`, { token: adminToken, body: { is_active: 0 } }), 200);
  expect('deactivated buyer token refused', await api('GET', '/me', { token: tokens.buyerA }), 401);
  expect('deactivated buyer login refused', await api('POST', '/login', { body: { username: `${PREFIX}_buyerA`, password } }), 403);
  expect('reactivate buyer', await api('PUT', `/users/${users.buyerA}`, { token: adminToken, body: { is_active: 1 } }), 200);
  tokens.buyerA = await login(`${PREFIX}_buyerA`, password);

  // Companies (BF02, admin only)
  expect('buyer lists companies', await api('GET', '/companies', { token: tokens.buyerA }), 200);
  expect('buyer creates a company', await api('POST', '/companies', { token: tokens.buyerA, body: { name: `${PREFIX} X` } }), 403);
  expect('empty company name', await api('POST', '/companies', { token: adminToken, body: { name: ' ' } }), 400);
  expect('duplicate company name (no branch)', await api('POST', '/companies', { token: adminToken, body: { name: `${PREFIX} Société A` } }), 409);
  const br1 = expect('company with a branch', await api('POST', '/companies', { token: adminToken, body: { name: `${PREFIX} Temp`, branch: 'Sfax' } }), 200);
  expect('same company, other branch', await api('POST', '/companies', { token: adminToken, body: { name: `${PREFIX} Temp`, branch: 'Sousse' } }), 200);
  expect('same company and branch', await api('POST', '/companies', { token: adminToken, body: { name: `${PREFIX} Temp`, branch: 'Sfax' } }), 409);
  expect('rename company', await api('PUT', `/companies/${br1.body.data.id}`, { token: adminToken, body: { branch: 'Tunis' } }), 200);
  expect('buyer deletes a company', await api('DELETE', `/companies/${br1.body.data.id}`, { token: tokens.buyerA }), 403);
  expect('delete unknown company', await api('DELETE', '/companies/999999', { token: adminToken }), 404);

  // Deleting a company keeps its users, without a company.
  const tmp = (await api('POST', '/companies', { token: adminToken, body: { name: `${PREFIX} Temp à supprimer` } })).body.data.id;
  const u = (await api('POST', '/users', { token: adminToken, body: { name: 'Y', username: `${PREFIX}_y1`, password, company_id: tmp } })).body.data.id;
  expect('delete company with users', await api('DELETE', `/companies/${tmp}`, { token: adminToken }), 200);
  const after = await api('GET', `/users/${u}`, { token: adminToken });
  check('its user stays, without a company', after.status === 200 && after.body.data.company_id === null);
};
