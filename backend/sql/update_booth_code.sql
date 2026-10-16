-- D32: moves an existing booths table to the fair's booth code ("11.3J26", "14.3I16-17", "9.1").
-- The letter and the start number become optional (both or neither), the phase leaves the code,
-- and the unique key moves from booth_code to (phase, hall, floor, letter, num_start).
-- Run it with update_booth_code.js: each "-- step:" runs only when the table still needs it, so a
-- run that stopped half-way can be run again (MariaDB/MySQL cannot roll back ALTER TABLE).
-- D31/D35: the generated column must not use the CHAR column `letter` bare (MariaDB 11.8 refuses
-- it): RTRIM(letter) for the text, and num_start for "no letter" (they are set together).
-- D50: the numbers on at least 2 digits (10.3A08-23): a code without them is dropped
-- (pad-drop-index, pad-drop-code) and built again by add-code and add-code-index.

-- step: drop-old-unique
ALTER TABLE booths DROP INDEX uq_booth_code;

-- step: drop-old-code
ALTER TABLE booths DROP COLUMN booth_code;

-- step: letter-optional
ALTER TABLE booths MODIFY letter CHAR(1) NULL CHECK (letter BETWEEN 'A' AND 'Z');

-- step: number-optional
ALTER TABLE booths MODIFY num_start SMALLINT NULL;

-- step: pad-drop-index
ALTER TABLE booths DROP INDEX ix_booths_code;

-- step: pad-drop-code
ALTER TABLE booths DROP COLUMN booth_code;

-- step: add-code
ALTER TABLE booths ADD COLUMN booth_code VARCHAR(30) GENERATED ALWAYS AS (
    CONCAT(hall, '.', floor,
           IF(num_start IS NULL, '',
              CONCAT(RTRIM(letter), IF(num_start < 10, CONCAT('0', num_start), num_start),
                     IF(num_end IS NULL, '', CONCAT('-', IF(num_end < 10, CONCAT('0', num_end), num_end))))))
  ) STORED AFTER num_end;

-- step: add-place-unique
ALTER TABLE booths ADD UNIQUE KEY uq_booth_place (phase, hall, floor, letter, num_start);

-- step: add-code-index
ALTER TABLE booths ADD KEY ix_booths_code (booth_code);

-- step: add-place-check
ALTER TABLE booths ADD CONSTRAINT chk_booth_place
  CHECK ((letter IS NULL) = (num_start IS NULL) AND (num_start IS NOT NULL OR num_end IS NULL));

-- step: view
-- The view lost its column with the drop: create it again (same text as create_sourcing_schema.sql).
CREATE OR REPLACE VIEW v_booths AS
SELECT b.id, b.booth_code, b.phase, b.hall, b.floor, b.letter, b.num_start, b.num_end,
       b.category_id, c.category, c.section, c.sub_category,
       b.supplier_id, s.name AS supplier_name,
       b.visited, b.comment,
       CASE WHEN b.hall BETWEEN 1 AND 8 THEN 'A' WHEN b.hall BETWEEN 9 AND 13 THEN 'B'
            WHEN b.hall BETWEEN 14 AND 16 THEN 'C' WHEN b.hall BETWEEN 17 AND 21 THEN 'D' END AS zone
FROM booths b
LEFT JOIN canton_fair_category c ON c.id = b.category_id
LEFT JOIN suppliers s            ON s.id = b.supplier_id;
