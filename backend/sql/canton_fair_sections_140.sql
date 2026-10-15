-- backend/sql/canton_fair_sections_140.sql
-- D41: the 23 exhibition sections of the 140th Canton Fair missing from canton_fair_categories.sql
-- (all of Phase 1, Fashion Jewelry in Phase 2, Rural Vitalization and Intelligent Healthcare in
-- Phase 3). Section names from the Ministry of Commerce's list of the 140th fair's sections:
-- https://www.mofcom.gov.cn/zwjg/sqfb/md/art/2026/art_7b21114e2804493fafab631cbf886dfc.html
-- The official list has no sub-categories for them: each section is its own sub-category until
-- the real ones are known. The category of three of them is not in that list ("category to
-- confirm" below). Each row is added only if its section is not there yet: safe to run twice.
-- Run by run_schema_setup.js (new database) or add_canton_sections.js (existing database).

SET NAMES utf8mb4;

INSERT INTO canton_fair_category (phase, category, section, sub_category)
SELECT 'Phase 1 (Oct.15 - 19)', 'Electronics & Appliance', 'Household Electrical Appliances', 'Household Electrical Appliances' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM canton_fair_category WHERE phase = 'Phase 1 (Oct.15 - 19)' AND section = 'Household Electrical Appliances');

INSERT INTO canton_fair_category (phase, category, section, sub_category)
SELECT 'Phase 1 (Oct.15 - 19)', 'Electronics & Appliance', 'Consumer Electronics and Information Products', 'Consumer Electronics and Information Products' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM canton_fair_category WHERE phase = 'Phase 1 (Oct.15 - 19)' AND section = 'Consumer Electronics and Information Products');

INSERT INTO canton_fair_category (phase, category, section, sub_category)
SELECT 'Phase 1 (Oct.15 - 19)', 'Manufacturing', 'Industrial Automation and Intelligent Manufacturing', 'Industrial Automation and Intelligent Manufacturing' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM canton_fair_category WHERE phase = 'Phase 1 (Oct.15 - 19)' AND section = 'Industrial Automation and Intelligent Manufacturing');

INSERT INTO canton_fair_category (phase, category, section, sub_category)
SELECT 'Phase 1 (Oct.15 - 19)', 'Manufacturing', 'Processing Machinery Equipment', 'Processing Machinery Equipment' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM canton_fair_category WHERE phase = 'Phase 1 (Oct.15 - 19)' AND section = 'Processing Machinery Equipment');

INSERT INTO canton_fair_category (phase, category, section, sub_category)
SELECT 'Phase 1 (Oct.15 - 19)', 'Manufacturing', 'Power Machinery and Electric Power', 'Power Machinery and Electric Power' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM canton_fair_category WHERE phase = 'Phase 1 (Oct.15 - 19)' AND section = 'Power Machinery and Electric Power');

INSERT INTO canton_fair_category (phase, category, section, sub_category)
SELECT 'Phase 1 (Oct.15 - 19)', 'Manufacturing', 'General Machinery and Mechanical Basic Parts', 'General Machinery and Mechanical Basic Parts' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM canton_fair_category WHERE phase = 'Phase 1 (Oct.15 - 19)' AND section = 'General Machinery and Mechanical Basic Parts');

INSERT INTO canton_fair_category (phase, category, section, sub_category)
SELECT 'Phase 1 (Oct.15 - 19)', 'Manufacturing', 'Construction Machinery', 'Construction Machinery' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM canton_fair_category WHERE phase = 'Phase 1 (Oct.15 - 19)' AND section = 'Construction Machinery');

INSERT INTO canton_fair_category (phase, category, section, sub_category)
SELECT 'Phase 1 (Oct.15 - 19)', 'Manufacturing', 'Agricultural Machinery', 'Agricultural Machinery' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM canton_fair_category WHERE phase = 'Phase 1 (Oct.15 - 19)' AND section = 'Agricultural Machinery');

-- category to confirm
INSERT INTO canton_fair_category (phase, category, section, sub_category)
SELECT 'Phase 1 (Oct.15 - 19)', 'Manufacturing', 'New Materials and Chemical Products', 'New Materials and Chemical Products' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM canton_fair_category WHERE phase = 'Phase 1 (Oct.15 - 19)' AND section = 'New Materials and Chemical Products');

-- category to confirm
INSERT INTO canton_fair_category (phase, category, section, sub_category)
SELECT 'Phase 1 (Oct.15 - 19)', 'Manufacturing', 'Service Robots', 'Service Robots' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM canton_fair_category WHERE phase = 'Phase 1 (Oct.15 - 19)' AND section = 'Service Robots');

