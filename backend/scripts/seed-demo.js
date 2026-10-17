// Loads demonstration data through the API (so every rule applies), for showing the app: demo
// companies, two buyers who record the data, 14 suppliers over the 3 phases with their contacts
// (WeChat QR links), booths in the halls of the official plan (D48), products with drawn photos,
// some already decided by the admin (D38) and the others waiting in the evening review.
// Usage (from backend/, the backend running):
//   npm run db:demo                      load it (stops if it is already there)
//   npm run db:demo -- --remove          remove it again (suppliers, their booths, contacts,
//                                        products and photos, the demo users and companies)
//   npm run db:demo -- http://host/api   another backend
// Logs in as the admin of .env. The demo buyers are deactivated once the data is loaded: their
// password is in this file, so they must not stay usable (D46: the admin reactivates an account).
const path = require('path');
const zlib = require('zlib');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const args = process.argv.slice(2);
const REMOVE = args.includes('--remove');
const BASE = args.find((a) => !a.startsWith('--')) || `http://localhost:${process.env.PORT || 3000}/api`;
const DEMO_PASSWORD = 'demo-sourcing-2026';
const COMPANY = 'Groupe démo';
const COMPANY_B = 'Société B (démo)';
const BUYERS = [
  { name: 'Amine (acheteur)', username: 'acheteur.a', level: 'Acheteur', company: 'tunis' },
  { name: 'Karim (acheteur)', username: 'acheteur.b', level: 'Chef des achats', company: 'other' },
];

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

// A PNG drawn by `pixel(x, y) -> [r, g, b]`, so the photos are visible without shipping image files.
function drawPng(width, height, pixel) {
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
  const rows = [];
  for (let y = 0; y < height; y++) {
    const line = [0]; // filter type of the row
    for (let x = 0; x < width; x++) line.push(...pixel(x, y));
    rows.push(Buffer.from(line));
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0)),
  ]);
}

// A product "photo": a shaded object (round, box or tall) on a light studio background with its
// shadow. `angle` shifts the light, so a second photo of the same product looks different.
function productPng(colour, shape, angle = 0) {
  const S = 360;
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const clamp = (t) => Math.max(0, Math.min(1, t));
  const inside = (u, v) => {
    if (shape === 'round') return Math.hypot(u, v) < 1;
    const [w, h] = shape === 'tall' ? [0.55, 1] : [1, 0.75];
    const r = 0.25;
    const dx = Math.max(Math.abs(u) - (w - r), 0);
    const dy = Math.max(Math.abs(v) - (h - r), 0);
    return Math.hypot(dx, dy) < r;
  };
  return drawPng(S, S, (x, y) => {
    let bg = mix([248, 248, 246], [222, 224, 228], y / S);
    const sh = Math.hypot((x - S / 2) / 120, (y - S * 0.82) / 22); // shadow on the floor
    if (sh < 1) bg = mix(bg, [150, 152, 158], (1 - sh) * 0.45);
    const u = (x - S / 2) / 110;
    const v = (y - S * 0.47) / 110;
    if (!inside(u, v)) return bg;
    const light = clamp(0.55 - (u * (0.6 + angle) + v * 0.8) * 0.35); // lit from the top left
    return light > 0.5 ? mix(colour, [255, 255, 255], (light - 0.5) * 0.9) : mix(colour, [0, 0, 0], (0.5 - light) * 0.8);
  });
}

async function addPhotos(token, productId, colour, shape, count) {
  const form = new FormData();
  for (let i = 0; i < count; i++) {
    form.append('images', new Blob([productPng(colour, shape, i * 0.8)], { type: 'image/png' }), `photo-${i + 1}.png`);
  }
  await call('POST', `/products/${productId}/images`, token, form);
}

