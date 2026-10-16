-- A database user for the app alone, with rights on the app's tables only: the app can never read
-- or change an ERP table of Smart360_copy, even through a bug. Run once as the database admin on
-- the server (sudo mariadb), after replacing <password> with a long random password, then put the
-- same values in /opt/sourcing/backend/.env (DB_USER=sourcing_app, DB_PASSWORD=..., DB_HOST=127.0.0.1).
-- Schema changes (npm run db:setup, db:update-…, db:add-fair-plan) keep using an admin account.
-- On another database than Smart360_copy, replace that name everywhere below (deploy/DATABASE.md).

CREATE USER IF NOT EXISTS 'sourcing_app'@'localhost' IDENTIFIED BY '<password>';
CREATE USER IF NOT EXISTS 'sourcing_app'@'127.0.0.1' IDENTIFIED BY '<password>';

-- Read and write: the app's data.
GRANT SELECT, INSERT, UPDATE, DELETE ON Smart360_copy.companies      TO 'sourcing_app'@'localhost', 'sourcing_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON Smart360_copy.users          TO 'sourcing_app'@'localhost', 'sourcing_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON Smart360_copy.suppliers      TO 'sourcing_app'@'localhost', 'sourcing_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON Smart360_copy.contacts       TO 'sourcing_app'@'localhost', 'sourcing_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON Smart360_copy.booths         TO 'sourcing_app'@'localhost', 'sourcing_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON Smart360_copy.products       TO 'sourcing_app'@'localhost', 'sourcing_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON Smart360_copy.product_images TO 'sourcing_app'@'localhost', 'sourcing_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON Smart360_copy.product_shares TO 'sourcing_app'@'localhost', 'sourcing_app'@'127.0.0.1';
-- The hall plan (D42/D48): read by everyone, written by the admin's correction route.
GRANT SELECT, INSERT, UPDATE, DELETE ON Smart360_copy.section_halls  TO 'sourcing_app'@'localhost', 'sourcing_app'@'127.0.0.1';

-- Read only: the reference lists and the views.
GRANT SELECT ON Smart360_copy.china_province       TO 'sourcing_app'@'localhost', 'sourcing_app'@'127.0.0.1';
GRANT SELECT ON Smart360_copy.canton_fair_category TO 'sourcing_app'@'localhost', 'sourcing_app'@'127.0.0.1';
GRANT SELECT ON Smart360_copy.shipping_types       TO 'sourcing_app'@'localhost', 'sourcing_app'@'127.0.0.1';
GRANT SELECT ON Smart360_copy.v_booths             TO 'sourcing_app'@'localhost', 'sourcing_app'@'127.0.0.1';
GRANT SELECT ON Smart360_copy.v_suppliers          TO 'sourcing_app'@'localhost', 'sourcing_app'@'127.0.0.1';
GRANT SELECT ON Smart360_copy.v_products           TO 'sourcing_app'@'localhost', 'sourcing_app'@'127.0.0.1';

-- The nightly backup (deploy/backup.sh) uses this user too: it only reads the tables (SELECT).

FLUSH PRIVILEGES;
