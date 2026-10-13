require('dotenv').config();            // first line: db.js reads process.env at require time
const express = require('express');
const cors = require('cors');
require('./config/db');
const app = express();

app.use(cors({ origin: '*', credentials: true, maxAge: 86400 })); // maxAge: avoid a preflight per call
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Module routes are mounted here, sprint by sprint:
// app.use('/api', require('./routes/loginRoute'));

app.get('/', (req, res) => res.send('Backend is running!'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