// The demo, phase by phase. Booths sit in a hall of their section on the official plan (D48).
// Phase 1 is on (15-19 Oct): most of its booths are visited. Phases 2 and 3 are still to come.
// `decision`: what the admin already decided (D38); a product without one waits in the review.
// The WeChat links are made up: the app draws a QR code from them, but WeChat does not know them.
const PLAN = [
  // ---- Phase 1 ----
  {
    supplier: { name: 'Shenzhen Brightway Home Electric Co.', province: 'Guangdong', rating: 5, phone: '+86 755 2611 0000', email: 'sales@brightway.example', website: 'www.brightway.example', address: 'Bao\'an District, Shenzhen', notes: 'Fournisseur sérieux, déjà en contact depuis 2025. Usine visitée.' },
    contacts: [
      { name: 'Mr Li Wei', phone: '+86 138 0000 1111', email: 'li.wei@brightway.example', wechat: 'https://u.wechat.com/demo-liwei' },
      { name: 'Ms Huang Mei', phone: '+86 136 0000 1212', wechat: 'https://u.wechat.com/demo-huangmei' },
    ],
    booth: { phase: 1, hall: 3, floor: 1, letter: 'E', num_start: 12, num_end: 13, section: 'Household Electrical Appliances', sub: 'Household Electrical Appliances', visited: true, comment: 'Catalogue reçu. Bon niveau de finition, délai 30 jours.' },
    products: [
      { name: 'Bouilloire électrique 1,7 L', supplier_ref: 'BW-K17', price: '8.90', unit: 'pièce', moq: 1000, shipping_type: 'FOB', colour: [52, 120, 219], shape: 'tall', photos: 2, description: 'Inox brossé, arrêt automatique, base 360°. Certifiée CE.', decision: ['RETENU', 'Bon rapport qualité/prix : négocier 8,50 pour 3 000 pièces.'], share: ['tunis', 'sfax'] },
      { name: 'Grille-pain 2 fentes', supplier_ref: 'BW-T2', price: '6.40', unit: 'pièce', moq: 800, shipping_type: 'FOB', colour: [236, 186, 40], shape: 'box', photos: 1, description: '6 niveaux de brunissage, fonction décongélation.', decision: ['ECHANTILLON', 'Demander 2 échantillons, coloris crème et noir.'] },
      { name: 'Mixeur plongeant 600 W', supplier_ref: 'BW-H600', price: '7.20', unit: 'pièce', moq: 1000, shipping_type: 'FOB', colour: [90, 90, 96], shape: 'tall', photos: 2, description: 'Pied inox amovible, 2 vitesses, bol gradué fourni.' },
    ],
  },
  {
    supplier: { name: 'Zhongshan Lumina Lighting', province: 'Guangdong', rating: 4, phone: '+86 760 8822 0000', email: 'export@lumina.example', website: 'www.lumina.example' },
    contacts: [{ name: 'Mr Chen Hao', phone: '+86 137 0000 2323', wechat: 'https://u.wechat.com/demo-chenhao' }],
    booth: { phase: 1, hall: 14, floor: 4, letter: 'B', num_start: 5, section: 'Lighting Equipment', sub: 'Lighting Equipment', visited: true, comment: 'Stand très fréquenté, revenir avec les quantités.' },
    products: [
      { name: 'Lampe LED de bureau pliable', supplier_ref: 'LM-D12', price: '5.80', unit: 'pièce', moq: 500, shipping_type: 'FOB', colour: [245, 245, 245], shape: 'tall', photos: 2, description: 'Port USB-C, 3 températures de couleur, bras articulé.', decision: ['A_COMMANDER', 'Commander 2 000 pièces, livraison avant fin décembre.'], share: ['tunis', 'other'] },
      { name: 'Guirlande LED solaire 10 m', supplier_ref: 'LM-S10', price: '2.35', unit: 'pièce', moq: 2000, shipping_type: 'FOB', colour: [250, 200, 60], shape: 'round', photos: 1, description: '100 LED blanc chaud, 8 modes, étanche IP65.' },
    ],
  },
  {
    supplier: { name: 'Yongkang ProTools Co.', province: 'Zhejiang', rating: 3, phone: '+86 579 8711 0000' },
    contacts: [{ name: 'Mr Wu Jun', phone: '+86 135 0000 3434', email: 'wu.jun@protools.example' }],
    booth: { phase: 1, hall: 12, floor: 1, letter: 'C', num_start: 18, section: 'Tools', sub: 'Tools', visited: true, comment: 'Prix bas mais finition moyenne.' },
    products: [
      { name: 'Coffret tournevis 32 pièces', supplier_ref: 'PT-S32', price: '3.95', unit: 'coffret', moq: 1000, shipping_type: 'FOB', colour: [214, 48, 49], shape: 'box', photos: 1, description: 'Embouts chrome-vanadium, mallette plastique.', decision: ['REJETE', 'Qualité de l\'acier insuffisante, embouts déformés au test.'] },
      { name: 'Perceuse-visseuse sans fil 20 V', supplier_ref: 'PT-D20', price: '21.50', unit: 'pièce', moq: 300, shipping_type: 'FOB', colour: [255, 140, 0], shape: 'box', photos: 2, description: '2 batteries Li-ion, chargeur rapide, coffret.' },
    ],
  },
  {
    supplier: { name: 'Shenzhen Smartlink Electronics', province: 'Guangdong', rating: 4, phone: '+86 755 8300 0000', email: 'info@smartlink.example', website: 'www.smartlink.example' },
    contacts: [{ name: 'Ms Zhou Lin', phone: '+86 139 0000 4545', wechat: 'https://u.wechat.com/demo-zhoulin' }],
    booth: { phase: 1, hall: 18, floor: 2, letter: 'A', num_start: 30, section: 'Consumer Electronics and Information Products', sub: 'Consumer Electronics and Information Products', visited: false, comment: 'À voir demain matin : écouteurs et enceintes.' },
    products: [
      { name: 'Écouteurs Bluetooth 5.3', supplier_ref: 'SL-E53', price: '4.60', unit: 'paire', moq: 1000, shipping_type: 'FOB', colour: [30, 30, 34], shape: 'round', photos: 2, description: 'Boîtier de charge, 30 h d\'autonomie. Reçu sur catalogue.' },
    ],
  },
  {
    supplier: { name: 'Tianjin VeloStar Bicycles', province: 'Tianjin', rating: 3, phone: '+86 22 2800 0000' },
    contacts: [{ name: 'Mr Sun Peng', phone: '+86 132 0000 5656' }],
    booth: { phase: 1, hall: 16, floor: 2, letter: 'D', num_start: 7, section: 'Bicycles', sub: 'Bicycles', visited: false },
    products: [],
  },
  // ---- Phase 2 ----
  {
    supplier: { name: 'Ningbo HomeStar Kitchenware', province: 'Zhejiang', rating: 4, phone: '+86 574 8800 0000', email: 'chen.yu@homestar.example' },
    contacts: [{ name: 'Ms Chen Yu', phone: '+86 139 0000 2222', email: 'chen.yu@homestar.example', wechat: 'https://u.wechat.com/demo-chenyu' }],
    booth: { phase: 2, hall: 3, floor: 2, letter: 'F', num_start: 21, section: 'Kitchenware and Tableware', sub: 'Cookware', visited: false, comment: 'Rendez-vous pris avec Ms Chen le 24.' },
    products: [
      { name: 'Poêle antiadhésive 28 cm', supplier_ref: 'HS-P28', price: '4.75', unit: 'pièce', moq: 1200, shipping_type: 'CIF', colour: [60, 60, 66], shape: 'round', photos: 2, description: 'Revêtement granit, tous feux dont induction. Prix catalogue.', decision: ['ECHANTILLON', 'Échantillon à tester sur induction avant le salon.'], share: ['other'] },
      { name: 'Set 3 casseroles inox', supplier_ref: 'HS-C3', price: '12.80', unit: 'set', moq: 500, shipping_type: 'CIF', colour: [190, 192, 198], shape: 'box', photos: 1, description: 'Fond triple épaisseur, couvercles verre.' },
    ],
  },
  {
    supplier: { name: 'Chaozhou Fine Ceramics', province: 'Guangdong', rating: 4, phone: '+86 768 6200 0000' },
    contacts: [{ name: 'Mr Lin Tao', phone: '+86 131 0000 6767', wechat: 'https://u.wechat.com/demo-lintao' }],
    booth: { phase: 2, hall: 4, floor: 1, letter: 'G', num_start: 9, section: 'General Ceramics', sub: 'Porcelain dinner set white porcelain dinnerware', visited: false },
    products: [
      { name: 'Service de table 18 pièces porcelaine', supplier_ref: 'CZ-D18', price: '14.90', unit: 'set', moq: 300, shipping_type: 'FOB', colour: [250, 250, 252], shape: 'round', photos: 1, description: 'Porcelaine blanche, passe au lave-vaisselle et au micro-ondes.' },
    ],
  },
  {
    supplier: { name: 'Foshan Modern Furniture', province: 'Guangdong', rating: 4, phone: '+86 757 8600 0000', website: 'www.modernfurniture.example' },
    contacts: [{ name: 'Ms Liang Qi', phone: '+86 138 0000 7878', email: 'liang.qi@modernfurniture.example' }],
    booth: { phase: 2, hall: 10, floor: 3, letter: 'D', num_start: 40, num_end: 41, section: 'Furniture', sub: 'Dinning furniture', visited: false },
    products: [
      { name: 'Chaise scandinave', supplier_ref: 'FM-C01', price: '15.00', unit: 'pièce', moq: 200, shipping_type: 'FOB', colour: [196, 160, 120], shape: 'tall', photos: 2, description: 'Pieds hêtre massif, assise polypropylène. 4 coloris.', decision: ['RETENU', 'À présenter aux magasins de Tunis et de la société B.'], share: ['other', 'tunis'] },
    ],
  },
  {
    supplier: { name: 'Yiwu Golden Home Deco', province: 'Zhejiang', rating: 3 },
    contacts: [{ name: 'Mr Zhang Bo', phone: '+86 137 0000 3333', wechat: 'https://u.wechat.com/demo-zhangbo' }],
    booth: { phase: 2, hall: 18, floor: 1, letter: 'A', num_start: 8, num_end: 9, section: 'Home Decorations', sub: 'Frames', visited: false },
    products: [
      { name: 'Cadre photo bois 20 × 25', supplier_ref: 'GH-F20', price: '1.45', unit: 'pièce', moq: 2400, shipping_type: 'EXW', colour: [140, 98, 60], shape: 'box', photos: 1, description: 'Bois de pin, verre, pied chevalet.' },
    ],
  },
  {
    supplier: { name: 'Xiamen GreenGarden Products', province: 'Fujian', rating: 4, phone: '+86 592 5100 0000' },
    contacts: [{ name: 'Ms Xu Ling', phone: '+86 135 0000 8989', wechat: 'https://u.wechat.com/demo-xuling' }],
    booth: { phase: 2, hall: 8, floor: 1, letter: 'C', num_start: 15, section: 'Gardening Products', sub: 'Flowerpots and plantation', visited: false },
    products: [],
  },
  // ---- Phase 3 ----
  {
    supplier: { name: 'Nantong Silkroad Home Textiles', province: 'Jiangsu', rating: 4, notes: 'Échantillons à demander avant commande.' },
    contacts: [{ name: 'Ms Wang Fang', email: 'wang.fang@silkroad.example', wechat: 'https://u.wechat.com/demo-wangfang' }],
    booth: { phase: 3, hall: 15, floor: 2, letter: 'B', num_start: 21, section: 'Home Textiles', sub: 'Blankets', visited: false },
    products: [
      { name: 'Plaid polaire 130 × 170', supplier_ref: 'SR-B130', price: '3.20', unit: 'pièce', moq: 1000, shipping_type: 'FOB', colour: [120, 150, 200], shape: 'box', photos: 1, description: 'Flanelle 220 g/m², 6 coloris. Reçu sur catalogue.' },
    ],
  },
  {
    supplier: { name: 'Shantou HappyKids Toys', province: 'Guangdong', rating: 3, phone: '+86 754 8800 0000' },
    contacts: [{ name: 'Mr Cai Ming', phone: '+86 133 0000 9090' }],
    booth: { phase: 3, hall: 17, floor: 1, letter: 'E', num_start: 3, section: 'Toys', sub: 'Classic toys', visited: false },
    products: [],
  },
  {
    supplier: { name: 'Quanzhou Stride Footwear', province: 'Fujian', rating: 4, phone: '+86 595 2200 0000' },
    contacts: [{ name: 'Mr Hong Wei', phone: '+86 136 0000 1010', wechat: 'https://u.wechat.com/demo-hongwei' }],
    booth: { phase: 3, hall: 2, floor: 2, letter: 'H', num_start: 11, section: 'Shoes', sub: "Men's shoes", visited: false },
    products: [],
  },
  {
    supplier: { name: 'Baigou Travel Bags', province: 'Hebei', rating: 3 },
    contacts: [{ name: 'Ms Ma Jing', phone: '+86 134 0000 1111' }],
    booth: { phase: 3, hall: 19, floor: 2, letter: 'C', num_start: 26, num_end: 27, section: 'Cases and Bags', sub: 'Business bag', visited: false },
    products: [],
  },
];

