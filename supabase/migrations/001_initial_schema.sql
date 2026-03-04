-- ============================================
-- Kotra.is — Database Migration
-- Run this in the Supabase SQL Editor
-- ============================================

-- ==========================================
-- 1. Admin profiles table (links auth.users to admin roles)
-- ==========================================
CREATE TABLE IF NOT EXISTS admin_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('admin', 'editor')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;

-- Only authenticated admins can read admin_profiles
CREATE POLICY "Admins can read admin_profiles" ON admin_profiles
  FOR SELECT USING (auth.uid() = id);

-- ==========================================
-- 2. News table
-- ==========================================
CREATE TABLE IF NOT EXISTS news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_is TEXT NOT NULL DEFAULT '',
  title_en TEXT NOT NULL DEFAULT '',
  body_is TEXT NOT NULL DEFAULT '',
  body_en TEXT NOT NULL DEFAULT '',
  slug TEXT UNIQUE,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  published_date TIMESTAMPTZ,
  author TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE news ENABLE ROW LEVEL SECURITY;

-- Anyone can read published news
CREATE POLICY "Public can read published news" ON news
  FOR SELECT USING (published = true);

-- Admins can do everything
CREATE POLICY "Admins can manage news" ON news
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
  );

-- ==========================================
-- 3. Players table
-- ==========================================
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  rating INTEGER DEFAULT 0,
  rank INTEGER,
  joined_date DATE,
  photo_url TEXT,
  bio_is TEXT DEFAULT '',
  bio_en TEXT DEFAULT '',
  bg_heroes_nick TEXT,
  bg_galaxy_nick TEXT,
  bg_nj_nick TEXT,
  wbif_id TEXT,
  discord_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Anyone can read players
CREATE POLICY "Public can read players" ON players
  FOR SELECT USING (true);

-- Admins can manage players
CREATE POLICY "Admins can manage players" ON players
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
  );

-- ==========================================
-- 4. Tournaments table
-- ==========================================
CREATE TABLE IF NOT EXISTS tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_is TEXT NOT NULL DEFAULT '',
  name_en TEXT NOT NULL DEFAULT '',
  date DATE,
  location TEXT,
  type TEXT CHECK (type IN ('wbif', 'domestic', 'friendly', 'other')),
  description_is TEXT DEFAULT '',
  description_en TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed')),
  wbif_link TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read tournaments" ON tournaments
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage tournaments" ON tournaments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
  );

-- ==========================================
-- 5. Tournament Results table
-- ==========================================
CREATE TABLE IF NOT EXISTS tournament_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  placement INTEGER,
  points DECIMAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tournament_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read results" ON tournament_results
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage results" ON tournament_results
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
  );

-- ==========================================
-- 6. Board Members table
-- ==========================================
CREATE TABLE IF NOT EXISTS board_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id),
  name TEXT NOT NULL,
  role_is TEXT NOT NULL DEFAULT '',
  role_en TEXT NOT NULL DEFAULT '',
  photo_url TEXT,
  term_start DATE,
  term_end DATE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE board_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read board members" ON board_members
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage board members" ON board_members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
  );

-- ==========================================
-- 7. Resources table
-- ==========================================
CREATE TABLE IF NOT EXISTS resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_is TEXT NOT NULL DEFAULT '',
  title_en TEXT NOT NULL DEFAULT '',
  url TEXT,
  type TEXT CHECK (type IN ('book', 'website', 'app', 'course', 'video')),
  description_is TEXT DEFAULT '',
  description_en TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read resources" ON resources
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage resources" ON resources
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
  );

-- ==========================================
-- 8. Media Coverage table
-- ==========================================
CREATE TABLE IF NOT EXISTS media_coverage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  outlet TEXT,
  url TEXT,
  published_date DATE,
  type TEXT CHECK (type IN ('tv', 'radio', 'print', 'web')),
  description_is TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE media_coverage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read media coverage" ON media_coverage
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage media coverage" ON media_coverage
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
  );

-- ==========================================
-- 9. Newsletter Subscribers table (Listmonk-independent)
-- ==========================================
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  subscribed BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Admins can read subscribers
CREATE POLICY "Admins can manage subscribers" ON newsletter_subscribers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
  );

-- Anyone can insert (subscribe)
CREATE POLICY "Anyone can subscribe" ON newsletter_subscribers
  FOR INSERT WITH CHECK (true);

-- ==========================================
-- 10. Updated_at trigger function
-- ==========================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON news
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON players
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON tournaments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ==========================================
-- IMPORTANT: After running this migration,
-- create an admin user in Supabase Auth and then
-- insert into admin_profiles:
--
-- INSERT INTO admin_profiles (id, email, display_name, role)
-- VALUES ('<auth-user-uuid>', 'admin@kotra.is', 'Admin', 'admin');
-- ==========================================
