# Database of the Sourcing app

This guide is for the person who installs the app on the real database. It explains what the
app adds to the database, how to create it, and how to bring over the data typed in the copy
(`Smart360_copy`) during development.

## What the app adds

The app lives **next to** the ERP's tables, in the same database. It never reads or changes an
ERP table (those have UPPERCASE names). Everything it adds has a lowercase name:

| Kind | Names |
|---|---|
| Tables of the app | `companies`, `users`, `suppliers`, `contacts`, `booths`, `products`, `product_images`, `product_shares`, `section_halls` |
| Reference lists | `china_province`, `canton_fair_category`, `shipping_types` |
| Views | `v_booths`, `v_suppliers`, `v_products` |

All of it is created by the scripts in `backend/sql/`. The copy is not needed: the code in git is
enough to build the same schema.

**Check before installing**
- No lowercase table with one of the names above already exists in the database.
- If the server ignores upper/lower case in table names (`SHOW VARIABLES LIKE 'lower_case_table_names'`
  gives 1 or 2, usual on Windows), `users` would be the same table as an ERP `USERS`: in that case,
  use a separate database for the app instead.

## 1. Back up the database

Before anything else, a full backup of the target database, for example:

```bash
mysqldump --single-transaction --routines <database> | gzip > before-sourcing.sql.gz
```

## 2. Settings

On the server, in the project's `backend/` folder:

```bash
npm install
cp .env.example .env
```

Fill in `.env` (it is never in git: it holds passwords):

| Setting | Value |
|---|---|
| `DB_HOST`, `DB_PORT` | the database server, usually `127.0.0.1` and `3306` |
| `DB_NAME` | the target database |
| `DB_USER`, `DB_PASSWORD` | an account allowed to create tables (for steps 3 and 4 only, see step 5) |
| `JWT_SECRET` | a long random string, e.g. `openssl rand -hex 48` |
| `SEED_ADMIN_USERNAME`, `SEED_ADMIN_PASSWORD` | the first administrator of the app |

## 3. Create the schema

```bash
npm run db:setup        # lists, tables, views, then the administrator; safe to run twice
npm run db:add-fair-plan # the hall plan of the 140th Canton Fair (official plan)
```

`db:setup` runs, in order: `sql/china_provinces.sql`, `sql/canton_fair_categories.sql` (only into
an empty table), `sql/canton_fair_sections_140.sql`, `sql/create_sourcing_schema.sql`. Every
statement is `CREATE … IF NOT EXISTS`, `INSERT IGNORE` or `CREATE OR REPLACE VIEW`.

On a new database, the `db:update-…` scripts are **not** needed: they only bring a database
created with an older version of the app up to date (like `Smart360_copy`). Their order is in
`docs/sourcing-status.md` ("Migration scripts").

## 4. Bring over the data of the copy (optional)

Only if the data typed in `Smart360_copy` must be kept. Skip it to start empty.

1. On the machine that can reach the copy, export the app's tables only, data without schema
   (the schema comes from step 3):

   ```bash
   mysqldump -h <copy host> -u <user> -p --no-create-info --skip-triggers --complete-insert \
     Smart360_copy companies users suppliers contacts booths products product_images \
     product_shares section_halls > sourcing-data.sql
   ```

2. On the target, empty the tables filled by step 3 that the export also contains, then import:

   ```sql
   SET FOREIGN_KEY_CHECKS = 0;
   DELETE FROM users; DELETE FROM section_halls;
   SET FOREIGN_KEY_CHECKS = 1;
   ```

   ```bash
   mysql <database> < sourcing-data.sql
   ```

   The administrator of step 3 is replaced by the accounts of the copy (same passwords).
   `booths.booth_code` is computed by the database: MariaDB ignores the value in the export (a
   warning) and computes it again. If a MySQL 8 server refuses the import because of
   `booth_code`, remove that column from the `booths` lines of the export and import again.
   (Tested on MariaDB: every row and every booth code came back.)

3. Copy the photos: the folder `backend/uploads/` of the development machine goes to the same
   place on the server (product photos and older WeChat QR photos are files, not database rows).

4. In the app, as administrator: delete the test accounts (`test`, `test1`, anything named
   `TEST…`) and check the suppliers and contacts.

## 5. Account of the app (recommended)

The app should not use the account of step 2 day to day. `deploy/db-user.sql` creates
`sourcing_app`, allowed to read and write the app's tables only and to read the lists and views:

1. Replace `Smart360_copy` in the file with the target database name, and `<password>` with a
   long random password.
2. Run it as the database administrator: `sudo mariadb < deploy/db-user.sql`.
3. In `backend/.env`: `DB_USER=sourcing_app`, `DB_PASSWORD=` that password. Restart the backend.

Keep the administrator account for later schema changes (`npm run db:…`).

## 6. Check

```bash
npm start                                   # or the PM2 service, see deploy/README.md
curl http://127.0.0.1:3000/                 # answers once the backend is up
```

Then log in to the web app with the administrator, open "Plan du salon" (the 3 phases must show
their halls) and create the accounts of the buyers in "Utilisateurs" (there is no sign-up).

## Later versions

When a new version of the app changes the schema, its commit adds a script in `backend/sql/` and
an `npm run db:…` command, listed in `docs/sourcing-status.md`. Back up, run it with the
administrator account, then deploy the code. The scripts check what is already there, so running
one twice does nothing the second time.
