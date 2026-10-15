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
| BF04 | Suppliers, province from the list, booths and % visited | À valider | API, navigateur (web, mobile); D40 web pages: search by phone, sorting, supplier page tabs (contacts with QR, stands visited / total updated by the switch, products) in the browser on the local database |
| BF05 | Contacts and their WeChat QR code (D33, D34: scanned) | À valider | API (scanned content: refusals, save, replaces a photo, has_qr, CSV), téléphone (scanner tested on a phone over https by the user, 2026-10-15); web picture reading not checked by hand yet |
| BF06 | Category tree | Remplacé | Canton Fair list, read only: API, navigateur |
| BF07 | Booths, booth code, Canton category of the phase | À valider | API, navigateur (web: refused overlap, creation, edit) |
| BF08 | "To visit" list | À valider | API, navigateur (web, mobile); mobile one-tap "visited" (D39): tap, undo, refused save put back, reload, "Masquer visités", in the browser on the local database |
| BF09 | Visit log | Remplacé | "Visited" flag: API, navigateur (web, mobile) |
| BF10 | Products, price, shipping type | À valider | API, navigateur (web: refused price shown, mobile) |
| BF11 | Product photos | À valider | API, navigateur (mobile) |
| BF12 | Product list and filters | À valider | API, navigateur; "Partagés / Non partagés" filter (D40): API, navigateur |
| BF13 | Share a product with companies | À valider | API, navigateur (web multi-select); D40 sharing several products at once (add, replace, refusals) and "Partager" on one row: API, navigateur (2 products added to a company, empty choice refused, shares removed again one by one) |
| BF14 | Products shared with my company | À valider | API, navigateur |
| BF15 | Mobile app | Partiel | Navigateur; QR scanner on a phone (https). iPhone home-screen app (D36) ready, to install once online (deploy/README.md); the Android APK needs Node 22 |
| BF16 | ~~Sign-up~~ removed (D46) | — | API (sign-up routes answer 404; admin creates an inactive account, its login is refused, admin activates it); navigateur (web and mobile: old sign-up address leads to the login page, no sign-up link; web users page without the pending tab) |
| BF17 | Contacts page (QR code in the edit form), CSV export, QR code sheet | À valider | API (list, filters, export), navigateur (table, filters, supplier link, add, edit, QR replace and remove in the form, delete, export content, QR sheet; the print preview itself was not opened) |
| BF18 | Business card scan (mobile), new supplier from a card | À valider | Navigateur (real OCR on a rendered card: 6/6 fields in 4 s; new supplier + contact + WeChat id saved; a blank photo gives the message). Not yet on an iPhone with a real card. QR code scanned in the new supplier and new contact forms (mobile, from a photo of a QR) and read in the web new-contact form: saved with the contact (navigateur) |
| BF19 | Product decision, evening review (D38) | À valider | API (decision admin-only, refused values, undo, queue and counts, status filter, edit keeps the decision); navigateur (mobile review as admin: decide with a note, next product, undo back to the same product, Décidés list; buyer read-only; badges and note on the supplier page; layout at 375 px; web decision block as admin and buyer, column and filter). Not yet on an iPhone |
| BF20 | Hall plan, supplier's Canton Fair page (D42) | À valider | API (plan read by all, filled by the admin only, refused values, clear; link refused for other sites and look-alike hosts, kept on edit, removed); navigateur (mobile plan as admin and buyer, link refused then saved and opened, "+ Fournisseur" field; web plan edit, halls shown in the booth form, link in the supplier form and page). D45: 54 of 58 sections pre-filled from the site's floor-map legends (titled 137th session), to check on site; checked in the browser (web plan 20/14/20, booth form hint, mobile plan). D47: 57 of 58 with 3 from other sources (2 "à vérifier"), Rural Vitalization empty; halls shown one line per hall (web plan, booth form, mobile plan checked) |
| D43, D44 | Booth of each product; "Booth" instead of "Stand" | À valider | API (booth refused if invalid, unknown or of another supplier, supplier taken from the booth, filter, kept on edit, removed, emptied when the booth is deleted); navigateur on the phone (old #/stands address redirects, "+ Produit" from a booth preselects it, "Produits de ce booth" and "Autres produits du fournisseur", booth on the evening review). Navigateur on the web: old /stands/:id redirects to /booths/:id, no "stand" left on the home, À visiter, Booths, suppliers and supplier pages, Booth column with its link in the product list, booth shown on the product page, the edit form offers only the supplier's booths and clears the booth when the supplier changes, saved with the new supplier's booth |
| BNF01 | Tenant isolation | Remplacé | Data shared by the group (schema v2) |
| BNF02 | Token on every route except login | À valider | API |
| BNF03 | French refusal messages, no SQL | À valider | API (every refusal checked) |
| BNF04 | Online only | À valider | |
| BNF05 | Hashed passwords | À valider | API |
| BNF06 | Schema changes as scripts | À valider | |
| D1–D47 | Decisions in `sourcing-spec.md` §5 (several replaced by v2) | À valider | Web home page (D40): API, navigateur (figures, phases, companies) |

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
| `backend/sql/canton_fair_sections_140.sql` | `npm run db:add-canton-sections` (new database: `npm run db:setup`) | D41: the 23 missing sections of the 140th fair (Phase 1, Fashion Jewelry, Rural Vitalization, Intelligent Healthcare); a row is added only if its section is missing. Done on the remote `Smart360_copy` on 2026-10-15 (444 rows) |
| `backend/sql/update_fair_plan.sql` | `npm run db:update-fair-plan` | D42: `suppliers.cantonfair_url`, table `section_halls`, `v_suppliers` refreshed. Each step runs only if still needed. Done on the remote `Smart360_copy` on 2026-10-15 |
| `backend/sql/update_product_booth.sql` | `npm run db:update-product-booth` | D43, after D38: `products.booth_id` and `v_products` with the booth code. Each step runs only if still needed. Done on the remote `Smart360_copy` on 2026-10-15 |
| `backend/sql/fair_plan_from_site.sql` | `npm run db:add-fair-plan` | D45, after D42: the halls of 54 sections from the site's floor maps, plus 3 from other sources (D47); INSERT IGNORE, so a section already typed is kept. Done on the remote `Smart360_copy` on 2026-10-15 |
| `backend/sql/update_product_decision.sql` | `npm run db:update-product-decision` | D38, once, on a database set up before it: decision status, note, who decided and when, who recorded the product and when; `v_products` refreshed. Each step runs only if still needed. Done on the remote `Smart360_copy` on 2026-10-15 |
