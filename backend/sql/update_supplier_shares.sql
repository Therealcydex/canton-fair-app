-- D66 (suppliers shared, users in several companies), on a database set up before it. Run it with
-- update_supplier_shares.js: each "-- step:" runs only when the database still needs it, so it is
-- safe to run twice and finishes a run that stopped half-way.

-- step: add-user-companies
-- A user belongs to any number of Tarek's companies.
CREATE TABLE user_companies (
    user_id     INT NOT NULL,
    company_id  INT NOT NULL,
    PRIMARY KEY (user_id, company_id),
    KEY ix_user_companies_company (company_id),
    CONSTRAINT fk_user_companies_user    FOREIGN KEY (user_id)    REFERENCES users(id)     ON DELETE CASCADE,
    CONSTRAINT fk_user_companies_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- step: copy-user-company
-- Each user keeps the company it had. users.company_id stays, unused, so an older version of the
-- app on the same database keeps working; a later run adds what it changed meanwhile.
INSERT IGNORE INTO user_companies (user_id, company_id)
SELECT id, company_id FROM users WHERE company_id IS NOT NULL;

-- step: add-supplier-shares
-- The suppliers the admin shares with a company; its viewers (LECTEUR) read them.
CREATE TABLE supplier_shares (
    supplier_id INT NOT NULL,
    company_id  INT NOT NULL,
    shared_by   INT NULL,
    shared_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (supplier_id, company_id),
    KEY ix_supplier_shares_company (company_id),
    CONSTRAINT fk_supplier_shares_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id)  ON DELETE CASCADE,
    CONSTRAINT fk_supplier_shares_company  FOREIGN KEY (company_id)  REFERENCES companies(id)  ON DELETE CASCADE,
    CONSTRAINT fk_supplier_shares_user     FOREIGN KEY (shared_by)   REFERENCES users(id)      ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- step: copy-booth-shares
-- A booth shared with a company becomes its supplier shared with that company. The share of a
-- booth without a supplier is not copied (update_supplier_shares.js counts them). booth_shares
-- stays, unused, like product_shares.
INSERT IGNORE INTO supplier_shares (supplier_id, company_id, shared_by, shared_at)
SELECT b.supplier_id, bs.company_id, bs.shared_by, bs.shared_at
FROM booth_shares bs JOIN booths b ON b.id = bs.booth_id
WHERE b.supplier_id IS NOT NULL;
