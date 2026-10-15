# Sourcing — status

States: **Réalisé** (done and accepted), **À valider** (done and tested, waiting for the PO's
acceptance), **Partiel** (started), **À faire**, **Remplacé** (by schema v2).

"API" = covered by `npm run test:api` (refused and legitimate request for each rule, 254 checks).
"Navigateur" = checked by hand in the browser (web and mobile) on a local copy with demo data.

| Id | Requirement | State | Checked |
|---|---|---|---|
| BF01 | Login, inactive users refused | À valider | API, navigateur (web, mobile) |
| BF02 | Companies with a branch (admin) | À valider | API |
| BF03 | Users (admin): create, edit, activate, delete | À valider | API, navigateur (web) |
| BF04 | Suppliers, province from the list, booths and % visited | À valider | API, navigateur (web, mobile) |
| BF05 | Contacts and their WeChat QR code (D33, D34: scanned) | À valider | API (scanned content: refusals, save, replaces a photo, has_qr, CSV), téléphone (scanner tested on a phone over https by the user, 2026-10-15); web picture reading not checked by hand yet |
| BF06 | Category tree | Remplacé | Canton Fair list, read only: API, navigateur |
| BF07 | Booths, booth code, Canton category of the phase | À valider | API, navigateur (web: refused overlap, creation, edit) |
| BF08 | "To visit" list | À valider | API, navigateur (web, mobile) |
| BF09 | Visit log | Remplacé | "Visited" flag: API, navigateur (web, mobile) |
| BF10 | Products, price, shipping type | À valider | API, navigateur (web: refused price shown, mobile) |
| BF11 | Product photos | À valider | API, navigateur (mobile) |
| BF12 | Product list and filters | À valider | API, navigateur |
| BF13 | Share a product with companies | À valider | API, navigateur (web multi-select) |
| BF14 | Products shared with my company | À valider | API, navigateur |
| BF15 | Mobile app | Partiel | Navigateur; the Android APK is still to build (Node 22) |
| BF16 | Sign-up validated by the admin | À valider | API, navigateur (web and mobile sign-up, pending login refused, activation) |
| BF17 | Contacts page (QR code in the edit form), CSV export, QR code sheet | À valider | API (list, filters, export), navigateur (table, filters, supplier link, add, edit, QR replace and remove in the form, delete, export content, QR sheet; the print preview itself was not opened) |
| BNF01 | Tenant isolation | Remplacé | Data shared by the group (schema v2) |
| BNF02 | Token on every route except login and sign-up | À valider | API |
| BNF03 | French refusal messages, no SQL | À valider | API (every refusal checked) |
| BNF04 | Online only | À valider | |
| BNF05 | Hashed passwords | À valider | API |
| BNF06 | Schema changes as scripts | À valider | |
| D1–D35 | Decisions in `sourcing-spec.md` §5 (several replaced by v2) | À valider | |

## Not checked by hand yet

- The companies screen and editing a supplier, contact or product through the web forms.
- Photo upload from the web product page (the mobile one was checked).
- The Android app on a real phone (needs Node 22 to generate the Android project).

## Migration scripts (run in this order)

| Script | Runner | Content |
|---|---|---|
| `backend/sql/drop_v1_tables.js` | `npm run db:drop-v1 -- --yes` | Once, on a database that has the v1 tables: drops them and their data (refuses anything that is not v1) |
| `backend/sql/china_provinces.sql` | `npm run db:setup` | The 23 provinces |
| `backend/sql/canton_fair_categories.sql` | `npm run db:setup` | The 421 Canton Fair categories (only loaded into an empty table) |
| `backend/sql/create_sourcing_schema.sql` | `npm run db:setup` | Schema v2: tables, shipping types, views; then the admin user |
| `backend/sql/update_booth_code.sql` | `npm run db:update-booth-code` | D32, once, on a database set up before it: booth code `11.3J26`, optional letter and number, stand unique per phase. Each step runs only if still needed (D35), so it also finishes a run that stopped half-way. Done on the remote `Smart360_copy` on 2026-10-15 |
