/**
 * Backgammon Engine — Legal Move Generation
 *
 * Core rules implemented:
 * 1. Must enter from bar before making any other move
 * 2. Can only land on empty, own, or single-opponent (blot → hit)
 * 3. Bearing off only when ALL checkers are in home board
 * 4. Must use both dice if possible; if only one possible, must use larger
 * 5. Doubles = 4 moves
 * 6. Bearing off: exact or higher die allowed if no checker on higher point
 */

import {
  type Player,
  type PointState,
  type PointIndex,
  type Die,
  type SingleMove,
  type GameState,
  opponent,
  barFor,
  offFor,
  homeRange,
  direction,
  BAR_WHITE,
  BAR_BLACK,
  NUM_POINTS,
  CHECKERS_PER_PLAYER,
} from './types';

// ─── Board Queries ──────────────────────────────────────

/** How many checkers does this player have on the bar? */
export function checkersOnBar(state: GameState, player: Player): number {
  return state.points[barFor(player)].count;
}

/** How many checkers has this player borne off? */
export function checkersBorneOff(state: GameState, player: Player): number {
  return state.points[offFor(player)].count;
}

/** Are all of this player's checkers in their home board (or borne off)? */
export function allInHome(state: GameState, player: Player): boolean {
  const [homeStart, homeEnd] = homeRange(player);
  const bar = barFor(player);
  const off = offFor(player);

  let homeCount = state.points[off].count; // already borne off

  for (let i = homeStart; i <= homeEnd; i++) {
    if (state.points[i].owner === player) {
      homeCount += state.points[i].count;
    }
  }

  return homeCount === CHECKERS_PER_PLAYER;
}

/** Can a player land on this point? (empty, own, or single opponent) */
export function canLandOn(state: GameState, point: PointIndex, player: Player): boolean {
  const p = state.points[point];
  if (p.count === 0) return true;
  if (p.owner === player) return true;
  if (p.owner === opponent(player) && p.count === 1) return true; // hit blot
  return false;
}

/** Is this a hit? (landing on a single opponent checker) */
function isHit(state: GameState, point: PointIndex, player: Player): boolean {
  const p = state.points[point];
  return p.count === 1 && p.owner === opponent(player);
}

/** Calculate destination point, or null if off-board */
function destPoint(from: PointIndex, die: Die, player: Player): PointIndex | null {
  const dir = direction(player);
  const to = from + dir * die;

  // Entering from bar
  if (from === BAR_WHITE) {
    // White enters at 25 - die (so die=1 → point 24, die=6 → point 19)
    return 25 - die;
  }
  if (from === BAR_BLACK) {
    // Black enters at 0 + die (so die=1 → point 1, die=6 → point 6)
    return die;
  }

  // Normal move — check bounds
  if (to >= 1 && to <= 24) return to;

  // Bearing off check handled separately
  return null;
}

// ─── Single Move Generation ─────────────────────────────

/** Generate all legal single moves for one die value */
function singleMovesForDie(state: GameState, player: Player, die: Die): SingleMove[] {
  const moves: SingleMove[] = [];
  const bar = barFor(player);

  // Must enter from bar first
  if (state.points[bar].count > 0) {
    const to = destPoint(bar, die, player);
    if (to !== null && to >= 1 && to <= 24 && canLandOn(state, to, player)) {
      moves.push({
        from: bar,
        to,
        die,
        hit: isHit(state, to, player),
      });
    }
    return moves; // If on bar, MUST enter — no other moves allowed
  }

  // Check bearing off
  const canBearOff = allInHome(state, player);
  const [homeStart, homeEnd] = homeRange(player);
  const off = offFor(player);

  for (let i = 1; i <= 24; i++) {
    const pt = state.points[i];
    if (pt.count === 0 || pt.owner !== player) continue;

    const to = destPoint(i, die, player);

    if (to !== null && to >= 1 && to <= 24) {
      // Normal move
      if (canLandOn(state, to, player)) {
        moves.push({ from: i, to, die, hit: isHit(state, to, player) });
      }
    } else if (canBearOff) {
      // Bearing off
      if (player === 'white') {
        // White bears off from points 1-6, moving toward 0
        // Exact: point - die = 0 (or less)
        if (i - die === 0) {
          // Exact bear off
          moves.push({ from: i, to: off, die, hit: false });
        } else if (i - die < 0) {
          // Over-bearing: only allowed if no checker on a higher point
          const hasHigher = hasCheckerOnHigherPoint(state, player, i);
          if (!hasHigher) {
            moves.push({ from: i, to: off, die, hit: false });
          }
        }
      } else {
        // Black bears off from points 19-24, moving toward 25
        // Exact: point + die = 25
        if (i + die === 25) {
          moves.push({ from: i, to: off, die, hit: false });
        } else if (i + die > 25) {
          const hasHigher = hasCheckerOnHigherPoint(state, player, i);
          if (!hasHigher) {
            moves.push({ from: i, to: off, die, hit: false });
          }
        }
      }
    }
  }

  return moves;
}

