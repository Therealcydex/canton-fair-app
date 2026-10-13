// BF04-BF05: suppliers and contacts, scoped to the caller's company.
const { api, expect, check, PREFIX } = require('./lib');

module.exports = async (ctx) => {
  const { tokens, companies } = ctx;
  const A = tokens.buyerA;
  const B = tokens.buyerB;

  expect('list without token', await api('GET', '/suppliers'), 401);
  expect('supplier without name', await api('POST', '/suppliers', { token: A, body: { phone: '123' } }), 400);
  expect('supplier with bad email', await api('POST', '/suppliers', { token: A, body: { name: 'X', email: 'pas-un-mail' } }), 400);
  expect('supplier with rating 6', await api('POST', '/suppliers', { token: A, body: { name: 'X', rating: 6 } }), 400);
  expect('supplier with rating 2.5', await api('POST', '/suppliers', { token: A, body: { name: 'X', rating: 2.5 } }), 400);
  expect('supplier name too long', await api('POST', '/suppliers', { token: A, body: { name: 'x'.repeat(151) } }), 400);

  const s = expect('create supplier (company_id in body ignored)', await api('POST', '/suppliers', {
    token: A,
    body: { name: `${PREFIX} Shenzhen Lighting`, province: 'Guangdong', rating: 4, email: 'sales@example.cn', company_id: companies.B },
  }), 200);
  const sid = s.body.data.id;
  await api('POST', '/suppliers', { token: A, body: { name: `${PREFIX} Yiwu 50% Toys`, province: 'Zhejiang' } });
  await api('POST', '/suppliers', { token: B, body: { name: `${PREFIX} B only`, province: 'Fujian' } });

  const listA = expect('list own suppliers', await api('GET', '/suppliers', { token: A }), 200);
  check('company A sees only its suppliers', listA.body.data.length === 2 && listA.body.data.every((x) => x.name.startsWith(PREFIX) && x.name !== `${PREFIX} B only`));
  const listB = await api('GET', '/suppliers', { token: B });
  check('company B does not see A suppliers', listB.body.data.length === 1);
  const q = await api('GET', `/suppliers?q=${encodeURIComponent('50%')}`, { token: A });
  check('search treats % literally', q.body.data.length === 1 && q.body.data[0].name.includes('50%'));
  const p = await api('GET', '/suppliers?province=Guangdong', { token: A });
  check('filter by province', p.body.data.length === 1 && p.body.data[0].id === sid);
  const prov = expect('provinces list', await api('GET', '/suppliers/provinces', { token: A }), 200);
  check('provinces are the company\'s only', JSON.stringify(prov.body.data) === JSON.stringify(['Guangdong', 'Zhejiang']));

  expect('read supplier of other company', await api('GET', `/suppliers/${sid}`, { token: B }), 403);
  expect('edit supplier of other company', await api('PUT', `/suppliers/${sid}`, { token: B, body: { name: 'pirate' } }), 403);
  expect('delete supplier of other company', await api('DELETE', `/suppliers/${sid}`, { token: B }), 403);
  expect('read unknown supplier', await api('GET', '/suppliers/999999', { token: A }), 404);
  expect('invalid id', await api('GET', '/suppliers/abc', { token: A }), 400);

  expect('partial update keeps other fields', await api('PUT', `/suppliers/${sid}`, { token: A, body: { rating: 5 } }), 200);
  const got = await api('GET', `/suppliers/${sid}`, { token: A });
  check('rating updated, name kept', got.body.data.rating === 5 && got.body.data.name === `${PREFIX} Shenzhen Lighting`);
  check('no company_id leaked', !('company_id' in got.body.data) && !('owner_company_id' in got.body.data));
  expect('clearing the name is refused', await api('PUT', `/suppliers/${sid}`, { token: A, body: { name: '' } }), 400);

  // Contacts (BF05)
  expect('contact without name', await api('POST', `/suppliers/${sid}/contacts`, { token: A, body: { phone: '1' } }), 400);
  expect('contact on other company supplier', await api('POST', `/suppliers/${sid}/contacts`, { token: B, body: { name: 'X' } }), 403);
  const c = expect('create contact', await api('POST', `/suppliers/${sid}/contacts`, {
    token: A, body: { name: 'Mr Li', phone: '+86 138 0000 0000', wechat_qr: 'wxid_li' },
  }), 200);
  const cid = c.body.data.id;
  const other = await api('POST', '/suppliers', { token: A, body: { name: `${PREFIX} Other` } });
  expect('contact through the wrong supplier', await api('PUT', `/suppliers/${other.body.data.id}/contacts/${cid}`, { token: A, body: { name: 'X' } }), 404);
  expect('edit contact', await api('PUT', `/suppliers/${sid}/contacts/${cid}`, { token: A, body: { email: 'li@example.cn' } }), 200);
  const contacts = expect('list contacts', await api('GET', `/suppliers/${sid}/contacts`, { token: A }), 200);
  check('contact edited', contacts.body.data[0]?.email === 'li@example.cn' && contacts.body.data[0]?.name === 'Mr Li');
  expect('list contacts of other company', await api('GET', `/suppliers/${sid}/contacts`, { token: B }), 403);
  expect('delete contact of other company', await api('DELETE', `/suppliers/${sid}/contacts/${cid}`, { token: B }), 403);
  expect('delete contact', await api('DELETE', `/suppliers/${sid}/contacts/${cid}`, { token: A }), 200);

  // Delete: contacts go with the supplier (D8)
  await api('POST', `/suppliers/${other.body.data.id}/contacts`, { token: A, body: { name: 'Temp' } });
  expect('delete supplier with contacts only', await api('DELETE', `/suppliers/${other.body.data.id}`, { token: A }), 200);

  ctx.suppliers = { A: sid };
};
