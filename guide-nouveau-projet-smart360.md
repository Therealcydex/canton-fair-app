# Guide: starting a new project on the Smart360 stack

A step-by-step guide for a new project at Espace La Caverne (Bomexport), using the same
technologies and conventions as the Smart360 ERP. Every pattern below is taken from the
ERP's own code (`esapcecaverne` repository), so the new project will feel familiar to the
team and can share code, users and the database with Smart360.

---

## 0. How to use this guide

1. Read sections 1 and 2 before writing any code.
2. Follow sections 3 to 7 to set the project up, in order.
3. Keep section 9 (checklists) open while you work.
4. Copy the templates in section 10 instead of starting files from scratch.

---

## 1. The stack (same versions as Smart360)

| Layer | Technology | Version used in Smart360 |
|---|---|---|
| Server | Node.js | 20.x |
| API | Express | 5.1 |
| Database driver | mysql2 (promise API, connection pool) | 3.14 |
| Authentication | jsonwebtoken (JWT, 12 h) | 9.0 |
| Config | dotenv | 16.x |
| Database | MariaDB | 11.x |
| Web app | React (Create React App) | 18.3 |
| Web UI | Bootstrap 5.3, Ant Design 5.23, react-bootstrap | - |
| Web HTTP | axios (with a token interceptor) | 1.9 |
| Mobile app | React 18 + TypeScript + Vite 4 | - |
| Mobile packaging | Capacitor (Android) | 8.1 |
| Mobile styling | Tailwind CSS 3 | - |
| Version control | Git + GitHub | - |
| Process manager (server) | PM2 (`ecosystem.config.js`) | - |

**Rule:** do not add a new framework (no NestJS, no Next.js, no ORM) unless the team asks
for it. The value of using the same stack is that anyone on the team can maintain it.

---

## 2. Before writing code: understand the business

What made the Ventes en ligne work succeed, to repeat on the new project:

- **Get the requirements in writing**, then number them (BF01, BF02… for functional,
  BNF01… for non-functional). Turn each into a user story in the backlog.
- **Read the existing code and data before deciding.** Many rules are not written down;
  they are in the data. Example from the internship: the free-delivery threshold and the
  discount units were recovered by querying the order history, not guessed.
- **Check every assumption with a SQL query** on a copy of the database before treating
  it as true.
- **Write down every decision** taken without a clear instruction, in a decisions file
  (see section 8), so the management can validate or change it.
- **Ask early:** who are the actors (shop employee, head office, IT…)? Which shop does each
  piece of data belong to? Which values must be configurable without a code change?

---

## 3. Project layout

Mirror the ERP's layout so files are where the team expects them:

```
nouveau-projet/
├── backend/
│   ├── index.js                 # Express app: CORS, JSON, routes, listen
│   ├── .env                     # secrets, NEVER committed
│   ├── config/
│   │   ├── db.js                # mysql2 pool
│   │   └── <module>Params.js    # cached settings table (optional)
│   ├── middleware/
│   │   └── auth.js              # requireAuth, requireLevel, signToken
│   ├── routes/<module>Routes.js
│   ├── controllers/<Module>Controller.js
│   ├── utils/                   # shared helpers
│   └── sql/
│       ├── create_<table>.sql   # one script per schema change
│       └── run_<name>_setup.js  # runner for that script
├── frontend/                    # React 18 (CRA)
│   └── src/
│       ├── config/config.js     # API_BASE_URL per environment
│       ├── context/AuthContext.jsx
│       ├── Router/router.jsx
│       └── feature-module/<module>/
├── mobile/                      # Vite + React + TS + Capacitor
│   └── src/
│       ├── config/api.ts        # API_BASE_URL, authFetch, ensureOk
│       └── pages/
└── docs/
    ├── <module>-spec.md         # requirements, decisions, changelog
    └── <module>-status.md       # what is done / partial / pending
```

