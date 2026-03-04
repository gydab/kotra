/**
 * Game Analysis & Persistence
 *
 * Analyzes completed games and saves them to Supabase (if logged in).
 * The game engine runs entirely client-side — this module only fires
 * after a game ends, comparing the human's moves against AI-optimal moves.
 */

import { BackgammonGame, type GameState, type Turn, type SingleMove, type Player } from '@lib/engine';
import { chooseAIMove, evaluatePosition, type AIDifficulty } from '@lib/engine/ai';
import { supabase } from '@lib/supabase';

// ─── Types ──────────────────────────────────────────────

export interface GameAnalysis {
  blunderCount: number;
  missedDoubles: number;
  wrongTakes: number;
  wrongPasses: number;
  avgMoveScore: number | null;
  bestPossibleAvgScore: number | null;
  blunderDetails: BlunderDetail[];
}

export interface BlunderDetail {
  turnIndex: number;
  roll: [number, number];
  playerMoves: SingleMove[];
  bestMoves: SingleMove[];
  scoreLoss: number; // how much worse the human's move was
}

export interface SavedGameData {
  player_id: string;
  played_at: string;
  duration_seconds: number;
  difficulty: string;
  match_length: number;
  player_color: string;
  winner: string;
  win_type: string;
  points: number;
  player_won: boolean;
  final_cube_value: number;
  player_final_pips: number;
  opponent_final_pips: number;
  move_history: Turn[];
  total_turns: number;
  blunder_count: number;
  missed_doubles: number;
  wrong_takes: number;
  wrong_passes: number;
  avg_move_score: number | null;
  best_possible_avg_score: number | null;
}

// ─── Analysis ───────────────────────────────────────────

/**
 * Analyze a completed game by replaying it and comparing each human
 * move against the AI's best move. This gives us blunder counts and
 * average move quality.
 *
 * IMPORTANT: This runs a simplified analysis — full backgammon analysis
 * (like GnuBG) would need rollout simulations. We use single-ply eval
 * which is still very useful for spotting clear mistakes.
 */
export function analyzeGame(
  history: Turn[],
  humanColor: Player,
  difficulty: AIDifficulty = 'hard'
): GameAnalysis {
  const blunders: BlunderDetail[] = [];
  let totalHumanScore = 0;
  let totalBestScore = 0;
  let humanTurnCount = 0;

  // Replay the game from scratch
  const replay = new BackgammonGame();

  for (let t = 0; t < history.length; t++) {
    const turn = history[t];

    // Set the dice for this turn
    if (replay.state.phase !== 'rolling') continue;
    try {
      replay.setDice(turn.roll);
    } catch {
      continue; // phase mismatch, skip
    }

    if (turn.player === humanColor && replay.state.phase === 'moving') {
      humanTurnCount++;

      // Get AI's best move for this position
      const snapshotForAI = replay.getSnapshot();
      const aiGame = new BackgammonGame(snapshotForAI);
      const bestMoves = chooseAIMove(aiGame, 'hard'); // always compare against best

      // Score the position after AI's best moves
      const aiEvalGame = new BackgammonGame(snapshotForAI);
      for (const m of bestMoves) {
        aiEvalGame.makeMove(m.from, m.to);
      }
      const bestScore = evaluatePosition(aiEvalGame.state, humanColor);
      totalBestScore += bestScore;

      // Now apply the human's actual moves
      for (const m of turn.moves) {
        replay.makeMove(m.from, m.to);
      }
      const actualScore = evaluatePosition(replay.state, humanColor);
      totalHumanScore += actualScore;

      // A blunder is when the human's move is significantly worse
      const scoreLoss = bestScore - actualScore;
      if (scoreLoss > 8) {
        // Threshold: 8+ points of eval loss = clear blunder
        blunders.push({
          turnIndex: t,
          roll: turn.roll,
          playerMoves: turn.moves,
          bestMoves,
          scoreLoss,
        });
      }
    } else {
      // AI's turn — just replay the moves
      for (const m of turn.moves) {
        replay.makeMove(m.from, m.to);
      }
    }
  }

  return {
    blunderCount: blunders.length,
    missedDoubles: 0, // TODO: track double decisions separately
    wrongTakes: 0,
    wrongPasses: 0,
    avgMoveScore: humanTurnCount > 0 ? totalHumanScore / humanTurnCount : null,
    bestPossibleAvgScore: humanTurnCount > 0 ? totalBestScore / humanTurnCount : null,
    blunderDetails: blunders,
  };
}

// ─── Persistence ────────────────────────────────────────

/**
 * Get the currently logged-in player's user ID (if any).
 * Returns null if not logged in.
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Check if there's a logged-in user session.
 */
export async function isLoggedIn(): Promise<boolean> {
  const userId = await getCurrentUserId();
  return userId !== null;
}

