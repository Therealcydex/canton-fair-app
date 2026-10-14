// BF01-BF03 and BF16: login, sign-up and its validation, companies, users.
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

  // Sign-up (BF16)
  const pub = expect('companies for sign-up, without a token', await api('GET', '/signup/companies'), 200);
  check('sign-up list shows only id, name, branch',
    pub.body.data.length > 0 && pub.body.data.every((c) => Object.keys(c).sort().join() === 'branch,id,name'));
  const form = { name: `${PREFIX} Nouveau`, username: `${PREFIX}_signup1`, password, company_id: companies.A };
  expect('sign-up without name', await api('POST', '/signup', { body: { ...form, name: ' ' } }), 400);
  expect('sign-up with a short password', await api('POST', '/signup', { body: { ...form, password: 'court' } }), 400);
  expect('sign-up with an invalid username', await api('POST', '/signup', { body: { ...form, username: 'a b' } }), 400);
  expect('sign-up without company', await api('POST', '/signup', { body: { ...form, company_id: undefined } }), 400);
  expect('sign-up with an unknown company', await api('POST', '/signup', { body: { ...form, company_id: 999999 } }), 400);
  expect('sign-up with a taken username', await api('POST', '/signup', { body: { ...form, username: `${PREFIX}_buyerB` } }), 409);
  const signed = expect('sign-up (role ADMIN in the body is ignored)',
    await api('POST', '/signup', { body: { ...form, role: 'ADMIN', is_active: 1 } }), 200);
  const newId = signed.body.data?.id;
  check('sign-up is pending', signed.body.data?.pending === true);
  expect('pending account cannot log in', await api('POST', '/login', { body: { username: form.username, password } }), 403);

  expect('buyer lists pending sign-ups', await api('GET', '/users?pending=1', { token: tokens.buyerA }), 403);
  expect('buyer activates a sign-up', await api('PUT', `/users/${newId}`, { token: tokens.buyerA, body: { is_active: 1 } }), 403);
  const pending = expect('admin lists pending sign-ups', await api('GET', '/users?pending=1', { token: adminToken }), 200);
  const row = pending.body.data.find((u) => u.id === newId);
  check('pending list has the new user, inactive buyer of company A',
    row && row.is_active === 0 && row.role === 'ACHETEUR' && row.company_id === companies.A);
  check('pending list has only inactive users', pending.body.data.every((u) => u.is_active === 0));
  check('no password hash in user list', pending.body.data.every((u) => !('password_hash' in u)));
  expect('admin activates the sign-up', await api('PUT', `/users/${newId}`, { token: adminToken, body: { is_active: 1, level: 'Acheteur junior' } }), 200);
  const newToken = await login(form.username, password);
  check('activated user logs in', !!newToken);

  const refused = expect('second sign-up', await api('POST', '/signup', { body: { ...form, username: `${PREFIX}_signup2` } }), 200);
  expect('admin refuses (deletes) a sign-up', await api('DELETE', `/users/${refused.body.data.id}`, { token: adminToken }), 200);
  expect('deleted sign-up is gone', await api('GET', `/users/${refused.body.data.id}`, { token: adminToken }), 404);

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
