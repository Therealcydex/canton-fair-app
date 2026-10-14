// Loads demonstration data through the API (so every rule applies): a second company, three
// users, suppliers with contacts, booths, visits, products with photos and two shared products.
// Usage (from backend/, the backend running): npm run db:demo [-- http://localhost:3000/api]
// Logs in as the super-admin of .env. Stops if the demo data is already there.
const path = require('path');
const zlib = require('zlib');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const BASE = process.argv[2] || `http://localhost:${process.env.PORT || 3000}/api`;
const DEMO_PASSWORD = 'demo-sourcing-2026';
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
  const su = await login(process.env.SEED_ADMIN_USERNAME, process.env.SEED_ADMIN_PASSWORD);
  const companies = (await call('GET', '/companies', su)).data;
  if (companies.some((c) => c.name === COMPANY_B)) {
    console.log(`Demo data already loaded ("${COMPANY_B}" exists): nothing done.`);
    return;
  }
  const companyA = companies.find((c) => c.name === 'Société démo') || companies[0];
  const companyB = (await call('POST', '/companies', su, { name: COMPANY_B })).data.id;

  // Users
  const users = [
    { name: 'Amine (acheteur)', username: 'acheteur.a', level: 1, company_id: companyA.id },
    { name: 'Sarra (chef des achats)', username: 'chef.a', level: 4, company_id: companyA.id },
    { name: 'Karim (acheteur)', username: 'acheteur.b', level: 1, company_id: companyB },
  ];
  for (const u of users) await call('POST', '/users', su, { ...u, password: DEMO_PASSWORD });
  const A = await login('acheteur.a', DEMO_PASSWORD);
  const B = await login('acheteur.b', DEMO_PASSWORD);

  // Categories (global): reuse the seeded ones, add LED lighting under Électronique.
  let cats = (await call('GET', '/categories', su)).data;
  const cat = (name) => cats.find((c) => c.name === name)?.id ?? null;
  if (!cat('Éclairage LED')) {
    await call('POST', '/categories', su, { name: 'Éclairage LED', parent_id: cat('Électronique') });
    cats = (await call('GET', '/categories', su)).data;
  }

  // Suppliers of company A, each with contacts, booths, products.
  const plan = [
    {
      supplier: { name: 'Shenzhen Brightway Lighting Co.', province: 'Guangdong', rating: 5, phone: '+86 755 2611 0000', email: 'sales@brightway.example', website: 'brightway.example' },
      contacts: [{ name: 'Mr Li Wei', phone: '+86 138 0000 1111', wechat_qr: 'liwei_bright' }],
      booths: [{ category: 'Éclairage LED', phase: 1, hall: 12, level: 2, letter: 'F', num_start: 35, num_end: 36, to_visit: false }],
      visits: [{ status: 'visite', visited_at: '2026-10-15 10:30', comment: 'Catalogue reçu. Bon niveau de finition, délai 30 jours.' }],
      products: [
        { name: 'Ruban LED 5 m RGB', supplier_ref: 'BW-LS500', price_tnd: '12.500', unit: 'rouleau', moq: 500, incoterm: 'FOB', colour: [230, 126, 34], share: true },
        { name: 'Ampoule LED E27 9 W', supplier_ref: 'BW-E27-9', price_tnd: '1.850', unit: 'pièce', moq: 3000, incoterm: 'FOB', colour: [241, 196, 15] },
      ],
    },
    {
      supplier: { name: 'Ningbo HomeStar Appliances', province: 'Zhejiang', rating: 4, phone: '+86 574 8800 0000' },
      contacts: [{ name: 'Ms Chen Yu', phone: '+86 139 0000 2222', email: 'chen.yu@homestar.example' }],
      booths: [{ category: 'Petit électroménager', phase: 1, hall: 9, level: 1, letter: 'C', num_start: 12, to_visit: true }],
      visits: [{ status: 'prevu', visited_at: '2026-10-16 14:00', comment: 'Rendez-vous pris avec Ms Chen.' }],
      products: [
        { name: 'Bouilloire électrique 1,7 L', supplier_ref: 'HS-K17', price_tnd: '24.900', unit: 'pièce', moq: 1000, incoterm: 'FOB', colour: [52, 152, 219] },
      ],
    },
    {
      supplier: { name: 'Yiwu Golden Home Deco', province: 'Zhejiang', rating: 3 },
      contacts: [{ name: 'Mr Zhang', phone: '+86 137 0000 3333', wechat_qr: 'zhang_deco' }],
      booths: [{ category: 'Maison et décoration', phase: 2, hall: 15, level: 3, letter: 'A', num_start: 8, num_end: 9, to_visit: true }],
      visits: [],
      products: [
        { name: 'Vase céramique 30 cm', supplier_ref: 'GH-V30', price_tnd: '9.400', unit: 'pièce', moq: 600, incoterm: 'EXW', colour: [26, 188, 156], share: true },
      ],
    },
    {
      supplier: { name: 'Guangzhou Silkroad Textiles', province: 'Guangdong', rating: 4, notes: 'Échantillons à demander avant commande.' },
      contacts: [{ name: 'Ms Wang Fang', email: 'wang.fang@silkroad.example' }],
      booths: [{ category: 'Textile', phase: 3, hall: 2, level: 1, letter: 'B', num_start: 21, to_visit: true }],
      visits: [],
      products: [],
    },
  ];

  let shared = 0;
  let products = 1; // company B's product below
  for (const s of plan) {
    const supplierId = (await call('POST', '/suppliers', A, s.supplier)).data.id;
    for (const c of s.contacts) await call('POST', `/suppliers/${supplierId}/contacts`, A, c);
    let boothId = null;
    for (const b of s.booths) {
      const { category, ...rest } = b;
      boothId = (await call('POST', '/booths', A, { ...rest, supplier_id: supplierId, category_id: cat(category) })).data.id;
    }
    for (const v of s.visits) await call('POST', `/booths/${boothId}/visits`, A, v);
    for (const p of s.products) {
      const { colour, share, ...rest } = p;
      const productId = (await call('POST', '/products', A, { ...rest, supplier_id: supplierId, booth_id: boothId })).data.id;
      await addPhoto(A, productId, colour);
      products++;
      if (share) {
        await call('POST', `/products/${productId}/shares`, A, { company_id: companyB });
        shared++;
      }
    }
  }

  // Company B has its own supplier, invisible to company A.
  const sB = (await call('POST', '/suppliers', B, { name: 'Foshan Modern Furniture', province: 'Guangdong', rating: 4 })).data.id;
  const bB = (await call('POST', '/booths', B, { supplier_id: sB, category_id: cat('Maison et décoration'), phase: 2, hall: 13, level: 1, letter: 'D', num_start: 40, to_visit: true })).data.id;
  const pB = (await call('POST', '/products', B, { name: 'Chaise scandinave', supplier_id: sB, booth_id: bB, price_tnd: '45.000', unit: 'pièce', moq: 200, incoterm: 'FOB' })).data.id;
  await addPhoto(B, pB, [155, 89, 182]);

  console.log(`Demo data loaded on ${BASE}:`);
  console.log(`  companies: "${companyA.name}" and "${COMPANY_B}"`);
  console.log(`  users (password ${DEMO_PASSWORD}): acheteur.a, chef.a (admin of ${companyA.name}), acheteur.b`);
  console.log(`  ${plan.length + 1} suppliers, ${plan.length + 1} booths, ${products} products with photos, ${shared} shared with ${COMPANY_B}`);
}

main().catch((err) => {
  console.error('Demo data not loaded:', err.message);
  process.exit(1);
});
