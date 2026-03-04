/**
 * Backgammon AI — Simple Heuristic-Based Opponent
 *
 * Uses a position evaluation function that considers:
 * - Pip count (race advantage)
 * - Blots (exposed checkers = bad)
 * - Anchors in opponent's home board
 * - Prime building (consecutive blocked points)
 * - Home board control
 * - Bearing off progress
 * - Hitting opponent blots
 *
 * Not neural-net level, but plays a reasonable game.
 * Later can plug in gnubg for stronger play.
 */

import {
  type Player,
  type GameState,
  type SingleMove,
  type Die,
  opponent,
  barFor,
  offFor,
  homeRange,
  CHECKERS_PER_PLAYER,
} from './types';

import {
  generateAllTurns,
  applyMove,
  checkersOnBar,
  checkersBorneOff,
  allInHome,
} from './moves';

import { BackgammonGame } from './game';

// ─── Position Evaluation ────────────────────────────────

interface EvalWeights {
  pipCount: number;
  blotPenalty: number;
  hitBonus: number;
  blockBonus: number;
  primeBonus: number;
  anchorBonus: number;
  homeBoardBonus: number;
  bearOffBonus: number;
  barPenalty: number;
}

const DEFAULT_WEIGHTS: EvalWeights = {
  pipCount: -0.1,      // Lower pip count is better
  blotPenalty: -3.0,    // Exposed checker is bad
  hitBonus: 2.5,        // Hitting opponent is good
  blockBonus: 1.5,      // Two+ on a point blocks opponent
  primeBonus: 4.0,      // Consecutive blocks (prime)
  anchorBonus: 2.0,     // Anchor in opponent's home
  homeBoardBonus: 1.5,  // Points controlled in home board
  bearOffBonus: 5.0,    // Each borne off checker
  barPenalty: -4.0,     // Opponent on bar is good for us (negative = penalty for them)
};

/** Evaluate position from the perspective of `player`. Higher = better. */
export function evaluatePosition(state: GameState, player: Player, weights = DEFAULT_WEIGHTS): number {
  let score = 0;
  const opp = opponent(player);

  // Pip count comparison
  const myPips = calcPipCount(state, player);
  const oppPips = calcPipCount(state, opp);
  score += (oppPips - myPips) * weights.pipCount * -1; // More lead = better

  // Borne off
  score += checkersBorneOff(state, player) * weights.bearOffBonus;

  // Bar penalties
  score += checkersOnBar(state, opp) * Math.abs(weights.barPenalty); // Opponent on bar = good
  score += checkersOnBar(state, player) * weights.barPenalty; // Us on bar = bad

  // Board analysis
  const [myHomeStart, myHomeEnd] = homeRange(player);
  const [oppHomeStart, oppHomeEnd] = homeRange(opp);
  let consecutiveBlocks = 0;
  let maxPrime = 0;

  for (let i = 1; i <= 24; i++) {
    const pt = state.points[i];

    if (pt.owner === player) {
      if (pt.count === 1) {
        // Blot — check how dangerous it is
        let dangerFactor = 1.0;

        // Blots in opponent's home board are more dangerous
        if (i >= oppHomeStart && i <= oppHomeEnd) {
          dangerFactor = 1.8;
        }
        // Blots close to home are less dangerous
        if (i >= myHomeStart && i <= myHomeEnd) {
          dangerFactor = 0.5;
        }

        score += weights.blotPenalty * dangerFactor;
      } else if (pt.count >= 2) {
        // Block
        score += weights.blockBonus;
        consecutiveBlocks++;

        // Prime detection
        if (consecutiveBlocks > maxPrime) {
          maxPrime = consecutiveBlocks;
        }

        // Home board control
        if (i >= myHomeStart && i <= myHomeEnd) {
          score += weights.homeBoardBonus;
        }

        // Anchor in opponent's home
        if (i >= oppHomeStart && i <= oppHomeEnd) {
          score += weights.anchorBonus;
        }
      }
    } else {
      consecutiveBlocks = 0;
    }
  }

  // Prime bonus (exponential for longer primes)
  if (maxPrime >= 3) {
    score += weights.primeBonus * (maxPrime - 2);
  }
  if (maxPrime >= 6) {
    score += 20; // Full prime is devastating
  }

  return score;
}

function calcPipCount(state: GameState, player: Player): number {
  let pips = 0;
  for (let i = 1; i <= 24; i++) {
    if (state.points[i].owner === player) {
      const dist = player === 'white' ? i : 25 - i;
      pips += state.points[i].count * dist;
    }
  }
  pips += state.points[barFor(player)].count * 25;
  return pips;
}

// ─── AI Move Selection ──────────────────────────────────

export type AIDifficulty = 'easy' | 'medium' | 'hard';

/**
 * Choose the best move sequence for the AI.
 */
export function chooseAIMove(
  game: BackgammonGame,
  difficulty: AIDifficulty = 'hard'
): SingleMove[] {
  const state = game.state;
  const player = state.currentPlayer;
  const dice = state.remainingDice;

  // Generate all possible turn sequences
  const allTurns = generateAllTurns(state, player, dice);

  if (allTurns.length === 0 || (allTurns.length === 1 && allTurns[0].length === 0)) {
    return []; // No moves possible
  }

  // If only one option, take it
  if (allTurns.length === 1) {
    return allTurns[0];
  }

  // Evaluate each turn by applying moves and evaluating resulting position
  const scored = allTurns.map(turn => {
    // Clone and apply
    const tempState = JSON.parse(JSON.stringify(state)) as GameState;
    for (const move of turn) {
      applyMove(tempState, move, player);
    }

    const score = evaluatePosition(tempState, player);

    return { turn, score };
  });

  // Sort by score (best first)
  scored.sort((a, b) => b.score - a.score);

  // Difficulty affects selection
  switch (difficulty) {
    case 'easy': {
      // Pick a random move from bottom 60%
      const bottomIdx = Math.floor(scored.length * 0.4);
      const idx = bottomIdx + Math.floor(Math.random() * (scored.length - bottomIdx));
      return scored[Math.min(idx, scored.length - 1)].turn;
    }
    case 'medium': {
      // Pick from top 40%, with some randomness
      const topCount = Math.max(1, Math.floor(scored.length * 0.4));
      const idx = Math.floor(Math.random() * topCount);
      return scored[idx].turn;
    }
    case 'hard':
    default: {
      // Best move (with tiny random factor for variety among equal moves)
      const bestScore = scored[0].score;
      const nearBest = scored.filter(s => s.score >= bestScore - 0.5);
      const idx = Math.floor(Math.random() * nearBest.length);
      return nearBest[idx].turn;
    }
  }
}

/** Should the AI double? Simple heuristic. */
export function shouldAIDouble(game: BackgammonGame): boolean {
  const state = game.state;
  const player = state.currentPlayer;

  // Don't double if cube is already high
  if (state.cube.value >= 8) return false;

  // Can we double?
  if (state.cube.owner !== null && state.cube.owner !== player) return false;

  // Evaluate position
  const score = evaluatePosition(state, player);

  // Only double if we're significantly ahead
  return score > 15;
}

/** Should the AI take a double? */
export function shouldAITake(game: BackgammonGame): boolean {
  const state = game.state;
  const player = state.currentPlayer;

  // Evaluate from our perspective
  const score = evaluatePosition(state, player);

  // Take if we're not too far behind (rough ~25% equity threshold)
  return score > -20;
}
