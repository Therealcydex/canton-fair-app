# Sourcing

Trade-fair sourcing app (Canton-Fair-style booths) for buyers from several companies: suppliers
and contacts, booths to visit and visit log, products with price in TND, MOQ, incoterm and
photos, and products shared between companies. Built on the Smart360 stack
(`guide-nouveau-projet-smart360.md`).

| Folder | What | Stack |
|---|---|---|
| `backend/` | REST API (`/api/...`) and product photos (`/uploads/...`) | Node 20, Express 5, mysql2, JWT |
| `frontend/` | Web app (all features, administration) | React 18 (Create React App), Ant Design, Bootstrap |
| `mobile/` | App for the fair floor | Vite, React, TypeScript, Tailwind, Capacitor 8 |
| `docs/` | Requirements, decisions (D1…), status | |

Read `docs/sourcing-spec.md` first: the decisions D1–D21 are waiting for the Product Owner's
validation.

## Run it locally

Needs Node 20 and MySQL 8 or MariaDB 10.4+ (XAMPP works).

```bash
# 1. Backend — port 3000
cd backend
npm install
cp .env.example .env            # fill in JWT_SECRET (long random) and SEED_ADMIN_PASSWORD
npm run db:setup                # creates sourcing_db, its tables and the super-admin
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

Log in with `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` (the super-admin), create the
companies and their users, then log in as a user of a company to work with its data.

## Tests

```bash
cd backend && npm run test:api                   # backend running; ~190 checks
cd backend && npm run test:api -- products       # one scenario file
cd frontend && CI=true npm test -- --watchAll=false
cd mobile && npm run lint && npm run build
```

`test:api` replays, for every rule, the request that must be refused (401, 403, 400, 409…) and
the legitimate one, against the running backend. Its data is named `TEST…`; it is deleted at
the end and the row counts are checked. Run it on a development database, never production.

## Deploy

1. **Database**: create the database and run, in order, the scripts of `backend/sql/`:
   - `create_sourcing_schema.sql` (with `npm run db:setup`, which also creates the super-admin).
2. **Backend**: `npm ci --omit=dev`, a production `.env` (its own `JWT_SECRET`), then
   `pm2 start ecosystem.config.js` (see the comments in that file). Keep `backend/uploads/`
   between deployments: it holds the product photos.
3. **Web app**: `REACT_APP_API_BASE_URL=https://<server>/api npm run build`, then serve
   `frontend/build/` as static files.
4. **Mobile app**: `VITE_API_BASE_URL=https://<server>/api`, then the Android build in
   `mobile/README.md` (Capacitor needs Node 22). Switch `capacitor.config.ts` to https.

If the API runs behind a reverse proxy (nginx), add `app.set('trust proxy', 1)` in
`backend/index.js` so the login attempt limit sees the users' addresses, not the proxy's.
