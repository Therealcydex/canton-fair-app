-- D42: the exhibitor's Canton Fair page on suppliers, and the hall plan of the fair, on a database
-- set up before them; D48: the plan's rows by area, with their rank, as on the official plan.
-- Run it with update_fair_plan.js: each "-- step:" runs only when still needed.

-- step: add-supplier-link
ALTER TABLE suppliers ADD COLUMN cantonfair_url VARCHAR(255) NULL AFTER website;

-- step: add-section-halls
CREATE TABLE IF NOT EXISTS section_halls (
    phase       TINYINT      NOT NULL CHECK (phase BETWEEN 1 AND 3),
    section     VARCHAR(150) NOT NULL,
    halls       VARCHAR(255) NOT NULL,
    updated_by  INT NULL,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (phase, section),
    CONSTRAINT fk_section_halls_user FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- step: add-hall-area
-- Existing rows get area '' (not split yet): the plan loader (add_fair_plan_from_site.js) rewrites them.
ALTER TABLE section_halls
  ADD COLUMN area CHAR(1) NOT NULL DEFAULT '' AFTER section,
  ADD COLUMN position SMALLINT NULL AFTER halls;

-- step: hall-area-key
ALTER TABLE section_halls DROP PRIMARY KEY, ADD PRIMARY KEY (phase, section, area);

-- step: view
-- Same text as create_sourcing_schema.sql.
CREATE OR REPLACE VIEW v_suppliers AS
SELECT s.id, s.name, s.phone, s.email, s.website, s.address, s.province_id, s.rating, s.notes,
       s.cantonfair_url, p.name_en AS province,
       (SELECT COUNT(*) FROM booths b WHERE b.supplier_id = s.id) AS nbr_booths,
       (SELECT ROUND(100 * SUM(b.visited) / NULLIF(COUNT(*), 0))
          FROM booths b WHERE b.supplier_id = s.id) AS booth_visit_pct
FROM suppliers s
LEFT JOIN china_province p ON p.id = s.province_id;
