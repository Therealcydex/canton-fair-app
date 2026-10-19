# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Sourcing** is a standalone app for the buyers of Tarek's group at the Canton Fair. Buyers keep
suppliers and contacts, plan the booths to visit and mark them visited, record products (price,
MOQ, shipping type, photos); the admin shares booths with Tarek's companies, whose viewers read them (D62). The data is shared by the
whole group. It has its own tables and its own login; there is no sign-up, the admin creates the accounts (D46). It
follows the Smart360 code conventions in `guide-nouveau-projet-smart360.md`, but none of the
Smart360 data: no `LISTE_DES_SALARIES`, no `Boutique`, no UPPERCASE table names.

- `docs/sourcing-spec.md` holds the actors, requirements (BF01–BF20, BNF01–BNF06), decisions (D1–D52, several replaced by schema v2) and open questions. The decisions are not yet validated by the Product Owner. Read it before working on a feature, and add a decision there when you make one.
- `docs/sourcing-status.md` tracks the state of each requirement, what was checked, and the migration scripts in order. Update it when a requirement changes.
- Sprints 0–6 were built on schema v1; branch `feat/sourcing-schema-v2` moves everything to schema v2 (sign-up was added, then removed by D46). What remains: the PO's validation and the hand checks listed in the status file.

## Commands

