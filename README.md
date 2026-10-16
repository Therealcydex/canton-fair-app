# Sourcing

Canton Fair sourcing app for the buyers of Tarek's group: suppliers and their contacts (WeChat QR
codes, business cards), booths to visit (written as on the fair's badges, `10.3A08-23`), products
with price, MOQ, shipping type, photos and the booth where they were found, the boss's decision on
each product (evening review), the official hall plan of the fair, and sharing with Tarek's
companies. There is no sign-up: the administrator creates the accounts.

| Folder | What | Stack |
|---|---|---|
| `backend/` | REST API (`/api/...`) and photos (`/uploads/...`) | Node 20, Express 5, mysql2, JWT |
| `frontend/` | The app, on a computer and on the phone (installed on the iPhone home screen): WeChat QR scanner, business cards, evening review, administration | React 18 (Create React App), Ant Design, Bootstrap |
| `deploy/` | Going online, database guide, backups | nginx, PM2 |
| `docs/` | Requirements, decisions (D1…), status | |

## Quick start (your PC)

You need **Node 20** and **MySQL 8 or MariaDB 10.4+** (XAMPP is fine).

**1. Backend** (port 3000)

```bash
cd backend
npm install
cp .env.example .env      # then edit .env: database, JWT_SECRET, first admin
npm run db:setup          # creates the database, the lists, the tables and the admin
npm run db:add-fair-plan  # the official hall plan of the 140th fair
npm run dev
```

In `.env`: `DB_HOST` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` for your database, `JWT_SECRET` a
long random string, `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` the first administrator. The
file stays on your PC: it is never committed.

**2. Web app** (port 3001), in a second terminal

```bash
cd frontend
npm install
PORT=3001 npm start       # PowerShell: $env:PORT=3001; npm start
```

Open http://localhost:3001 and log in with the administrator.

**3. On a phone** (same Wi-Fi as the PC)

The same app adapts to the phone's screen (tab bar at the bottom, "À visiter" as a checklist). The
camera (WeChat QR scanner) only opens on https, so use instead of `npm start`:

```bash
cd frontend
npm run start:phone       # https on port 3001, /api passed to the backend on port 3000
```

Open `https://<PC address>:3001` on the phone (PC address: `ipconfig`, Wi-Fi IPv4), accept the
certificate warning once, and allow port 3001 in the Windows firewall if the page does not open.

**4. First steps in the app** (administrator)
1. *Administration › Sociétés*: create Tarek's companies.
2. *Administration › Utilisateurs*: create an account for each buyer (role Acheteur) and for the
   boss (role Administrateur: he makes the decisions of the evening review).
3. Everyone can then record suppliers, booths and products, on the web or the phone.

## Database

**The tables are not created when the app is built or started.** They are created by SQL scripts
that are in this repository, in `backend/sql/`. Nobody needs to send a separate SQL file or a copy
of a database: the code in git is enough.

| Command (in `backend/`) | What it does |
|---|---|
| `npm run db:setup` | Runs, in order, `china_provinces.sql`, `canton_fair_categories.sql`, `canton_fair_sections_140.sql` and `create_sourcing_schema.sql` (reference lists, tables, views), then creates the first administrator from `.env` |
| `npm run db:add-fair-plan` | Loads the official hall plan of the 140th fair |
| `npm run db:update-…` | Only for a database created with an older version: brings it up to date (list and order in `docs/sourcing-status.md`, "Migration scripts") |

Every script checks what is already there (`CREATE TABLE IF NOT EXISTS`, `INSERT IGNORE`): running
one twice does nothing the second time, and existing data is kept.

The app adds its own lowercase tables next to the ERP's tables and never touches the ERP.
To install it on the real database (backup, settings, the app's own database account) or to bring
over the data of a copy, follow **[deploy/DATABASE.md](deploy/DATABASE.md)**.

## Tests

```bash
cd backend && npm run test:api                  # backend running, development database only
cd backend && npm run test:api -- products      # one scenario file
cd frontend && CI=true npm test -- --watchAll=false
cd frontend && CI=true npm run build
```

`test:api` replays, for every rule, the request that must be refused (401, 403, 400, 409…) and
the one that must work. Its data is named `TEST…` and is deleted at the end. It refuses to run
on a remote database: never run it against production.

## Going online

`deploy/README.md`: one https address on the server (`https://76-13-55-161.sslip.io`), the app
at `/` (on the iPhone: Safari › Share › Add to Home Screen), the API at `/api/`
behind nginx, nightly backups, and the checks before the fair (access from China, security).

## Before working on the code

Read `CLAUDE.md` (conventions, commands, rules) and `docs/sourcing-spec.md` (requirements and
decisions, still to be validated by the Product Owner).
