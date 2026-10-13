-- backend/sql/create_sourcing_schema.sql
-- Schema of sourcing_db, from sourcing_db_diagram.pdf (10 tables).
-- Additions to the diagram are marked with their decision id (docs/sourcing-spec.md §5).
-- Runs on MySQL 8 and MariaDB 10.4+. Safe to run twice (IF NOT EXISTS / INSERT IGNORE).
-- Run it with: node sql/run_schema_setup.js

CREATE TABLE IF NOT EXISTS companies (
  id   INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  UNIQUE KEY uq_companies_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id            INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  company_id    INT          NOT NULL,
  name          VARCHAR(100) NOT NULL,
  username      VARCHAR(50)  NOT NULL,              -- D1
  password_hash VARCHAR(255) NOT NULL,              -- D1 (bcrypt)
  level         TINYINT      NOT NULL DEFAULT 1,    -- D4: >= 4 = company admin
  role          VARCHAR(50)  NOT NULL DEFAULT 'ACHETEUR', -- D4: 'SUPER_ADMIN' = super-admin
  active        TINYINT(1)   NOT NULL DEFAULT 1,
  UNIQUE KEY uq_users_username (username),
  CONSTRAINT fk_users_company FOREIGN KEY (company_id) REFERENCES companies (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- D3: global tree, managed by the super-admin
CREATE TABLE IF NOT EXISTS categories (
  id        INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  parent_id INT          NULL,
  name      VARCHAR(100) NOT NULL,
  depth     TINYINT      NOT NULL DEFAULT 0,
  CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS suppliers (
  id         INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  company_id INT          NOT NULL,
  name       VARCHAR(150) NOT NULL,
  phone      VARCHAR(50)  NULL,
  email      VARCHAR(150) NULL,
  website    VARCHAR(200) NULL,
  address    TEXT         NULL,
  province   VARCHAR(100) NULL,
  rating     TINYINT      NULL,                     -- 1 to 5, checked by the API
  notes      TEXT         NULL,
  KEY ix_suppliers_company_name (company_id, name),
  CONSTRAINT fk_suppliers_company FOREIGN KEY (company_id) REFERENCES companies (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- D8: contacts go with their supplier
CREATE TABLE IF NOT EXISTS contacts (
  id          INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  supplier_id INT          NOT NULL,
  name        VARCHAR(100) NOT NULL,
  phone       VARCHAR(50)  NULL,
  email       VARCHAR(150) NULL,
  wechat_qr   VARCHAR(255) NULL,
  CONSTRAINT fk_contacts_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Location example: phase 2, hall 12, level 2, letter F, numbers 35-36 -> "12.2 F35-36"
CREATE TABLE IF NOT EXISTS booths (
  id          INT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
  supplier_id INT        NOT NULL,
  category_id INT        NULL,
  phase       TINYINT    NULL,
  hall        TINYINT    NULL,
  level       TINYINT    NULL,
  letter      CHAR(1)    NULL,
  num_start   SMALLINT   NULL,
  num_end     SMALLINT   NULL,
  to_visit    TINYINT(1) NOT NULL DEFAULT 0,
  comment     TEXT       NULL,
  KEY ix_booths_location (phase, hall, level),
  CONSTRAINT fk_booths_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id),
  CONSTRAINT fk_booths_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS booth_visits (
  id         INT      NOT NULL AUTO_INCREMENT PRIMARY KEY,
  booth_id   INT      NOT NULL,
  user_id    INT      NOT NULL,
  visited_at DATETIME NULL,
  status     ENUM('prevu','visite','annule') NOT NULL DEFAULT 'prevu', -- D2
  comment    TEXT     NULL,
  CONSTRAINT fk_visits_booth FOREIGN KEY (booth_id) REFERENCES booths (id) ON DELETE CASCADE,
  CONSTRAINT fk_visits_user  FOREIGN KEY (user_id)  REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- D7: a product belongs to the company of its supplier
CREATE TABLE IF NOT EXISTS products (
  id           INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
  supplier_id  INT           NOT NULL,
  booth_id     INT           NULL,
  created_by   INT           NOT NULL,
  supplier_ref VARCHAR(100)  NULL,
  name         VARCHAR(150)  NOT NULL,
  description  TEXT          NULL,
  price_tnd    DECIMAL(12,3) NULL,
  unit         VARCHAR(30)   NULL,
  moq          INT           NULL,
  incoterm     VARCHAR(10)   NULL,
  CONSTRAINT fk_products_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id),
  CONSTRAINT fk_products_booth    FOREIGN KEY (booth_id)    REFERENCES booths (id) ON DELETE SET NULL,
  CONSTRAINT fk_products_user     FOREIGN KEY (created_by)  REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_images (
  id         INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id INT          NOT NULL,
  image_url  VARCHAR(255) NOT NULL,
  CONSTRAINT fk_images_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_shares (
  product_id INT NOT NULL,
  company_id INT NOT NULL,
  PRIMARY KEY (product_id, company_id),
  CONSTRAINT fk_shares_product FOREIGN KEY (product_id) REFERENCES products (id)  ON DELETE CASCADE,
  CONSTRAINT fk_shares_company FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seeds. The admin user is created by run_schema_setup.js (its password must be hashed).
INSERT IGNORE INTO companies (id, name) VALUES (1, 'Société démo');

INSERT IGNORE INTO categories (id, parent_id, name, depth) VALUES
  (1, NULL, 'Électronique', 0),
  (2, NULL, 'Maison et décoration', 0),
  (3, NULL, 'Textile', 0),
  (4, 1,    'Petit électroménager', 1);