> If the new project is a **new module inside Smart360** rather than a separate app, do
> not create new folders: add `routes/`, `controllers/` and `feature-module/` files in the
> existing repository, on a dedicated Git branch.

---

## 4. Backend

### 4.1 Initialise

```bash
mkdir backend && cd backend
npm init -y
npm install express@5 mysql2 jsonwebtoken dotenv cors
npm install -D nodemon
```

`package.json` scripts, as in Smart360:

```json
"scripts": {
  "start": "node index.js",
  "dev": "nodemon index.js"
}
```

### 4.2 Environment file (`backend/.env`)

```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=...
DB_PASSWORD=...
DB_NAME=Smart360_copy        # always a COPY during development
JWT_SECRET=<long random string>
JWT_EXPIRES_IN=12h
```

- Add `.env` to `.gitignore` **before** the first commit. Never commit it.
- There is deliberately **no default** for `JWT_SECRET`: without it, protected routes refuse
  every request instead of silently using a guessable key.

### 4.3 Database pool (`config/db.js`), same as Smart360

```js
const mysql = require('mysql2/promise');

const connection = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME,
  connectTimeout: 10000,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Test the connection at startup
connection.query('SELECT 1')
  .then(() => console.log('Database connection successful!'))
  .catch((err) => console.error('Error connecting to the database:', err));

module.exports = connection;
```

### 4.4 Entry point (`index.js`)

```js
require('dotenv').config();            // first line: db.js reads process.env at require time
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors({ origin: '*', credentials: true, maxAge: 86400 })); // maxAge: avoid a preflight per call
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api', require('./routes/loginRoute'));
app.use('/api/mon-module', require('./routes/monModuleRoutes'));

app.get('/', (req, res) => res.send('Backend is running!'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
```

### 4.5 Authentication: reuse Smart360's middleware

Copy `backend/middleware/auth.js` from Smart360 as it is. It provides:

| Function | Role |
|---|---|
| `signToken(user)` | at login, signs a JWT with `CIN, USERNAME, NomAbr, Level, Departement, Boutique` (never the password) |
| `requireAuth` | checks `Authorization: Bearer <token>`, puts the caller in `req.user`, answers 401 otherwise |
| `requireLevel(n)` | answers 403 if `req.user.Level < n` |

The golden rule, written at the top of every Smart360 route file:

> **Identity always comes from `req.user`, never from `req.query` or `req.body`.**
> The browser controls the URL and the body; it does not control a signed token.

If the new project is a separate app, keep the **same `JWT_SECRET`** as Smart360 only if
the team wants one login for both; otherwise use its own secret.

### 4.6 Routes (`routes/monModuleRoutes.js`)

```js
const express = require('express');
const router = express.Router();
const { requireAuth, requireLevel } = require('../middleware/auth');
const c = require('../controllers/MonModuleController');

// Every route below requires a valid token.
router.use(requireAuth);

// Lookups and fixed paths FIRST: '/export' declared after '/:id' would be captured by it.
router.get('/export', c.exportItems);
router.get('/stats', requireLevel(4), c.getStats);

router.get('/', c.list);
router.post('/', c.create);
router.get('/:id', c.getById);
router.put('/:id', c.update);

module.exports = router;
```

### 4.7 Controllers: conventions

- **Always parameterised queries** (`?` placeholders), never string concatenation:
  ```js
  const [rows] = await db.query('SELECT * FROM COMMANDES WHERE BOUTIQUE = ?', [req.user.Boutique]);
  ```
- **Filter by the user's shop** on every read, unless the user is head office:
  check `req.user.Boutique` / `req.user.Departement` / `req.user.Level`.
- **On a single record**, check that it belongs to the caller's shop → 403 otherwise.
- **Multi-table writes in a transaction**:
  ```js
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    // INSERT header, INSERT lines...
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  ```
- **Same response shape everywhere**: `{ success: true, data }` or
  `{ success: false, message: "<phrase en français pour l'utilisateur>" }`.
