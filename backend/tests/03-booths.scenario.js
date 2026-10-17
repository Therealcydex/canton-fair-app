// BF07-BF09: booths (the CHECK rules of schema v2, the unique booth code), the "to visit" list
// and the visited flag. Halls 126-127 keep the test booths away from real ones.
const { api, expect, check, PREFIX } = require('./lib');

module.exports = async (ctx) => {
  const { tokens } = ctx;
  const A = tokens.buyerA;
  const B = tokens.buyerB;
  const supplier = (await api('POST', '/suppliers', { token: A, body: { name: `${PREFIX} Booth supplier` } })).body.data.id;
  const phase2 = (await api('GET', '/lists/canton-categories?phase=2', { token: A })).body.data[0];
  const phase3 = (await api('GET', '/lists/canton-categories?phase=3', { token: A })).body.data[0];
  const base = { phase: 2, hall: 126, floor: 1, letter: 'f', num_start: 10, num_end: 12, supplier_id: supplier, comment: `${PREFIX} stand` };

  expect('no token', await api('GET', '/booths'), 401);
  expect('phase 4', await api('POST', '/booths', { token: A, body: { ...base, phase: 4 } }), 400);
  expect('phase missing', await api('POST', '/booths', { token: A, body: { ...base, phase: undefined } }), 400);
  expect('floor 5', await api('POST', '/booths', { token: A, body: { ...base, floor: 5 } }), 400);
  expect('letter is a digit', await api('POST', '/booths', { token: A, body: { ...base, letter: '1' } }), 400);
  expect('two letters', await api('POST', '/booths', { token: A, body: { ...base, letter: 'AB' } }), 400);
  expect('hall missing', await api('POST', '/booths', { token: A, body: { ...base, hall: '' } }), 400);
  expect('hall 128 (TINYINT)', await api('POST', '/booths', { token: A, body: { ...base, hall: 128 } }), 400);
  expect('end before start', await api('POST', '/booths', { token: A, body: { ...base, num_end: 9 } }), 400);
  expect('unknown supplier', await api('POST', '/booths', { token: A, body: { ...base, supplier_id: 999999 } }), 400);
  expect('unknown category', await api('POST', '/booths', { token: A, body: { ...base, category_id: 999999 } }), 400);
  expect('phase 3 category on a phase 2 booth', await api('POST', '/booths', { token: A, body: { ...base, category_id: phase3.id } }), 400);

  // D32: the letter and the number go together
  expect('letter without number', await api('POST', '/booths', { token: A, body: { ...base, num_start: null, num_end: null } }), 400);
  expect('number without letter', await api('POST', '/booths', { token: A, body: { ...base, letter: '' } }), 400);
  expect('end number alone', await api('POST', '/booths', { token: A, body: { ...base, letter: null, num_start: null } }), 400);

  const b1 = expect('create booth (letter in lowercase)', await api('POST', '/booths', { token: A, body: { ...base, category_id: phase2.id } }), 200);
  check('booth code is built in uppercase, fair style', b1.body.data.booth_code === '126.1F10-12' && b1.body.data.phase === 2);
  const got = expect('another user reads it', await api('GET', `/booths/${b1.body.data.id}`, { token: B }), 200);
  check('v_booths gives code, category and supplier',
    got.body.data.booth_code === '126.1F10-12' && got.body.data.sub_category === phase2.sub_category
    && got.body.data.supplier_name === `${PREFIX} Booth supplier` && got.body.data.visited === 0);

  expect('same code', await api('POST', '/booths', { token: B, body: { ...base, letter: 'F' } }), 409);
  const ov = expect('overlapping number', await api('POST', '/booths', { token: A, body: { ...base, num_start: 12, num_end: null } }), 409);
  check('the refusal names the booth phase first', ov.body.message.includes('Ph2 126.1F10-12'));
  expect('overlapping range', await api('POST', '/booths', { token: A, body: { ...base, num_start: 8, num_end: 10 } }), 409);
  const b2 = expect('next booth (end = start is a single booth)', await api('POST', '/booths', { token: A, body: { ...base, num_start: 13, num_end: 13 } }), 200);
  check('single booth code has no range', b2.body.data.booth_code === '126.1F13');
  const b3 = expect('booth without supplier', await api('POST', '/booths', { token: B, body: { ...base, hall: 127, supplier_id: null } }), 200);
  // D32: the phase is not in the code, and the same stand holds another supplier at the next phase
  const other = expect('same stand, phase 3', await api('POST', '/booths', { token: A, body: { ...base, phase: 3, supplier_id: null } }), 200);
  check('phase 3 booth has the same code', other.body.data.booth_code === '126.1F10-12');

  // D41: Phase 1 sections (added from the 140th fair's list) are chosen like the others.
  const phase1 = (await api('GET', '/lists/canton-categories?phase=1', { token: A })).body.data;
  check('the 20 Phase 1 sections are listed', phase1.length === 20 && phase1.some((c) => c.section === 'Lighting Equipment'));
  expect('phase 1 category on a phase 2 booth', await api('POST', '/booths', { token: A, body: { ...base, category_id: phase1[0].id } }), 400);
  expect('phase 1 booth with a phase 1 category', await api('POST', '/booths', {
    token: A, body: { ...base, phase: 1, supplier_id: null, category_id: phase1[0].id },
  }), 200);
  // D32: only the hall and floor known ("9.1"); several suppliers can share that
  const hallOnly = { ...base, hall: 127, floor: 2, letter: null, num_start: null, num_end: null, supplier_id: null };
  const h1 = expect('booth with hall and floor only', await api('POST', '/booths', { token: A, body: hallOnly }), 200);
  check('hall-only code', h1.body.data.booth_code === '127.2');
  expect('a second hall-only booth there', await api('POST', '/booths', { token: B, body: hallOnly }), 200);
  const h1got = await api('GET', `/booths/${h1.body.data.id}`, { token: A });
  check('v_booths gives the hall-only code', h1got.body.data.booth_code === '127.2' && h1got.body.data.letter === null);

  // The "to visit" list (BF08) and the visited flag (BF09)
  const toVisit = expect('to visit list, filtered by hall', await api('GET', '/booths?visited=0&phase=2&hall=126', { token: A }), 200);
  check('both booths of hall 126 are to visit', [b1, b2].every((b) => toVisit.body.data.some((x) => x.id === b.body.data.id)));
  expect('invalid visited filter', await api('GET', '/booths?visited=2', { token: A }), 400);
  expect('invalid hall filter', await api('GET', '/booths?hall=x', { token: A }), 400);
  expect('visited without value', await api('PATCH', `/booths/${b1.body.data.id}/visited`, { token: A, body: {} }), 400);
  expect('mark visited', await api('PATCH', `/booths/${b1.body.data.id}/visited`, { token: B, body: { visited: true } }), 200);
  const after = await api('GET', '/booths?visited=0&hall=126', { token: A });
  check('visited booth left the list', !after.body.data.some((x) => x.id === b1.body.data.id));
  const s = await api('GET', `/suppliers/${supplier}`, { token: A });
  check('supplier shows 2 booths, 50 % visited', s.body.data.nbr_booths === 2 && Number(s.body.data.booth_visit_pct) === 50);
  const q = expect('search by code', await api('GET', `/booths?q=${encodeURIComponent('126.1f13')}`, { token: A }), 200);
  check('search finds the booth', q.body.data.length === 1 && q.body.data[0].id === b2.body.data.id);
  // D53: the apps show "Ph2 126.1F13"; the search takes it, and the messages say it.
  const qph = expect('search by phase label', await api('GET', `/booths?q=${encodeURIComponent('ph2 126.1f13')}`, { token: A }), 200);
  check('phase label search finds the booth', qph.body.data.length === 1 && qph.body.data[0].id === b2.body.data.id);
  const qph3 = await api('GET', `/booths?q=${encodeURIComponent('Ph3 126.1F13')}`, { token: A });
  check('another phase finds nothing', qph3.body.data.length === 0);

  // Update and delete
  expect('move onto another booth', await api('PUT', `/booths/${b2.body.data.id}`, { token: A, body: { num_start: 11 } }), 409);
  expect('update keeps the rules', await api('PUT', `/booths/${b2.body.data.id}`, { token: A, body: { floor: 9 } }), 400);
  const moved = expect('move to floor 2', await api('PUT', `/booths/${b2.body.data.id}`, { token: A, body: { floor: 2 } }), 200);
  check('code follows the move', moved.body.data.booth_code === '126.2F13');
  expect('clear only the letter', await api('PUT', `/booths/${b2.body.data.id}`, { token: A, body: { letter: null } }), 400);
  const cleared = expect('clear letter and number', await api('PUT', `/booths/${b2.body.data.id}`, { token: A, body: { letter: null, num_start: null } }), 200);
  check('code falls back to hall.floor', cleared.body.data.booth_code === '126.2');

  // D50: numbers on 2 digits (10.3A08-23), the zone from the hall, and a search typed without the 0.
  const padded = expect('booth with 1-digit numbers', await api('POST', '/booths', {
    token: A, body: { phase: 2, hall: 21, floor: 4, letter: 'z', num_start: 8, num_end: 9, comment: `${PREFIX} padded` },
  }), 200);
  check('numbers padded to 2 digits', padded.body.data.booth_code === '21.4Z08-09');
  const paddedGot = (await api('GET', `/booths/${padded.body.data.id}`, { token: A })).body.data;
  check('zone D for hall 21', paddedGot.zone === 'D');
  const found = expect('search typed without the 0', await api('GET', '/booths?q=21.4Z8', { token: A }), 200);
  check('search finds 21.4Z08-09', found.body.data.some((b) => b.id === padded.body.data.id));
  expect('unknown booth', await api('GET', '/booths/999999', { token: A }), 404);
  expect('delete booth', await api('DELETE', `/booths/${b3.body.data.id}`, { token: A }), 200);
  expect('delete it again', await api('DELETE', `/booths/${b3.body.data.id}`, { token: A }), 404);

  // Deleting the supplier leaves its booths without a supplier (schema v2: ON DELETE SET NULL).
  expect('delete supplier with booths', await api('DELETE', `/suppliers/${supplier}`, { token: A }), 200);
  const orphan = await api('GET', `/booths/${b1.body.data.id}`, { token: A });
  check('booth stays, without supplier', orphan.status === 200 && orphan.body.data.supplier_id === null);
};