/** For bearing off with a higher die: is there a checker further from home? */
function hasCheckerOnHigherPoint(state: GameState, player: Player, currentPoint: number): boolean {
  if (player === 'white') {
    // White home: 1-6. "Higher" means further from bearing off = higher point number
    for (let i = currentPoint + 1; i <= 6; i++) {
      if (state.points[i].owner === player && state.points[i].count > 0) return true;
    }
  } else {
    // Black home: 19-24. "Higher" means further from bearing off = lower point number
    for (let i = currentPoint - 1; i >= 19; i--) {
      if (state.points[i].owner === player && state.points[i].count > 0) return true;
    }
  }
  return false;
}

// ─── Apply / Undo Moves ────────────────────────────────

/** Apply a single move to the game state (mutates!) */
export function applyMove(state: GameState, move: SingleMove, player: Player): void {
  // Remove from source
  state.points[move.from].count--;
  if (state.points[move.from].count === 0) {
    state.points[move.from].owner = null;
  }

  // Handle hit
  if (move.hit) {
    const opp = opponent(player);
    const oppBar = barFor(opp);
    state.points[move.to].count = 0;
    state.points[move.to].owner = null;
    state.points[oppBar].count++;
    state.points[oppBar].owner = opp;
  }

  // Place at destination
  state.points[move.to].count++;
  state.points[move.to].owner = player;
}

/** Undo a single move (mutates!) */
export function undoMove(state: GameState, move: SingleMove, player: Player): void {
  const opp = opponent(player);
  const oppBar = barFor(opp);

  // Remove from destination
  state.points[move.to].count--;
  if (state.points[move.to].count === 0) {
    state.points[move.to].owner = null;
  }

  // Restore hit
  if (move.hit) {
    state.points[oppBar].count--;
    if (state.points[oppBar].count === 0) {
      state.points[oppBar].owner = null;
    }
    state.points[move.to].count = 1;
    state.points[move.to].owner = opp;
  }

  // Restore source
  state.points[move.from].count++;
  state.points[move.from].owner = player;
}

// ─── Full Turn Move Generation ──────────────────────────

/**
 * The key algorithm: generate ALL legal turn sequences.
 *
 * Backgammon rules require:
 * 1. You must use both dice if possible
 * 2. If only one can be used, you must use the LARGER die
 * 3. With doubles, use as many as possible
 *
 * Returns all maximal move sequences.
 */
export function generateAllTurns(state: GameState, player: Player, dice: Die[]): SingleMove[][] {
  const results: SingleMove[][] = [];

  function search(remaining: Die[], movesSoFar: SingleMove[]): void {
    if (remaining.length === 0) {
      results.push([...movesSoFar]);
      return;
    }

    let foundAny = false;

    // Try each remaining die (avoid duplicates for doubles)
    const triedDice = new Set<Die>();

    for (let i = 0; i < remaining.length; i++) {
      const die = remaining[i];
      if (triedDice.has(die)) continue;
      triedDice.add(die);

      const legalMoves = singleMovesForDie(state, player, die);

      for (const move of legalMoves) {
        foundAny = true;

        // Apply move
        applyMove(state, move, player);
        movesSoFar.push(move);

        // Remove used die
        const newRemaining = [...remaining];
        newRemaining.splice(i, 1);

        // Recurse
        search(newRemaining, movesSoFar);

        // Undo
        movesSoFar.pop();
        undoMove(state, move, player);
      }
    }

    if (!foundAny) {
      // Can't use remaining dice — this is a terminal state
      results.push([...movesSoFar]);
    }
  }

  search(dice, []);

  // Filter to maximal sequences (use as many dice as possible)
  return filterMaximal(results, dice);
}

