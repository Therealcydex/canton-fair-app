require('dotenv').config();            // first line: db.js reads process.env at require time
const express = require('express');
const cors = require('cors');
require('./config/db');
const { fail, serverError } = require('./utils/http');
const { UPLOAD_ROOT } = require('./utils/upload');
const app = express();
app.disable('x-powered-by');

// JWT_SECRET has no default (protected routes refuse every request without it); warn early.
if (!process.env.JWT_SECRET) console.error('JWT_SECRET is not set: every login and protected route will be refused');
else if (process.env.JWT_SECRET.length < 32) console.warn('JWT_SECRET is shorter than 32 characters: use a long random value');

app.use(cors({ origin: '*', credentials: true, maxAge: 86400 })); // maxAge: avoid a preflight per call
// Photos go through multer (utils/upload.js); JSON bodies are small forms (D21).
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use('/api', require('./routes/loginRoute'));
app.use('/api/companies', require('./routes/companyRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/suppliers', require('./routes/supplierRoutes'));
app.use('/api/lists', require('./routes/listRoutes'));
app.use('/api/booths', require('./routes/boothRoutes'));
app.use('/api/products', require('./routes/productRoutes'));

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
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
