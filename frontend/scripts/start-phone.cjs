// `npm run start:phone`: the dev server for a phone on the same Wi-Fi (D52). Browsers only open
// the live camera (WeChat QR scanner) on https, so the server uses a local certificate (accept
// the warning once on the phone), and the app calls /api and /uploads on its own address: the
// "proxy" of package.json passes them to the backend on port 3000.
// Open https://<the PC's address>:3001 on the phone (the PC's address: `ipconfig`, Wi-Fi IPv4).
const { spawn } = require('child_process');
const path = require('path');

require('./copy-ocr.cjs');
const env = { ...process.env, HTTPS: 'true', PORT: process.env.PORT || '3001', REACT_APP_API_BASE_URL: '/api', BROWSER: 'none' };
const bin = path.join(__dirname, '..', 'node_modules', 'react-scripts', 'bin', 'react-scripts.js');
spawn(process.execPath, [bin, 'start'], { stdio: 'inherit', env }).on('exit', (code) => process.exit(code ?? 0));
