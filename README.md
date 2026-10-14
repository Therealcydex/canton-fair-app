# Sourcing

Canton Fair sourcing app for the buyers of Tarek's group: suppliers (Chinese province) and
contacts, booths to visit (booth code, Canton Fair category, visited flag), products with price,
MOQ, shipping type and photos, shared with Tarek's companies. Self sign-up validated by the
admin. Built on the Smart360 stack (`guide-nouveau-projet-smart360.md`), on Tarek's schema v2.

| Folder | What | Stack |
|---|---|---|
| `backend/` | REST API (`/api/...`) and product photos (`/uploads/...`) | Node 20, Express 5, mysql2, JWT |
| `frontend/` | Web app (all features, administration) | React 18 (Create React App), Ant Design, Bootstrap |
| `mobile/` | App for the fair floor | Vite, React, TypeScript, Tailwind, Capacitor 8 |
| `docs/` | Requirements, decisions (D1…), status | |

Read `docs/sourcing-spec.md` first: the decisions D1–D33 and the open questions on schema v2
are waiting for the Product Owner's validation.

## Run it locally

Needs Node 20 and MySQL 8 or MariaDB 10.4+ (XAMPP works).

```bash
# 1. Backend — port 3000
cd backend
npm install
cp .env.example .env            # fill in JWT_SECRET (long random) and SEED_ADMIN_PASSWORD
npm run db:setup                # creates the database, the lists, the v2 tables and the admin
npm run db:demo                 # optional, backend running: demo companies, users, suppliers…
npm run dev

# 2. Web app — port 3001
cd frontend
npm install
PORT=3001 npm start             # PowerShell: $env:PORT=3001; npm start

# 3. Mobile app in the browser — port 5173 (see mobile/README.md for Android)
cd mobile
npm install
npm run dev
```

Log in with `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` (the admin) and create Tarek's
companies. Buyers sign up from the login page ("Créer un compte"); the admin activates them in
Administration › Utilisateurs › En attente de validation.

## Tests

```bash
cd backend && npm run test:api                   # backend running, local database only; 254 checks
cd backend && npm run test:api -- products       # one scenario file
cd frontend && CI=true npm test -- --watchAll=false
cd mobile && npm run lint && npm run build
```

`test:api` replays, for every rule, the request that must be refused (401, 403, 400, 409…) and
the legitimate one, against the running backend. Its data is named `TEST…`; it is deleted at
the end and the row counts are checked. Run it on a development database, never production.

## Deploy

1. **Database**: on a database that still has the schema v1 tables, run `npm run db:drop-v1 -- --yes`
   once (their data is lost). Then `npm run db:setup` runs, in order, `china_provinces.sql`,
   `canton_fair_categories.sql` and `create_sourcing_schema.sql`, and creates the admin.
2. **Backend**: `npm ci --omit=dev`, a production `.env` (its own `JWT_SECRET`), then
   `pm2 start ecosystem.config.js` (see the comments in that file). Keep `backend/uploads/`
   between deployments: it holds the product photos.
3. **Web app**: `REACT_APP_API_BASE_URL=https://<server>/api npm run build`, then serve
   `frontend/build/` as static files.
4. **Mobile app**: `VITE_API_BASE_URL=https://<server>/api`, then the Android build in
   `mobile/README.md` (Capacitor needs Node 22). Switch `capacitor.config.ts` to https.

If the API runs behind a reverse proxy (nginx), add `app.set('trust proxy', 1)` in
`backend/index.js` so the login attempt limit sees the users' addresses, not the proxy's.