- **Status codes** used in Smart360:

  | Code | When |
  |---|---|
  | 200 | success (create included) |
  | 400 | invalid input (missing customer, missing carrier…) |
  | 401 | no token / expired token |
  | 403 | authenticated but not allowed (other shop, level too low) |
  | 409 | business rule refused (e.g. "Une commande manifestée ne peut plus être annulée") |
  | 500 | unexpected error, **without** SQL or stack trace in the message |

- **Business rules live on the server.** The interface only *shows* them (disabled
  fields + explanation). A rule enforced only in the browser is not a rule.
- **The author of an action comes from the token** (`req.user.NomAbr`), never from a field
  the client sends.

### 4.8 Configurable values: settings table with cache

When a value may change (threshold, price product id, lock stage…), do not hard-code it.
Copy the pattern of `config/ventesEnLigneParams.js`:

- a table `PARAMETRES_<MODULE>` (`PARAM`, `VALEUR`, `DESCRIPTION`);
- a `DEFAULTS` object in code, so the module still works if the table is missing;
- an in-memory cache of 60 s;
- validation of each value, falling back to the default with a `console.warn` on a typo.

### 4.9 Schema changes

Never change the schema by hand. For each change:

1. `backend/sql/create_<table>.sql`: `CREATE TABLE IF NOT EXISTS …` + seed rows.
2. `backend/sql/run_<name>_setup.js`: loads `.env` itself (`require('dotenv').config({ path: … })`
   before `require('../config/db')`), strips `--` comments, runs each statement.
3. Run it on the **copy** first, then hand it to the team for production.

---

## 5. Database (MariaDB)

- **Work on `Smart360_copy`**, never on production. Note the row count of the tables you
  touch before a test session, delete your test data afterwards, and check that the count
  is back to its starting value.
- **Respect the existing naming**: tables are UPPERCASE with legacy names
  (`COMMANDES`, `DETAILS_COMMANDES`, `CUSTOMER`, `PRODUCTS`, `LISTE_DES_SALARIES`,
  `PASS_BOUTIQUE`, `SHIPPERS`…). New tables follow the same style.
- **Units**: discounts and VAT are stored as **fractions** (0.2 = 20 %) in the database, and
  sent as **percentages** between interface and server. Use one conversion function, in
  one place.
- **Users** are in `LISTE_DES_SALARIES` (`CIN`, `NomAbr`, `Boutique`, `Departement`,
  `Level`); reuse it rather than creating a new users table.
- **Shop codes**: `PASS_BOUTIQUE` holds a single-use 6-digit code per shop, regenerated every
  5 minutes. To protect a sensitive action, exchange the code server-side for a short signed
  grant (`signGrant` / `verifyGrant` in `auth.js`).
- Add an **index** when a screen filters a large table by shop and date
  (see `sql/index_big_cahier_store_date.sql`).

---

## 6. Web frontend (React 18)

### 6.1 API address per environment

Copy `frontend/src/config/config.js`: it detects the environment from the hostname
(`localhost` → `http://localhost:3000/api`, server IP → production API) and exports
`API_BASE_URL`. Never write an API URL anywhere else.

### 6.2 Token on every request

In `context/AuthContext.jsx`, register an axios interceptor **once**:

```js
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

At login (`POST /api/login`), store `response.data.token` and `response.data.user`;
at logout, remove them.

### 6.3 Pages and access

- One folder per module in `src/feature-module/<module>/`.
- Declare routes in `src/Router/router.jsx`; protect admin pages with the existing
  level-based guard (Smart360 lets in Level ≥ 4 or the INFORMATIQUE department).
- The guard in the browser is for comfort only; the **server must refuse too** (section 4.7).

### 6.4 UI rules

- Use the components already in the project (Bootstrap / react-bootstrap / Ant Design),
  not a new UI library.
- When the server would refuse an action, **disable the control and explain why**
  (tooltip or message), and display the server's French message on a refusal; never a
  bare "Erreur".
- Keep the same look as Smart360 (colours, tables, modals).

---

## 7. Mobile app (Vite + React + TypeScript + Capacitor)

### 7.1 Create and run

```bash
npm create vite@4 mobile -- --template react-ts
cd mobile
npm install @capacitor/core@8 @capacitor/android@8
npm install -D @capacitor/cli@8 tailwindcss@3 postcss autoprefixer
npx cap init
npx cap add android
npm run dev                      # in the browser
npm run build && npx cap sync android && npx cap open android   # Android Studio
```

Run against a local backend:

```bash
VITE_API_BASE_URL=http://localhost:3000/api npm run dev
```

### 7.2 API helpers (`src/config/api.ts`): copy from Smart360

- `API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '<production API>'`
- `authFetch(url, init)`: `fetch` with `Authorization: Bearer <token>` added.
- `ensureOk(res, fallback)`: **throws** on a non-2xx response with the server's message.

> Lesson from the internship: `fetch` does **not** fail on 400/403/409. Without
> `ensureOk`, the mobile app closed the form as if an order was saved when the server had
> refused it. Call `ensureOk` after **every** request.

```ts
const res = await ensureOk(
  await authFetch(`${API_BASE_URL}/mon-module`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }),
  "Erreur lors de l'enregistrement",
);
```

### 7.3 One rule, one place

Do not re-implement business rules in the mobile app: send the data, let the server
decide, show its message. Duplicating a rule in two clients is how the old mobile app
drifted away from the server.

---

## 8. Way of working

### 8.1 Scrum (as in the internship)

- **Product Owner**: the person who expresses the needs and validates (M. Tarek Ben Omrane
  in the previous project). **Scrum Master**: your company supervisor.
- **Backlog**: one user story per requirement, with priority (Haute / Moyenne / Basse).
- **Sprints** of one or two weeks, each with a clear goal.
- **Events**: planning at the start, a short daily point, a **demonstration at the end of
  each sprint** (review), a short retrospective.

### 8.2 Git

- One branch per feature: `feat/<module>-<sujet>`; never work directly on `main`.
- **One commit per validated task**, with a message that says what and why
  (e.g. *"Enforce the form rules and make refusals legible"*).
- Never commit `.env`, database dumps or test data.
- Push regularly; open a pull request for review before merging.

### 8.3 Testing (on disposable data)

For every rule, two checks:

1. **the request that must now be refused** is refused, with the right code and message
   (no token → 401, another shop → 403, broken rule → 409);
2. **the legitimate request** still works.

Do it at two levels: directly against the API, then in the web and mobile interfaces.
Delete the test data and check the row counts afterwards.

### 8.4 Documentation to keep up to date

- `docs/<module>-spec.md`: requirements (BF/BNF), decisions (D1, D2…) with the reason,
  changelog.
- `docs/<module>-status.md`: each requirement with its state (Réalisé / Partiel / À valider).

These two files are also the raw material for the internship report and the journal.

---

## 9. Checklists

### Day 1

- [ ] Access to the repository, a copy of the database, and a test account
- [ ] Node 20 installed, `npm install` OK in backend / frontend / mobile
- [ ] `backend/.env` created, **not committed**, pointing to the copy
- [ ] `npm run dev` on the backend: "Database connection successful!"
- [ ] Requirements received in writing and numbered
- [ ] Product Owner and Scrum Master identified, sprint length agreed

### Before each commit

- [ ] Every new route is behind `requireAuth`
- [ ] No identity read from `req.query` / `req.body`
- [ ] All SQL is parameterised
- [ ] Reads filtered by the user's shop; single records checked (403)
- [ ] Business rules enforced on the server, shown in the UI
- [ ] Refusals return `{ success: false, message }` in French; no SQL in error messages
- [ ] Mobile calls go through `authFetch` + `ensureOk`
- [ ] Schema change = a script in `backend/sql/`
- [ ] Test data deleted, counts checked
- [ ] Decision written in `docs/<module>-spec.md` if one was made

### Before a demo / delivery

- [ ] The refused and the legitimate scenario tested for each rule
- [ ] `docs/<module>-status.md` up to date
- [ ] Migration scripts listed for the team (to run on production)
- [ ] Settings rows seeded with their default values

---

## 10. Templates

### 10.1 Controller

```js
const db = require('../config/db');

