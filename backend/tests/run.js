// API scenarios: refused + legitimate request for every rule (guide §8.3).
// Usage (from backend/, with the backend running): npm run test:api [-- auth suppliers ...]
// Needs SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD in .env (the admin).
const fs = require('fs');
const path = require('path');
const { api, login, connect, counts, cleanup, summary, PREFIX, BASE } = require('./lib');

const PASSWORD = 'motdepasse-test';

// Two of Tarek's companies, each with an active buyer created by the admin.
async function fixtures(adminToken) {
  const ctx = { adminToken, password: PASSWORD, companies: {}, users: {}, tokens: {} };
  for (const key of ['A', 'B']) {
    const c = await api('POST', '/companies', { token: adminToken, body: { name: `${PREFIX} Société ${key}` } });
    if (!c.body.success) throw new Error(`fixture company ${key}: ${JSON.stringify(c.body)}`);
    ctx.companies[key] = c.body.data.id;
    const username = `${PREFIX}_buyer${key}`;
    const u = await api('POST', '/users', {
      token: adminToken,
      body: { name: `${PREFIX} buyer ${key}`, username, password: PASSWORD, level: 2, company_id: c.body.data.id },
    });
    if (!u.body.success) throw new Error(`fixture user ${username}: ${JSON.stringify(u.body)}`);
    ctx.users[`buyer${key}`] = u.body.data.id;
    ctx.tokens[`buyer${key}`] = await login(username, PASSWORD);
  }
  return ctx;
}

async function main() {
  // The scenarios create and delete data: never against a shared or remote database.
  const host = process.env.DB_HOST || 'localhost';
  if (!['localhost', '127.0.0.1', '::1'].includes(host) && process.env.ALLOW_REMOTE_TESTS !== '1') {
    throw new Error(`DB_HOST is ${host}: the scenarios only run on a local database (set ALLOW_REMOTE_TESTS=1 to force)`);
  }

  const health = await fetch(BASE.replace(/\/api$/, '/')).catch(() => null);
  if (!health || !health.ok) throw new Error(`backend not reachable at ${BASE} — start it with npm run dev`);

  const only = process.argv.slice(2);
  const files = fs.readdirSync(__dirname)
    .filter((f) => f.endsWith('.scenario.js'))
    .sort()
    .filter((f) => !only.length || only.some((o) => f.includes(o)));

  const conn = await connect();
  await cleanup(conn); // leftovers of an interrupted run
  const before = await counts(conn);
  try {
    const adminToken = await login(process.env.SEED_ADMIN_USERNAME, process.env.SEED_ADMIN_PASSWORD);
    const ctx = await fixtures(adminToken);
    for (const f of files) {
      console.log(`\n# ${f}`);
      await require(path.join(__dirname, f))(ctx);
    }
  } finally {
    await cleanup(conn);
    const after = await counts(conn);
    const changed = Object.keys(before).filter((t) => before[t] !== after[t]);
    console.log(changed.length
      ? `\nRow counts CHANGED after cleanup: ${changed.map((t) => `${t} ${before[t]} -> ${after[t]}`).join(', ')}`
      : '\nRow counts back to their starting values');
    await conn.end();
  }

  const { passes, failures } = summary();
  console.log(`${passes} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error('Scenario run aborted:', err.message);
  process.exit(1);
});