async function remove(admin) {
  const names = new Set(PLAN.map((s) => s.supplier.name));
  const suppliers = (await call('GET', '/suppliers', admin)).data.filter((s) => names.has(s.name));
  for (const s of suppliers) {
    // The supplier's booths stay when it is deleted (D43): delete them first.
    for (const b of (await call('GET', `/booths?supplier_id=${s.id}`, admin)).data) await call('DELETE', `/booths/${b.id}`, admin);
    await call('DELETE', `/suppliers/${s.id}`, admin); // its contacts, products and photos go with it
  }
  const usernames = new Set([...BUYERS.map((b) => b.username), 'sarra.demo', 'lecteur.demo']);
  const users = (await call('GET', '/users', admin)).data.filter((u) => usernames.has(u.username));
  for (const u of users) await call('DELETE', `/users/${u.id}`, admin);
  const companies = (await call('GET', '/companies', admin)).data.filter((c) => [COMPANY, COMPANY_B].includes(c.name));
  for (const c of companies) await call('DELETE', `/companies/${c.id}`, admin);
  console.log(`Demo data removed from ${BASE}: ${suppliers.length} suppliers (with their booths, contacts, products and photos), ${users.length} users, ${companies.length} companies.`);
}

async function load(admin) {
  let companies = (await call('GET', '/companies', admin)).data;
  if (companies.some((c) => c.name === COMPANY)) {
    console.log(`Demo data already loaded ("${COMPANY}" exists): nothing done. Remove it with: npm run db:demo -- --remove`);
    return;
  }

  // The group's companies (demo names), one with two branches.
  for (const c of [{ name: COMPANY, branch: 'Tunis' }, { name: COMPANY, branch: 'Sfax' }, { name: COMPANY_B, branch: null }]) {
    await call('POST', '/companies', admin, c);
  }
  companies = (await call('GET', '/companies', admin)).data;
  const find = (name, branch) => companies.find((c) => c.name === name && c.branch === branch).id;
  const companyIds = { tunis: find(COMPANY, 'Tunis'), sfax: find(COMPANY, 'Sfax'), other: find(COMPANY_B, null) };

  // The buyers who record the data (shared by the whole group), and an inactive account.
  const userIds = [];
  for (const b of BUYERS) {
    const created = await call('POST', '/users', admin, { name: b.name, username: b.username, password: DEMO_PASSWORD, level: b.level, company_id: companyIds[b.company] });
    userIds.push(created.data.id);
  }
  await call('POST', '/users', admin, { name: 'Sarra (acheteuse)', username: 'sarra.demo', password: DEMO_PASSWORD, level: 'Acheteur', company_id: companyIds.sfax, is_active: false });
  // D62: a viewer of the Tunis branch, who reads the booths shared with it (inactive at the end).
  userIds.push((await call('POST', '/users', admin, { name: 'Lecteur Tunis', username: 'lecteur.demo', password: DEMO_PASSWORD, role: 'LECTEUR', company_id: companyIds.tunis })).data.id);
  const tokens = [];
  for (const b of BUYERS) tokens.push(await login(b.username, DEMO_PASSWORD));

  const provinces = (await call('GET', '/lists/provinces', admin)).data;
  const provinceId = (name) => provinces.find((p) => p.name_en === name)?.id ?? null;
  const categories = (await call('GET', '/lists/canton-categories', admin)).data;
  const categoryId = (section, sub) => {
    const c = categories.find((x) => x.section === section && x.sub_category === sub);
    if (!c) throw new Error(`Category not found: ${section} / ${sub}`);
    return c.id;
  };

  let booths = 0;
  let products = 0;
  let decided = 0;
  for (const [i, s] of PLAN.entries()) {
    const token = tokens[i % tokens.length];
    const { province, ...supplier } = s.supplier;
    const supplierId = (await call('POST', '/suppliers', token, { ...supplier, province_id: provinceId(province) })).data.id;
    for (const { wechat, ...c } of s.contacts) {
      const contactId = (await call('POST', `/suppliers/${supplierId}/contacts`, token, c)).data.id;
      if (wechat) await call('PUT', `/suppliers/${supplierId}/contacts/${contactId}/wechat-qr`, token, { content: wechat });
    }
    const { section, sub, ...booth } = s.booth;
    let boothId = null;
    try {
      boothId = (await call('POST', '/booths', token, { ...booth, supplier_id: supplierId, category_id: categoryId(section, sub) })).data.id;
      booths++;
    } catch (err) {
      console.log(`  booth of ${s.supplier.name} not created (${err.message})`); // e.g. a booth already recorded there
    }
    const shareWith = new Set(); // D62: the booth is shared with the companies its products were meant for
    for (const p of s.products) {
      const { colour, shape, photos, decision, share, ...product } = p;
      const productId = (await call('POST', '/products', token, { ...product, supplier_id: supplierId, booth_id: boothId })).data.id;
      await addPhotos(token, productId, colour, shape, photos);
      products++;
      for (const k of share || []) shareWith.add(companyIds[k]);
      if (decision) {
        await call('PUT', `/products/${productId}/decision`, admin, { status: decision[0], note: decision[1] });
        decided++;
      }
    }
    if (boothId && shareWith.size) await call('PUT', `/booths/${boothId}`, admin, { share_company_ids: [...shareWith] });
  }

  // The demo buyers' password is in this file: they must not stay usable.
  for (const id of userIds) await call('PUT', `/users/${id}`, admin, { is_active: 0 });

  console.log(`Demo data loaded on ${BASE}:`);
  console.log(`  companies "${COMPANY}" (Tunis, Sfax) and "${COMPANY_B}"`);
  console.log(`  ${PLAN.length} suppliers with contacts, ${booths} booths (phase 1 mostly visited), ${products} products with photos`);
  console.log(`  ${decided} products already decided, ${products - decided} waiting in "Revue du soir"`);
  console.log('  some booths shared with the companies (D62) and a viewer of the Tunis branch (lecteur.demo)');
  console.log('  the demo accounts (acheteur.a, acheteur.b, sarra.demo, lecteur.demo) are inactive; remove it all with: npm run db:demo -- --remove');
}

(async () => {
  const admin = await login(process.env.SEED_ADMIN_USERNAME, process.env.SEED_ADMIN_PASSWORD);
  await (REMOVE ? remove(admin) : load(admin));
})().catch((err) => {
  console.error(`Demo data ${REMOVE ? 'not removed' : 'not loaded'}:`, err.message);
  process.exit(1);
});
