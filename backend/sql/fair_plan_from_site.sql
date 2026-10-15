-- backend/sql/fair_plan_from_site.sql
-- D45: the halls of each exhibition section (section_halls, D42), from the legends of the floor maps
-- on https://www.cantonfair.org.cn/en-US/exhibition-hall-map (one tab per phase), read on
-- 2026-10-15. The site titles these maps "137th session": the halls may differ at the 140th, so the
-- admin checks them on site and corrects a section in "Plan du salon" / "Plan des halls".
-- Not loaded: International Pavilion (every phase), "Stone/Iron Decoration and Outdoor Spa
-- Equipment" (phase 2, 13.0) and "Traditional Chinese Specialties" (phase 3, 6.0), which are not
-- sections of canton_fair_category. Four sections are not on the maps: three come from other
-- sources (end of the file, D47); Rural Vitalization (phase 3) stays empty, no source found.
-- INSERT IGNORE: a section whose halls were already typed is never overwritten; safe to run twice.
-- Run it with add_fair_plan_from_site.js (npm run db:add-fair-plan).

SET NAMES utf8mb4;

-- Phase 1
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (1, 'Consumer Electronics and Information Products', '1.1, 6.1, 7.1, 8.1, 1.1Y, 2.1Y, 6.0, 8.0', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (1, 'Household Electrical Appliances', '1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 4.1, 4.2, 5.1, 5.2, 2.1Y, 3.1Y, 4.1Y, 5.1Y', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (1, 'New Energy Vehicles and Smart Mobility', '8.1', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (1, 'Construction Machinery', '4.0, 9.0 (extérieur), 12.0 (extérieur)', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (1, 'Agricultural Machinery', '5.0 (extérieur), 8.0, 9.0 (extérieur)', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (1, 'Power Machinery and Electric Power', '17.1, 18.1', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (1, 'Processing Machinery Equipment', '18.1, 19.1, 20.1', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (1, 'Industrial Automation and Intelligent Manufacturing', '20.1', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (1, 'New Materials and Chemical Products', '17.2', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (1, 'General Machinery and Mechanical Basic Parts', '17.2, 18.2, 19.2, 20.2', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (1, 'Service Robots', '21.2 (Friendship Hall)', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (1, 'Motorcycles', '14.1, 15.1, 16.2', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (1, 'Electronic and Electrical Products', '14.2, 15.2, 16.3', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (1, 'Bicycles', '16.2', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (1, 'Lighting Equipment', '14.3, 14.4, 15.4, 16.4', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (1, 'New Energy Resources', '14.3, 15.3', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (1, 'Hardware', '9.1, 10.1, 11.1, 13.1', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (1, 'Tools', '9.2, 10.2, 11.2, 12.1, 12.2, 13.1, 13.2', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (1, 'Vehicle Spare Parts', '9.2, 9.3, 10.3, 11.3', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (1, 'Vehicles', '13.0 (extérieur)', NULL);

-- Phase 2
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (2, 'Festival Products', '1.1, 6.1, 6.0', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (2, 'General Ceramics', '2.1, 3.1, 4.1, 5.1, 5.1Y', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (2, 'Kitchenware and Tableware', '1.2, 2.2, 3.2, 4.2, 5.2, 1.1Y, 2.1Y, 3.1Y, 4.1Y', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (2, 'Gardening Products', '6.1, 7.1, 8.1, 8.0', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (2, 'Weaving, Rattan and Iron Products', '4.0, 8.0', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (2, 'Home Decorations', '17.1, 18.1, 19.1, 20.1', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (2, 'Clocks, Watches and Optical Instruments', '20.1', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (2, 'Gifts and Premiums', '17.2, 18.2, 19.2, 20.2', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (2, 'Glass Artware', '14.1, 14.2, 15.1, 15.2', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (2, 'Household Items', '14.3, 14.4, 15.2, 15.3, 15.4, 16.2, 16.3, 16.4', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (2, 'Sanitary and Bathroom Equipment', '9.1, 10.1, 11.1', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (2, 'Art Ceramics', '9.2, 10.2', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (2, 'Furniture', '9.3, 10.2, 10.3, 11.3, 9.0 (extérieur), 12.0 (extérieur)', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (2, 'Building and Decorative Materials', '11.1, 11.2, 12.1, 12.2, 13.1, 13.2', NULL);

-- Phase 3
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (3, 'Men and Women''s Clothing', '1.1, 2.1, 3.1, 4.1, 5.1, 2.1Y', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (3, 'Kids'' Wear', '1.1, 1.1Y', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (3, 'Sports and Casual Wear', '6.1, 7.1, 1.1Y', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (3, 'Underwear', '8.1, 3.1Y', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (3, 'Shoes', '1.2, 2.2, 3.2, 4.2, 5.2, 3.1Y', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (3, 'Furs, Leather, Downs and Related Products', '5.2', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (3, 'Carpets and Tapestries', '5.2, 4.1Y, 5.1Y', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (3, 'Fashion Accessories and Fittings', '4.0, 8.0, 5.1Y', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (3, 'Toys', '17.1, 18.1, 19.1', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (3, 'Children, Baby and Maternity Products', '20.1', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (3, 'Cases and Bags', '17.2, 18.2, 19.2, 20.2', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (3, 'Home Textiles', '14.1, 14.2, 14.3, 15.1, 15.2, 15.3, 16.2, 16.3', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (3, 'Textile Raw Materials and Fabrics', '14.4, 15.4, 16.4', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (3, 'Personal Care Products', '9.1, 10.1', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (3, 'Pet Products and Food', '10.1', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (3, 'Sports, Travel and Recreation Products', '11.1, 12.1, 13.1, 9.0 (extérieur), 12.0 (extérieur), 13.0 (extérieur)', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (3, 'Toiletries', '9.2', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (3, 'Medicines, Health Products and Medical Devices', '9.2, 10.2', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (3, 'Food', '11.2, 12.2, 13.2', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (3, 'Office Supplies', '9.3, 10.3, 11.3', NULL);

-- D47: three sections that are not on the site's maps, from other sources (checked on 2026-10-15).
-- Intelligent Healthcare: an exhibitor's page, "Hall 21.2 · Booths B41-48", Intelligent Healthcare
-- Zone (https://www.yjtmedical.com/yjt-medical-140th-canton-fair-2026.html).
-- Fashion Jewelry and Prefabricated House: one trade-guide summary only, so marked "à vérifier".
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (3, 'Intelligent Healthcare', '21.2 (Friendship Hall)', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (2, 'Fashion Jewelry', '21.2 (à vérifier)', NULL);
INSERT IGNORE INTO section_halls (phase, section, halls, updated_by) VALUES (2, 'Prefabricated House and Courtyard Facilities', '9.0 (extérieur, à vérifier), 12.0 (extérieur, à vérifier), 13.0 (extérieur, à vérifier)', NULL);
