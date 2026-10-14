# Sourcing — specification

First draft written from `sourcing_db_diagram.pdf` (schema v1). Since 2026-10-14 the app follows
Tarek's **schema v2** (`schema.sql`, `china_provinces.sql`, `canton_fair_categories.sql`), with the
corrections D22-D30. **To be validated by the Product Owner.** Every requirement and decision
below can change.

## 1. Purpose

Tarek's group sends buyers to the Canton Fair (booth code phase/hall.floor.letter.number, for
example `2/12.1.A.22-24`). The app lets them:

- keep one list of suppliers (with their Chinese province) and their contacts, shared by the whole group;
- plan which booths to visit and mark them visited;
- record the products they find (price, unit, MOQ, shipping type, photos);
- share a product with one or several of Tarek's companies (each with an optional branch).

The app is **standalone**: its own tables and its own login, with self sign-up validated by the
admin. It follows the Smart360 code conventions (`guide-nouveau-projet-smart360.md`) but uses
none of its data. Its tables live next to the ERP's in `Smart360_copy` (lowercase names).

## 2. Actors

| Actor | Who | Can |
|---|---|---|
| Admin | IT / project owner (`role = 'ADMIN'`) | manage companies and users, validate sign-ups, plus everything a buyer can do |
| Buyer | any active user (`role = 'ACHETEUR'`) | manage the group's suppliers, contacts, booths and products, and share products with companies |
| Visitor | someone without an account | sign up; the account stays inactive until the admin activates it |

## 3. Functional requirements (BF)

| Id | Requirement | Priority |
|---|---|---|
| BF01 | A user logs in with a username and a password; an inactive user cannot log in | Haute |
| BF02 | The admin creates, edits (name, branch) and deletes companies | Haute |
| BF03 | The admin creates, edits, activates, deactivates and deletes users (role, free-text level, company) | Haute |
| BF04 | A user lists, searches (name, province from the list of Chinese provinces), creates and edits the suppliers, with a rating from 1 to 5; the list shows the number of booths and the % visited | Haute |
| BF05 | A user manages the contacts of a supplier (name, phone, email, WeChat QR) | Haute |
| BF06 | ~~Category tree~~ replaced (v2): booths pick from the fixed Canton Fair list (phase → category → section → sub-category), read only | Moyenne |
| BF07 | A user records a booth: phase 1-3, hall, floor 1-4, letter, number range, Canton category, supplier (optional), comment; its code is built automatically | Haute |
| BF08 | A user gets the list of booths not visited yet, filterable by phase, hall and category | Haute |
| BF09 | ~~Visit log~~ replaced (v2): a user marks a booth visited or not visited | Haute |
| BF10 | A user records a product (supplier optional): reference, name, description, price, unit, MOQ, shipping type (Incoterm list, FOB by default) | Haute |
| BF11 | A user adds photos to a product | Haute |
| BF12 | A user lists the products, filterable by supplier, shipping type and company shared with | Haute |
| BF13 | A user chooses the companies a product is shared with | Moyenne |
| BF14 | A user sees the products shared with their own company | Moyenne |
| BF15 | A mobile app gives buyers sign-up, the "to visit" list, one-tap "visited", quick product entry with a camera photo, and supplier lookup | Moyenne |
| BF16 | A visitor signs up (name, company, username, password); the account is inactive until the admin activates it (or refuses it) | Haute |

## 4. Non-functional requirements (BNF)

| Id | Requirement |
|---|---|
| BNF01 | ~~Tenant isolation~~ replaced (v2): the data belongs to the whole group; only the admin manages companies and users |
| BNF02 | Every API route except login and sign-up requires a valid token; identity comes only from the token |
| BNF03 | Refusals return `{ success: false, message }` with a French message; no SQL or stack trace in a message |
| BNF04 | Online only: the web and mobile apps call the API directly; no offline mode |
| BNF05 | Passwords are stored hashed (bcrypt), never in clear and never in the token |
| BNF06 | Every schema change is a script in `backend/sql/` |

