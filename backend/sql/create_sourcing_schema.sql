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
    level          VARCHAR(50),
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
-- booth_code is built automatically: phase/hall.floor.letter.num
-- e.g. phase 2, hall 12, floor 1, letter A, num 22-24  ->  2/12.1.A.22-24
-- D31: RTRIM(letter): MariaDB 11.8 refuses a CHAR column in a generated column (its value depends on PAD_CHAR_TO_FULL_LENGTH).
-- D27: the API stores the letter in uppercase (the collation is case-insensitive, so the CHECK lets 'a' in).
CREATE TABLE IF NOT EXISTS booths (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    phase         TINYINT  NOT NULL CHECK (phase BETWEEN 1 AND 3),
    hall          TINYINT  NOT NULL,
    floor         TINYINT  NOT NULL CHECK (floor BETWEEN 1 AND 4),
    letter        CHAR(1)  NOT NULL CHECK (letter BETWEEN 'A' AND 'Z'),
    num_start     SMALLINT NOT NULL,
    num_end       SMALLINT NULL,                         -- NULL if single booth
    booth_code    VARCHAR(30) GENERATED ALWAYS AS (
                    CONCAT(phase, '/', hall, '.', floor, '.', RTRIM(letter), '.', num_start,
                           IF(num_end IS NULL, '', CONCAT('-', num_end)))
                  ) STORED,
    category_id   INT NULL,                              -- category + sub category (canton_fair_category)
    supplier_id   INT NULL,
    visited       TINYINT(1) NOT NULL DEFAULT 0,         -- true / false
    comment       TEXT,
    UNIQUE KEY uq_booth_code (booth_code),
    KEY ix_booths_to_visit (visited, phase, hall),       -- D24: the "to visit" list and its filters
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
    KEY ix_products_name (name),                  -- D24: search by name
    FOREIGN KEY (supplier_id)   REFERENCES suppliers(id)        ON DELETE CASCADE,
    FOREIGN KEY (shipping_type) REFERENCES shipping_types(code) ON UPDATE CASCADE
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

-- Booths with category names and supplier name
CREATE OR REPLACE VIEW v_booths AS
SELECT b.id, b.booth_code, b.phase, b.hall, b.floor, b.letter, b.num_start, b.num_end,
       b.category_id, c.category, c.section, c.sub_category,
       b.supplier_id, s.name AS supplier_name,
       b.visited, b.comment
FROM booths b
LEFT JOIN canton_fair_category c ON c.id = b.category_id
LEFT JOIN suppliers s            ON s.id = b.supplier_id;

-- Suppliers with Nbr Booths and Booth Visit %
CREATE OR REPLACE VIEW v_suppliers AS
SELECT s.id, s.name, s.phone, s.email, s.website, s.address, s.province_id, s.rating, s.notes,
       p.name_en AS province,
       (SELECT COUNT(*) FROM booths b WHERE b.supplier_id = s.id) AS nbr_booths,
       (SELECT ROUND(100 * SUM(b.visited) / NULLIF(COUNT(*), 0))
          FROM booths b WHERE b.supplier_id = s.id) AS booth_visit_pct
FROM suppliers s
LEFT JOIN china_province p ON p.id = s.province_id;

-- Products with shipping name and the companies they're shared with
CREATE OR REPLACE VIEW v_products AS
SELECT pr.id, pr.supplier_id, pr.supplier_ref, pr.name, pr.description, pr.price, pr.unit,
       pr.moq, pr.shipping_type, st.name AS shipping_name,
       (SELECT GROUP_CONCAT(CONCAT_WS(' - ', co.name, co.branch) ORDER BY co.name, co.branch SEPARATOR ', ')
          FROM product_shares ps JOIN companies co ON co.id = ps.company_id
         WHERE ps.product_id = pr.id) AS shared_with
FROM products pr
LEFT JOIN shipping_types st ON st.code = pr.shipping_type;
