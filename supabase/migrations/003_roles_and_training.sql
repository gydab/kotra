-- ============================================
-- Kotra.is — Migration 003
-- Roles, Tournament Directors & Training System
-- ============================================

-- ==========================================
-- 1. Expand admin_profiles with more roles
-- ==========================================
-- Add 'tournament_director' role option
ALTER TABLE admin_profiles
  DROP CONSTRAINT IF EXISTS admin_profiles_role_check;

ALTER TABLE admin_profiles
  ADD CONSTRAINT admin_profiles_role_check
  CHECK (role IN ('admin', 'editor', 'tournament_director'));

-- ==========================================
-- 2. Expand player_profiles for richer profiles
-- ==========================================
ALTER TABLE player_profiles
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'IS',
  ADD COLUMN IF NOT EXISTS rating INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bg_heroes_nick TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS bg_galaxy_nick TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS bg_nj_nick TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS preferred_locale TEXT DEFAULT 'is' CHECK (preferred_locale IN ('is', 'en')),
  ADD COLUMN IF NOT EXISTS training_level TEXT DEFAULT 'beginner' CHECK (training_level IN ('beginner', 'intermediate', 'advanced')),
  ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT FALSE;

-- Allow public read of basic profile info (for leaderboards)
CREATE POLICY "Public can read basic profiles" ON player_profiles
  FOR SELECT USING (true);

-- ==========================================
-- 3. Training categories — types of mistakes
-- ==========================================
CREATE TABLE IF NOT EXISTS training_categories (
  id TEXT PRIMARY KEY,  -- e.g. 'blot_exposure', 'prime_building', 'bearing_off'
  name_is TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_is TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  icon TEXT DEFAULT '📘',
  sort_order INTEGER DEFAULT 0
);

ALTER TABLE training_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read training categories" ON training_categories
  FOR SELECT USING (true);
CREATE POLICY "Admins can manage training categories" ON training_categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
  );

-- Seed training categories
INSERT INTO training_categories (id, name_is, name_en, description_is, description_en, icon, sort_order) VALUES
  ('blot_exposure', 'Blottar', 'Blot Exposure',
   'Þjálfun í að forðast óþarfa blotta og velja hvenær er réttur tími til að blotta.',
   'Training to avoid unnecessary blots and choosing when it''s right to leave one.',
   '🎯', 1),
  ('prime_building', 'Prímbygging', 'Prime Building',
   'Lærðu að byggja og viðhalda prímum til að loka á andstæðinginn.',
   'Learn to build and maintain primes to block your opponent.',
   '🧱', 2),
  ('anchor_strategy', 'Akkerisstratégía', 'Anchor Strategy',
   'Hvernig á að setja og nota akkeri í heimasvæði andstæðingsins.',
   'How to place and use anchors in your opponent''s home board.',
   '⚓', 3),
  ('bearing_off', 'Útakstrar', 'Bearing Off',
   'Besta leiðin til að aka checkers út – forðastu villur sem kosta leiki.',
   'Best techniques for bearing off – avoid mistakes that cost games.',
   '🏁', 4),
  ('hitting_decisions', 'Höggákvarðanir', 'Hitting Decisions',
   'Hvenær er rétt að höggva og hvenær er betra að fara framhjá.',
   'When to hit and when it''s better to pass by.',
   '⚔️', 5),
  ('race_strategy', 'Kapphlaup', 'Race Strategy',
   'Pip count greining og ákvarðanir þegar leikurinn verður kapphlaup.',
   'Pip count analysis and decisions when the game becomes a race.',
   '🏃', 6),
  ('cube_decisions', 'Tvöföldunarteningur', 'Cube Decisions',
   'Hvenær á að tvöfalda, taka eða passa – lykilatriði í kotru.',
   'When to double, take or pass – a key skill in backgammon.',
   '🎲', 7),
  ('opening_moves', 'Opnunarleikhættir', 'Opening Moves',
   'Bestu opnunarleikhættirnir og hvers vegna þeir virka.',
   'The best opening moves and why they work.',
   '🚀', 8),
  ('back_game', 'Bakleikur', 'Back Game',
   'Hvernig á að spila bakleik þegar þú ert á eftir.',
   'How to play the back game when you''re behind.',
   '🔄', 9),
  ('checker_play', 'Peðarleikur', 'Checker Play',
   'Almennar ákvarðanir um peðahreyfingar – undirstaðan í kotruleik.',
   'General checker movement decisions – the foundation of backgammon play.',
   '♟️', 10)
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- 4. Training lessons per category
-- ==========================================
CREATE TABLE IF NOT EXISTS training_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id TEXT NOT NULL REFERENCES training_categories(id) ON DELETE CASCADE,
  title_is TEXT NOT NULL,
  title_en TEXT NOT NULL,
  description_is TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  difficulty TEXT NOT NULL DEFAULT 'beginner' CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  sort_order INTEGER DEFAULT 0,
  -- The position and correct answer are stored as JSON
  -- position: GameState snapshot, correctMoves: SingleMove[]
  position_json JSONB,
  correct_moves_json JSONB,
  explanation_is TEXT DEFAULT '',
  explanation_en TEXT DEFAULT '',
  hint_is TEXT DEFAULT '',
  hint_en TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE training_lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read training lessons" ON training_lessons
  FOR SELECT USING (true);
