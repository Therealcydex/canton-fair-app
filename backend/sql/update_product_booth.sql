-- D43: the booth where a product was found, on a database set up before it: products.booth_id
-- (a booth, emptied if the booth is deleted) and v_products with the booth code. Existing
-- products stay without a booth. Run it with update_product_booth.js: each "-- step:" runs only
-- when still needed. Run update_product_decision.js (D38) first.

-- step: add-booth-id
ALTER TABLE products ADD COLUMN booth_id INT NULL AFTER created_at;

-- step: add-booth-fk
ALTER TABLE products ADD CONSTRAINT fk_products_booth FOREIGN KEY (booth_id) REFERENCES booths(id) ON DELETE SET NULL;

-- step: view
-- Same text as create_sourcing_schema.sql.
CREATE OR REPLACE VIEW v_products AS
SELECT pr.id, pr.supplier_id, pr.supplier_ref, pr.name, pr.description, pr.price, pr.unit,
       pr.moq, pr.shipping_type, st.name AS shipping_name,
       (SELECT GROUP_CONCAT(CONCAT_WS(' - ', co.name, co.branch) ORDER BY co.name, co.branch SEPARATOR ', ')
          FROM product_shares ps JOIN companies co ON co.id = ps.company_id
         WHERE ps.product_id = pr.id) AS shared_with,
       pr.status, pr.decision_note, pr.decided_at, pr.decided_by, du.name AS decided_by_name,
       pr.created_at, pr.created_by, cu.name AS created_by_name,
       pr.booth_id, bo.booth_code, bo.phase AS booth_phase
FROM products pr
LEFT JOIN shipping_types st ON st.code = pr.shipping_type
LEFT JOIN users du          ON du.id = pr.decided_by
LEFT JOIN users cu          ON cu.id = pr.created_by
LEFT JOIN booths bo         ON bo.id = pr.booth_id;
