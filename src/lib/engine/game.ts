/**
 * Backgammon Engine — Game Manager
 *
 * High-level game flow:
 * 1. Roll dice (or opening roll to determine who goes first)
 * 2. Generate legal moves
 * 3. Player selects moves
 * 4. Apply moves, switch turn
 * 5. Check for win
 * 6. Repeat
 */

import {
  type Player,
  type GameState,
  type SingleMove,
  type DiceRoll,
  type Die,
  type GameResult,
  type Turn,
  opponent,
  expandDice,
  rollDice,
  createInitialGameState,
} from './types';

import {
  applyMove,
  undoMove,
  generateAllTurns,
  getLegalFirstMoves,
  getMovableSources,
  getLegalDestinations,
  checkWin,
} from './moves';

// ─── Deep Clone ─────────────────────────────────────────

function cloneState(state: GameState): GameState {
  return {
    points: state.points.map(p => ({ ...p })),
    currentPlayer: state.currentPlayer,
    dice: state.dice ? [...state.dice] : null,
    remainingDice: [...state.remainingDice],
    cube: { ...state.cube },
    phase: state.phase,
    result: state.result ? { ...state.result } : null,
    history: state.history.map(h => ({
      ...h,
      moves: h.moves.map(m => ({ ...m })),
    })),
    currentMoves: state.currentMoves.map(m => ({ ...m })),
    matchLength: state.matchLength,
    score: { ...state.score },
  };
}

// ─── Game Manager ───────────────────────────────────────

export class BackgammonGame {
  state: GameState;

  constructor(state?: GameState) {
    this.state = state ? cloneState(state) : createInitialGameState();
  }

  // ─── Rolling ────────────────────────────────────────

  /** Roll dice for current player */
  roll(): DiceRoll {
    if (this.state.phase !== 'rolling') {
      throw new Error(`Cannot roll in phase: ${this.state.phase}`);
    }

    const dice = rollDice();
    this.state.dice = dice;
    this.state.remainingDice = expandDice(dice);
    this.state.currentMoves = [];
    this.state.phase = 'moving';

    // Check if any moves are possible
    const legalMoves = getLegalFirstMoves(this.state);
    if (legalMoves.length === 0) {
      // No legal moves — skip turn
      this.endTurn();
    }

    return dice;
  }

  /** Set specific dice (for testing or replays) */
  setDice(dice: DiceRoll): void {
    if (this.state.phase !== 'rolling') {
      throw new Error(`Cannot set dice in phase: ${this.state.phase}`);
    }

    this.state.dice = dice;
    this.state.remainingDice = expandDice(dice);
    this.state.currentMoves = [];
    this.state.phase = 'moving';

    const legalMoves = getLegalFirstMoves(this.state);
    if (legalMoves.length === 0) {
      this.endTurn();
    }
  }

  // ─── Moving ─────────────────────────────────────────

  /** Get points that have movable checkers */
  getMovableSources(): number[] {
    if (this.state.phase !== 'moving') return [];
    return getMovableSources(this.state);
  }

  /** Get legal destinations from a source point */
  getLegalDestinations(from: number): SingleMove[] {
    if (this.state.phase !== 'moving') return [];
    return getLegalDestinations(this.state, from);
  }

  /** Make a move from → to */
  makeMove(from: number, to: number): SingleMove | null {
    if (this.state.phase !== 'moving') return null;

    // Find matching legal move
    const legal = getLegalDestinations(this.state, from);
    const move = legal.find(m => m.to === to);

    if (!move) return null;

    // Apply
    applyMove(this.state, move, this.state.currentPlayer);
    this.state.currentMoves.push(move);

    // Remove used die
    const dieIdx = this.state.remainingDice.indexOf(move.die);
    if (dieIdx >= 0) {
      this.state.remainingDice.splice(dieIdx, 1);
    }

    // Check for win
    const winType = checkWin(this.state, this.state.currentPlayer);
    if (winType) {
      this.state.result = {
        winner: this.state.currentPlayer,
        winType,
        points: this.state.cube.value * (winType === 'backgammon' ? 3 : winType === 'gammon' ? 2 : 1),
      };
      this.state.phase = 'game-over';
      this.saveTurn();
      return move;
    }

    // Check if more moves possible
    if (this.state.remainingDice.length === 0) {
      this.endTurn();
    } else {
      // Check if remaining dice have legal moves
      const nextMoves = getLegalFirstMoves(this.state);
      if (nextMoves.length === 0) {
        this.endTurn();
      }
    }

    return move;
  }

