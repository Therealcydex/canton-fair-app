// BF06-BF09: category tree, booths, "to visit" list, visits.
const { api, expect, check, login, PREFIX } = require('./lib');

module.exports = async (ctx) => {
  const { tokens, superToken } = ctx;
  const A = tokens.buyerA;
  const B = tokens.buyerB;

  // Categories (BF06): global, super-admin only (D3, D12)
  expect('buyer lists categories', await api('GET', '/categories', { token: A }), 200);
  expect('company admin creates a category', await api('POST', '/categories', { token: tokens.adminA, body: { name: `${PREFIX} cat` } }), 403);
  expect('category without name', await api('POST', '/categories', { token: superToken, body: {} }), 400);
  expect('category under unknown parent', await api('POST', '/categories', { token: superToken, body: { name: `${PREFIX} x`, parent_id: 999999 } }), 400);
  const root = expect('create root category', await api('POST', '/categories', { token: superToken, body: { name: `${PREFIX} Lighting` } }), 200).body.data.id;
  const l1 = (await api('POST', '/categories', { token: superToken, body: { name: `${PREFIX} LED`, parent_id: root } })).body.data.id;
  const l2 = (await api('POST', '/categories', { token: superToken, body: { name: `${PREFIX} Strips`, parent_id: l1 } })).body.data.id;
  const l3 = expect('create 4th level', await api('POST', '/categories', { token: superToken, body: { name: `${PREFIX} RGB`, parent_id: l2 } }), 200).body.data.id;
  expect('5th level refused', await api('POST', '/categories', { token: superToken, body: { name: `${PREFIX} too deep`, parent_id: l3 } }), 409);
  expect('duplicate sibling name', await api('POST', '/categories', { token: superToken, body: { name: `${PREFIX} led`, parent_id: root } }), 409);
  expect('move under own descendant', await api('PUT', `/categories/${l1}`, { token: superToken, body: { parent_id: l2 } }), 409);
  // LED has 2 levels below it: under a depth-1 category it would reach depth 4 (5 levels).
  const other = (await api('POST', '/categories', { token: superToken, body: { name: `${PREFIX} Other` } })).body.data.id;
  const otherChild = (await api('POST', '/categories', { token: superToken, body: { name: `${PREFIX} Other child`, parent_id: other } })).body.data.id;
  expect('move making the tree too deep', await api('PUT', `/categories/${l1}`, { token: superToken, body: { parent_id: otherChild } }), 409);
  expect('move a subtree to the root', await api('PUT', `/categories/${l2}`, { token: superToken, body: { parent_id: null } }), 200);
  const cats = (await api('GET', '/categories', { token: A })).body.data;
  const depthOf = (id) => cats.find((c) => c.id === id)?.depth;
  check('subtree depths shifted after move', depthOf(l2) === 0 && depthOf(l3) === 1, JSON.stringify(cats.filter((c) => c.name.startsWith(PREFIX))));
  expect('delete category with children', await api('DELETE', `/categories/${l2}`, { token: superToken }), 409);

  // Booths (BF07)
  const sA = (await api('POST', '/suppliers', { token: A, body: { name: `${PREFIX} Booth supplier A` } })).body.data.id;
  const sA2 = (await api('POST', '/suppliers', { token: A, body: { name: `${PREFIX} Booth supplier A2` } })).body.data.id;
  const sB = (await api('POST', '/suppliers', { token: B, body: { name: `${PREFIX} Booth supplier B` } })).body.data.id;

  expect('booth without supplier', await api('POST', '/booths', { token: A, body: { hall: 12, num_start: 35 } }), 400);
  expect('booth without hall', await api('POST', '/booths', { token: A, body: { supplier_id: sA, num_start: 35 } }), 400);
  expect('booth for other company supplier', await api('POST', '/booths', { token: A, body: { supplier_id: sB, hall: 12, num_start: 35 } }), 403);
  expect('booth with two letters', await api('POST', '/booths', { token: A, body: { supplier_id: sA, hall: 12, letter: 'FF', num_start: 35 } }), 400);
  expect('booth with end before start', await api('POST', '/booths', { token: A, body: { supplier_id: sA, hall: 12, num_start: 36, num_end: 35 } }), 400);
  expect('booth with unknown category', await api('POST', '/booths', { token: A, body: { supplier_id: sA, hall: 12, num_start: 35, category_id: 999999 } }), 400);

  const b1 = expect('create booth', await api('POST', '/booths', {
    token: A, body: { supplier_id: sA, category_id: l1, phase: 2, hall: 12, level: 2, letter: 'f', num_start: 35, num_end: 36, to_visit: true },
  }), 200).body.data.id;
  expect('overlapping booth refused', await api('POST', '/booths', {
    token: A, body: { supplier_id: sA2, phase: 2, hall: 12, level: 2, letter: 'F', num_start: 36 },
  }), 409);
  expect('same place in another company is allowed', await api('POST', '/booths', {
    token: B, body: { supplier_id: sB, phase: 2, hall: 12, level: 2, letter: 'F', num_start: 36 },
  }), 200);
  const b2 = expect('adjacent booth allowed', await api('POST', '/booths', {
    token: A, body: { supplier_id: sA2, phase: 2, hall: 12, level: 2, letter: 'F', num_start: 37 },
  }), 200).body.data.id;

  const got = expect('read booth', await api('GET', `/booths/${b1}`, { token: A }), 200).body.data;
  check('location formatted "12.2 F35-36"', got.location === '12.2 F35-36', got.location);
  check('letter stored upper-case', got.letter === 'F');
  expect('read booth of other company', await api('GET', `/booths/${b1}`, { token: B }), 403);
  expect('edit booth of other company', await api('PUT', `/booths/${b1}`, { token: B, body: { comment: 'x' } }), 403);
  expect('move booth onto its neighbour', await api('PUT', `/booths/${b1}`, { token: A, body: { num_start: 37, num_end: 37 } }), 409);
  expect('partial update keeps location', await api('PUT', `/booths/${b1}`, { token: A, body: { comment: 'Prix intéressants' } }), 200);

  // "To visit" list and filters (BF08)
  const toVisit = expect('to-visit list', await api('GET', '/booths?to_visit=1', { token: A }), 200).body.data;
  check('to-visit list has only b1', toVisit.length === 1 && toVisit[0].id === b1);
  const byCat = (await api('GET', `/booths?category_id=${root}`, { token: A })).body.data;
  check('category filter includes sub-categories', byCat.length === 1 && byCat[0].id === b1);
  const byHall = (await api('GET', '/booths?phase=2&hall=12', { token: A })).body.data;
  check('phase+hall filter, own company only', byHall.length === 2);
  expect('invalid filter', await api('GET', '/booths?hall=abc', { token: A }), 400);

  // Visits (BF09)
  expect('visit with unknown status', await api('POST', `/booths/${b1}/visits`, { token: A, body: { status: 'fini' } }), 400);
  expect('visit with bad date', await api('POST', `/booths/${b1}/visits`, { token: A, body: { status: 'prevu', visited_at: '2026-02-30 10:00' } }), 400);
  expect('visit on other company booth', await api('POST', `/booths/${b1}/visits`, { token: B, body: { status: 'visite' } }), 403);
  const planned = expect('plan a visit', await api('POST', `/booths/${b1}/visits`, {
    token: A, body: { status: 'prevu', visited_at: '2026-10-16T10:30', user_id: ctx.users.buyerB },
  }), 200).body.data.id;
  let booth = (await api('GET', `/booths/${b1}`, { token: A })).body.data;
  check('planned visit: author from token, time kept', booth.visits[0]?.user_id === ctx.users.buyerA && booth.visits[0]?.visited_at === '2026-10-16 10:30:00', JSON.stringify(booth.visits[0]));
  check('planned visit keeps booth to visit', booth.to_visit === 1);

  // A second buyer of the same company: same tenant, but not the author.
  await api('POST', '/users', { token: tokens.adminA, body: { name: `${PREFIX} buyer A2`, username: `${PREFIX}_buyerA2`, password: ctx.password } });
  const buyerA2 = await login(`${PREFIX}_buyerA2`, ctx.password);
  expect('other buyer of the company reads the booth', await api('GET', `/booths/${b1}`, { token: buyerA2 }), 200);
  expect('other buyer of the company edits the visit', await api('PUT', `/booths/${b1}/visits/${planned}`, { token: buyerA2, body: { comment: 'x' } }), 403);
  expect('other buyer of the company deletes the visit', await api('DELETE', `/booths/${b1}/visits/${planned}`, { token: buyerA2 }), 403);
  expect('mark visit as done', await api('PUT', `/booths/${b1}/visits/${planned}`, { token: A, body: { status: 'visite' } }), 200);
  booth = (await api('GET', `/booths/${b1}`, { token: A })).body.data;
  check('done visit takes booth off the to-visit list (D14)', booth.to_visit === 0 && booth.last_status === 'visite');
  expect('visit without date is dated now', await api('POST', `/booths/${b2}/visits`, { token: A, body: { status: 'visite' } }), 200);
  booth = (await api('GET', `/booths/${b2}`, { token: A })).body.data;
  check('dated visit', /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(booth.visits[0]?.visited_at || ''), booth.visits[0]?.visited_at);
  expect('company admin edits a buyer visit', await api('PUT', `/booths/${b1}/visits/${planned}`, { token: tokens.adminA, body: { comment: 'Relu' } }), 200);

  const journal = expect('visit log', await api('GET', '/booths/visits', { token: A }), 200).body.data;
  check('visit log has both visits with location', journal.length === 2 && journal.every((v) => v.location));
  const journalB = (await api('GET', '/booths/visits', { token: B })).body.data;
  check('company B sees no A visit', journalB.length === 0);

  expect('delete booth of other company', await api('DELETE', `/booths/${b2}`, { token: B }), 403);
  expect('delete booth with its visits', await api('DELETE', `/booths/${b2}`, { token: A }), 200);
  expect('delete supplier that has booths', await api('DELETE', `/suppliers/${sA}`, { token: A }), 409);
  expect('delete category used by a booth', await api('DELETE', `/categories/${l1}`, { token: superToken }), 409);

  ctx.booths = { A: b1 };
  ctx.categories = { root, l1 };
  ctx.suppliers = { ...(ctx.suppliers || {}), boothA: sA, B: sB };
};