CREATE POLICY "Admins can manage training lessons" ON training_lessons
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
  );

CREATE TRIGGER set_updated_at BEFORE UPDATE ON training_lessons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ==========================================
-- 5. Player training progress
-- ==========================================
CREATE TABLE IF NOT EXISTS training_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES training_lessons(id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  attempts INTEGER NOT NULL DEFAULT 0,
  best_score REAL,  -- 0.0 to 1.0 (how close to optimal)
  last_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(player_id, lesson_id)
);

ALTER TABLE training_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players read own progress" ON training_progress
  FOR SELECT USING (auth.uid() = player_id);
CREATE POLICY "Players insert own progress" ON training_progress
  FOR INSERT WITH CHECK (auth.uid() = player_id);
CREATE POLICY "Players update own progress" ON training_progress
  FOR UPDATE USING (auth.uid() = player_id);

CREATE INDEX idx_training_progress_player ON training_progress(player_id);

-- ==========================================
-- 6. Blunder analysis table — links game blunders to categories
-- ==========================================
CREATE TABLE IF NOT EXISTS game_blunder_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  turn_index INTEGER NOT NULL,
  category_id TEXT REFERENCES training_categories(id),
  score_loss REAL NOT NULL DEFAULT 0,
  player_moves JSONB NOT NULL DEFAULT '[]'::jsonb,
  best_moves JSONB NOT NULL DEFAULT '[]'::jsonb,
  position_json JSONB,  -- board state at blunder moment
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE game_blunder_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players read own blunder analysis" ON game_blunder_analysis
  FOR SELECT USING (auth.uid() = player_id);
CREATE POLICY "Players insert own blunder analysis" ON game_blunder_analysis
  FOR INSERT WITH CHECK (auth.uid() = player_id);

CREATE INDEX idx_blunder_analysis_player ON game_blunder_analysis(player_id);
CREATE INDEX idx_blunder_analysis_game ON game_blunder_analysis(game_id);
CREATE INDEX idx_blunder_analysis_category ON game_blunder_analysis(category_id);

-- ==========================================
-- 7. Player weakness summary view
-- ==========================================
CREATE OR REPLACE VIEW player_weakness_summary AS
SELECT
  player_id,
  category_id,
  COUNT(*)::int AS blunder_count,
  AVG(score_loss)::real AS avg_score_loss,
  MAX(score_loss)::real AS worst_score_loss,
  MAX(created_at) AS last_blunder_at
FROM game_blunder_analysis
WHERE category_id IS NOT NULL
GROUP BY player_id, category_id
ORDER BY blunder_count DESC;

-- ==========================================
-- 8. Training recommendations view
-- ==========================================
CREATE OR REPLACE VIEW training_recommendations AS
SELECT
  pw.player_id,
  pw.category_id,
  tc.name_is,
  tc.name_en,
  tc.icon,
  pw.blunder_count,
  pw.avg_score_loss,
  -- Priority: more blunders + worse avg = higher priority
  (pw.blunder_count * pw.avg_score_loss)::real AS priority_score,
  -- Count completed lessons in this category
  COALESCE(tp.completed_lessons, 0)::int AS completed_lessons,
  COALESCE(tp.total_lessons, 0)::int AS total_lessons
FROM player_weakness_summary pw
JOIN training_categories tc ON tc.id = pw.category_id
LEFT JOIN (
  SELECT 
    tp2.player_id,
    tl.category_id,
    COUNT(*) FILTER (WHERE tp2.completed) AS completed_lessons,
    COUNT(*) AS total_lessons
  FROM training_progress tp2
  JOIN training_lessons tl ON tl.id = tp2.lesson_id
  GROUP BY tp2.player_id, tl.category_id
) tp ON tp.player_id = pw.player_id AND tp.category_id = pw.category_id
ORDER BY priority_score DESC;

-- ==========================================
-- 9. Admins can read all player data
-- ==========================================
CREATE POLICY "Admins can read all profiles" ON player_profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can read all games" ON games
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can manage training progress" ON training_progress
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can manage blunder analysis" ON game_blunder_analysis
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid())
  );

-- ==========================================
-- 10. Tournament directors can manage tournaments
-- ==========================================
CREATE POLICY "Directors can manage tournaments" ON tournaments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'tournament_director')
    )
  );

CREATE POLICY "Directors can manage results" ON tournament_results
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'tournament_director')
    )
  );
