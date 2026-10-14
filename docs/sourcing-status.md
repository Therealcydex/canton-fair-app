# Sourcing — status

States: **Réalisé** (done and accepted), **À valider** (done and tested, waiting for the PO's
acceptance), **Partiel** (started), **À faire**.

"API" = covered by `npm run test:api` (refused and legitimate request for each rule).
"Navigateur" = checked by hand in the browser with two test companies.

| Id | Requirement | Sprint | State | Checked |
|---|---|---|---|---|
| BF01 | Login, inactive users refused | 1 | À valider | API, navigateur (web, mobile) |
| BF02 | Companies (super-admin) | 1 | À valider | API |
| BF03 | Users of a company (company admin) | 1 | À valider | API |
| BF04 | Suppliers | 2 | À valider | API, navigateur |
| BF05 | Contacts | 2 | À valider | API, navigateur (lecture) |
| BF06 | Category tree | 3 | À valider | API |
| BF07 | Booths | 3 | À valider | API, navigateur |
| BF08 | "To visit" list | 3 | À valider | API, navigateur (web, mobile) |
| BF09 | Booth visits | 3 | À valider | API, navigateur (web, mobile) |
| BF10 | Products | 4 | À valider | API, navigateur (web, mobile, refus affiché) |
| BF11 | Product photos | 4 | À valider | API, navigateur (mobile) |
| BF12 | Product list and filters | 4 | À valider | API, navigateur |
| BF13 | Share a product | 4 | À valider | API, navigateur |
| BF14 | Products shared with us | 4 | À valider | API, navigateur |
| BF15 | Mobile app | 5 | Partiel | Navigateur; l'APK Android reste à construire (Node 22) |
| BNF01 | Tenant isolation | all | À valider | API (403 on every module) |
| BNF02 | Token on every route | all | À valider | API |
| BNF03 | French refusal messages, no SQL | all | À valider | API (every refusal checked) |
| BNF04 | Online only | 5 | À valider | |
| BNF05 | Hashed passwords | 1 | À valider | API |
| BNF06 | Schema changes as scripts | 0 | À valider | |
| D1–D21 | Decisions in `sourcing-spec.md` §5 | 0–6 | À valider | |

## Not checked by hand yet

- The administration screens (companies, users, categories) in the browser.
- Creating and editing through the web forms (the mobile forms were checked).
- The Android app on a real phone (needs Node 22 to generate the Android project).

## Migration scripts (run in this order)

| Script | Runner | Content |
|---|---|---|
| `backend/sql/create_sourcing_schema.sql` | `npm run db:setup` | The 10 tables, demo company, sample categories, super-admin |
