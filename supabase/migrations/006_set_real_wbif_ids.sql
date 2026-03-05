-- ============================================
-- Kotra.is — Migration 006
-- Set real WBIF profile IDs
-- The actual matchlog IDs were extracted from
-- HTML links on matches.wbif.net/wbif/ratings
-- ============================================

-- Update existing players with their real WBIF profile IDs
UPDATE players SET wbif_id = '1713' WHERE name = 'Grétar Aasen' AND country = 'IS';
UPDATE players SET wbif_id = '2468' WHERE name = 'Donara Levonsdóttir' AND country = 'IS';
UPDATE players SET wbif_id = '2395' WHERE name = 'Bjössi Sigmars' AND country = 'IS';
UPDATE players SET wbif_id = '2129' WHERE name = 'Vesteinn Stefánsson' AND country = 'IS';
UPDATE players SET wbif_id = '1811' WHERE name = 'Auður Magnúsdóttir' AND country = 'IS';
UPDATE players SET wbif_id = '1407' WHERE name = 'Kjartan Ingvarsson' AND country = 'IS';
UPDATE players SET wbif_id = '1716' WHERE name = 'Einar Kristjánsson' AND country = 'IS';
UPDATE players SET wbif_id = '2897' WHERE name = 'Stefan Freyr Guðmundsson' AND country = 'IS';
UPDATE players SET wbif_id = '1026' WHERE name = 'Sigurður Þorsteinsson' AND country = 'IS';
UPDATE players SET wbif_id = '1938' WHERE name = 'Arnar Mar Guðmundsson' AND country = 'IS';
UPDATE players SET wbif_id = '2969' WHERE name = 'Guðmundur Gestur Sveinsson' AND country = 'IS';
UPDATE players SET wbif_id = '2971' WHERE name = 'Kjartan Ásmundsson' AND country = 'IS';
UPDATE players SET wbif_id = '305'  WHERE name = 'Kristinn Björgvinsson' AND country = 'IS';
UPDATE players SET wbif_id = '2923' WHERE name = 'Þráinn Sigfússon' AND country = 'IS';
UPDATE players SET wbif_id = '1540' WHERE name = 'Alda Dröfn Guðbjörnsdóttir' AND country = 'IS';
UPDATE players SET wbif_id = '4733' WHERE name = 'Margrét Óskarsdóttir' AND country = 'IS';
UPDATE players SET wbif_id = '4040' WHERE name = 'Anna Eir Emeliudóttir' AND country = 'IS';
UPDATE players SET wbif_id = '2582' WHERE name = 'Gunnar Gunnsteinsson' AND country = 'IS';
UPDATE players SET wbif_id = '2593' WHERE name = 'Ólafur Tryggvason' AND country = 'IS';
UPDATE players SET wbif_id = '2952' WHERE name = 'Bjarni Freyr Kristjánsson' AND country = 'IS';
UPDATE players SET wbif_id = '3021' WHERE name = 'Þórolfur Beck' AND country = 'IS';
UPDATE players SET wbif_id = '3286' WHERE name = 'Gyða Björg Sigurðardóttir' AND country = 'IS';
UPDATE players SET wbif_id = '3695' WHERE name = 'Sveinbjörg Bjarnadóttir' AND country = 'IS';
UPDATE players SET wbif_id = '2587' WHERE name = 'Tryggvi Þórhallsson' AND country = 'IS';
UPDATE players SET wbif_id = '2657' WHERE name = 'Njáll Björgvinsson' AND country = 'IS';
UPDATE players SET wbif_id = '2469' WHERE name = 'Signy Kristinsdóttir' AND country = 'IS';
UPDATE players SET wbif_id = '2895' WHERE name = 'Daniel Sigurðsson' AND country = 'IS';
UPDATE players SET wbif_id = '3238' WHERE name = 'Bryndís Hrönn Ragnarsdóttir' AND country = 'IS';
UPDATE players SET wbif_id = '1839' WHERE name = 'María Jónsdóttir' AND country = 'IS';
UPDATE players SET wbif_id = '2204' WHERE name = 'Rosa Ísfeld' AND country = 'IS';
UPDATE players SET wbif_id = '2998' WHERE name = 'Aron Ingi Óskarsson' AND country = 'IS';
UPDATE players SET wbif_id = '1214' WHERE name = 'Arnór Gauti Helgason' AND country = 'IS';

-- Add missing Icelandic players not in original seed
INSERT INTO players (name, wbif_id, wbif_rating, wbif_experience, country, active, rating, rank, joined_date)
VALUES
  ('Ingi Tandri Traustason', '49', 1577.65, 1836, 'IS', true, 1578, 786, '2024-01-01'),
  ('Jóhannes Jónsson', '1458', 1573.80, 715, 'IS', true, 1574, 856, '2024-01-01'),
  ('Magni Rafn Jónsson', '1153', 1538.01, 65, 'IS', true, 1538, 1378, '2024-01-01'),
  ('Fjalarr Páll Manason', '1759', 1500.85, 1131, 'IS', true, 1501, 2075, '2024-01-01'),
  ('Margrét Hróarsdóttir', '2588', 1494.40, 136, 'IS', true, 1494, 2212, '2024-01-01'),
  ('Guðrún Sigurðardóttir', '4058', 1465.77, 52, 'IS', true, 1466, 2802, '2024-01-01'),
  ('Katrín Guðmundsdóttir', '1838', 1349.67, 156, 'IS', true, 1350, 4447, '2024-01-01'),
  ('Eyrún Jónsdóttir', '2299', 1323.69, 78, 'IS', true, 1324, 4565, '2024-01-01'),
  ('Steindór Kristjánsson', '2015', 1346.30, 273, 'IS', true, 1346, 4471, '2024-01-01')
ON CONFLICT DO NOTHING;
