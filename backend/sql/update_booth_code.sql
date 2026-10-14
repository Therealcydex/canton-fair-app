-- D32: moves an existing booths table to the fair's booth code ("11.3J26", "14.3I16-17", "9.1").
-- The letter and the start number become optional (both or neither), the phase leaves the code,
-- and the unique key moves from booth_code to (phase, hall, floor, letter, num_start).
-- Run it with update_booth_code.js, which skips it once the table is up to date.

ALTER TABLE booths DROP INDEX uq_booth_code;
ALTER TABLE booths DROP COLUMN booth_code;
ALTER TABLE booths MODIFY letter CHAR(1) NULL CHECK (letter BETWEEN 'A' AND 'Z');
ALTER TABLE booths MODIFY num_start SMALLINT NULL;
ALTER TABLE booths ADD COLUMN booth_code VARCHAR(30) GENERATED ALWAYS AS (
    CONCAT(hall, '.', floor,
           IF(letter IS NULL, '',
              CONCAT(RTRIM(letter), num_start, IF(num_end IS NULL, '', CONCAT('-', num_end)))))
  ) STORED AFTER num_end;
ALTER TABLE booths ADD UNIQUE KEY uq_booth_place (phase, hall, floor, letter, num_start);
ALTER TABLE booths ADD KEY ix_booths_code (booth_code);
ALTER TABLE booths ADD CONSTRAINT chk_booth_place
  CHECK ((letter IS NULL) = (num_start IS NULL) AND (num_start IS NOT NULL OR num_end IS NULL));

-- The view lost its column with the drop: create it again (same text as create_sourcing_schema.sql).
CREATE OR REPLACE VIEW v_booths AS
SELECT b.id, b.booth_code, b.phase, b.hall, b.floor, b.letter, b.num_start, b.num_end,
       b.category_id, c.category, c.section, c.sub_category,
       b.supplier_id, s.name AS supplier_name,
       b.visited, b.comment
FROM booths b
LEFT JOIN canton_fair_category c ON c.id = b.category_id
LEFT JOIN suppliers s            ON s.id = b.supplier_id;
