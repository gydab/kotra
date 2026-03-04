/**
 * Backgammon engine sanity checks.
 * - CLI: npx tsx src/lib/engine/__tests__/engine.test.ts
 * - Vitest: npm test (runs as a single test case)
 */

import { expect, test } from 'vitest';
import { BackgammonGame } from '../game';
import { chooseAIMove } from '../ai';
import { BAR_WHITE, BAR_BLACK, OFF_WHITE, OFF_BLACK, createInitialGameState, createInitialPoints } from '../types';

interface Result {
  passed: number;
  failed: number;
}

function runEngineSanity(log = true): Result {
  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, msg: string) => {
    if (condition) {
      passed++;
      if (log) console.log(`  ✓ ${msg}`);
    } else {
      failed++;
      if (log) console.error(`  ✗ ${msg}`);
    }
  };

  const section = (title: string) => {
    if (log) console.log(`\n📋 ${title}`);
  };

  // ─── Test 1: Initial Setup ──────────────────────────────
  section('Test 1: Initial Setup');
  {
    const game = new BackgammonGame();
    const s = game.state;

    assert(s.currentPlayer === 'white', 'White starts');
    assert(s.phase === 'rolling', 'Phase is rolling');
    assert(s.points[24].count === 2 && s.points[24].owner === 'white', 'White has 2 on point 24');
    assert(s.points[13].count === 5 && s.points[13].owner === 'white', 'White has 5 on point 13');
    assert(s.points[8].count === 3 && s.points[8].owner === 'white', 'White has 3 on point 8');
    assert(s.points[6].count === 5 && s.points[6].owner === 'white', 'White has 5 on point 6');
    assert(s.points[1].count === 2 && s.points[1].owner === 'black', 'Black has 2 on point 1');
    assert(s.points[12].count === 5 && s.points[12].owner === 'black', 'Black has 5 on point 12');
    assert(s.points[17].count === 3 && s.points[17].owner === 'black', 'Black has 3 on point 17');
    assert(s.points[19].count === 5 && s.points[19].owner === 'black', 'Black has 5 on point 19');

    const whitePips = game.pipCount('white');
    const blackPips = game.pipCount('black');
    assert(whitePips === 167, `White pip count = ${whitePips} (expected 167)`);
    assert(blackPips === 167, `Black pip count = ${blackPips} (expected 167)`);
  }

  // ─── Test 2: Rolling Dice ───────────────────────────────
  section('Test 2: Rolling Dice');
  {
    const game = new BackgammonGame();
    const dice = game.roll();

    assert(dice.length === 2, 'Dice has 2 values');
    assert(dice[0] >= 1 && dice[0] <= 6, 'Die 1 in range');
    assert(dice[1] >= 1 && dice[1] <= 6, 'Die 2 in range');

    if (game.state.phase === 'moving') {
      assert(game.state.remainingDice.length >= 2, 'Remaining dice set');
      assert(game.getMovableSources().length > 0, 'Has movable sources');
    }
  }

  // ─── Test 3: Specific Dice + Legal Moves ────────────────
  section('Test 3: Specific Dice & Legal Moves');
  {
    const game = new BackgammonGame();
    game.setDice([3, 1]);

    assert(game.state.phase === 'moving', 'Phase is moving after setDice');
    assert(game.state.remainingDice.length === 2, 'Has 2 remaining dice');

    const sources = game.getMovableSources();
    assert(sources.length > 0, `Has ${sources.length} movable points`);

    const destsFrom8 = game.getLegalDestinations(8);
    assert(destsFrom8.length > 0, `Point 8 has ${destsFrom8.length} destinations`);
  }

  // ─── Test 4: Making Moves ───────────────────────────────
  section('Test 4: Making Moves');
  {
    const game = new BackgammonGame();
    game.setDice([6, 1]);

    const move1 = game.makeMove(13, 7);
    assert(move1 !== null, `Move 13→7 succeeded`);
    assert(game.state.points[13].count === 4, 'Point 13 now has 4');
    assert(game.state.points[7].count === 1 && game.state.points[7].owner === 'white', 'Point 7 has 1 white');

    const move2 = game.makeMove(8, 7);
    assert(move2 !== null, `Move 8→7 succeeded`);
    assert(game.state.points[7].count === 2, 'Point 7 now has 2');

    assert(game.state.currentPlayer === 'black', 'Turn switched to black');
    assert(game.state.phase === 'rolling', 'Phase is rolling for black');
  }

  // ─── Test 5: Undo ───────────────────────────────────────
  section('Test 5: Undo');
  {
    const game = new BackgammonGame();
    game.setDice([5, 3]);

    const src1Count = game.state.points[13].count;
    game.makeMove(13, 8);

    assert(game.state.points[13].count === src1Count - 1, 'Source reduced after move');

    game.undoLastMove();
    assert(game.state.points[13].count === src1Count, 'Source restored after undo');
    assert(game.state.remainingDice.length === 2, 'Dice restored after undo');
  }

  // ─── Test 6: Doubles ────────────────────────────────────
  section('Test 6: Doubles');
  {
    const game = new BackgammonGame();
    game.setDice([3, 3]);

    assert(game.state.remainingDice.length === 4, 'Doubles give 4 dice');

    let movesOk = 0;
    for (let i = 0; i < 4; i++) {
      const sources = game.getMovableSources();
      if (sources.length === 0) break;
      const dests = game.getLegalDestinations(sources[0]);
      if (dests.length === 0) break;
      const m = game.makeMove(dests[0].from, dests[0].to);
      if (m) movesOk++;
    }
    assert(movesOk >= 1, `Made ${movesOk} moves with doubles`);
  }

  // ─── Test 7: AI Move Selection ──────────────────────────
  section('Test 7: AI Move Selection');
  {
    const game = new BackgammonGame();
    game.setDice([4, 2]);

    const moves = chooseAIMove(game, 'hard');
    assert(moves.length > 0, `AI chose ${moves.length} moves`);

    for (const m of moves) {
      assert(m.from >= 0 && m.from <= 27, `Move from ${m.from} is valid index`);
      assert(m.to >= 0 && m.to <= 27, `Move to ${m.to} is valid index`);
      assert(m.die >= 1 && m.die <= 6, `Die value ${m.die} is valid`);
    }
  }

  // ─── Test 8: Hit Detection ──────────────────────────────
  section('Test 8: Hit Detection');
  {
    const game = new BackgammonGame();

    game.setDice([6, 5]);
    game.makeMove(24, 18);

    assert(game.state.points[18].count === 1 && game.state.points[18].owner === 'white', 'Moved to 18');
  }

  // ─── Test 9: Full Game Flow ─────────────────────────────
  section('Test 9: Full Game Flow (100 random turns)');
  {
    const game = new BackgammonGame();
    let turns = 0;
    let errors = 0;

    while (turns < 100 && !game.isGameOver) {
      try {
        if (game.state.phase !== 'rolling') {
          errors++;
          break;
        }

        game.roll();

        if (game.state.phase === 'moving') {
          const moves = chooseAIMove(game, 'hard');
          for (const m of moves) {
            const result = game.makeMove(m.from, m.to);
            if (!result) {
              if (log) console.error(`  Move failed: ${m.from}→${m.to} (die ${m.die})`);
              errors++;
              break;
            }
          }
        }

        turns++;
      } catch (e) {
        if (log) console.error(`  Error on turn ${turns}:`, e);
        errors++;
        break;
      }
    }

    assert(errors === 0, `No errors in ${turns} turns`);
    if (log) {
      if (game.isGameOver) {
        console.log(`  Game ended after ${turns} turns: ${game.state.result?.winner} wins (${game.state.result?.winType})`);
      } else {
        console.log(`  Game still in progress after ${turns} turns`);
      }
    }
  }

  if (log) {
    console.log(`\n${'═'.repeat(40)}`);
    console.log(`Results: ${passed} passed, ${failed} failed`);
  }

  return { passed, failed };
}

// Vitest entry point
if (import.meta.vitest) {
  test('backgammon engine sanity', () => {
    const { failed } = runEngineSanity(false);
    expect(failed).toBe(0);
  });
} else {
  const { failed } = runEngineSanity(true);
  if (failed > 0) {
    process.exit(1);
  }
}