/**
 * Filter move sequences to only keep maximal ones.
 * - Keep only sequences that use the maximum number of dice
 * - If tied, prefer sequences using the larger die (for non-doubles)
 */
function filterMaximal(sequences: SingleMove[][], dice: Die[]): SingleMove[][] {
  if (sequences.length === 0) return [[]]; // No moves possible

  // Find max number of moves
  const maxMoves = Math.max(...sequences.map(s => s.length));

  // Keep only maximal
  let maximal = sequences.filter(s => s.length === maxMoves);

  // If maxMoves is 1 and dice are different, must use larger die
  if (maxMoves === 1 && dice.length === 2 && dice[0] !== dice[1]) {
    const largerDie = Math.max(dice[0], dice[1]) as Die;
    const usesLarger = maximal.filter(s => s[0].die === largerDie);
    if (usesLarger.length > 0) {
      maximal = usesLarger;
    }
  }

  // Deduplicate identical move sequences
  return deduplicateSequences(maximal);
}

/** Remove duplicate move sequences */
function deduplicateSequences(sequences: SingleMove[][]): SingleMove[][] {
  const seen = new Set<string>();
  const result: SingleMove[][] = [];

  for (const seq of sequences) {
    const key = seq.map(m => `${m.from}-${m.to}`).join('|');
    if (!seen.has(key)) {
      seen.add(key);
      result.push(seq);
    }
  }

  return result;
}

// ─── Convenience ────────────────────────────────────────

/** Get all legal first moves for the current state (what points can be clicked) */
export function getLegalFirstMoves(state: GameState): SingleMove[] {
  const { currentPlayer, remainingDice } = state;
  if (remainingDice.length === 0) return [];

  const allTurns = generateAllTurns(state, currentPlayer, remainingDice);

  // Collect unique first moves from all legal turn sequences
  const firstMoves = new Map<string, SingleMove>();
  for (const seq of allTurns) {
    if (seq.length > 0) {
      const m = seq[0];
      const key = `${m.from}-${m.to}-${m.die}`;
      if (!firstMoves.has(key)) {
        firstMoves.set(key, m);
      }
    }
  }

  return Array.from(firstMoves.values());
}

/** Get which source points have legal moves */
export function getMovableSources(state: GameState): PointIndex[] {
  const moves = getLegalFirstMoves(state);
  return [...new Set(moves.map(m => m.from))];
}

/** Get legal destinations from a specific source point */
export function getLegalDestinations(state: GameState, from: PointIndex): SingleMove[] {
  return getLegalFirstMoves(state).filter(m => m.from === from);
}

// ─── Win Detection ──────────────────────────────────────

export function checkWin(state: GameState, player: Player): 'normal' | 'gammon' | 'backgammon' | null {
  if (checkersBorneOff(state, player) < CHECKERS_PER_PLAYER) return null;

  const opp = opponent(player);
  const oppOff = checkersBorneOff(state, opp);

  if (oppOff === 0) {
    // Gammon or backgammon
    const oppBar = barFor(opp);
    const [homeStart, homeEnd] = homeRange(player); // player's home board

    // Check if opponent has checkers in winner's home board or on bar
    let inWinnerHome = state.points[oppBar].count > 0;
    if (!inWinnerHome) {
      for (let i = homeStart; i <= homeEnd; i++) {
        if (state.points[i].owner === opp && state.points[i].count > 0) {
          inWinnerHome = true;
          break;
        }
      }
    }

    return inWinnerHome ? 'backgammon' : 'gammon';
  }

  return 'normal';
}
