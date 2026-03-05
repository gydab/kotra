-- ============================================
-- Kotra.is — Migration 004
-- WBIF Player Integration
-- Links Icelandic players to WBIF profiles
-- ============================================

-- ==========================================
-- 1. Add WBIF fields to players table (admin-managed roster)
-- ==========================================
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS wbif_rating DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS wbif_experience INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wbif_pr_overall DECIMAL(6,4),
  ADD COLUMN IF NOT EXISTS wbif_pr_moves DECIMAL(6,4),
  ADD COLUMN IF NOT EXISTS wbif_pr_cube DECIMAL(6,4),
  ADD COLUMN IF NOT EXISTS wbif_matches_recorded INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wbif_win_rate DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS wbif_peak_rating DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS wbif_title TEXT,  -- e.g. 'Grandmaster G2', 'Master M1', etc.
  ADD COLUMN IF NOT EXISTS wbif_last_synced TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'IS',
  ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;

-- ==========================================
-- 2. Add WBIF fields to player_profiles (auth-linked users)
-- ==========================================
ALTER TABLE player_profiles
  ADD COLUMN IF NOT EXISTS wbif_id TEXT,           -- WBIF numeric ID (e.g. '3286')
  ADD COLUMN IF NOT EXISTS wbif_name TEXT,          -- Name as it appears on WBIF
  ADD COLUMN IF NOT EXISTS wbif_verified BOOLEAN DEFAULT FALSE,  -- Whether link is confirmed
  ADD COLUMN IF NOT EXISTS player_id UUID REFERENCES players(id); -- Link to admin-managed roster

-- ==========================================
-- 3. WBIF match history cache
-- ==========================================
CREATE TABLE IF NOT EXISTS wbif_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wbif_match_id INTEGER UNIQUE NOT NULL,     -- WBIF match ID (e.g. 117448)
  player_wbif_id TEXT NOT NULL,               -- WBIF player ID
  opponent_name TEXT NOT NULL,
  opponent_wbif_id TEXT,
  match_date DATE NOT NULL,
  player_score INTEGER NOT NULL,
  opponent_score INTEGER NOT NULL,
  player_won BOOLEAN NOT NULL,
  player_old_rating DECIMAL(8,2),
  player_new_rating DECIMAL(8,2),
  player_rating_change DECIMAL(6,2),
  player_experience INTEGER,
  event_name TEXT,                            -- Tournament/event name
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE wbif_matches ENABLE ROW LEVEL SECURITY;

-- Public can read WBIF match data
CREATE POLICY "Public can read wbif matches" ON wbif_matches
  FOR SELECT USING (true);

-- Admins can manage WBIF match data
CREATE POLICY "Admins can manage wbif matches" ON wbif_matches
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
  );

CREATE INDEX idx_wbif_matches_player ON wbif_matches(player_wbif_id);
CREATE INDEX idx_wbif_matches_date ON wbif_matches(match_date DESC);

-- ==========================================
-- 4. WBIF sync log — track when data was last fetched
-- ==========================================
CREATE TABLE IF NOT EXISTS wbif_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  wbif_id TEXT NOT NULL,
  sync_type TEXT NOT NULL CHECK (sync_type IN ('profile', 'matches', 'ratings')),
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error', 'partial')),
  details JSONB DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE wbif_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read sync log" ON wbif_sync_log
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
  );

-- ==========================================
-- 5. Icelandic players view — combines players + WBIF data
-- ==========================================
CREATE OR REPLACE VIEW icelandic_players AS
SELECT
  p.id,
  p.name,
  p.email,
  p.rating,
  p.rank,
  p.photo_url,
  p.bio_is,
  p.bio_en,
  p.wbif_id,
  p.wbif_rating,
  p.wbif_experience,
  p.wbif_pr_overall,
  p.wbif_pr_moves,
  p.wbif_pr_cube,
  p.wbif_matches_recorded,
  p.wbif_win_rate,
  p.wbif_peak_rating,
  p.wbif_title,
  p.wbif_last_synced,
  p.bg_heroes_nick,
  p.bg_galaxy_nick,
  p.active,
  p.joined_date,
  p.created_at
FROM players p
WHERE p.country = 'IS' OR p.country IS NULL
ORDER BY p.wbif_rating DESC NULLS LAST, p.name;

-- ==========================================
-- 6. Allow service role to insert/manage WBIF data
--    (for server-side sync operations)
-- ==========================================
-- Service role bypasses RLS, but adding explicit policies
-- for future API endpoint use