Backend (`backend/`, Node 20):
- `npm run dev` runs the server with nodemon on port 3000. `npm start` runs it without reloading.
- `npm run db:setup` creates the database if it is missing and runs, in order, `sql/china_provinces.sql`, `sql/canton_fair_categories.sql` (only into an empty table), `sql/canton_fair_sections_140.sql` (the sections it lacks, D41) and `sql/create_sourcing_schema.sql`. It then seeds the admin (`role = 'ADMIN'`) from `SEED_ADMIN_USERNAME` and `SEED_ADMIN_PASSWORD`. It is safe to run twice.
- `npm run db:update-booth-code` (D32) , `npm run db:update-product-decision` (D38) `npm run db:add-canton-sections` (D41) `npm run db:update-fair-plan` (D42) `npm run db:update-product-booth` (D43) and `npm run db:update-level-floor` (D56: level 1-5, floor 0-4) and `npm run db:add-fair-plan` (D48, the 140th fair's hall plan from `sql/fair_plan_140.js`; a section an admin corrected is kept) and `npm run db:update-boss-fixes` (D61-D63) and `npm run db:update-booth-edition` (D64: `booths.edition`, 140 by default) bring a database set up before them up to date; each step runs only if still needed.
- `npm run db:drop-v1 -- --yes` drops the schema v1 tables, once, before `db:setup` (it refuses tables that are not v1). `npm run db:demo` loads demo data through the API (14 suppliers over the 3 phases, products with photos and decisions; the demo buyers end inactive) and `npm run db:demo -- --remove` removes it.
- `backend/.env` points to the remote `Smart360_copy` (MariaDB 11.8); the local values are in a comment there. The API scenarios refuse to run on a remote database.
- Copy `.env.example` to `.env` and fill in the values. `JWT_SECRET` deliberately has no default.
- `npm run test:api` runs the API scenarios in `tests/*.scenario.js` against the running backend; `npm run test:api -- booths` runs only the files whose name contains "booths". Add scenarios there for every new rule.
- The local database is XAMPP MariaDB 10.4 on port 3306 (`root`, no password). Its client is `/c/xampp/mysql/bin/mysql.exe`. The target is MySQL 8, so keep SQL portable to both.
- `ecosystem.config.js` runs it under PM2 in production, as a single instance. Production: `deploy/README.md` (nginx, https at `76-13-55-161.sslip.io`, `deploy/deploy.sh` from the PC, `HOST=127.0.0.1`, `TRUST_PROXY=1`, database user `sourcing_app`, nightly backup).

Frontend (`frontend/`, Create React App, React 18.3). It is the only client (D52): it adapts to the phone and is installed on the iPhone home screen; the former `mobile/` app was merged into it.
- `PORT=3001 npm start` runs the dev server (the backend uses 3000).
- `npm run start:phone` runs it over https on port 3001 (local certificate) with `/api` and `/uploads` passed to the backend on port 3000 (`"proxy"` in package.json): use it on a phone, since the QR scanner's camera needs https (D34).
- `npm run build` builds for production; set `REACT_APP_API_BASE_URL` for a production API.
- `CI=true npm test -- --watchAll=false` runs the tests once. Add `-t "<test name>"` to run a single test.
- `contacts.wechat_qr` (D34): a scanned link (`http(s)://`, the app draws the QR code from it), an older photo path (`/uploads/wechat/`), or older text: `src/utils/qr.js`. Live scanner: `components/QrScanner.jsx`.
- Business cards (D37): `src/utils/ocr.js` (tesseract.js, loaded on the first card), `src/utils/cardParser.js` (fields from the text), `components/CardScanButton.jsx`. The reader's files are copied to `public/ocr/` (not committed) by `scripts/copy-ocr.cjs`, which runs before `start`, `start:phone` and `build`.
- Images (D61): `src/utils/image.js` resizes a picture to a JPEG data URL before sending; `components/ProductThumb.jsx` shows a product thumbnail or its placeholder; `feature-module/products/PhotosField.jsx` is the photo field of the product form; `components/ContactAvatar.jsx` and `feature-module/contacts/ContactCard.jsx` show a contact's photo (D63) and its card.
- Installed app (D36/D52): `public/manifest.json`, `public/sw.js` (registered in production only, never caches `/api` or `/uploads`), icons from `node scripts/make-icons.cjs`. On small screens `AppLayout` adds a bottom tab bar; "À visiter" becomes a checklist (`BoothList` `checklist`).

## Backend structure

Each module has `routes/<module>Routes.js` and `controllers/<Module>Controller.js`. Reuse these
shared helpers instead of rewriting them:
- `utils/http.js`: `fail`, `handle` (wraps a controller so any throw becomes a clean 500), `toId`, `clean`, `likeContains` (escapes LIKE wildcards).
- `utils/validate.js`: `validate(body, FIELDS, existing)`, which checks every field, missing or not. On an update, `existing` fills the fields the client did not send. DECIMAL values stay strings.
- `utils/scope.js`: `loadSupplier`, `loadBooth`, `loadProduct`, `loadCompany` find a record by id (400 for a bad id, 404 when missing).
- `utils/access.js`: `isAdmin`, `isViewer`, `ROLES`.
- `utils/upload.js`: WeChat QR photo upload (older QR photos in `uploads/wechat/`, D33). It checks the file content against JPEG/PNG/WebP signatures, saves under random names and deletes files. Delete the files when you delete their rows (D28).
- `utils/dataImage.js`: `parseDataImage(value, maxBytes, label)` checks a Base64 image (D61: product photos, contact avatars): format, real content, size.
- `middleware/auth.js`: `requireAuth` (reloads the user on every request, refuses `is_active = 0`), `requireAdmin`, `refuseViewer` (D62: 403 for a LECTEUR; put it after `requireAuth` in every new route file). `middleware/loginLimiter.js` limits failed logins.

## Data model (schema v2) and access rule

Tarek's schema v2 (`backend/sql/create_sourcing_schema.sql`, corrections D22-D30 in the spec):
- `companies` (name, branch) are Tarek's companies. A user may belong to one (`users.company_id`, SET NULL on delete).
- `suppliers` have a `province_id` (`china_province`), `contacts`, `booths` (supplier optional) and `products` (supplier optional).
- `booths`: phase 1-3, hall 1-18, floor 0-4 (D56), letter and numbers (optional, together); `booth_code` is a generated column in the fair's notation, numbers on 2 digits (`1.1D22`, `10.3A08-23`, `9.1`, D32/D50), and `v_booths.zone` gives the zone from the hall (A 1-8, B 9-13, C 14-16, D 17-21), and a booth is unique per phase (the apps say "booth", never "stand", D44); `category_id` points to `canton_fair_category` (read-only list, per phase); `visited` is the "to visit" flag.
- `products`: `price DECIMAL(12,2)`, `shipping_type` (FK to `shipping_types`, FOB by default), `product_images` (D61: Base64 `image_data` and `thumb_data`, sent with the product as `images_add`/`images_remove`; D62: products are no longer shared; `product_shares` stays, unused). D38: `status` (`A_ETUDIER` until the admin decides `RETENU`, `ECHANTILLON`, `A_COMMANDER` or `REJETE`), `decision_note`, `decided_by/at`, `created_by/at`. Only the admin decides (`PUT /api/products/:id/decision`); `GET /api/products/review` is the evening review queue (web page "Revue du soir", `/revue`). D43: `booth_id`, the booth where it was found (a booth of its supplier).
- D62: `booth_shares` (`booth_id`, `company_id`, `shared_by/at`): the booths the admin shares with a company (`share_company_ids` in the booth body; `shared_company_ids` in the booth rows).
- Views `v_booths`, `v_suppliers` (booth count, % visited), `v_products` (shipping name, decision, booth): keep them free of GROUP BY (D23).
- D42/D48: `section_halls` holds the hall plan like the official one (365.cantonfair.org.cn/en-US/exhibition-hall-map): one row per section and area (A = halls 1-8, B = 9-13, C = 14-16, D = 17-21), its codes as the site writes them and its rank in the area. `GET /api/fair-plan` returns it in the plan's order; `PUT /api/fair-plan` (admin) takes all the codes of a section and the server splits them by area (`utils/halls.js`). The app has no plan page any more (D55): the booth form only shows the halls of the chosen section (`hallsOf` in `frontend/src/utils/fairPlan.js`); `suppliers.cantonfair_url` only takes a cantonfair.org.cn address.
- Reference lists are served by `GET /api/lists/provinces|shipping-types|canton-categories`.
- `GET /api/contacts` (filters `q`, `supplier_id`, `has_qr`) lists every contact with its supplier, and `GET /api/contacts/export` gives the same list as CSV; contacts are still written through `/api/suppliers/:id/contacts` (D63: with `avatar`, a Base64 photo).

Access rule: there is **no per-company isolation** for the buyers. Every active `ACHETEUR` reads and writes every supplier, contact, booth and product. `role = 'ADMIN'` also manages companies and users (it creates every account and activates or deactivates it, `requireAdmin`) and shares booths with companies (D62). `role = 'LECTEUR'` (D62) is a company viewer: it must have a company, it only reads the booths shared with that company (`GET /api/booths`, `GET /api/booths/:id`, the reference lists) and every other route answers 403. `level` is a number from 1 to 5 or none (D56). There is no sign-up (D46).

The tables are lowercase and live next to the ERP's UPPERCASE tables in `Smart360_copy`: never touch an UPPERCASE table. The pool keeps decimals as strings (`decimalNumbers: false`), so never round prices through a JavaScript float.

## Backend rules (from the guide, non-negotiable)

- **Load dotenv first.** `require('dotenv').config()` is the first line of `index.js`, because `config/db.js` reads `process.env` when it is required.
- **Authentication**: every route file calls `router.use(requireAuth)`, except the public `POST /api/login` (the only public route since sign-up was removed, D46). Identity comes only from `req.user` (the signed token), never from `req.query` or `req.body`.
- **Passwords**: hash them with `bcryptjs`. They never go into the token or into a response.
- **SQL**: queries always use `?` placeholders. Multi-table writes run in a transaction (`getConnection`, `beginTransaction`, `commit` or `rollback`, `release`).
- **Route order**: declare fixed paths such as `/export` before `/:id`.
- **Responses**: success returns `{ success: true, data }`. A refusal returns `{ success: false, message }`, with the message in French. Status codes:
  - 200 for success, creation included
  - 400 for invalid input
  - 401 for a missing or expired token
  - 403 for a buyer on an admin route, or an inactive account at login
  - 404 for a missing record
  - 409 when a business rule refuses the request
  - 500 for unexpected errors, with no SQL or stack trace in the message
- **Business rules**: enforce them on the server and validate unconditionally. The UIs only display them: they disable the control, explain why, and show the server's message.
- **Schema changes**: never alter the schema by hand. Add a script in `backend/sql/` with a runner that loads `.env` itself, following `run_schema_setup.js`.

## Client rules

- **Web**:
  - The only API URL is `API_BASE_URL` in `src/config/config.js`.
  - Register the axios token interceptor once, in `src/context/AuthContext.jsx` (Sprint 1). It reads `localStorage.authToken`.
  - Declare routes in `src/Router/router.jsx` and put each module in `src/feature-module/<module>/`.
  - Use Bootstrap, react-bootstrap and Ant Design only; don't add another UI library.
  - Load the reference lists with `useList()` from `src/utils/lists.js` (cached once); show a company with `companyLabel()` (name and branch).
  - Every screen must work at a phone's width (375 px) as well as on a computer: there is no separate phone app (D52).

## Testing

For each rule, test two requests, first against the API (`npm run test:api`) and then in the UI:
1. The request that must be refused: 401 without a token, 403 for a buyer on an admin route, 400 or 409 for a broken rule.
2. The legitimate request, which must still succeed.

The scenarios name their data `TEST…`. `tests/lib.js` `cleanup()` deletes it, including WeChat QR photo files, and the runner checks that the row counts are back to their starting values. Run them on a development database only.

## Git workflow

- Work on branches named `feat/<module>-<sujet>`, never directly on `main`.
- Make one commit per validated task, with a message that says what changed and why.
- Merge through a pull request. The remote is `origin` (github.com/Therealcydex/canton-fair-app).
