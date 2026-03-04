-- ============================================
-- Kotra.is — Game History & Player Profiles
-- Migration 002: Track games for logged-in users
-- ============================================

-- ==========================================
-- 1. Player profiles (public users, not admins)
-- ==========================================
CREATE TABLE IF NOT EXISTS player_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE player_profiles ENABLE ROW LEVEL SECURITY;

-- Players can read their own profile
CREATE POLICY "Players read own profile" ON player_profiles
  FOR SELECT USING (auth.uid() = id);

-- Players can update their own profile
CREATE POLICY "Players update own profile" ON player_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on sign-up via trigger
CREATE OR REPLACE FUNCTION create_player_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO player_profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_player_profile();

-- ==========================================
-- 2. Games table — stores completed games
-- ==========================================
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Game metadata
  played_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_seconds INTEGER,               -- how long the game lasted
  difficulty TEXT NOT NULL DEFAULT 'hard' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  match_length INTEGER NOT NULL DEFAULT 0, -- 0 = money game
  player_color TEXT NOT NULL DEFAULT 'white' CHECK (player_color IN ('white', 'black')),

  -- Result
  winner TEXT NOT NULL CHECK (winner IN ('white', 'black')),
  win_type TEXT NOT NULL DEFAULT 'normal' CHECK (win_type IN ('normal', 'gammon', 'backgammon')),
  points INTEGER NOT NULL DEFAULT 1,       -- cube × win multiplier
  player_won BOOLEAN NOT NULL,             -- convenience: did the player win?

  -- Cube
  final_cube_value INTEGER NOT NULL DEFAULT 1,

  -- Pip counts at end
  player_final_pips INTEGER,
  opponent_final_pips INTEGER,

  -- Full move history (JSON)
  -- Array of turns: { player, roll: [d1,d2], moves: [{from, to, die, hit}] }
  move_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_turns INTEGER NOT NULL DEFAULT 0,

  -- Analysis (computed client-side)
  blunder_count INTEGER NOT NULL DEFAULT 0,       -- moves significantly worse than best
  missed_doubles INTEGER NOT NULL DEFAULT 0,      -- should have doubled but didn't
  wrong_takes INTEGER NOT NULL DEFAULT 0,         -- took a double that should have been dropped
  wrong_passes INTEGER NOT NULL DEFAULT 0,        -- dropped a double that should have been taken
  avg_move_score REAL,                             -- average position eval after player's moves
  best_possible_avg_score REAL,                    -- what AI would have scored on average

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Players can read their own games
CREATE POLICY "Players read own games" ON games
  FOR SELECT USING (auth.uid() = player_id);

-- Players can insert their own games
CREATE POLICY "Players insert own games" ON games
  FOR INSERT WITH CHECK (auth.uid() = player_id);

-- Index for fast lookups
CREATE INDEX idx_games_player_id ON games(player_id);
CREATE INDEX idx_games_played_at ON games(played_at DESC);
CREATE INDEX idx_games_player_played ON games(player_id, played_at DESC);

-- ==========================================
-- 3. Player stats (materialized view, refreshed)
-- ==========================================
-- We'll compute stats client-side from the games table
-- but this view helps with quick dashboard queries

CREATE OR REPLACE VIEW player_stats AS
SELECT
  player_id,
  COUNT(*)::int AS total_games,
  COUNT(*) FILTER (WHERE player_won)::int AS wins,
  COUNT(*) FILTER (WHERE NOT player_won)::int AS losses,
  ROUND(100.0 * COUNT(*) FILTER (WHERE player_won) / GREATEST(COUNT(*), 1), 1) AS win_rate,
  COUNT(*) FILTER (WHERE win_type = 'gammon' AND player_won)::int AS gammons_won,
  COUNT(*) FILTER (WHERE win_type = 'backgammon' AND player_won)::int AS backgammons_won,
  COALESCE(AVG(blunder_count), 0)::real AS avg_blunders,
  COALESCE(SUM(blunder_count), 0)::int AS total_blunders,
  COALESCE(AVG(total_turns), 0)::real AS avg_game_length,
  MIN(played_at) AS first_game,
  MAX(played_at) AS last_game,
  -- Streak calculation
  (SELECT COUNT(*) FROM (
    SELECT player_won, ROW_NUMBER() OVER (ORDER BY played_at DESC) -
           ROW_NUMBER() OVER (PARTITION BY player_won ORDER BY played_at DESC) AS grp
    FROM games g2 WHERE g2.player_id = games.player_id
  ) sub WHERE player_won AND grp = (
    SELECT MIN(grp) FROM (
      SELECT player_won, ROW_NUMBER() OVER (ORDER BY played_at DESC) -
             ROW_NUMBER() OVER (PARTITION BY player_won ORDER BY played_at DESC) AS grp
      FROM games g3 WHERE g3.player_id = games.player_id
    ) sub2 WHERE player_won
  ))::int AS current_win_streak,
  -- By difficulty
  COUNT(*) FILTER (WHERE difficulty = 'easy')::int AS games_easy,
  COUNT(*) FILTER (WHERE difficulty = 'medium')::int AS games_medium,
  COUNT(*) FILTER (WHERE difficulty = 'hard')::int AS games_hard,
  COUNT(*) FILTER (WHERE difficulty = 'easy' AND player_won)::int AS wins_easy,
  COUNT(*) FILTER (WHERE difficulty = 'medium' AND player_won)::int AS wins_medium,
  COUNT(*) FILTER (WHERE difficulty = 'hard' AND player_won)::int AS wins_hard
FROM games
GROUP BY player_id;

-- Apply updated_at trigger
CREATE TRIGGER set_updated_at BEFORE UPDATE ON player_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
