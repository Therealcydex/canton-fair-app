// Copies the business-card reader's files (tesseract.js, D37) into public/ocr/, so the app serves
// them itself: no CDN (often slow or blocked in China), and the phone keeps them after the first
// card (service worker + tesseract's own cache). Runs before `npm start` and `npm run build`.
// public/ocr/ is not committed (about 11 MB); it comes from node_modules.
const fs = require('fs');
const path = require('path');

const nm = path.join(__dirname, '..', 'node_modules');
const out = path.join(__dirname, '..', 'public', 'ocr');
const files = [
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  // Only the LSTM engine is used: the plain and the SIMD build (the library picks one).
  ['tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  // English, "best_int": accurate and compact (2.9 MB).
  ['@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'eng.traineddata.gz'],
];

fs.mkdirSync(out, { recursive: true });
for (const [from, to] of files) {
  const src = path.join(nm, from);
  const dest = path.join(out, to);
  const s = fs.statSync(src);
  if (fs.existsSync(dest) && fs.statSync(dest).size === s.size) continue;
  fs.copyFileSync(src, dest);
  console.log(`public/ocr/${to} (${(s.size / 1048576).toFixed(1)} MB)`);
}
