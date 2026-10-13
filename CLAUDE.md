# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Sourcing** is a standalone app for buyers from several companies at a trade fair (Canton-Fair-style
booths). Buyers keep suppliers and contacts, plan and log booth visits, record products (price in
TND, MOQ, incoterm, photos) and share products between companies. It has its own database
(`sourcing_db`) and its own login. It follows the Smart360 code conventions in
`guide-nouveau-projet-smart360.md`, but none of the Smart360 data: no `LISTE_DES_SALARIES`, no
`Boutique`, no UPPERCASE table names.

- `docs/sourcing-spec.md` holds the actors, requirements (BF01–BF15, BNF01–BNF06) and decisions (D1–D8). The decisions are not yet validated by the Product Owner. Read it before working on a feature, and add a decision there when you make one.
- `docs/sourcing-status.md` tracks the state of each requirement. Update it when a requirement is done.
- The work plan is in sprints: 0 foundations, 1 auth and admin, 2 suppliers and contacts, 3 categories, booths and visits, 4 products, photos and sharing, 5 mobile, 6 hardening. Build the web app first; the mobile app (online only, no offline mode) comes in Sprint 5.

## Commands

Backend (`backend/`, Node 20):
- `npm run dev` runs the server with nodemon on port 3000. `npm start` runs it without reloading.
- `npm run db:setup` creates `sourcing_db` if it is missing and runs `sql/create_sourcing_schema.sql`. It then seeds the super-admin from `SEED_ADMIN_USERNAME` and `SEED_ADMIN_PASSWORD`. It is safe to run twice.
- Copy `.env.example` to `.env` and fill in the values. `JWT_SECRET` deliberately has no default.
- The local database is XAMPP MariaDB 10.4 on port 3306 (`root`, no password). Its client is `/c/xampp/mysql/bin/mysql.exe`. The target is MySQL 8, so keep SQL portable to both.

Frontend (`frontend/`, Create React App, React 18.3):
- `npm start` runs the dev server on port 3000. Start the backend first, then accept CRA's offer of another port.
- `npm run build` builds for production.
- `CI=true npm test -- --watchAll=false` runs the tests once. Add `-t "<test name>"` to run a single test.

Mobile (`mobile/`, Sprint 5, not created yet): Vite 4, React, TypeScript, Tailwind 3 and Capacitor 8.
- `VITE_API_BASE_URL=http://localhost:3000/api npm run dev` runs it against a local API.

## Data model and tenant rule

These are the 10 tables of the diagram, with their links:
- `companies` has many `users` and many `suppliers`.
- A supplier has `contacts`, `booths` and `products`.
- `booths` link to `categories`, a global tree with `parent_id` and `depth`.
- `booth_visits` link a booth to a user.
- `products` have a supplier, an optional booth and a `created_by` user. They have `product_images`.
- `product_shares` (`product_id`, `company_id`) shares a product with another company.

The tenant rule replaces Smart360's `Boutique` filter:
- Suppliers, contacts, booths, visits and products belong to a company **through `suppliers.company_id`**. Every read filters on `req.user.company_id`.
- A single record from another company returns 403.
- Products shared with a company through `product_shares` are readable by that company. Only the owning company can edit or share them.
- Categories are global and only the super-admin edits them.

Roles: `role = 'SUPER_ADMIN'` manages companies and categories. `level >= 4` is a company admin, who manages the users of their company. Everyone else is a buyer.

`price_tnd` is `DECIMAL(12,3)`. The pool keeps decimals as strings (`decimalNumbers: false`), so never round prices through a JavaScript float.

## Backend rules (from the guide, non-negotiable)

- **Load dotenv first.** `require('dotenv').config()` is the first line of `index.js`, because `config/db.js` reads `process.env` when it is required.
- **Authentication**: every route file calls `router.use(requireAuth)`, except login. Identity comes only from `req.user` (the signed token), never from `req.query` or `req.body`. Authors such as `created_by` and `booth_visits.user_id` come from `req.user.id`.
- **Passwords**: hash them with `bcryptjs`. They never go into the token or into a response.
- **SQL**: queries always use `?` placeholders. Multi-table writes run in a transaction (`getConnection`, `beginTransaction`, `commit` or `rollback`, `release`).
- **Route order**: declare fixed paths such as `/export` before `/:id`.
- **Responses**: success returns `{ success: true, data }`. A refusal returns `{ success: false, message }`, with the message in French. Status codes:
  - 200 for success, creation included
  - 400 for invalid input
  - 401 for a missing or expired token
  - 403 for another company or a level that is too low
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
- **Mobile**: every call goes through `authFetch` followed by `ensureOk`, because `fetch` does not reject on 4xx. Never re-implement business rules in the mobile app.

## Testing

The backend has no automated test suite. For each rule, test two requests, first against the API and then in the UI:
1. The request that must be refused: 401 without a token, 403 for another company or a level that is too low, 400 or 409 for a broken rule.
2. The legitimate request, which must still succeed.

Delete the test data afterwards and check the row counts.

## Git workflow

- Work on branches named `feat/<module>-<sujet>`, never directly on `main`.
- Make one commit per validated task, with a message that says what changed and why.
- Merge through a pull request. There is no remote yet.