INSERT INTO canton_fair_category (phase, category, section, sub_category)
SELECT 'Phase 1 (Oct.15 - 19)', 'Vehicles & Two Wheels', 'New Energy Vehicles and Smart Mobility', 'New Energy Vehicles and Smart Mobility' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM canton_fair_category WHERE phase = 'Phase 1 (Oct.15 - 19)' AND section = 'New Energy Vehicles and Smart Mobility');

INSERT INTO canton_fair_category (phase, category, section, sub_category)
SELECT 'Phase 1 (Oct.15 - 19)', 'Vehicles & Two Wheels', 'Vehicles', 'Vehicles' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM canton_fair_category WHERE phase = 'Phase 1 (Oct.15 - 19)' AND section = 'Vehicles');

INSERT INTO canton_fair_category (phase, category, section, sub_category)
SELECT 'Phase 1 (Oct.15 - 19)', 'Vehicles & Two Wheels', 'Vehicle Spare Parts', 'Vehicle Spare Parts' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM canton_fair_category WHERE phase = 'Phase 1 (Oct.15 - 19)' AND section = 'Vehicle Spare Parts');

INSERT INTO canton_fair_category (phase, category, section, sub_category)
SELECT 'Phase 1 (Oct.15 - 19)', 'Vehicles & Two Wheels', 'Motorcycles', 'Motorcycles' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM canton_fair_category WHERE phase = 'Phase 1 (Oct.15 - 19)' AND section = 'Motorcycles');

INSERT INTO canton_fair_category (phase, category, section, sub_category)
SELECT 'Phase 1 (Oct.15 - 19)', 'Vehicles & Two Wheels', 'Bicycles', 'Bicycles' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM canton_fair_category WHERE phase = 'Phase 1 (Oct.15 - 19)' AND section = 'Bicycles');

INSERT INTO canton_fair_category (phase, category, section, sub_category)
SELECT 'Phase 1 (Oct.15 - 19)', 'Light & Electrical', 'Lighting Equipment', 'Lighting Equipment' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM canton_fair_category WHERE phase = 'Phase 1 (Oct.15 - 19)' AND section = 'Lighting Equipment');

INSERT INTO canton_fair_category (phase, category, section, sub_category)
SELECT 'Phase 1 (Oct.15 - 19)', 'Light & Electrical', 'Electronic and Electrical Products', 'Electronic and Electrical Products' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM canton_fair_category WHERE phase = 'Phase 1 (Oct.15 - 19)' AND section = 'Electronic and Electrical Products');

INSERT INTO canton_fair_category (phase, category, section, sub_category)
SELECT 'Phase 1 (Oct.15 - 19)', 'Light & Electrical', 'New Energy Resources', 'New Energy Resources' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM canton_fair_category WHERE phase = 'Phase 1 (Oct.15 - 19)' AND section = 'New Energy Resources');

INSERT INTO canton_fair_category (phase, category, section, sub_category)
SELECT 'Phase 1 (Oct.15 - 19)', 'Hardware', 'Hardware', 'Hardware' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM canton_fair_category WHERE phase = 'Phase 1 (Oct.15 - 19)' AND section = 'Hardware');

INSERT INTO canton_fair_category (phase, category, section, sub_category)
SELECT 'Phase 1 (Oct.15 - 19)', 'Hardware', 'Tools', 'Tools' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM canton_fair_category WHERE phase = 'Phase 1 (Oct.15 - 19)' AND section = 'Tools');

INSERT INTO canton_fair_category (phase, category, section, sub_category)
SELECT 'Phase 2 (Oct.23 - 27)', 'Gifts & Decorations', 'Fashion Jewelry', 'Fashion Jewelry' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM canton_fair_category WHERE phase = 'Phase 2 (Oct.23 - 27)' AND section = 'Fashion Jewelry');

-- category to confirm
INSERT INTO canton_fair_category (phase, category, section, sub_category)
SELECT 'Phase 3 (Oct.31 - Nov.4)', 'Health & Recreation', 'Rural Vitalization', 'Rural Vitalization' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM canton_fair_category WHERE phase = 'Phase 3 (Oct.31 - Nov.4)' AND section = 'Rural Vitalization');

INSERT INTO canton_fair_category (phase, category, section, sub_category)
SELECT 'Phase 3 (Oct.31 - Nov.4)', 'Health & Recreation', 'Intelligent Healthcare', 'Intelligent Healthcare' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM canton_fair_category WHERE phase = 'Phase 3 (Oct.31 - Nov.4)' AND section = 'Intelligent Healthcare');
