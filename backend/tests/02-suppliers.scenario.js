// BF04-BF05: suppliers (province from the list, rating) and their contacts. Reference lists.
const fs = require('fs');
const path = require('path');
const { api, expect, check, PREFIX, BASE } = require('./lib');
const { UPLOAD_ROOT } = require('../utils/upload');

// Smallest valid PNG (1x1 pixel).
const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082',
  'hex'
);

const form = (files) => {
  const f = new FormData();
  for (const [name, buffer, type] of files) f.append('images', new Blob([buffer], { type }), name);
  return f;
};

const fileOf = (url) => path.join(UPLOAD_ROOT, url.replace(/^\/uploads\//, ''));

module.exports = async (ctx) => {
  const { tokens } = ctx;
  const A = tokens.buyerA;
  const B = tokens.buyerB;

  // Reference lists
  expect('lists need a token', await api('GET', '/lists/provinces'), 401);
  const provinces = expect('province list', await api('GET', '/lists/provinces', { token: A }), 200);
  check('23 provinces', provinces.body.data.length === 23);
  const guangdong = provinces.body.data.find((p) => p.name_en === 'Guangdong');
  check('Chinese names are intact', guangdong?.name_zh === '广东');
  const ships = expect('shipping types', await api('GET', '/lists/shipping-types', { token: A }), 200);
  check('11 Incoterms', ships.body.data.length === 11 && ships.body.data.some((s) => s.code === 'FOB'));
  const cats = expect('Canton categories of phase 2', await api('GET', '/lists/canton-categories?phase=2', { token: A }), 200);
  check('only phase 2 rows', cats.body.data.length > 0 && cats.body.data.every((c) => c.phase.startsWith('Phase 2 ')));

  // Suppliers (BF04)
  expect('no token', await api('GET', '/suppliers'), 401);
  expect('supplier without name', await api('POST', '/suppliers', { token: A, body: { phone: '1' } }), 400);
  expect('rating 6', await api('POST', '/suppliers', { token: A, body: { name: `${PREFIX} S`, rating: 6 } }), 400);
  expect('rating 0', await api('POST', '/suppliers', { token: A, body: { name: `${PREFIX} S`, rating: 0 } }), 400);
  expect('invalid e-mail', await api('POST', '/suppliers', { token: A, body: { name: `${PREFIX} S`, email: 'pas-un-mail' } }), 400);
  expect('unknown province', await api('POST', '/suppliers', { token: A, body: { name: `${PREFIX} S`, province_id: 99999 } }), 400);
  expect('name over 200 characters', await api('POST', '/suppliers', { token: A, body: { name: `${PREFIX} ${'x'.repeat(200)}` } }), 400);
  const s = expect('create supplier', await api('POST', '/suppliers', {
    token: A, body: { name: `${PREFIX} Shenzhen 100%_Lighting`, province_id: guangdong.id, rating: 4, email: 'a@b.cn' },
  }), 200);
  const id = s.body.data.id;

  const got = expect('another user of the group reads it', await api('GET', `/suppliers/${id}`, { token: B }), 200);
  check('province name and booth stats from v_suppliers',
    got.body.data.province === 'Guangdong' && got.body.data.nbr_booths === 0 && got.body.data.booth_visit_pct === null);
  const search = expect('search with LIKE wildcards', await api('GET', `/suppliers?q=${encodeURIComponent('100%_')}`, { token: A }), 200);
  check('wildcards matched literally', search.body.data.length === 1 && search.body.data[0].id === id);
  const byProvince = expect('filter by province', await api('GET', `/suppliers?province_id=${guangdong.id}`, { token: A }), 200);
  check('filter keeps the supplier', byProvince.body.data.some((x) => x.id === id));
  expect('invalid province filter', await api('GET', '/suppliers?province_id=abc', { token: A }), 400);

  expect('partial update keeps the rules', await api('PUT', `/suppliers/${id}`, { token: B, body: { rating: 9 } }), 400);
  expect('update supplier', await api('PUT', `/suppliers/${id}`, { token: B, body: { rating: 5, province_id: null } }), 200);
  const updated = await api('GET', `/suppliers/${id}`, { token: A });
  check('update kept the name and cleared the province',
    updated.body.data.name === `${PREFIX} Shenzhen 100%_Lighting` && updated.body.data.province_id === null && updated.body.data.rating === 5);
  expect('unknown supplier', await api('GET', '/suppliers/999999', { token: A }), 404);
  expect('invalid id', await api('GET', '/suppliers/abc', { token: A }), 400);

  // Contacts (BF05)
  expect('empty contact', await api('POST', `/suppliers/${id}/contacts`, { token: A, body: {} }), 400);
  expect('contact with invalid e-mail', await api('POST', `/suppliers/${id}/contacts`, { token: A, body: { name: 'Li', email: 'x' } }), 400);
  expect('contact of unknown supplier', await api('POST', '/suppliers/999999/contacts', { token: A, body: { name: 'Li' } }), 404);
  const c = expect('create contact (a WeChat text in the body is ignored)', await api('POST', `/suppliers/${id}/contacts`, { token: A, body: { name: 'Mr Li', wechat_qr: 'li_wechat' } }), 200);
  const phoneOnly = expect('contact with only a phone', await api('POST', `/suppliers/${id}/contacts`, { token: A, body: { phone: '+86 1' } }), 200);
  expect('update contact', await api('PUT', `/suppliers/${id}/contacts/${c.body.data.id}`, { token: B, body: { phone: '+86 2' } }), 200);
  expect('contact of another supplier', await api('PUT', `/suppliers/${id + 100000}/contacts/${c.body.data.id}`, { token: A, body: { name: 'X' } }), 404);
  const list = expect('list contacts', await api('GET', `/suppliers/${id}/contacts`, { token: A }), 200);
  check('two contacts', list.body.data.length === 2);
  check('no WeChat QR code from the body', list.body.data.every((x) => x.wechat_qr === null));

  // WeChat QR code of a contact (D33): a photo, uploaded like the product photos.
  const qrUrl = `/suppliers/${id}/contacts/${c.body.data.id}/wechat-qr`;
  expect('QR code without a token', await api('POST', qrUrl, { form: form([['qr.png', PNG, 'image/png']]) }), 401);
  expect('QR code without a photo', await api('POST', qrUrl, { token: A, form: new FormData() }), 400);
  expect('QR code: two photos', await api('POST', qrUrl, { token: A, form: form([['a.png', PNG, 'image/png'], ['b.png', PNG, 'image/png']]) }), 400);
  expect('QR code: a text file named .png', await api('POST', qrUrl, { token: A, form: form([['qr.png', Buffer.from('hello'), 'image/png']]) }), 400);
  expect('QR code of an unknown contact', await api('POST', `/suppliers/${id}/contacts/999999/wechat-qr`, { token: A, form: form([['qr.png', PNG, 'image/png']]) }), 404);
  const qr1 = expect('add the QR code', await api('POST', qrUrl, { token: B, form: form([['qr.png', PNG, 'image/png']]) }), 200);
  const url1 = qr1.body.data?.wechat_qr;
  check('QR photo stored under /uploads/wechat/', /^\/uploads\/wechat\/[0-9a-f]{32}\.png$/.test(url1 || '') && fs.existsSync(fileOf(url1)));
  check('QR photo is served', (await fetch(BASE.replace(/\/api$/, '') + url1)).status === 200);
  const shown = await api('GET', `/suppliers/${id}`, { token: A });
  check('supplier detail shows the QR code', shown.body.data.contacts.some((x) => x.wechat_qr === url1));
  const qr2 = expect('replace the QR code', await api('POST', qrUrl, { token: A, form: form([['qr2.png', PNG, 'image/png']]) }), 200);
  check('the old QR file is deleted', !fs.existsSync(fileOf(url1)) && fs.existsSync(fileOf(qr2.body.data.wechat_qr)));
  expect('update keeps the QR code', await api('PUT', `/suppliers/${id}/contacts/${c.body.data.id}`, { token: A, body: { name: 'Mr Li Wei' } }), 200);
  check('QR code still there', (await api('GET', `/suppliers/${id}/contacts`, { token: A })).body.data.some((x) => x.wechat_qr === qr2.body.data.wechat_qr));
  // D34: the content read by a QR scanner replaces the photo.
  const wechatLink = 'https://u.wechat.com/TEST-scan';
  expect('scanned content without a token', await api('PUT', qrUrl, { body: { content: wechatLink } }), 401);
  expect('empty scanned content', await api('PUT', qrUrl, { token: A, body: { content: '  ' } }), 400);
  expect('scanned content missing', await api('PUT', qrUrl, { token: A, body: {} }), 400);
  expect('scanned content over 255 characters', await api('PUT', qrUrl, { token: A, body: { content: `https://u.wechat.com/${'x'.repeat(250)}` } }), 400);
  expect('scanned content with a control character', await api('PUT', qrUrl, { token: A, body: { content: 'https://a\u0007b' } }), 400);
  expect('scanned content looking like a photo path', await api('PUT', qrUrl, { token: A, body: { content: '/uploads/wechat/x.png' } }), 400);
  expect('scanned content for an unknown contact', await api('PUT', `/suppliers/${id}/contacts/999999/wechat-qr`, { token: A, body: { content: wechatLink } }), 404);
  const scanned = expect('save the scanned content', await api('PUT', qrUrl, { token: B, body: { content: ` ${wechatLink} ` } }), 200);
  check('content stored trimmed', scanned.body.data?.wechat_qr === wechatLink);
  check('the photo it replaces is deleted', !fs.existsSync(fileOf(qr2.body.data.wechat_qr)));
  const withLink = await api('GET', `/contacts?supplier_id=${id}&has_qr=1`, { token: A });
  check('a scanned link counts as a QR code', withLink.body.data.some((x) => x.id === c.body.data.id));
  const linkCsv = await (await fetch(`${BASE}/contacts/export?supplier_id=${id}`, { headers: { Authorization: `Bearer ${A}` } })).text();
  check('the CSV has the scanned link', linkCsv.includes(`"${wechatLink}"`));

  expect('remove the QR code', await api('DELETE', qrUrl, { token: A }), 200);
  check('scanned content removed', (await api('GET', `/suppliers/${id}/contacts`, { token: A })).body.data.some((x) => x.id === c.body.data.id && x.wechat_qr === null));
  expect('remove it again', await api('DELETE', qrUrl, { token: A }), 404);

  // A contact known only by its QR code keeps it.
  const onlyQr = `/suppliers/${id}/contacts/${phoneOnly.body.data.id}`;
  const qr3 = (await api('POST', `${onlyQr}/wechat-qr`, { token: A, form: form([['qr.png', PNG, 'image/png']]) })).body.data.wechat_qr;
  expect('clear the phone of a contact that has a QR code', await api('PUT', onlyQr, { token: A, body: { phone: null } }), 200);
  expect('remove its only information', await api('DELETE', `${onlyQr}/wechat-qr`, { token: A }), 409);
  expect('delete that contact', await api('DELETE', onlyQr, { token: A }), 200);
  check('its QR file is deleted with it', !fs.existsSync(fileOf(qr3)));

  expect('delete contact', await api('DELETE', `/suppliers/${id}/contacts/${c.body.data.id}`, { token: A }), 200);
  expect('delete it again', await api('DELETE', `/suppliers/${id}/contacts/${c.body.data.id}`, { token: A }), 404);

  // Deleting a supplier deletes its contacts' QR files.
  const s2 = (await api('POST', '/suppliers', { token: A, body: { name: `${PREFIX} QR supplier` } })).body.data.id;
  const c2 = (await api('POST', `/suppliers/${s2}/contacts`, { token: A, body: { name: 'Ms Wang' } })).body.data.id;
  const qr4 = (await api('POST', `/suppliers/${s2}/contacts/${c2}/wechat-qr`, { token: A, form: form([['qr.png', PNG, 'image/png']]) })).body.data.wechat_qr;
  expect('delete a supplier whose contact has a QR code', await api('DELETE', `/suppliers/${s2}`, { token: A }), 200);
  check('the QR file is deleted', !fs.existsSync(fileOf(qr4)));

  // All contacts in one table, and their CSV export (BF17)
  expect('contact list without a token', await api('GET', '/contacts'), 401);
  const sx = (await api('POST', '/suppliers', { token: A, body: { name: `${PREFIX} Contacts table` } })).body.data.id;
  const cWith = (await api('POST', `/suppliers/${sx}/contacts`, { token: A, body: { name: `${PREFIX} Ms "QR"`, email: 'qr@test.cn' } })).body.data.id;
  const cWithout = (await api('POST', `/suppliers/${sx}/contacts`, { token: A, body: { name: '=HYPERLINK("x")', phone: '+86 9' } })).body.data.id;
  await api('POST', `/suppliers/${sx}/contacts/${cWith}/wechat-qr`, { token: A, form: form([['qr.png', PNG, 'image/png']]) });

  const all = expect('contact list', await api('GET', `/contacts?supplier_id=${sx}`, { token: B }), 200);
  check('both contacts, with their supplier', all.body.data.length === 2
    && all.body.data.every((x) => x.supplier_id === sx && x.supplier_name === `${PREFIX} Contacts table`));
  const byText = expect('search by supplier name', await api('GET', `/contacts?q=${encodeURIComponent(`${PREFIX} Contacts tab`)}`, { token: A }), 200);
  check('search finds both', byText.body.data.filter((x) => x.supplier_id === sx).length === 2);
  const byMail = await api('GET', '/contacts?q=qr%40test.cn', { token: A });
  check('search by e-mail', byMail.body.data.length === 1 && byMail.body.data[0].id === cWith);
  const withQr = expect('only contacts with a QR code', await api('GET', `/contacts?supplier_id=${sx}&has_qr=1`, { token: A }), 200);
  check('has_qr=1', withQr.body.data.length === 1 && withQr.body.data[0].id === cWith);
  // A value that is neither a photo nor a link (an older typed WeChat id) is not a QR code.
  await api('PUT', `/suppliers/${sx}/contacts/${cWithout}/wechat-qr`, { token: A, body: { content: 'liwei_bright' } });
  const noQr = expect('only contacts without a QR code', await api('GET', `/contacts?supplier_id=${sx}&has_qr=0`, { token: A }), 200);
  check('has_qr=0', noQr.body.data.length === 1 && noQr.body.data[0].id === cWithout);
  expect('invalid supplier filter', await api('GET', '/contacts?supplier_id=abc', { token: A }), 400);
  expect('invalid has_qr filter', await api('GET', '/contacts?has_qr=2', { token: A }), 400);

  expect('export without a token', await api('GET', '/contacts/export'), 401);
  expect('export with an invalid filter', await api('GET', '/contacts/export?has_qr=x', { token: A }), 400);
  const csv = await fetch(`${BASE}/contacts/export?supplier_id=${sx}`, { headers: { Authorization: `Bearer ${A}` } });
  const bytes = Buffer.from(await csv.arrayBuffer());
  const text = bytes.toString('utf8');
  check('export is a CSV download', csv.status === 200 && /^text\/csv/.test(csv.headers.get('content-type'))
    && /attachment; filename="contacts-\d{4}-\d{2}-\d{2}\.csv"/.test(csv.headers.get('content-disposition')));
  check('export starts with a UTF-8 BOM', bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf);
  const lines = text.replace(/^﻿/, '').split('\r\n').filter(Boolean);
  check('export header', lines[0] === '"N° contact";"N° fournisseur";"Fournisseur";"Nom";"Téléphone";"E-mail";"QR code WeChat"');
  check('export has the 2 contacts', lines.length === 3);
  check('quotes doubled and QR as a full address',
    lines.some((l) => l.includes(`"${PREFIX} Ms ""QR"""`) && /"http:\/\/[^"]+\/uploads\/wechat\/[0-9a-f]{32}\.png"$/.test(l)));
  check('formula neutralised', lines.some((l) => l.includes('"\'=HYPERLINK(""x"")"')));
  check('phone number left as it is', lines.some((l) => l.includes('"+86 9"')));

  ctx.supplierId = id;
};