  /** Undo the last move in the current turn */
  undoLastMove(): SingleMove | null {
    if (this.state.phase !== 'moving' || this.state.currentMoves.length === 0) {
      return null;
    }

    const move = this.state.currentMoves.pop()!;
    undoMove(this.state, move, this.state.currentPlayer);
    this.state.remainingDice.push(move.die);

    return move;
  }

  /** Undo all moves in the current turn */
  undoAllMoves(): void {
    while (this.state.currentMoves.length > 0) {
      this.undoLastMove();
    }
  }

  // ─── Turn Management ────────────────────────────────

  private saveTurn(): void {
    if (this.state.dice) {
      this.state.history.push({
        player: this.state.currentPlayer,
        roll: this.state.dice,
        moves: [...this.state.currentMoves],
      });
    }
  }

  private endTurn(): void {
    this.saveTurn();
    this.state.currentMoves = [];
    this.state.dice = null;
    this.state.remainingDice = [];
    this.state.currentPlayer = opponent(this.state.currentPlayer);
    this.state.phase = 'rolling';
  }

  // ─── Doubling Cube ──────────────────────────────────

  /** Current player offers a double */
  offerDouble(): boolean {
    if (this.state.phase !== 'rolling') return false;
    if (this.state.cube.value >= 64) return false;

    const player = this.state.currentPlayer;

    // Can only double if you own the cube or it's centered
    if (this.state.cube.owner !== null && this.state.cube.owner !== player) {
      return false;
    }

    this.state.cube.lastDoubled = player;
    this.state.phase = 'cube-decision';
    return true;
  }

  /** Opponent takes the double */
  takeDouble(): void {
    if (this.state.phase !== 'cube-decision') return;

    this.state.cube.value *= 2;
    // The taker (opponent of the doubler) gets cube ownership
    this.state.cube.owner = opponent(this.state.currentPlayer);
    this.state.phase = 'rolling';
  }

  /** Opponent passes (drops) the double */
  passDouble(): void {
    if (this.state.phase !== 'cube-decision') return;

    const doubler = this.state.cube.lastDoubled!;
    this.state.result = {
      winner: doubler,
      winType: 'normal',
      points: this.state.cube.value, // wins at pre-double value
    };
    this.state.phase = 'game-over';
  }

  // ─── New Game ───────────────────────────────────────

  /** Start a new game (preserves match score) */
  newGame(): void {
    const score = { ...this.state.score };
    const matchLength = this.state.matchLength;

    this.state = createInitialGameState();
    this.state.score = score;
    this.state.matchLength = matchLength;
  }

  // ─── Queries ────────────────────────────────────────

  get isGameOver(): boolean {
    return this.state.phase === 'game-over';
  }

  get isMoving(): boolean {
    return this.state.phase === 'moving';
  }

  get isRolling(): boolean {
    return this.state.phase === 'rolling';
  }

  /** Get a snapshot of the state (immutable) */
  getSnapshot(): GameState {
    return cloneState(this.state);
  }

  /** Pip count for a player */
  pipCount(player: Player): number {
    let pips = 0;
    const dir = player === 'white' ? 1 : -1;

    for (let i = 1; i <= 24; i++) {
      const pt = this.state.points[i];
      if (pt.owner === player) {
        // Distance to bear off
        const dist = player === 'white' ? i : 25 - i;
        pips += pt.count * dist;
      }
    }

    // Bar checkers — max distance (25 for white, 25 for black)
    const barIdx = player === 'white' ? 0 : 25;
    pips += this.state.points[barIdx].count * 25;

    return pips;
  }
}

// Re-export everything useful
export {
  type Player,
  type GameState,
  type SingleMove,
  type DiceRoll,
  type Die,
  type GameResult,
  type CubeState,
  type PointState,
  type Turn,
  type WinType,
  type GamePhase,
  type PointIndex,
  opponent,
  rollDice,
  barFor,
  offFor,
  BAR_WHITE,
  BAR_BLACK,
} from './types';
