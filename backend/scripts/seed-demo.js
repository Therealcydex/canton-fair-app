// Loads demonstration data through the API (so every rule applies): Tarek's companies (demo
// names), two buyers and a pending sign-up, suppliers with contacts, booths, products with photos and shares.
// Usage (from backend/, the backend running): npm run db:demo [-- http://localhost:3000/api]
// Logs in as the admin of .env. Stops if the demo data is already there.
const path = require('path');
const zlib = require('zlib');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const BASE = process.argv[2] || `http://localhost:${process.env.PORT || 3000}/api`;
const DEMO_PASSWORD = 'demo-sourcing-2026';
const COMPANY = 'Groupe démo';
const COMPANY_B = 'Société B (démo)';

async function call(method, url, token, body) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload = body;
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(BASE + url, { method, headers, body: payload });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status} ${json.message || ''}`);
  return json;
}

const login = async (username, password) => (await call('POST', '/login', null, { username, password })).token;

// A plain-colour PNG, so the photos are visible without shipping image files.
function colourPng(width, height, [r, g, b]) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const x of buf) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array(width).fill([r, g, b]).flat())]);
  const raw = Buffer.concat(Array(height).fill(row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

async function addPhoto(token, productId, colour) {
  const form = new FormData();
  form.append('images', new Blob([colourPng(320, 320, colour)], { type: 'image/png' }), 'photo.png');
  await call('POST', `/products/${productId}/images`, token, form);
}

async function main() {
  const admin = await login(process.env.SEED_ADMIN_USERNAME, process.env.SEED_ADMIN_PASSWORD);
  let companies = (await call('GET', '/companies', admin)).data;
  if (companies.some((c) => c.name === COMPANY)) {
    console.log(`Demo data already loaded ("${COMPANY}" exists): nothing done.`);
    return;
  }

  // Tarek's companies (demo names), one with two branches.
  for (const c of [
    { name: COMPANY, branch: 'Tunis' },
    { name: COMPANY, branch: 'Sfax' },
    { name: COMPANY_B, branch: null },
  ]) await call('POST', '/companies', admin, c);
  companies = (await call('GET', '/companies', admin)).data;
  const company = (name, branch) => companies.find((c) => c.name === name && c.branch === branch).id;
  const tunis = company(COMPANY, 'Tunis');
  const sfax = company(COMPANY, 'Sfax');
  const other = company(COMPANY_B, null);

  // Users: two active buyers, and one sign-up waiting for the admin.
  await call('POST', '/users', admin, { name: 'Amine (acheteur)', username: 'acheteur.a', password: DEMO_PASSWORD, level: 'Acheteur', company_id: tunis });
  await call('POST', '/users', admin, { name: 'Karim (acheteur)', username: 'acheteur.b', password: DEMO_PASSWORD, level: 'Chef des achats', company_id: other });
  await call('POST', '/signup', null, { name: 'Sarra (inscription)', username: 'sarra.demo', password: DEMO_PASSWORD, company_id: sfax });
  const A = await login('acheteur.a', DEMO_PASSWORD);
  const B = await login('acheteur.b', DEMO_PASSWORD);

  const provinces = (await call('GET', '/lists/provinces', A)).data;
  const province = (name) => provinces.find((p) => p.name_en === name).id;
  const categories = (await call('GET', '/lists/canton-categories', A)).data;
  const category = (sub) => categories.find((c) => c.sub_category === sub).id;

  const plan = [
    {
      supplier: { name: 'Shenzhen Brightway Home Electric Co.', province_id: province('Guangdong'), rating: 5, phone: '+86 755 2611 0000', email: 'sales@brightway.example', website: 'brightway.example' },
      contacts: [{ name: 'Mr Li Wei', phone: '+86 138 0000 1111', wechat_qr: 'liwei_bright' }],
      booths: [{ phase: 2, hall: 12, floor: 2, letter: 'F', num_start: 35, num_end: 36, category: 'Household electronic appliances', visited: true, comment: 'Catalogue reçu. Bon niveau de finition, délai 30 jours.' }],
      products: [
        { name: 'Bouilloire électrique 1,7 L', supplier_ref: 'BW-K17', price: '8.90', unit: 'pièce', moq: 1000, shipping_type: 'FOB', colour: [52, 152, 219], share: [tunis, sfax] },
        { name: 'Grille-pain 2 fentes', supplier_ref: 'BW-T2', price: '6.40', unit: 'pièce', moq: 800, shipping_type: 'FOB', colour: [241, 196, 15] },
      ],
    },
    {
      supplier: { name: 'Ningbo HomeStar Kitchenware', province_id: province('Zhejiang'), rating: 4, phone: '+86 574 8800 0000' },
      contacts: [{ name: 'Ms Chen Yu', phone: '+86 139 0000 2222', email: 'chen.yu@homestar.example' }],
      booths: [{ phase: 2, hall: 9, floor: 1, letter: 'C', num_start: 12, category: 'Cookware', visited: false, comment: 'Rendez-vous pris avec Ms Chen.' }],
      products: [
        { name: 'Poêle antiadhésive 28 cm', supplier_ref: 'HS-P28', price: '4.75', unit: 'pièce', moq: 1200, shipping_type: 'CIF', colour: [231, 76, 60], share: [other] },
      ],
    },
    {
      supplier: { name: 'Yiwu Golden Home Deco', province_id: province('Zhejiang'), rating: 3 },
      contacts: [{ name: 'Mr Zhang', phone: '+86 137 0000 3333', wechat_qr: 'zhang_deco' }],
      booths: [{ phase: 2, hall: 15, floor: 3, letter: 'A', num_start: 8, num_end: 9, category: 'Vases', visited: false }],
      products: [
        { name: 'Vase céramique 30 cm', supplier_ref: 'GH-V30', price: '3.10', unit: 'pièce', moq: 600, shipping_type: 'EXW', colour: [26, 188, 156], share: [tunis] },
      ],
    },
    {
      supplier: { name: 'Guangzhou Silkroad Textiles', province_id: province('Guangdong'), rating: 4, notes: 'Échantillons à demander avant commande.' },
      contacts: [{ name: 'Ms Wang Fang', email: 'wang.fang@silkroad.example' }],
      booths: [{ phase: 3, hall: 2, floor: 1, letter: 'B', num_start: 21, category: 'Quilt & bed sheet', visited: false }],
      products: [],
    },
    {
      supplier: { name: 'Foshan Modern Furniture', province_id: province('Guangdong'), rating: 4 },
      contacts: [],
      booths: [{ phase: 2, hall: 13, floor: 1, letter: 'D', num_start: 40, category: 'Dinning furniture', visited: true }],
      products: [
        { name: 'Chaise scandinave', price: '15.00', unit: 'pièce', moq: 200, shipping_type: 'FOB', colour: [155, 89, 182], share: [other, tunis] },
      ],
    },
  ];

  let booths = 0;
  let products = 0;
  let shares = 0;
  for (const [i, s] of plan.entries()) {
    const token = i % 2 ? B : A; // both buyers add data: it is shared by the whole group
    const supplierId = (await call('POST', '/suppliers', token, s.supplier)).data.id;
    for (const c of s.contacts) await call('POST', `/suppliers/${supplierId}/contacts`, token, c);
    for (const b of s.booths) {
      const { category: sub, ...rest } = b;
      await call('POST', '/booths', token, { ...rest, supplier_id: supplierId, category_id: category(sub) });
      booths++;
    }
    for (const p of s.products) {
      const { colour, share, ...rest } = p;
      const productId = (await call('POST', '/products', token, { ...rest, supplier_id: supplierId })).data.id;
      await addPhoto(token, productId, colour);
      products++;
      if (share) {
        await call('PUT', `/products/${productId}/shares`, token, { company_ids: share });
        shares += share.length;
      }
    }
  }

  console.log(`Demo data loaded on ${BASE}:`);
  console.log(`  companies: "${COMPANY}" (Tunis, Sfax) and "${COMPANY_B}"`);
  console.log(`  users (password ${DEMO_PASSWORD}): acheteur.a, acheteur.b; sarra.demo is a pending sign-up`);
  console.log(`  ${plan.length} suppliers, ${booths} booths (2 visited), ${products} products with photos, ${shares} shares`);
}

main().catch((err) => {
  console.error('Demo data not loaded:', err.message);
  process.exit(1);
});