CREATE POLICY "Authenticated can insert wbif matches" ON wbif_matches
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
  );

-- ==========================================
-- 7. Seed initial Icelandic players from WBIF ratings
-- ==========================================
INSERT INTO players (name, wbif_id, wbif_rating, wbif_experience, country, active, rating, joined_date)
VALUES
  ('Grétar Aasen', '102', 1674.28, 179, 'IS', true, 1674, '2024-01-01'),
  ('Bjössi Sigmars', '604', 1596.14, 168, 'IS', true, 1596, '2024-01-01'),
  ('Vesteinn Stefánsson', '620', 1593.84, 637, 'IS', true, 1594, '2024-01-01'),
  ('Auður Magnúsdóttir', '838', 1574.69, 351, 'IS', true, 1575, '2024-01-01'),
  ('Kjartan Ingvarsson', '952', 1565.10, 312, 'IS', true, 1565, '2024-01-01'),
  ('Einar Kristjánsson', '1029', 1561.02, 533, 'IS', true, 1561, '2024-01-01'),
  ('Stefan Freyr Guðmundsson', '1369', 1538.72, 603, 'IS', true, 1539, '2024-01-01'),
  ('Sigurður Þorsteinsson', '1736', 1518.92, 78, 'IS', true, 1519, '2024-01-01'),
  ('Arnar Mar Guðmundsson', '2052', 1501.65, 66, 'IS', true, 1502, '2024-01-01'),
  ('Guðmundur Gestur Sveinsson', '2496', 1478.47, 317, 'IS', true, 1478, '2024-01-01'),
  ('Kjartan Ásmundsson', '2410', 1482.10, 169, 'IS', true, 1482, '2024-01-01'),
  ('Kristinn Björgvinsson', '2437', 1480.85, 52, 'IS', true, 1481, '2024-01-01'),
  ('Þráinn Sigfússon', '2768', 1468.12, 65, 'IS', true, 1468, '2024-01-01'),
  ('Alda Dröfn Guðbjörnsdóttir', '2920', 1461.73, 598, 'IS', true, 1462, '2024-01-01'),
  ('Margrét Óskarsdóttir', '2936', 1460.77, 13, 'IS', true, 1461, '2024-01-01'),
  ('Anna Eir Emeliudóttir', '2972', 1458.80, 65, 'IS', true, 1459, '2024-01-01'),
  ('Gunnar Gunnsteinsson', '3167', 1447.27, 72, 'IS', true, 1447, '2024-01-01'),
  ('Ólafur Tryggvason', '3347', 1438.21, 46, 'IS', true, 1438, '2024-01-01'),
  ('Bjarni Freyr Kristjánsson', '3494', 1431.25, 182, 'IS', true, 1431, '2024-01-01'),
  ('Þórolfur Beck', '3491', 1431.38, 26, 'IS', true, 1431, '2024-01-01'),
  ('Gyða Björg Sigurðardóttir', '3651', 1422.60, 117, 'IS', true, 1423, '2024-01-01'),
  ('Sveinbjörg Bjarnadóttir', '3711', 1418.68, 52, 'IS', true, 1419, '2024-01-01'),
  ('Tryggvi Þórhallsson', '3752', 1415.77, 59, 'IS', true, 1416, '2024-01-01'),
  ('Njáll Björgvinsson', '3838', 1410.80, 33, 'IS', true, 1411, '2024-01-01'),
  ('Donara Levonsdóttir', '652', 1590.29, 125, 'IS', true, 1590, '2024-01-01'),
  ('Signy Kristinsdóttir', '4116', 1390.97, 64, 'IS', true, 1391, '2024-01-01'),
  ('Daniel Sigurðsson', '4232', 1379.51, 73, 'IS', true, 1380, '2024-01-01'),
  ('Bryndís Hrönn Ragnarsdóttir', '4160', 1387.80, 78, 'IS', true, 1388, '2024-01-01'),
  ('María Jónsdóttir', '4239', 1378.92, 130, 'IS', true, 1379, '2024-01-01'),
  ('Rosa Ísfeld', '4212', 1381.60, 94, 'IS', true, 1382, '2024-01-01'),
  ('Aron Ingi Óskarsson', '4274', 1375.70, 104, 'IS', true, 1376, '2024-01-01'),
  ('Arnór Gauti Helgason', '4417', 1356.10, 1004, 'IS', true, 1356, '2024-01-01')
ON CONFLICT DO NOTHING;
