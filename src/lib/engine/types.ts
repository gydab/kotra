/**
 * Backgammon Engine — Type Definitions
 *
 * Board layout (standard numbering):
 *
 *   13  14  15  16  17  18      19  20  21  22  23  24
 *  ┌───┬───┬───┬───┬───┬───┐  ┌───┬───┬───┬───┬───┬───┐
 *  │   │   │   │   │   │   │  │   │   │   │   │   │   │  ← Black home board (19-24)
 *  │   │   │   │   │   │   │  │   │   │   │   │   │   │
 *  │   │       BAR       │   │  │   │   │   │   │   │   │
 *  │   │   │   │   │   │   │  │   │   │   │   │   │   │
 *  │   │   │   │   │   │   │  │   │   │   │   │   │   │  ← White home board (1-6)
 *  └───┴───┴───┴───┴───┴───┘  └───┴───┴───┴───┴───┴───┘
 *   12  11  10   9   8   7       6   5   4   3   2   1
 *
 * White moves from 24 → 1 (bearing off from 1-6)
 * Black moves from 1 → 24 (bearing off from 19-24)
 */

// ─── Player ─────────────────────────────────────────────

export type Player = 'white' | 'black';

export function opponent(player: Player): Player {
  return player === 'white' ? 'black' : 'white';
}

// ─── Point ──────────────────────────────────────────────

/** A point on the board (1-24), BAR_WHITE (0), BAR_BLACK (25), OFF_WHITE (26), OFF_BLACK (27) */
export type PointIndex = number;

export const BAR_WHITE = 0;  // White's bar (must enter into black's home 19-24)
export const BAR_BLACK = 25; // Black's bar (must enter into white's home 1-6)
export const OFF_WHITE = 26; // White's borne off checkers
export const OFF_BLACK = 27; // Black's borne off checkers

export function barFor(player: Player): PointIndex {
  return player === 'white' ? BAR_WHITE : BAR_BLACK;
}

export function offFor(player: Player): PointIndex {
  return player === 'white' ? OFF_WHITE : OFF_BLACK;
}

/** Home board range for a player (inclusive) */
export function homeRange(player: Player): [number, number] {
  return player === 'white' ? [1, 6] : [19, 24];
}

/** Direction of movement: white goes negative (24→1), black goes positive (1→24) */
export function direction(player: Player): 1 | -1 {
  return player === 'white' ? -1 : 1;
}

// ─── Checker ────────────────────────────────────────────

export interface PointState {
  count: number;       // number of checkers (0 = empty)
  owner: Player | null; // who owns them (null if empty)
}

// ─── Dice ───────────────────────────────────────────────

export type Die = 1 | 2 | 3 | 4 | 5 | 6;
export type DiceRoll = [Die, Die];

/** Returns 4 dice if doubles, otherwise 2 */
export function expandDice(roll: DiceRoll): Die[] {
  if (roll[0] === roll[1]) {
    return [roll[0], roll[0], roll[0], roll[0]];
  }
  return [...roll];
}

export function rollDice(): DiceRoll {
  const d1 = (Math.floor(Math.random() * 6) + 1) as Die;
  const d2 = (Math.floor(Math.random() * 6) + 1) as Die;
  return [d1, d2];
}

// ─── Move ───────────────────────────────────────────────

/** A single checker move using one die */
export interface SingleMove {
  from: PointIndex;   // source point (0 = white bar, 25 = black bar)
  to: PointIndex;     // destination point (26 = white off, 27 = black off)
  die: Die;           // which die value was used
  hit: boolean;       // did this move hit an opponent's blot?
}

/** A complete turn: all moves made with the dice roll */
export interface Turn {
  player: Player;
  roll: DiceRoll;
  moves: SingleMove[];
}

// ─── Doubling Cube ──────────────────────────────────────

export interface CubeState {
  value: number;           // 1, 2, 4, 8, 16, 32, 64
  owner: Player | null;    // null = centered (either player can double)
  lastDoubled: Player | null;
}

export const INITIAL_CUBE: CubeState = {
  value: 1,
  owner: null,
  lastDoubled: null,
};

// ─── Game State ─────────────────────────────────────────

export type GamePhase =
  | 'not-started'     // waiting for initial roll
  | 'rolling'         // player needs to roll dice
  | 'moving'          // player is making moves
  | 'cube-decision'   // opponent deciding take/pass on double
  | 'game-over';      // game finished

export type WinType = 'normal' | 'gammon' | 'backgammon';

export interface GameResult {
  winner: Player;
  winType: WinType;
  points: number;     // cube value × win multiplier
}

export interface GameState {
  /** Board points 0-27: [0]=white bar, [1-24]=board, [25]=black bar, [26]=white off, [27]=black off */
  points: PointState[];

  /** Current turn */
  currentPlayer: Player;

  /** Dice for current turn (null if not rolled yet) */
  dice: DiceRoll | null;

  /** Remaining dice to use this turn */
  remainingDice: Die[];

  /** Doubling cube */
  cube: CubeState;

  /** Phase */
  phase: GamePhase;

  /** Result (only set when phase is 'game-over') */
  result: GameResult | null;

  /** History of turns */
  history: Turn[];

  /** Moves made so far in current turn (for undo) */
  currentMoves: SingleMove[];

  /** Match length (0 = unlimited/money game) */
  matchLength: number;

  /** Score */
  score: { white: number; black: number };
}

// ─── Constants ──────────────────────────────────────────

export const NUM_POINTS = 24;
export const CHECKERS_PER_PLAYER = 15;
export const POINTS_COUNT = 28; // 0-27

/** Starting position: standard backgammon setup */
export function createInitialPoints(): PointState[] {
  const points: PointState[] = Array.from({ length: POINTS_COUNT }, () => ({
    count: 0,
    owner: null,
  }));

  // White checkers (moving from 24 → 1)
  points[24] = { count: 2, owner: 'white' };
  points[13] = { count: 5, owner: 'white' };
  points[8]  = { count: 3, owner: 'white' };
  points[6]  = { count: 5, owner: 'white' };

  // Black checkers (moving from 1 → 24)
  points[1]  = { count: 2, owner: 'black' };
  points[12] = { count: 5, owner: 'black' };
  points[17] = { count: 3, owner: 'black' };
  points[19] = { count: 5, owner: 'black' };

  return points;
}

export function createInitialGameState(): GameState {
  return {
    points: createInitialPoints(),
    currentPlayer: 'white',
    dice: null,
    remainingDice: [],
    cube: { ...INITIAL_CUBE },
    phase: 'rolling',
    result: null,
    history: [],
    currentMoves: [],
    matchLength: 0,
    score: { white: 0, black: 0 },
  };
}
