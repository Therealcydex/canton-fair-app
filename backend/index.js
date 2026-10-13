require('dotenv').config();            // first line: db.js reads process.env at require time
const express = require('express');
const cors = require('cors');
require('./config/db');
const { fail, serverError } = require('./utils/http');
const app = express();

app.use(cors({ origin: '*', credentials: true, maxAge: 86400 })); // maxAge: avoid a preflight per call
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api', require('./routes/loginRoute'));
app.use('/api/companies', require('./routes/companyRoutes'));
app.use('/api/users', require('./routes/userRoutes'));

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