/**
 * Save a completed game to Supabase.
 * Only works if the user is logged in.
 */
export async function saveGame(data: SavedGameData): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('games').insert(data);
  if (error) {
    console.error('Failed to save game:', error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * High-level: analyze and save a game after it ends.
 */
export async function analyzeAndSaveGame(params: {
  game: BackgammonGame;
  humanColor: Player;
  difficulty: AIDifficulty;
  matchLength: number;
  durationSeconds: number;
}): Promise<{ saved: boolean; analysis: GameAnalysis }> {
  const { game, humanColor, difficulty, matchLength, durationSeconds } = params;
  const state = game.state;
  const result = state.result!;

  // Analyze
  const analysis = analyzeGame(state.history, humanColor, difficulty);

  // Try to save if logged in
  const userId = await getCurrentUserId();
  if (!userId) {
    return { saved: false, analysis };
  }

  const aiColor = humanColor === 'white' ? 'black' : 'white';

  const gameData: SavedGameData = {
    player_id: userId,
    played_at: new Date().toISOString(),
    duration_seconds: durationSeconds,
    difficulty,
    match_length: matchLength,
    player_color: humanColor,
    winner: result.winner,
    win_type: result.winType,
    points: result.points,
    player_won: result.winner === humanColor,
    final_cube_value: state.cube.value,
    player_final_pips: game.pipCount(humanColor),
    opponent_final_pips: game.pipCount(aiColor),
    move_history: state.history,
    total_turns: state.history.length,
    blunder_count: analysis.blunderCount,
    missed_doubles: analysis.missedDoubles,
    wrong_takes: analysis.wrongTakes,
    wrong_passes: analysis.wrongPasses,
    avg_move_score: analysis.avgMoveScore,
    best_possible_avg_score: analysis.bestPossibleAvgScore,
  };

  const { success, error } = await saveGame(gameData);
  if (!success) {
    console.warn('Game analysis complete but save failed:', error);
  }

  return { saved: success, analysis };
}

// ─── Stats Queries ──────────────────────────────────────

export interface PlayerStats {
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number;
  gammonsWon: number;
  backgammonsWon: number;
  avgBlunders: number;
  totalBlunders: number;
  avgGameLength: number;
  firstGame: string | null;
  lastGame: string | null;
  currentWinStreak: number;
  byDifficulty: {
    easy: { games: number; wins: number };
    medium: { games: number; wins: number };
    hard: { games: number; wins: number };
  };
}

export async function fetchPlayerStats(): Promise<PlayerStats | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('player_stats')
    .select('*')
    .eq('player_id', userId)
    .single();

  if (error || !data) return null;

  return {
    totalGames: data.total_games,
    wins: data.wins,
    losses: data.losses,
    winRate: data.win_rate,
    gammonsWon: data.gammons_won,
    backgammonsWon: data.backgammons_won,
    avgBlunders: data.avg_blunders,
    totalBlunders: data.total_blunders,
    avgGameLength: data.avg_game_length,
    firstGame: data.first_game,
    lastGame: data.last_game,
    currentWinStreak: data.current_win_streak ?? 0,
    byDifficulty: {
      easy: { games: data.games_easy, wins: data.wins_easy },
      medium: { games: data.games_medium, wins: data.wins_medium },
      hard: { games: data.games_hard, wins: data.wins_hard },
    },
  };
}

/**
 * Fetch recent games with their analysis data.
 */
export async function fetchRecentGames(limit = 20): Promise<any[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('games')
    .select('id, played_at, difficulty, player_won, win_type, points, final_cube_value, total_turns, blunder_count, duration_seconds, player_color')
    .eq('player_id', userId)
    .order('played_at', { ascending: false })
    .limit(limit);

  if (error) return [];
  return data ?? [];
}

/**
 * Fetch blunder trend: average blunders per game over time.
 * Returns array of { date, avgBlunders } grouped by week.
 */
export async function fetchBlunderTrend(): Promise<{ date: string; avgBlunders: number; games: number }[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('games')
    .select('played_at, blunder_count')
    .eq('player_id', userId)
    .order('played_at', { ascending: true });

  if (error || !data) return [];

  // Group by week
  const weeks = new Map<string, { total: number; count: number }>();
  for (const g of data) {
    const d = new Date(g.played_at);
    // ISO week start (Monday)
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(d.setDate(diff));
    const key = weekStart.toISOString().slice(0, 10);
    const entry = weeks.get(key) ?? { total: 0, count: 0 };
    entry.total += g.blunder_count;
    entry.count++;
    weeks.set(key, entry);
  }

  return Array.from(weeks.entries()).map(([date, { total, count }]) => ({
    date,
    avgBlunders: Math.round((total / count) * 10) / 10,
    games: count,
  }));
}
