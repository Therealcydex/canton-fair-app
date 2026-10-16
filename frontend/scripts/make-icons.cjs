// Draws the app icons into public/icons/ (PNG, no image tool needed): a dark square with a white
// QR-code corner motif. Run once after changing the design: node scripts/make-icons.cjs
// Sizes: 180 (iPhone home screen), 192 and 512 (manifest), 512 maskable (Android safe zone).
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

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

function png(size, pixel) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const rows = [];
  for (let y = 0; y < size; y++) {
    const line = Buffer.alloc(1 + size * 3);
    for (let x = 0; x < size; x++) line.set(pixel(x / size, y / size), 1 + x * 3);
    rows.push(line);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const BG = [15, 23, 42]; // slate-900, the app's header colour
const FG = [255, 255, 255];
const ACCENT = [37, 99, 235]; // blue-600, the app's buttons

// A QR-code finder square (7x7 modules: ring, gap, 3x3 centre) at (cx, cy), `m` = module size.
const finder = (u, v, cx, cy, m) => {
  const i = Math.floor((u - cx) / m);
  const j = Math.floor((v - cy) / m);
  if (i < 0 || j < 0 || i > 6 || j > 6) return false;
  const ring = Math.max(Math.abs(i - 3), Math.abs(j - 3));
  return ring !== 2;
};

// The motif fills `inner` of the icon (smaller for the maskable icon's safe zone).
const draw = (inner) => (u, v) => {
  const pad = (1 - inner) / 2;
  const x = (u - pad) / inner;
  const y = (v - pad) / inner;
  if (x < 0 || y < 0 || x >= 1 || y >= 1) return BG;
  const m = 1 / 21; // a 21-module grid, like a small QR code
  if (finder(x, y, m * 2, m * 2, m) || finder(x, y, m * 12, m * 2, m) || finder(x, y, m * 2, m * 12, m)) return FG;
  // A blue square where the fourth corner would be: the "scan" point.
  if (x >= m * 13 && x < m * 18 && y >= m * 13 && y < m * 18) return ACCENT;
  return BG;
};

const out = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(out, { recursive: true });
for (const [name, size, inner] of [
  ['apple-touch-icon.png', 180, 0.8],
  ['icon-192.png', 192, 0.8],
  ['icon-512.png', 512, 0.8],
  ['icon-maskable-512.png', 512, 0.6],
]) {
  fs.writeFileSync(path.join(out, name), png(size, draw(inner)));
  console.log(`public/icons/${name}`);
}
