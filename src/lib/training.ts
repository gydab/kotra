/**
 * Training System — Blunder Classification & Training Manager
 *
 * Categorizes blunders from game analysis into training categories,
 * so players can see WHERE they make mistakes and practice specifically.
 */

import type { GameState, SingleMove, Player, PointState } from '@lib/engine/types';
import { homeRange, barFor, offFor } from '@lib/engine/types';
import { evaluatePosition } from '@lib/engine/ai';
import type { BlunderDetail, GameAnalysis } from '@lib/game-persistence';
import { supabase } from '@lib/supabase';

// ─── Blunder Classification ────────────────────────────

export type TrainingCategory =
  | 'blot_exposure'
  | 'prime_building'
  | 'anchor_strategy'
  | 'bearing_off'
  | 'hitting_decisions'
  | 'race_strategy'
  | 'cube_decisions'
  | 'opening_moves'
  | 'back_game'
  | 'checker_play';

/**
 * Classify a blunder into a training category based on the
 * position and the nature of the correct vs actual moves.
 */
export function classifyBlunder(
  blunder: BlunderDetail,
  gameState: GameState,
  humanColor: Player,
  turnNumber: number,
  totalTurns: number
): TrainingCategory {
  const { playerMoves, bestMoves } = blunder;

  // Early game = opening moves (first 4 turns)
  if (turnNumber <= 4) {
    return 'opening_moves';
  }

  // Check if blunder involves bearing off
  const [homeStart, homeEnd] = homeRange(humanColor);
  const offPoint = offFor(humanColor);
  const bestInvolvesOff = bestMoves.some(m => m.to === offPoint);
  const playerInvolvesOff = playerMoves.some(m => m.to === offPoint);
  if (bestInvolvesOff || playerInvolvesOff) {
    return 'bearing_off';
  }

  // Check if blunder involves hitting
  const bestHits = bestMoves.filter(m => m.hit);
  const playerHits = playerMoves.filter(m => m.hit);
  if (bestHits.length !== playerHits.length) {
    return 'hitting_decisions';
  }

  // Check if blunder involves leaving blots
  const playerLeavesBlots = playerMoves.some(m => {
    // After moving, is the 'from' point a blot?
    return isBlotCreated(gameState, m, humanColor);
  });
  const bestLeavesBlots = bestMoves.some(m => {
    return isBlotCreated(gameState, m, humanColor);
  });
  if (playerLeavesBlots && !bestLeavesBlots) {
    return 'blot_exposure';
  }

  // Check if best move builds/extends a prime
  const bestFormsPrime = bestMoves.some(m => {
    return isPartOfPrime(gameState, m.to, humanColor);
  });
  if (bestFormsPrime) {
    return 'prime_building';
  }

  // Check if involves anchor in opponent's home board
  const oppHomeRange = homeRange(humanColor === 'white' ? 'black' : 'white');
  const bestAnchors = bestMoves.some(m =>
    m.to >= oppHomeRange[0] && m.to <= oppHomeRange[1]
  );
  if (bestAnchors) {
    return 'anchor_strategy';
  }

  // Late game / race
  if (turnNumber > totalTurns * 0.7) {
    return 'race_strategy';
  }

  // Default: general checker play
  return 'checker_play';
}

/** Check if a move creates a blot (single exposed checker) */
function isBlotCreated(state: GameState, move: SingleMove, player: Player): boolean {
  const fromPoint = state.points[move.from];
  // If there was exactly 2 on the source point, moving leaves a blot
  if (fromPoint && fromPoint.owner === player && fromPoint.count === 2) {
    return true;
  }
  return false;
}

/** Check if a destination is part of a prime (3+ consecutive blocked points) */
function isPartOfPrime(state: GameState, point: number, player: Player): boolean {
  if (point < 1 || point > 24) return false;

  let consecutive = 0;
  const start = Math.max(1, point - 5);
  const end = Math.min(24, point + 5);

  for (let i = start; i <= end; i++) {
    const p = state.points[i];
    if (p.owner === player && p.count >= 2) {
      consecutive++;
      if (consecutive >= 3 && i >= point && i - consecutive + 1 <= point) {
        return true;
      }
    } else {
      consecutive = 0;
    }
  }
  return false;
}

// ─── Save classified blunders ───────────────────────────

export interface ClassifiedBlunder {
  game_id: string;
  player_id: string;
  turn_index: number;
  category_id: TrainingCategory;
  score_loss: number;
  player_moves: SingleMove[];
  best_moves: SingleMove[];
  position_json: GameState | null;
}

/**
 * After game analysis, classify all blunders and save to database.
 */
export async function saveClassifiedBlunders(
  gameId: string,
  playerId: string,
  analysis: GameAnalysis,
  gameHistory: any[],
  humanColor: Player
): Promise<void> {
  if (analysis.blunderDetails.length === 0) return;

  const totalTurns = gameHistory.length;
  const classified: ClassifiedBlunder[] = analysis.blunderDetails.map(blunder => {
    const category = classifyBlunder(
      blunder,
      // We don't have the exact position at this point, using a simplified approach
      {} as GameState,
      humanColor,
      blunder.turnIndex,
      totalTurns
    );

    return {
      game_id: gameId,
      player_id: playerId,
      turn_index: blunder.turnIndex,
      category_id: category,
      score_loss: blunder.scoreLoss,
      player_moves: blunder.playerMoves,
      best_moves: blunder.bestMoves,
      position_json: null,
    };
  });

  const { error } = await supabase
    .from('game_blunder_analysis')
    .insert(classified.map(b => ({
      game_id: b.game_id,
      player_id: b.player_id,
      turn_index: b.turn_index,
      category_id: b.category_id,
      score_loss: b.score_loss,
      player_moves: JSON.stringify(b.player_moves),
      best_moves: JSON.stringify(b.best_moves),
      position_json: b.position_json ? JSON.stringify(b.position_json) : null,
    })));

  if (error) {
    console.error('Failed to save blunder analysis:', error);
  }
}

