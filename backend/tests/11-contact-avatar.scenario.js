// D63: the contact's photo (avatar), a Base64 image checked by the server, kept when an edit
// leaves it out, removed with null, and given back by every contact list.
const { api, expect, check, PREFIX } = require('./lib');

// Smallest valid PNG (1x1 pixel), as the app sends a photo: a data URL.
const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082',
  'hex'
);
const AVATAR = `data:image/png;base64,${PNG.toString('base64')}`;

module.exports = async (ctx) => {
  const A = ctx.tokens.buyerA;
  const supplier = expect('supplier', await api('POST', '/suppliers', { token: A, body: { name: `${PREFIX} Fournisseur avatar` } }), 200).body.data.id;
  const url = `/suppliers/${supplier}/contacts`;

  expect('avatar that is not an image', await api('POST', url, { token: A, body: { name: 'Mr Avatar', avatar: 'bonjour' } }), 400);
  expect('text dressed as a PNG', await api('POST', url, {
    token: A, body: { name: 'Mr Avatar', avatar: `data:image/png;base64,${Buffer.from('hello').toString('base64')}` },
  }), 400);
  expect('avatar too heavy', await api('POST', url, {
    token: A, body: { name: 'Mr Avatar', avatar: `data:image/png;base64,${Buffer.concat([PNG, Buffer.alloc(120 * 1024)]).toString('base64')}` },
  }), 400);
  check('a refused avatar creates no contact', (await api('GET', url, { token: A })).body.data.length === 0);

  const id = expect('contact with an avatar', await api('POST', url, { token: A, body: { name: 'Mr Avatar', phone: '+86 1', avatar: AVATAR } }), 200).body.data.id;
  const all = (await api('GET', `/contacts?supplier_id=${supplier}`, { token: A })).body.data;
  check('the contacts list gives the avatar', all.length === 1 && all[0].avatar === AVATAR);
  check('the supplier page too', (await api('GET', `/suppliers/${supplier}`, { token: A })).body.data.contacts[0].avatar === AVATAR);

  expect('edit without avatar', await api('PUT', `${url}/${id}`, { token: A, body: { name: 'Mr Avatar Bis' } }), 200);
  const kept = (await api('GET', url, { token: A })).body.data[0];
  check('the avatar is kept', kept.name === 'Mr Avatar Bis' && kept.avatar === AVATAR);
  expect('edit with a bad avatar', await api('PUT', `${url}/${id}`, { token: A, body: { avatar: 'data:image/gif;base64,R0lGOD' } }), 400);
  expect('remove the avatar', await api('PUT', `${url}/${id}`, { token: A, body: { avatar: null } }), 200);
  check('avatar removed', (await api('GET', url, { token: A })).body.data[0].avatar === null);

  const csv = await fetch(`${require('./lib').BASE}/contacts/export?supplier_id=${supplier}`, { headers: { Authorization: `Bearer ${A}` } });
  check('the CSV export leaves the avatar out', !(await csv.text()).includes('base64'));
  expect('delete supplier', await api('DELETE', `/suppliers/${supplier}`, { token: A }), 200);
};
