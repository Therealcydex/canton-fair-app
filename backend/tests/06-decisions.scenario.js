// D38: the product decision and the evening review. Only the admin (the boss) decides; every
// user sees the decision; editing a product keeps it.
const { api, expect, check, PREFIX } = require('./lib');

module.exports = async (ctx) => {
  const { tokens, adminToken: admin } = ctx;
  const A = tokens.buyerA;
  const B = tokens.buyerB;

  const created = expect('buyer A records a product', await api('POST', '/products', {
    token: A, body: { name: `${PREFIX} Lampe solaire`, price: '3.20', moq: 1000 },
  }), 200);
  const id = created.body.data.id;
  const fresh = (await api('GET', `/products/${id}`, { token: B })).body.data;
  check('a new product waits for a decision, with its buyer and date',
    fresh.status === 'A_ETUDIER' && fresh.created_by_name === `${PREFIX} buyer A`
    && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(fresh.created_at) && fresh.decided_at === null);

  // The review queue
  expect('review without token', await api('GET', '/products/review'), 401);
  const review = expect('review (a buyer may read it)', await api('GET', '/products/review', { token: B }), 200);
  check('the product is in the queue, with the counts',
    review.body.data.pending.some((p) => p.id === id) && review.body.data.counts.A_ETUDIER >= 1
    && Object.keys(review.body.data.counts).length === 5);

  // Refused decisions
  expect('decision without token', await api('PUT', `/products/${id}/decision`, { body: { status: 'RETENU' } }), 401);
  expect('a buyer cannot decide', await api('PUT', `/products/${id}/decision`, { token: A, body: { status: 'RETENU' } }), 403);
  expect('decision without status', await api('PUT', `/products/${id}/decision`, { token: admin, body: {} }), 400);
  expect('unknown status', await api('PUT', `/products/${id}/decision`, { token: admin, body: { status: 'PEUT_ETRE' } }), 400);
  expect('note too long', await api('PUT', `/products/${id}/decision`, { token: admin, body: { status: 'RETENU', note: 'x'.repeat(501) } }), 400);
  expect('unknown product', await api('PUT', '/products/999999/decision', { token: admin, body: { status: 'RETENU' } }), 404);
  expect('invalid product id', await api('PUT', '/products/abc/decision', { token: admin, body: { status: 'RETENU' } }), 400);
  check('a refused decision changes nothing', (await api('GET', `/products/${id}`, { token: A })).body.data.status === 'A_ETUDIER');

  // The admin decides
  const kept = expect('admin keeps it, with a note', await api('PUT', `/products/${id}/decision`, {
    token: admin, body: { status: 'RETENU', note: '  Négocier à 2,90  ' },
  }), 200);
  const k = kept.body.data;
  check('decision, trimmed note, who and when',
    k.status === 'RETENU' && k.decision_note === 'Négocier à 2,90' && !!k.decided_by_name && !!k.decided_at);
  const after = (await api('GET', '/products/review', { token: admin })).body.data;
  check('it left the queue', !after.pending.some((p) => p.id === id) && after.counts.RETENU >= 1);

  expect('a buyer edits the product', await api('PUT', `/products/${id}`, { token: A, body: { price: '3.10' } }), 200);
  check('editing keeps the decision', (await api('GET', `/products/${id}`, { token: B })).body.data.status === 'RETENU');

  const byStatus = expect('filter by status (any case)', await api('GET', '/products?status=retenu', { token: B }), 200);
  check('filter finds it, and only kept products', byStatus.body.data.some((p) => p.id === id)
    && byStatus.body.data.every((p) => p.status === 'RETENU'));
  expect('invalid status filter', await api('GET', '/products?status=x', { token: B }), 400);

  expect('admin rejects it without a note', await api('PUT', `/products/${id}/decision`, { token: admin, body: { status: 'REJETE' } }), 200);
  check('the old note is gone', (await api('GET', `/products/${id}`, { token: A })).body.data.decision_note === null);

  expect('admin sends it back to the queue', await api('PUT', `/products/${id}/decision`, { token: admin, body: { status: 'A_ETUDIER', note: 'ignorée' } }), 200);
  const back = (await api('GET', `/products/${id}`, { token: A })).body.data;
  check('undo clears the decision', back.status === 'A_ETUDIER' && back.decision_note === null && back.decided_by === null && back.decided_at === null);

  expect('delete product', await api('DELETE', `/products/${id}`, { token: A }), 200);
};