// ─── Training data fetching ────────────────────────────

export interface WeaknessSummary {
  category_id: string;
  name_is: string;
  name_en: string;
  icon: string;
  blunder_count: number;
  avg_score_loss: number;
  priority_score: number;
  completed_lessons: number;
  total_lessons: number;
}

export interface TrainingLesson {
  id: string;
  category_id: string;
  title_is: string;
  title_en: string;
  description_is: string;
  description_en: string;
  difficulty: string;
  position_json: any;
  correct_moves_json: any;
  explanation_is: string;
  explanation_en: string;
  hint_is: string;
  hint_en: string;
  sort_order: number;
}

export interface LessonProgress {
  lesson_id: string;
  completed: boolean;
  attempts: number;
  best_score: number | null;
}

/**
 * Fetch player's weakness summary (ordered by priority).
 */
export async function fetchWeaknesses(userId: string): Promise<WeaknessSummary[]> {
  const { data, error } = await supabase
    .from('training_recommendations')
    .select('*')
    .eq('player_id', userId)
    .order('priority_score', { ascending: false });

  if (error || !data) return [];

  return data.map((w: any) => ({
    category_id: w.category_id,
    name_is: w.name_is,
    name_en: w.name_en,
    icon: w.icon,
    blunder_count: w.blunder_count,
    avg_score_loss: w.avg_score_loss,
    priority_score: w.priority_score,
    completed_lessons: w.completed_lessons,
    total_lessons: w.total_lessons,
  }));
}

/**
 * Fetch all training categories with lesson counts.
 */
export async function fetchTrainingCategories(): Promise<any[]> {
  const { data: categories } = await supabase
    .from('training_categories')
    .select('*')
    .order('sort_order');

  if (!categories) return [];

  // Get lesson counts per category
  const { data: lessons } = await supabase
    .from('training_lessons')
    .select('category_id');

  const lessonCounts = new Map<string, number>();
  if (lessons) {
    for (const l of lessons) {
      lessonCounts.set(l.category_id, (lessonCounts.get(l.category_id) ?? 0) + 1);
    }
  }

  return categories.map((c: any) => ({
    ...c,
    lesson_count: lessonCounts.get(c.id) ?? 0,
  }));
}

/**
 * Fetch lessons for a specific category.
 */
export async function fetchLessonsForCategory(categoryId: string): Promise<TrainingLesson[]> {
  const { data, error } = await supabase
    .from('training_lessons')
    .select('*')
    .eq('category_id', categoryId)
    .order('sort_order');

  if (error || !data) return [];
  return data;
}

/**
 * Fetch player's progress for a set of lessons.
 */
export async function fetchLessonProgress(userId: string, lessonIds: string[]): Promise<Map<string, LessonProgress>> {
  const { data, error } = await supabase
    .from('training_progress')
    .select('lesson_id, completed, attempts, best_score')
    .eq('player_id', userId)
    .in('lesson_id', lessonIds);

  const map = new Map<string, LessonProgress>();
  if (data) {
    for (const p of data) {
      map.set(p.lesson_id, p);
    }
  }
  return map;
}

/**
 * Record an attempt at a training lesson.
 */
export async function recordLessonAttempt(
  userId: string,
  lessonId: string,
  score: number,
  completed: boolean
): Promise<void> {
  // Upsert: insert or update
  const { data: existing } = await supabase
    .from('training_progress')
    .select('*')
    .eq('player_id', userId)
    .eq('lesson_id', lessonId)
    .single();

  if (existing) {
    await supabase
      .from('training_progress')
      .update({
        attempts: existing.attempts + 1,
        best_score: Math.max(existing.best_score ?? 0, score),
        completed: existing.completed || completed,
        last_attempt_at: new Date().toISOString(),
      })
      .eq('player_id', userId)
      .eq('lesson_id', lessonId);
  } else {
    await supabase
      .from('training_progress')
      .insert({
        player_id: userId,
        lesson_id: lessonId,
        attempts: 1,
        best_score: score,
        completed,
        last_attempt_at: new Date().toISOString(),
      });
  }
}

/**
 * Get overall training stats for a player.
 */
export async function fetchTrainingStats(userId: string): Promise<{
  totalLessons: number;
  completedLessons: number;
  totalCategories: number;
  weakestCategory: string | null;
}> {
  const { data: progress } = await supabase
    .from('training_progress')
    .select('completed')
    .eq('player_id', userId);

  const { data: categories } = await supabase
    .from('training_categories')
    .select('id');

  const { data: lessons } = await supabase
    .from('training_lessons')
    .select('id');

  const weaknesses = await fetchWeaknesses(userId);

  return {
    totalLessons: lessons?.length ?? 0,
    completedLessons: progress?.filter((p: any) => p.completed).length ?? 0,
    totalCategories: categories?.length ?? 0,
    weakestCategory: weaknesses.length > 0 ? weaknesses[0].category_id : null,
  };
}