const isHeadOffice = (user) => (parseInt(user.Level) || 0) >= 4 || user.Departement === 'INFORMATIQUE';

exports.list = async (req, res) => {
  try {
    const params = [];
    let where = '1=1';
    if (!isHeadOffice(req.user)) {
      where += ' AND BOUTIQUE = ?';
      params.push(req.user.Boutique);
    }
    const [rows] = await db.query(`SELECT * FROM MA_TABLE WHERE ${where} ORDER BY ID DESC LIMIT 200`, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('[MonModule] list', error);
    res.status(500).json({ success: false, message: 'Erreur lors du chargement des données' });
  }
};

exports.getById = async (req, res) => {
  try {
    const [[row]] = await db.query('SELECT * FROM MA_TABLE WHERE ID = ?', [req.params.id]);
    if (!row) return res.status(404).json({ success: false, message: 'Élément introuvable' });
    if (!isHeadOffice(req.user) && row.BOUTIQUE !== req.user.Boutique) {
      return res.status(403).json({ success: false, message: "Cet élément n'appartient pas à votre boutique" });
    }
    res.json({ success: true, data: row });
  } catch (error) {
    console.error('[MonModule] getById', error);
    res.status(500).json({ success: false, message: 'Erreur lors du chargement' });
  }
};
```

> Adjust `isHeadOffice` to the rule the management confirms for the new project.

### 10.2 SQL migration

```sql
-- backend/sql/create_parametres_mon_module.sql
CREATE TABLE IF NOT EXISTS PARAMETRES_MON_MODULE (
  PARAM       VARCHAR(64)  NOT NULL PRIMARY KEY,
  VALEUR      VARCHAR(255) NOT NULL,
  DESCRIPTION VARCHAR(255) NULL
);

INSERT IGNORE INTO PARAMETRES_MON_MODULE (PARAM, VALEUR, DESCRIPTION) VALUES
  ('SEUIL_EXEMPLE', '250', 'Exemple de seuil paramétrable');
```

### 10.3 Web call

```js
import axios from 'axios';
import { API_BASE_URL } from '../../config/config';

try {
  const { data } = await axios.post(`${API_BASE_URL}/mon-module`, payload);
  // data.success === true
} catch (err) {
  const message = err.response?.data?.message || "Erreur lors de l'enregistrement";
  // show `message` to the user, keep the form open
}
```

---

## 11. Common pitfalls (seen in Smart360)

| Pitfall | Consequence | Avoid it by |
|---|---|---|
| Identity taken from the URL (`?userLevel=…`) | anyone could read every shop's customers | `req.user` from the token only |
| Rule checked only when a field is present | omit the field → bypass the rule | validate unconditionally on the server |
| Rule only in the browser | the API accepts anything | enforce in the controller |
| Guessing units (1 % vs 100 %) | wrong amounts displayed | one documented unit, one conversion function |
| Column too short for a generated id | every insert fails | check column sizes before generating ids |
| `fetch` without `ensureOk` | refused saves look successful | `ensureOk` on every mobile call |
| Lines deleted and recreated on every edit | lost history, extra load | compare and update only changed lines |
| `/:id` declared before `/export` | `/export` never reached | fixed paths before parameterised ones |
| Hard-coded secret or price | forgeable tokens, stale prices | `.env` for secrets, read prices from the data |
