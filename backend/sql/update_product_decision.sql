-- D38: adds the product decision (evening review) to an existing products table: the status set
-- by the admin, the note, who decided and when, and who recorded the product and when.
-- Run it with update_product_decision.js: each "-- step:" runs only when the table still needs it,
-- so a run that stopped half-way can be run again (MariaDB/MySQL cannot roll back ALTER TABLE).
-- Existing products start "A_ETUDIER", with created_at = the time of the update and no creator.

-- step: add-status
ALTER TABLE products ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'A_ETUDIER' AFTER shipping_type;

-- step: add-decision-note
ALTER TABLE products ADD COLUMN decision_note VARCHAR(500) NULL AFTER status;

-- step: add-decided-by
ALTER TABLE products ADD COLUMN decided_by INT NULL AFTER decision_note;

-- step: add-decided-at
ALTER TABLE products ADD COLUMN decided_at DATETIME NULL AFTER decided_by;

-- step: add-created-by
ALTER TABLE products ADD COLUMN created_by INT NULL AFTER decided_at;

-- step: add-created-at
ALTER TABLE products ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER created_by;

-- step: add-status-index
ALTER TABLE products ADD KEY ix_products_status (status, created_at);

-- step: add-status-check
ALTER TABLE products ADD CONSTRAINT chk_product_status
  CHECK (status IN ('A_ETUDIER', 'RETENU', 'ECHANTILLON', 'A_COMMANDER', 'REJETE'));

-- step: add-fk-decided-by
ALTER TABLE products ADD CONSTRAINT fk_products_decided_by FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE SET NULL;

-- step: add-fk-created-by
ALTER TABLE products ADD CONSTRAINT fk_products_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- step: view
-- Same text as create_sourcing_schema.sql.
CREATE OR REPLACE VIEW v_products AS
SELECT pr.id, pr.supplier_id, pr.supplier_ref, pr.name, pr.description, pr.price, pr.unit,
       pr.moq, pr.shipping_type, st.name AS shipping_name,
       (SELECT GROUP_CONCAT(CONCAT_WS(' - ', co.name, co.branch) ORDER BY co.name, co.branch SEPARATOR ', ')
          FROM product_shares ps JOIN companies co ON co.id = ps.company_id
         WHERE ps.product_id = pr.id) AS shared_with,
       pr.status, pr.decision_note, pr.decided_at, pr.decided_by, du.name AS decided_by_name,
       pr.created_at, pr.created_by, cu.name AS created_by_name
FROM products pr
LEFT JOIN shipping_types st ON st.code = pr.shipping_type
LEFT JOIN users du          ON du.id = pr.decided_by
LEFT JOIN users cu          ON cu.id = pr.created_by;
