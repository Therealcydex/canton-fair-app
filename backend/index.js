require('dotenv').config();            // first line: db.js reads process.env at require time
const express = require('express');
const cors = require('cors');
require('./config/db');
const { fail, serverError } = require('./utils/http');
const { UPLOAD_ROOT } = require('./utils/upload');
const app = express();
app.disable('x-powered-by');
// Behind nginx (deploy/): TRUST_PROXY=1 makes req.ip the user's address, not nginx's, so the
// login and sign-up limits (middleware/loginLimiter.js) count each user separately.
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);

// JWT_SECRET has no default (protected routes refuse every request without it); warn early.
if (!process.env.JWT_SECRET) console.error('JWT_SECRET is not set: every login and protected route will be refused');
else if (process.env.JWT_SECRET.length < 32) console.warn('JWT_SECRET is shorter than 32 characters: use a long random value');

app.use(cors({ origin: '*', credentials: true, maxAge: 86400 })); // maxAge: avoid a preflight per call
// WeChat QR photos go through multer (utils/upload.js); JSON bodies are small forms (D21).
// D61: product photos (10 of 1.5 MB at most) and contact avatars (300 KB) travel as Base64 in JSON.
app.use('/api/products', express.json({ limit: '25mb' }));
app.use('/api/suppliers', express.json({ limit: '2mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use('/api', require('./routes/loginRoute'));
app.use('/api/companies', require('./routes/companyRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/suppliers', require('./routes/supplierRoutes'));
app.use('/api/contacts', require('./routes/contactRoutes'));
app.use('/api/lists', require('./routes/listRoutes'));
app.use('/api/booths', require('./routes/boothRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/fair-plan', require('./routes/fairPlanRoutes'));

// Product photos (D17): random file names, served as images only.
app.use('/uploads', express.static(UPLOAD_ROOT, {
  index: false,
  setHeaders: (res) => res.set('X-Content-Type-Options', 'nosniff'),
}));

app.get('/', (req, res) => res.send('Backend is running!'));

// Unknown API route, and errors thrown before a controller (malformed JSON, body too large):
// keep the { success: false, message } shape instead of Express's HTML page.
app.use('/api', (req, res) => fail(res, 404, 'Route introuvable'));
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return fail(res, 400, 'Requête invalide (JSON mal formé)');
  if (err.type === 'entity.too.large') return fail(res, 413, 'Requête trop volumineuse');
  serverError(res, 'express', err);
});

const PORT = process.env.PORT || 3000;
// HOST=127.0.0.1 in production: only nginx (same server) reaches the API, never the internet directly.
const HOST = process.env.HOST || undefined;
app.listen(PORT, HOST, () => console.log(`Server is running on ${HOST || 'all interfaces'}, port ${PORT}`));
