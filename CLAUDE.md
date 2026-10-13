# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

This project has not been scaffolded yet. The only source of truth is
`guide-nouveau-projet-smart360.md`. Read it before creating files: it sets the stack, the layout,
and the conventions. This is a new app for Espace La Caverne (Bomexport) and must match the
Smart360 ERP (the `esapcecaverne` repository). The guide says to copy these files from that
repository rather than writing new code:

- `backend/middleware/auth.js` provides `signToken`, `requireAuth`, `requireLevel`, `signGrant` and `verifyGrant`. Copy it as it is.
- `backend/config/db.js` is the mysql2 promise pool.
- `backend/config/ventesEnLigneParams.js` is the cached settings-table pattern.
- `backend/sql/create_*.sql` and `run_*_setup.js` are the migration scripts and their runners.
- `frontend/src/config/config.js` holds `API_BASE_URL` for each environment.
- `mobile/src/config/api.ts` provides `authFetch` and `ensureOk`.

When the project is scaffolded, update this file with the real commands and structure.

## Stack (fixed: do not add frameworks, ORMs, NestJS or Next.js without the team's agreement)

- **backend/**: Node 20, Express 5, mysql2 (promise pool, raw SQL), jsonwebtoken (12 h), dotenv, and MariaDB 11. Run `npm run dev` (nodemon) or `npm start`. PM2 runs it in production.
- **frontend/**: React 18 (Create React App), Bootstrap 5.3, react-bootstrap, Ant Design 5, and axios with a token interceptor.
- **mobile/**: Vite 4, React 18, TypeScript, Tailwind 3 and Capacitor 8 (Android).
  - Run against a local API with `VITE_API_BASE_URL=http://localhost:3000/api npm run dev`.
  - Build for Android with `npm run build && npx cap sync android && npx cap open android`.
- **docs/**: `<module>-spec.md` holds requirements (BF/BNF), decisions (D1…) and the changelog. `<module>-status.md` tracks progress (Réalisé / Partiel / À valider). Keep both up to date.

There is no automated test suite in the stack. Test each rule twice, against the API and then
in the UI:

1. Send the request that must be refused and check its status: 401 without a token, 403 for another shop, 409 for a broken rule.
2. Send the legitimate request and check that it still succeeds.

## Backend rules (non-negotiable)

- **Load dotenv first.** `require('dotenv').config()` is the first line of `index.js`, because `db.js` reads `process.env` when it is required.
- **Secrets**: `.env` is never committed. `JWT_SECRET` deliberately has no default.
- **Development database**: work against `Smart360_copy`, never production. Record row counts before testing and confirm afterwards that the test data is deleted.
- **Authentication**: every route file calls `router.use(requireAuth)`. Identity comes only from `req.user`, never from `req.query` or `req.body`. The author of an action is `req.user.NomAbr`.
- **Shop scoping**:
  - Reads filter by `req.user.Boutique` unless the caller is head office. In Smart360, head office means `Level >= 4` or `Departement === 'INFORMATIQUE'`; confirm this rule for the new project.
  - A request for a single record from another shop returns 403.
- **SQL**: queries always use `?` placeholders. Multi-table writes run in a transaction (`getConnection`, `beginTransaction`, `commit` or `rollback`, `release`).
- **Route order**: declare fixed paths such as `/export` and `/stats` before `/:id`.
- **Responses**: success returns `{ success: true, data }`. A refusal returns `{ success: false, message }`, with the message in French. Status codes:
  - 200 for success, creation included
  - 400 for invalid input
  - 401 for a missing or expired token
  - 403 when the caller is not allowed
  - 409 when a business rule refuses the request
  - 500 for unexpected errors, with no SQL or stack trace in the message
- **Business rules**: enforce them on the server and validate unconditionally. The web and mobile UIs only display them: they disable the control, explain why, and show the server's message.
- **Configurable values**: store them in a `PARAMETRES_<MODULE>` table (`PARAM`, `VALEUR`, `DESCRIPTION`). Keep code `DEFAULTS` and a 60 s cache. When a value is invalid, fall back to the default and log a `console.warn`.
- **Schema changes**: never alter the schema by hand. Each change gets two files in `backend/sql/`:
  - `create_<table>.sql`, using `CREATE TABLE IF NOT EXISTS` and `INSERT IGNORE` seeds
  - `run_<name>_setup.js`, which loads `.env` itself
- **Database conventions**:
  - Tables use legacy UPPERCASE names (`COMMANDES`, `CUSTOMER`, `LISTE_DES_SALARIES`, `PASS_BOUTIQUE`…). Reuse `LISTE_DES_SALARIES` for users.
  - Discounts and VAT are stored as fractions (0.2) and travel between UI and API as percentages. Convert them in one function.

## Client rules

- **Web**: the only API URL lives in `API_BASE_URL` from `src/config/config.js`. Register the axios interceptor once, in `AuthContext.jsx`; it reads `localStorage.authToken`. Declare routes in `src/Router/router.jsx` and put each module in `src/feature-module/<module>/`.
- **Mobile**: every call goes through `authFetch` followed by `ensureOk`, because `fetch` does not reject on 4xx. Never re-implement business rules in the mobile app.

## Git workflow

- Work on branches named `feat/<module>-<sujet>`, never directly on `main`.
- Make one commit per validated task, with a message that says what changed and why.
- Merge through a pull request.
