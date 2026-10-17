-- backend/sql/create_sourcing_schema.sql
-- Schema v2 of the sourcing app, from Tarek's schema.sql (draft v2, MySQL 8).
-- Run order (run_schema_setup.js does it): china_provinces.sql, canton_fair_categories.sql, this file.
-- Changes to the draft are marked with their decision id (docs/sourcing-spec.md §5, D22-D28).
-- Runs on MySQL 8 and MariaDB 10.4+. Safe to run twice (IF NOT EXISTS / INSERT IGNORE / OR REPLACE).

SET NAMES utf8mb4;

-- ---------- Companies (Tarek's companies, the targets of product sharing) ----------
CREATE TABLE IF NOT EXISTS companies (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    branch      VARCHAR(150),
    UNIQUE KEY uq_company_name_branch (name, branch)              -- D25: two branches of one company
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Users ----------
CREATE TABLE IF NOT EXISTS users (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    name           VARCHAR(150) NOT NULL,
    username       VARCHAR(50)  NOT NULL,                          -- D22: login
    password_hash  VARCHAR(255) NOT NULL,                          -- D22: bcrypt
    level          TINYINT NULL,                                   -- D56: 1 to 5, or none
    CONSTRAINT chk_users_level CHECK (level BETWEEN 1 AND 5),
    role           VARCHAR(50),                                    -- 'ADMIN' or 'ACHETEUR'
    is_active      TINYINT(1) NOT NULL DEFAULT 1,                  -- 0 = sign-up waiting for the admin
    company_id     INT,
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,    -- D22: orders pending sign-ups
    UNIQUE KEY uq_users_username (username),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Suppliers ----------
CREATE TABLE IF NOT EXISTS suppliers (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(200) NOT NULL,
    phone        VARCHAR(50),
    email        VARCHAR(150),
    website      VARCHAR(255),
    cantonfair_url VARCHAR(255),                        -- D42: the exhibitor's page on cantonfair.org.cn
    address      TEXT,
    province_id  INT,                                   -- list from china_province
    rating       TINYINT CHECK (rating BETWEEN 1 AND 5),
    notes        TEXT,
    KEY ix_suppliers_name (name),                       -- D24: search by name
    FOREIGN KEY (province_id) REFERENCES china_province(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Contacts ----------
CREATE TABLE IF NOT EXISTS contacts (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    supplier_id  INT NOT NULL,
    name         VARCHAR(150),
    phone        VARCHAR(50),
    email        VARCHAR(150),
    wechat_qr    VARCHAR(255),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Booths ----------
-- D32: booth_code is built automatically as the fair prints it: hall.floor + aisle letter + number(s)
-- e.g. hall 11, floor 3, letter J, num 26  ->  11.3J26;  num 16-17 -> 14.3I16-17;
-- D50: the numbers on at least 2 digits, as on the fair's badges: hall 10, floor 3, A, 8-23 -> 10.3A08-23;
-- no letter and no number (only the hall and floor are known)  ->  9.1
-- The phase is not in the code: the same stand holds another supplier at each phase.
-- D31: RTRIM(letter): MariaDB 11.8 refuses a CHAR column in a generated column (its value depends on PAD_CHAR_TO_FULL_LENGTH).
-- D27: the API stores the letter in uppercase (the collation is case-insensitive, so the CHECK lets 'a' in).
-- update_booth_code.js moves an existing table to this definition.
CREATE TABLE IF NOT EXISTS booths (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    phase         TINYINT  NOT NULL CHECK (phase BETWEEN 1 AND 3),
    hall          TINYINT  NOT NULL,                     -- D56: 1-18, checked by the API
    floor         TINYINT  NOT NULL,
    CONSTRAINT chk_booths_floor CHECK (floor BETWEEN 0 AND 4),  -- D56: floor 0 (ground level)
    letter        CHAR(1)  NULL CHECK (letter BETWEEN 'A' AND 'Z'),  -- NULL with num_start: only hall.floor known
    num_start     SMALLINT NULL,
    num_end       SMALLINT NULL,                         -- NULL if single booth
    booth_code    VARCHAR(30) GENERATED ALWAYS AS (
                    CONCAT(hall, '.', floor,
                           IF(num_start IS NULL, '',     -- D35: not the bare CHAR column (MariaDB 11.8)
                              CONCAT(RTRIM(letter), IF(num_start < 10, CONCAT('0', num_start), num_start),
                     IF(num_end IS NULL, '', CONCAT('-', IF(num_end < 10, CONCAT('0', num_end), num_end))))))
                  ) STORED,
    category_id   INT NULL,                              -- category + sub category (canton_fair_category)
    supplier_id   INT NULL,
    visited       TINYINT(1) NOT NULL DEFAULT 0,         -- true / false
    comment       TEXT,
    -- D32: one stand per phase; NULL letters do not collide, so several suppliers can be known only by "9.1"
    UNIQUE KEY uq_booth_place (phase, hall, floor, letter, num_start),
    KEY ix_booths_code (booth_code),
    KEY ix_booths_to_visit (visited, phase, hall),       -- D24: the "to visit" list and its filters
    CONSTRAINT chk_booth_place CHECK ((letter IS NULL) = (num_start IS NULL) AND (num_start IS NOT NULL OR num_end IS NULL)),
    CHECK (num_end IS NULL OR num_end >= num_start),
    FOREIGN KEY (category_id) REFERENCES canton_fair_category(id) ON DELETE SET NULL,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)            ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Shipping types (Incoterms list) ----------
CREATE TABLE IF NOT EXISTS shipping_types (
    code   CHAR(3) PRIMARY KEY,
    name   VARCHAR(60) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO shipping_types (code, name) VALUES
('EXW', 'Ex Works'),
('FCA', 'Free Carrier'),
('FAS', 'Free Alongside Ship'),
('FOB', 'Free On Board'),
('CFR', 'Cost and Freight'),
('CIF', 'Cost, Insurance and Freight'),
('CPT', 'Carriage Paid To'),
('CIP', 'Carriage and Insurance Paid To'),
('DAP', 'Delivered at Place'),
('DPU', 'Delivered at Place Unloaded'),
('DDP', 'Delivered Duty Paid');

-- ---------- Products ----------
-- D28: ON DELETE CASCADE removes the photo rows; the API deletes the photo files first.
CREATE TABLE IF NOT EXISTS products (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    supplier_id    INT,
    supplier_ref   VARCHAR(100),                  -- Ref. F
    name           VARCHAR(200) NOT NULL,
    description    TEXT,
    price          DECIMAL(12,2),
    unit           VARCHAR(30),
    moq            INT,
    shipping_type  CHAR(3) DEFAULT 'FOB',         -- picked from shipping_types
    -- D38: the decision on the product, taken by the admin (the boss) at the evening review.
    -- update_product_decision.js adds these columns to an existing table.
    status         VARCHAR(20) NOT NULL DEFAULT 'A_ETUDIER',
    decision_note  VARCHAR(500),
    decided_by     INT NULL,
    decided_at     DATETIME NULL,
    created_by     INT NULL,                      -- D38: the buyer who recorded it
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    booth_id       INT NULL,                      -- D43: the booth where it was found (update_product_booth.js)
    KEY ix_products_name (name),                  -- D24: search by name
    KEY ix_products_status (status, created_at),  -- D38: the review queue
    CONSTRAINT chk_product_status CHECK (status IN ('A_ETUDIER', 'RETENU', 'ECHANTILLON', 'A_COMMANDER', 'REJETE')),
    FOREIGN KEY (supplier_id)   REFERENCES suppliers(id)        ON DELETE CASCADE,
    FOREIGN KEY (shipping_type) REFERENCES shipping_types(code) ON UPDATE CASCADE,
    CONSTRAINT fk_products_decided_by FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_products_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_products_booth FOREIGN KEY (booth_id) REFERENCES booths(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Hall plan of the fair (D42) ----------
-- The halls of each exhibition section in the current session ("14.3, 14.4, 15.4"), typed by the
-- admin from the official printed plan: the plan changes from one session to the next.
-- update_fair_plan.js creates it on an existing database.
CREATE TABLE IF NOT EXISTS section_halls (
    phase       TINYINT      NOT NULL CHECK (phase BETWEEN 1 AND 3),
    section     VARCHAR(150) NOT NULL,                 -- a section of canton_fair_category
    area        CHAR(1)      NOT NULL DEFAULT '',      -- D48: A (halls 1-8), B (9-13), C (14-16), D (17-21)
    halls       VARCHAR(255) NOT NULL,                 -- the codes of the section in that area
    position    SMALLINT     NULL,                     -- D48: its rank in that area on the official plan
    updated_by  INT NULL,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (phase, section, area),                -- D48: a section can be in two areas
    CONSTRAINT fk_section_halls_user FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Product images ----------
CREATE TABLE IF NOT EXISTS product_images (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    product_id  INT NOT NULL,
    image_url   VARCHAR(255) NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Shared With (list of companies per product) ----------
-- One row per company that ticks the box: product 5 shared with 2 companies = 2 rows
CREATE TABLE IF NOT EXISTS product_shares (
    product_id  INT NOT NULL,
    company_id  INT NOT NULL,
    PRIMARY KEY (product_id, company_id),
    FOREIGN KEY (product_id) REFERENCES products(id)  ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- Views
-- D23: no GROUP BY. The counts are correlated subqueries, so the server merges the view into
-- the query and "WHERE id = ?" reads one row instead of aggregating the whole table first.
-- =========================================================

-- Booths with category names, supplier name and zone of the fair (D50: A = halls 1-8, B = 9-13, C = 14-16, D = 17-21)
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

-- Suppliers with Nbr Booths and Booth Visit %
CREATE OR REPLACE VIEW v_suppliers AS
SELECT s.id, s.name, s.phone, s.email, s.website, s.address, s.province_id, s.rating, s.notes,
       s.cantonfair_url, p.name_en AS province,
       (SELECT COUNT(*) FROM booths b WHERE b.supplier_id = s.id) AS nbr_booths,
       (SELECT ROUND(100 * SUM(b.visited) / NULLIF(COUNT(*), 0))
          FROM booths b WHERE b.supplier_id = s.id) AS booth_visit_pct
FROM suppliers s
LEFT JOIN china_province p ON p.id = s.province_id;

-- Products with shipping name, the companies they're shared with, the decision (D38) and the booth (D43)
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