## 5. Decisions (to validate)

| Id | Decision | Reason |
|---|---|---|
| D1 | Add `users.username` (unique) and `users.password_hash` | The diagram has no login fields and the app has its own login |
| D2 | *Replaced (no visit log in v2).* `booth_visits.status` = `ENUM('prevu','visite','annule')`, default `prevu` | The diagram does not list the values |
| D3 | *Replaced (v2: Canton Fair categories, data shared by the group).* `categories` are global (managed by the super-admin). `booths` belong to a company **through their supplier** | Neither table has `company_id`; a booth has a `supplier_id`, and suppliers belong to a company |
| D4 | *Replaced (v2: role ADMIN / ACHETEUR, level is free text, see D29).* `level >= 4` = company admin; `role = 'SUPER_ADMIN'` = super-admin; other roles are free text for now | The diagram does not define `level` or `role` |
| D5 | No `created_at` / `updated_at` columns for now | Not in the diagram; add them later if the PO wants history |
| D6 | Target MySQL 8 (as the diagram says); the schema also runs on MariaDB 10.4+ (local XAMPP) | Same `mysql2` driver; no engine-specific features used |
| D7 | *Replaced (v2: products belong to the group).* A product owned by a company = a product whose supplier belongs to that company. Only the owner can edit or share it | `products` has no `company_id`; ownership follows `supplier_id` |
| D8 | *Replaced (v2: deleting a supplier deletes its contacts and products, its booths stay without supplier).* Deleting a supplier deletes its contacts; it is refused (409) if it still has booths or products | Avoid losing products by accident |
| D9 | Each request reloads the user from the token's id: a deactivated account or a changed level takes effect at once, not at token expiry | Deactivation must be immediate (BF01) |
| D10 | *Replaced (v2: only the admin manages users, see D29).* A company admin can only give a level up to their own and cannot give the SUPER_ADMIN role; nobody can deactivate themselves or change their own level, role or company | Avoid privilege escalation and self lock-out |
| D11 | *Replaced (v2: nothing references users; the admin may delete an account, e.g. to refuse a sign-up).* Users are deactivated, never deleted | Visits and products keep their author |
| D12 | *Replaced (v2: no category tree).* Categories: at most 4 levels; a category cannot move under itself or one of its sub-categories; deleting one is refused while it has sub-categories or booths | Keep the tree usable; no booth silently loses its category |
| D13 | *Replaced (v2: see D26).* A booth needs a hall and a start number. Two booths of the same company cannot overlap (same phase, hall, level, letter and overlapping numbers); other companies may record the same place | Avoid duplicate booths in a company's plan |
| D14 | *Replaced (v2: no visit log).* Recording a visit with the status "visite" takes the booth off the "to visit" list. A "visite" without a date is dated now. Only the author of a visit or a company admin can change or delete it | The "to visit" list stays current on the fair floor |
| D15 | *Replaced (v2: no visit dates).* Visit times are stored and returned as written ("YYYY-MM-DD HH:MM:SS", the time at the fair), never converted between timezones | The fair is in China, the team in Tunisia |
| D16 | *Replaced (v2: products have no booth).* Deleting a booth deletes its visits; it is refused while products are attached to it | Avoid losing products by accident |
| D17 | Product photos: JPEG, PNG or WebP checked by their content, 8 MB each, 20 per product, stored in `backend/uploads/products/` under random names. They are served without a token (an `<img>` cannot send one), so anyone with the exact link can see a photo; the names cannot be guessed | Photos must display in the web and mobile apps |
| D18 | *Replaced (v2: shares are not read only).* A shared product is read only for the receiving company: it cannot edit, delete, add photos or share it further, and does not see which other companies receive it; it sees the owner's name | The owner stays in control of its data |
| D19 | *Replaced (v2: products have no booth, prices have 2 decimals).* A product's booth must be a booth of the product's supplier. Prices have at most 3 decimals and keep their exact value (a comma is accepted). Incoterms are the 11 Incoterms 2020 | Consistent data; no rounding of prices |
| D20 | Mobile app: photos come from the phone's camera through the file field (`capture="environment"`) instead of the `@capacitor/camera` plugin; the Android app id is `tn.sourcing.app` until the PO chooses one; development reaches the API over plain http. The Capacitor CLI needs Node 22 (the rest of the project runs on Node 20) | One less plugin, works the same in the browser and in the app |
| D21 | Hardening: after 10 failed logins for the same username from the same address in 15 minutes, login is refused (429) until the window ends; JSON bodies are limited to 1 MB (photos go through the upload route); the server warns at startup when `JWT_SECRET` is missing or short | Slow down password guessing; refuse oversized requests |
| D22 | `users` gets `username` (unique), `password_hash` and `created_at`, which v2 lacks | Login and sign-up are impossible without them; `created_at` orders the pending sign-ups |
| D23 | The views `v_suppliers` and `v_products` use correlated subqueries instead of `GROUP BY` and list their columns; `shared_with` shows the branch | A GROUP BY view cannot be merged: `WHERE id = ?` would aggregate the whole table first. It also avoids the ONLY_FULL_GROUP_BY error on `s.*` |
| D24 | Indexes `suppliers(name)`, `products(name)`, `booths(visited, phase, hall)` | Name search and the "to visit" list; foreign keys are already indexed by InnoDB |
| D25 | `companies` is unique on (name, branch), not on name; the API also refuses a duplicate name with no branch | Two branches of one company must both exist |
| D26 | `booth_code` is unique (v2) and the API refuses (409) a booth whose numbers overlap another booth at the same phase, hall, floor and letter; an end number equal to the start is stored as no end | "2/12.1.A.22-24" and "2/12.1.A.23" are the same stand |
| D27 | The API stores the booth letter in uppercase | The collation is case-insensitive: the CHECK lets "a" in, and "a" and "A" would make two codes |
| D28 | Deleting a supplier or a product also deletes the photo files | The FK cascade only deletes the rows |
| D29 | Roles: `ADMIN` manages companies and users; `ACHETEUR` is every other user; `level` is free text (a job title). A sign-up is an inactive ACHETEUR. The admin cannot deactivate, delete or change the role of their own account. At most 20 sign-ups (accounts created or usernames taken) per address in 15 minutes | v2 defines `level` and `role` as text; sign-up must stay under the admin's control |
| D30 | A booth's Canton category must belong to the booth's phase (the list covers phases 2 and 3 only) | The categories are per fair phase |
| D31 | The generated `booth_code` uses `RTRIM(letter)` | MariaDB 11.8 (the remote server) refuses a CHAR column in a generated column, because its value depends on PAD_CHAR_TO_FULL_LENGTH |

## 6. Changelog

| Date | Change |
|---|---|
| 2026-10-13 | First draft from the diagram |
| 2026-10-13 | Sprint 1: D9-D11 (authentication and user management) |
| 2026-10-14 | Sprint 3: D12-D16 (categories, booths, visits) |
| 2026-10-14 | Sprint 4: D17-D19 (products, photos, sharing) |
| 2026-10-14 | Sprint 5: D20 (mobile app) |
| 2026-10-14 | Sprint 6: D21 (hardening) |
| 2026-10-14 | Schema v2 from Tarek, user sign-up (BF16), corrections D22-D30; BF06, BF09, BNF01 and several decisions replaced |

## 7. Open questions on schema v2 (for Tarek)

- `products.price` is `DECIMAL(12,2)` with no currency: is it TND (3 decimals), USD or CNY?
- `booths.visited` is one flag for the whole group: who visited and when is no longer kept. Keep a visit log?
- `booth_code` is unique for the whole group: two companies cannot record the same stand separately (expected, since the data is shared).
- The Canton Fair category list covers phases 2 and 3 only: booths of phase 1 have no category.
- `level` and `role` are free text: is a list of levels wanted?
