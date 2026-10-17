-- D61-D63 (the boss's fixes), on a database set up before them. Run it with update_boss_fixes.js:
-- each "-- step:" runs only when the database still needs it, so it is safe to run twice and
-- finishes a run that stopped half-way.

-- step: add-booth-shares
-- D62: the booths the admin shares with a company; its viewers (LECTEUR) see them read-only.
CREATE TABLE booth_shares (
    booth_id    INT NOT NULL,
    company_id  INT NOT NULL,
    shared_by   INT NULL,
    shared_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (booth_id, company_id),
    KEY ix_booth_shares_company (company_id),
    CONSTRAINT fk_booth_shares_booth   FOREIGN KEY (booth_id)   REFERENCES booths(id)    ON DELETE CASCADE,
    CONSTRAINT fk_booth_shares_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_booth_shares_user    FOREIGN KEY (shared_by)  REFERENCES users(id)     ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- step: view
-- D62: products are no longer shared (product_shares stays, unused). Same text as create_sourcing_schema.sql.
CREATE OR REPLACE VIEW v_products AS
SELECT pr.id, pr.supplier_id, pr.supplier_ref, pr.name, pr.description, pr.price, pr.unit,
       pr.moq, pr.shipping_type, st.name AS shipping_name,
       pr.status, pr.decision_note, pr.decided_at, pr.decided_by, du.name AS decided_by_name,
       pr.created_at, pr.created_by, cu.name AS created_by_name,
       pr.booth_id, bo.booth_code, bo.phase AS booth_phase
FROM products pr
LEFT JOIN shipping_types st ON st.code = pr.shipping_type
LEFT JOIN users du          ON du.id = pr.decided_by
LEFT JOIN users cu          ON cu.id = pr.created_by
LEFT JOIN booths bo         ON bo.id = pr.booth_id;
