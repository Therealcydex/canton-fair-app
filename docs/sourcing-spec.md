# Sourcing — specification

Draft written from `sourcing_db_diagram.pdf` (10 tables, MySQL 8). **To be validated by the
Product Owner** in Sprint 0. Every requirement and decision below can change.

## 1. Purpose

Several companies send buyers to a trade fair (Canton-Fair-style booth locations:
phase / hall / level / letter / number range). The app lets them:

- keep a list of suppliers and their contacts;
- plan which booths to visit and record each visit;
- record the products they find (price in TND, unit, MOQ, incoterm, photos);
- share a product with another company.

The app is **standalone**: its own database (`sourcing_db`) and its own login. It follows the
Smart360 code conventions (`guide-nouveau-projet-smart360.md`) but uses none of its data.

## 2. Actors

| Actor | Who | Can |
|---|---|---|
| Super-admin | IT / project owner | manage companies, every user, the category tree |
| Company admin | head buyer of a company (`level >= 4`) | manage the users of their company, plus everything a buyer can do |
| Buyer | a user of a company (`level < 4`) | manage suppliers, contacts, booths, visits and products of their company |

## 3. Functional requirements (BF)

| Id | Requirement | Priority |
|---|---|---|
| BF01 | A user logs in with a username and a password; an inactive user cannot log in | Haute |
| BF02 | The super-admin creates, renames and deletes companies | Haute |
| BF03 | A company admin creates, edits and deactivates the users of their company | Haute |
| BF04 | A user lists, searches (name, province), creates and edits the suppliers of their company, with a rating from 1 to 5 | Haute |
| BF05 | A user manages the contacts of a supplier (name, phone, email, WeChat QR) | Haute |
| BF06 | The super-admin manages a category tree (category → sub-category → …) | Moyenne |
| BF07 | A user records the booths of a supplier: phase, hall, level, letter, number range, category, comment | Haute |
| BF08 | A user marks booths "to visit" and gets the list of booths to visit, filterable by phase, hall and category | Haute |
| BF09 | A user records a visit to a booth: date/time, status, comment; the author is the logged-in user | Haute |
| BF10 | A user records a product found at a supplier (optionally at a booth): reference, name, description, price in TND, unit, MOQ, incoterm | Haute |
| BF11 | A user adds photos to a product | Haute |
| BF12 | A user lists the products of their company, filterable by supplier, booth and category | Haute |
| BF13 | The company that owns a product shares it with another company, or stops sharing it | Moyenne |
| BF14 | A user sees the products shared with their company (read only) | Moyenne |
| BF15 | A mobile app gives buyers the "to visit" list, visit check-in, quick product entry with a camera photo, and supplier lookup | Moyenne |

## 4. Non-functional requirements (BNF)

| Id | Requirement |
|---|---|
| BNF01 | Tenant isolation: a user never reads or changes another company's data, except products shared with their company (read only) |
| BNF02 | Every API route except login requires a valid token; identity comes only from the token |
| BNF03 | Refusals return `{ success: false, message }` with a French message; no SQL or stack trace in a message |
| BNF04 | Online only: the web and mobile apps call the API directly; no offline mode |
| BNF05 | Passwords are stored hashed (bcrypt), never in clear and never in the token |
| BNF06 | Every schema change is a script in `backend/sql/` |

## 5. Decisions (to validate)

| Id | Decision | Reason |
|---|---|---|
| D1 | Add `users.username` (unique) and `users.password_hash` | The diagram has no login fields and the app has its own login |
| D2 | `booth_visits.status` = `ENUM('prevu','visite','annule')`, default `prevu` | The diagram does not list the values |
| D3 | `categories` are global (managed by the super-admin). `booths` belong to a company **through their supplier** | Neither table has `company_id`; a booth has a `supplier_id`, and suppliers belong to a company |
| D4 | `level >= 4` = company admin; `role = 'SUPER_ADMIN'` = super-admin; other roles are free text for now | The diagram does not define `level` or `role` |
| D5 | No `created_at` / `updated_at` columns for now | Not in the diagram; add them later if the PO wants history |
| D6 | Target MySQL 8 (as the diagram says); the schema also runs on MariaDB 10.4+ (local XAMPP) | Same `mysql2` driver; no engine-specific features used |
| D7 | A product owned by a company = a product whose supplier belongs to that company. Only the owner can edit or share it | `products` has no `company_id`; ownership follows `supplier_id` |
| D8 | Deleting a supplier deletes its contacts; it is refused (409) if it still has booths or products | Avoid losing products by accident |

## 6. Changelog

| Date | Change |
|---|---|
| 2026-10-13 | First draft from the diagram |
