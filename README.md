# Sourcing

Canton Fair sourcing app for the buyers of Tarek's group: suppliers and their contacts (WeChat QR
codes, business cards), booths to visit (written as on the fair's badges, `10.3A08-23`), products
with price, MOQ, shipping type, photos and the booth where they were found, the boss's decision on
each product (evening review), the official hall plan of the fair, and sharing with Tarek's
companies. There is no sign-up: the administrator creates the accounts.

| Folder | What | Stack |
|---|---|---|
| `backend/` | REST API (`/api/...`) and photos (`/uploads/...`) | Node 20, Express 5, mysql2, JWT |
| `frontend/` | Web app (everything, administration) | React 18 (Create React App), Ant Design, Bootstrap |
| `mobile/` | App for the fair floor (iPhone home-screen app) | Vite, React, TypeScript, Tailwind |
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

**3. Mobile app** (port 5173), in a third terminal

```bash
cd mobile
npm install
cp .env.example .env      # VITE_API_BASE_URL: the backend address seen from the phone
npm run dev               # in a browser: http://localhost:5173
npm run dev:phone         # on a phone on the same Wi-Fi, with the camera: https://<PC address>:5173
```

`mobile/README.md` explains the phone test (certificate, Windows firewall).

**4. First steps in the app** (administrator)
1. *Administration › Sociétés*: create Tarek's companies.
2. *Administration › Utilisateurs*: create an account for each buyer (role Acheteur) and for the
   boss (role Administrateur: he makes the decisions of the evening review).
3. Everyone can then record suppliers, booths and products, on the web or the phone.

## Database

The app adds its own lowercase tables next to the ERP's tables and never touches the ERP.
To install it on the real database, or to bring over the data of a copy, follow
**[deploy/DATABASE.md](deploy/DATABASE.md)**. When a version changes the schema, its `npm run db:…`
script is listed in `docs/sourcing-status.md` ("Migration scripts").

## Tests

```bash
cd backend && npm run test:api                  # backend running, development database only
cd backend && npm run test:api -- products      # one scenario file
cd frontend && CI=true npm test -- --watchAll=false
cd mobile && npm run lint && npm run build
```

`test:api` replays, for every rule, the request that must be refused (401, 403, 400, 409…) and
the one that must work. Its data is named `TEST…` and is deleted at the end. It refuses to run
on a remote database: never run it against production.

## Going online

`deploy/README.md`: one https address on the server (`https://76-13-55-161.sslip.io`), the web
app at `/`, the iPhone app at `/m/` (Safari › Share › Add to Home Screen), the API at `/api/`
behind nginx, nightly backups, and the checks before the fair (access from China, security).

## Before working on the code

Read `CLAUDE.md` (conventions, commands, rules) and `docs/sourcing-spec.md` (requirements and
decisions, still to be validated by the Product Owner).
