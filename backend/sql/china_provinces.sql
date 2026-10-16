-- backend/sql/china_provinces.sql (from Tarek's china_provinces.sql, made safe to run twice)
-- China: the 23 provinces (省) as counted by the PRC
-- Taiwan is listed as the PRC counts it, but is governed separately (prc_administered = 0)

SET NAMES utf8mb4;


CREATE TABLE IF NOT EXISTS china_province (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name_en VARCHAR(50) NOT NULL,
  name_zh VARCHAR(20) NOT NULL,
  capital VARCHAR(50) NOT NULL,
  prc_administered TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_name_en (name_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO china_province (name_en, name_zh, capital, prc_administered) VALUES
('Anhui', '安徽', 'Hefei', 1),
('Fujian', '福建', 'Fuzhou', 1),
('Gansu', '甘肃', 'Lanzhou', 1),
('Guangdong', '广东', 'Guangzhou', 1),
('Guizhou', '贵州', 'Guiyang', 1),
('Hainan', '海南', 'Haikou', 1),
('Hebei', '河北', 'Shijiazhuang', 1),
('Heilongjiang', '黑龙江', 'Harbin', 1),
('Henan', '河南', 'Zhengzhou', 1),
('Hubei', '湖北', 'Wuhan', 1),
('Hunan', '湖南', 'Changsha', 1),
('Jiangsu', '江苏', 'Nanjing', 1),
('Jiangxi', '江西', 'Nanchang', 1),
('Jilin', '吉林', 'Changchun', 1),
('Liaoning', '辽宁', 'Shenyang', 1),
('Qinghai', '青海', 'Xining', 1),
('Shaanxi', '陕西', 'Xi''an', 1),
('Shandong', '山东', 'Jinan', 1),
('Shanxi', '山西', 'Taiyuan', 1),
('Sichuan', '四川', 'Chengdu', 1),
('Yunnan', '云南', 'Kunming', 1),
('Zhejiang', '浙江', 'Hangzhou', 1),
('Taiwan', '台湾', 'Taipei', 0);
