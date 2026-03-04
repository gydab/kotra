<script lang="ts">
  import { BackgammonGame, type SingleMove, type Player, type DiceRoll, type Die, BAR_WHITE, BAR_BLACK, OFF_WHITE, OFF_BLACK } from '@lib/engine';
  import { chooseAIMove, shouldAIDouble, shouldAITake, type AIDifficulty } from '@lib/engine/ai';
  import { analyzeAndSaveGame, isLoggedIn } from '@lib/game-persistence';

  // ─── Props ────────────────────────────────────────────

  let { difficulty: propDifficulty = 'hard' as AIDifficulty, humanColor = 'white' as Player } = $props();

  // ─── Match & Clock Config ─────────────────────────────

  let showSetup = $state(true);           // show match config screen
  let matchLength = $state(5);            // points to play to (0 = money game)
  let clockMinutes = $state(0);           // 0 = no clock, else minutes per player
  let internalDifficulty = $state<AIDifficulty>(propDifficulty);
  let difficulty = $derived(internalDifficulty);

  // ─── State ────────────────────────────────────────────

  let game = $state(new BackgammonGame());
  let movableSources = $state<number[]>([]);
  let message = $state('Veldu stillingar og byrjaðu leik');
  let tick = $state(0);
  let aiThinking = $state(false);

  // Dice state — which side they show on, their order, and whose roll it is
  let currentDice = $state<DiceRoll | null>(null);
  let diceFlipped = $state(false);        // user flipped the dice order
  let diceOwner = $state<Player | null>(null); // whose roll is displayed
  let noMovesFlash = $state(false);       // flash when no moves possible

  // Doubling cube UI
  let showCubeOffer = $state(false);      // show take/pass dialog
  let cubeOfferFrom = $state<Player | null>(null);

  // Clock state
  let humanClock = $state(0);             // seconds remaining (0 = off)
  let aiClock = $state(0);
  let clockInterval = $state<ReturnType<typeof setInterval> | null>(null);
  let clockRunning = $state(false);

  // Match state
  let matchOver = $state(false);
  let gameCount = $state(0);              // games played in match

  // Game persistence
  let gameStartTime = $state(Date.now());
  let analysisMessage = $state('');       // shown below game-over message

  // ── Board Dimensions (wider, smaller checkers) ────────
  const W = 920;
  const H = 560;
  const POINT_W = 56;
  const POINT_H = 220;
  const BAR_W = 40;
  const CHECKER_R = 17;
  const BOARD_PAD = 32;
  const TRAY_W = 44;     // bearing-off tray width

  // ─── Derived ──────────────────────────────────────────

  let state = $derived({ ...game.state, _tick: tick });
  let isHumanTurn = $derived(game.state.currentPlayer === humanColor);
  let aiColor = $derived(humanColor === 'white' ? 'black' as Player : 'white' as Player);
  let humanPips = $derived.by(() => { void tick; return game.pipCount(humanColor); });
  let aiPips = $derived.by(() => { void tick; return game.pipCount(aiColor); });

  /** The ordered dice: first die is used first on click */
  let orderedDice = $derived.by(() => {
    if (!currentDice) return null;
    if (currentDice[0] === currentDice[1]) return currentDice; // doubles — no flip
    return diceFlipped ? [currentDice[1], currentDice[0]] as DiceRoll : currentDice;
  });

  /** The "active" die — the first remaining die in ordered sequence */
  let activeDie = $derived.by(() => {
    void tick;
    const rem = game.state.remainingDice;
    if (rem.length === 0 || !orderedDice) return null;
    // The first die in our ordered pair that still exists in remaining
    for (const d of orderedDice) {
      if (rem.includes(d)) return d;
    }
    return rem[0];
  });

  /** Can the human offer a double right now? */
  let canHumanDouble = $derived.by(() => {
    void tick;
    const s = game.state;
    return s.phase === 'rolling' && s.currentPlayer === humanColor
      && s.cube.value < 64
      && (s.cube.owner === null || s.cube.owner === humanColor);
  });

  /** Is the player in bearing-off mode? */
  let humanCanBearOff = $derived.by(() => {
    void tick;
    const offIdx = humanColor === 'white' ? OFF_WHITE : OFF_BLACK;
    // Check if there are legal moves with bear-off as destination
    if (game.state.phase !== 'moving' || game.state.currentPlayer !== humanColor) return false;
    const moves = getAllLegalFirstMoves();
    return moves.some(m => m.to === offIdx);
  });

  function invalidate() { tick++; }

  // ─── Colors ───────────────────────────────────────────

  const C = {
    boardBg: '#2D1B33',
    field: '#451952',
    pointLight: '#F39F5A',
    pointDark: '#AE445A',
    barBg: '#3a2242',
    trayBg: 'rgba(250,245,240,0.06)',
    trayStroke: 'rgba(250,245,240,0.15)',
    white: '#FAF5F0',
    whiteStroke: '#ccc8c0',
    black: '#2D1B33',
    blackStroke: '#1a0f1f',
    selected: '#F39F5A',
    destFill: 'rgba(243,159,90,0.35)',
    destStroke: '#F39F5A',
    textLight: '#FAF5F0',
    textDark: '#2D1B33',
    noMoves: '#e74c3c',
    cubeGold: '#F39F5A',
    diceBg: '#ffffff',
    diceDot: '#2D1B33',
  };

  // ─── Geometry helpers ─────────────────────────────────

  function pointX(idx: number): number {
    // 1-6  → right half bottom (right to left)
    // 7-12 → left half bottom  (right to left)
    // 13-18→ left half top     (left to right)
    // 19-24→ right half top    (left to right)
    if (idx >= 1 && idx <= 6)   return BOARD_PAD + (12 - idx) * POINT_W + BAR_W + POINT_W / 2;
    if (idx >= 7 && idx <= 12)  return BOARD_PAD + (12 - idx) * POINT_W + POINT_W / 2;
    if (idx >= 13 && idx <= 18) return BOARD_PAD + (idx - 13) * POINT_W + POINT_W / 2;
    if (idx >= 19 && idx <= 24) return BOARD_PAD + (idx - 13) * POINT_W + BAR_W + POINT_W / 2;
    return 0;
  }

  const isTop = (i: number) => i >= 13 && i <= 24;

  function pointBaseY(i: number): number {
    return isTop(i) ? BOARD_PAD : H - BOARD_PAD;
  }

  function checkerY(pointIdx: number, stackIdx: number): number {
    const dir = isTop(pointIdx) ? 1 : -1;
    const gap = CHECKER_R * 2 - 2;
    const maxVis = 6;
    const idx = Math.min(stackIdx, maxVis - 1);
    return pointBaseY(pointIdx) + dir * (CHECKER_R + idx * gap);
  }

  function barX(): number {
    return BOARD_PAD + 6 * POINT_W + BAR_W / 2;
  }

  function barCheckerY(player: Player, stackIdx: number): number {
    const gap = CHECKER_R * 2 - 2;
    return player === 'white'
      ? H / 2 + 28 + stackIdx * gap
      : H / 2 - 28 - stackIdx * gap;
  }

  function trianglePath(idx: number): string {
    const x = pointX(idx);
    const top = isTop(idx);
    const y0 = top ? BOARD_PAD : H - BOARD_PAD;
    const yTip = top ? BOARD_PAD + POINT_H : H - BOARD_PAD - POINT_H;
    const hw = POINT_W / 2 - 2;
    return `M ${x - hw} ${y0} L ${x} ${yTip} L ${x + hw} ${y0} Z`;
  }

  const triColor = (i: number) => i % 2 === 0 ? C.pointLight : C.pointDark;
  const cFill = (p: Player) => p === 'white' ? C.white : C.black;
  const cStroke = (p: Player) => p === 'white' ? C.whiteStroke : C.blackStroke;

  // Tray X position (right edge)
  const trayX = () => BOARD_PAD + 12 * POINT_W + BAR_W + 8;

  // Bearing-off tray checker positions — stacked thin rectangles
  function trayCheckerY(player: Player, idx: number): number {
    const slotH = 6;
    if (player === 'white') {
      // bottom half
      return H - BOARD_PAD - 4 - idx * slotH;
    }
    // top half
    return BOARD_PAD + 4 + idx * slotH;
  }

  // Dice positions: human dice on right side, AI dice on left side
  function diceAreaX(owner: Player | null): number {
    if (owner === humanColor) {
      // Right half of bar area
      return barX() + BAR_W / 2 + 60;
    }
    // Left half
    return barX() - BAR_W / 2 - 100;
  }

  // ─── Get all legal first moves (helper) ───────────────

  function getAllLegalFirstMoves(): SingleMove[] {
    if (game.state.phase !== 'moving') return [];
    const sources = game.getMovableSources();
    const all: SingleMove[] = [];
    for (const s of sources) {
      all.push(...game.getLegalDestinations(s));
    }
    return all;
  }

  // ─── Click-to-move interaction ────────────────────────
  //
  // New UX: Click a checker → automatically move it using
  // the first die in order. If there are two different
  // destinations (one per die), we pick the one matching
  // the active die. The user can flip dice to swap priority.

  function onCheckerClick(pointIdx: number) {
    if (game.state.currentPlayer !== humanColor || game.state.phase !== 'moving') return;
    if (!movableSources.includes(pointIdx)) return;

    const dests = game.getLegalDestinations(pointIdx);
    if (dests.length === 0) return;

    // Pick the move matching the active die (first in order)
    let move: SingleMove | undefined;

    if (dests.length === 1) {
      move = dests[0];
    } else {
      // Multiple destinations — prefer the active die
      move = dests.find(m => m.die === activeDie) ?? dests[0];
    }

    if (move) {
      executeHumanMove(move.from, move.to);
    }
  }

  function onBearOffClick() {
    if (game.state.currentPlayer !== humanColor || game.state.phase !== 'moving') return;
    // Find any move that bears off
    const allMoves = getAllLegalFirstMoves();
    const offTarget = humanColor === 'white' ? OFF_WHITE : OFF_BLACK;
    const bearOffMoves = allMoves.filter(m => m.to === offTarget);
    if (bearOffMoves.length === 0) return;

    // If only one source can bear off, do it
    if (bearOffMoves.length === 1) {
      executeHumanMove(bearOffMoves[0].from, bearOffMoves[0].to);
      return;
    }

    // Prefer the move using the active die
    const preferred = bearOffMoves.find(m => m.die === activeDie) ?? bearOffMoves[0];
    executeHumanMove(preferred.from, preferred.to);
  }

  function executeHumanMove(from: number, to: number) {
    const move = game.makeMove(from, to);
    if (!move) return;

    invalidate();
    updateMovableSources();

    const s = game.state;
    if (s.phase === 'moving' && movableSources.length > 0) {
      message = `Þú átt eftir ${s.remainingDice.length} tening${s.remainingDice.length > 1 ? 'a' : ''}`;
    } else if (s.phase === 'game-over') {
      showGameOver();
    } else {
      triggerAITurn();
    }
  }

  function updateMovableSources() {
    movableSources = game.getMovableSources();
  }

  // ─── Dice flip ────────────────────────────────────────

  function flipDice() {
    if (game.state.phase !== 'moving' || !isHumanTurn) return;
    if (!currentDice || currentDice[0] === currentDice[1]) return; // no point flipping doubles
    diceFlipped = !diceFlipped;
  }

  // ─── Roll / Turn Flow ─────────────────────────────────

  function humanRoll() {
    if (game.state.currentPlayer !== humanColor || game.state.phase !== 'rolling') return;

    const dice = game.roll();
    invalidate();
    currentDice = dice;
    diceFlipped = false;
    diceOwner = humanColor;

    const s = game.state;
    if (s.phase === 'moving') {
      updateMovableSources();
      if (movableSources.length > 0) {
        message = `${dice[0]}–${dice[1]} — smelltu á stein til að færa`;
      } else {
        noMovesFlash = true;
        message = `${dice[0]}–${dice[1]} — enginn leikur mögulegur!`;
        setTimeout(() => { noMovesFlash = false; triggerAITurn(); }, 2000);
      }
    } else {
      // Turn was skipped
      noMovesFlash = true;
      message = `${dice[0]}–${dice[1]} — enginn leikur mögulegur!`;
      setTimeout(() => { noMovesFlash = false; triggerAITurn(); }, 2000);
    }
  }

  function undoMove() {
    if (game.state.currentPlayer !== humanColor || game.state.phase !== 'moving') return;
    game.undoLastMove();
    invalidate();
    updateMovableSources();
    message = 'Afturkallað — veldu aftur';
  }

  // ─── Doubling Cube ───────────────────────────────────

  function humanOfferDouble() {
    if (!canHumanDouble) return;
    const ok = game.offerDouble();
    if (!ok) return;
    invalidate();

    // AI decides: take or pass
    aiThinking = true;
    message = 'Tölvan íhugar tvöföldun...';

    setTimeout(() => {
      if (shouldAITake(game)) {
        game.takeDouble();
        invalidate();
        message = `Tölvan tekur! Kubbur: ${game.state.cube.value}×`;
      } else {
        game.passDouble();
        invalidate();
        showGameOver();
        return;
      }
      aiThinking = false;
    }, 1200);
  }

  function handleCubeDecision(take: boolean) {
    if (game.state.phase !== 'cube-decision') return;
    showCubeOffer = false;
    cubeOfferFrom = null;
    if (take) {
      game.takeDouble();
      invalidate();
      message = `Þú tókst! Kubbur: ${game.state.cube.value}×`;
      // AI offered the double — now let it continue its turn (roll + move)
      setTimeout(() => triggerAITurn(), 800);
    } else {
      game.passDouble();
      invalidate();
      showGameOver();
    }
  }

  // ─── AI Turn ──────────────────────────────────────────

  async function triggerAITurn() {
    if (game.state.phase === 'game-over') return;

    aiThinking = true;
    message = 'Tölvan hugsar...';
    await sleep(500);

    // AI might offer a double before rolling
    if (game.state.phase === 'rolling' && shouldAIDouble(game)) {
      const ok = game.offerDouble();
      if (ok) {
        invalidate();
        message = 'Tölvan tvöfaldar!';
        showCubeOffer = true;
        cubeOfferFrom = aiColor;
        aiThinking = false;
        return; // wait for human take/pass
      }
    }

    // Roll
    const dice = game.roll();
    invalidate();
    currentDice = dice;
    diceFlipped = false;
    diceOwner = aiColor;

    message = `Tölvan fékk ${dice[0]}–${dice[1]}`;
    await sleep(700);

    if (game.state.phase === 'moving') {
      const moves = chooseAIMove(game, difficulty);
      if (moves.length === 0) {
        noMovesFlash = true;
        message = `Tölvan gat ekki leikið`;
        await sleep(1200);
        noMovesFlash = false;
      } else {
        for (const move of moves) {
          game.makeMove(move.from, move.to);
          invalidate();
          await sleep(350);
        }
      }
    } else {
      noMovesFlash = true;
      message = `Tölvan gat ekki leikið`;
      await sleep(1200);
      noMovesFlash = false;
    }

    aiThinking = false;
    invalidate();

    if (game.state.phase === 'game-over') {
      showGameOver();
    } else {
      message = 'Þú átt leik — kastaðu teningunum';
    }
  }

  function showGameOver() {
    stopClock();
    const r = game.state.result!;
    const winLabel = r.winType === 'backgammon' ? 'Bakgammon!' : r.winType === 'gammon' ? 'Gammon!' : '';

    // Accumulate score
    game.state.score[r.winner] += r.points;
    invalidate();
    gameCount++;

    // Check match win
    if (matchLength > 0 && game.state.score[r.winner] >= matchLength) {
      matchOver = true;
      message = r.winner === humanColor
        ? `🏆 Þú vinnur keppnina ${game.state.score[humanColor]}–${game.state.score[aiColor]}!`
        : `Tölvan vinnur keppnina ${game.state.score[aiColor]}–${game.state.score[humanColor]}`;
    } else {
      const scoreStr = `${game.state.score[humanColor]}–${game.state.score[aiColor]}`;
      message = r.winner === humanColor
        ? `🎉 Þú vinnur! ${winLabel} +${r.points} stig (${scoreStr})`
        : `Tölvan vinnur ${winLabel} +${r.points} stig (${scoreStr})`;
    }

    // Analyze & save (fire-and-forget, only if logged in)
    analysisMessage = '';
    const durationSeconds = Math.round((Date.now() - gameStartTime) / 1000);
    analyzeAndSaveGame({
      game,
      humanColor: humanColor as Player,
      difficulty,
      matchLength,
      durationSeconds,
    }).then(({ saved, analysis }) => {
      const parts: string[] = [];
      if (analysis.blunderCount === 0) {
        parts.push('✓ Engar villur!');
      } else {
        parts.push(`${analysis.blunderCount} ${analysis.blunderCount === 1 ? 'villa' : 'villur'}`);
      }
      if (saved) {
        parts.push('📊 Leikur vistaður');
      }
      analysisMessage = parts.join(' · ');
    }).catch(() => {
      // Silently ignore analysis/save errors
    });
  }

  function sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }

  // ─── Clock ────────────────────────────────────────────

  function startClock() {
    if (clockMinutes <= 0) return;
    stopClock();
    clockRunning = true;
    clockInterval = setInterval(() => {
      if (game.state.phase === 'game-over' || showSetup) {
        stopClock();
        return;
      }
      // Tick the active player's clock
      if (game.state.currentPlayer === humanColor) {
        humanClock = Math.max(0, humanClock - 1);
        if (humanClock <= 0) {
          // Human ran out of time
          stopClock();
          game.state.result = { winner: aiColor, winType: 'normal', points: game.state.cube.value };
          game.state.phase = 'game-over';
          invalidate();
          showGameOver();
          message = '⏱ Tíminn er búinn — tölvan vinnur!';
        }
      } else {
        aiClock = Math.max(0, aiClock - 1);
        if (aiClock <= 0) {
          stopClock();
          game.state.result = { winner: humanColor, winType: 'normal', points: game.state.cube.value };
          game.state.phase = 'game-over';
          invalidate();
          showGameOver();
          message = '⏱ Tími tölvunnar er búinn — þú vinnur!';
        }
      }
    }, 1000);
  }

  function stopClock() {
    if (clockInterval) {
      clearInterval(clockInterval);
      clockInterval = null;
    }
    clockRunning = false;
  }

  function formatTime(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // ─── Match setup ──────────────────────────────────────

  function startMatch() {
    showSetup = false;
    matchOver = false;
    gameCount = 0;
    game = new BackgammonGame();
    game.state.matchLength = matchLength;
    movableSources = [];
    currentDice = null;
    diceFlipped = false;
    diceOwner = null;
    noMovesFlash = false;
    showCubeOffer = false;
    cubeOfferFrom = null;
    aiThinking = false;
    analysisMessage = '';
    gameStartTime = Date.now();
    tick = 0;
    message = 'Ýttu á 🎲 til að hefja leik';

    // Init clocks
    if (clockMinutes > 0) {
      humanClock = clockMinutes * 60;
      aiClock = clockMinutes * 60;
      startClock();
    } else {
      humanClock = 0;
      aiClock = 0;
    }
  }

  // ─── New Game (next game in match) ────────────────────

  function nextGameInMatch() {
    const score = { ...game.state.score };
    game = new BackgammonGame();
    game.state.score = score;
    game.state.matchLength = matchLength;
    movableSources = [];
    message = 'Ýttu á 🎲 til að hefja næsta leik';
    currentDice = null;
    diceFlipped = false;
    diceOwner = null;
    noMovesFlash = false;
    showCubeOffer = false;
    cubeOfferFrom = null;
    aiThinking = false;
    analysisMessage = '';
    gameStartTime = Date.now();
    tick = 0;

    // Clocks: reset per game if set
    if (clockMinutes > 0) {
      humanClock = clockMinutes * 60;
      aiClock = clockMinutes * 60;
      startClock();
    }
  }

  function newMatch() {
    showSetup = true;
    matchOver = false;
    stopClock();
    message = 'Veldu stillingar og byrjaðu leik';
  }

  function startNewGame() {
    // Legacy: reset everything for a fresh match
    newMatch();
  }

  // ─── SVG die face (dots pattern) ──────────────────────

  function dieDots(val: number): [number, number][] {
    const s = 7; // spread
    const dots: Record<number, [number, number][]> = {
      1: [[0, 0]],
      2: [[-s, -s], [s, s]],
      3: [[-s, -s], [0, 0], [s, s]],
      4: [[-s, -s], [s, -s], [-s, s], [s, s]],
      5: [[-s, -s], [s, -s], [0, 0], [-s, s], [s, s]],
      6: [[-s, -s], [s, -s], [-s, 0], [s, 0], [-s, s], [s, s]],
    };
    return dots[val] ?? [];
  }
</script>

<div class="game-container">
  <!-- ═══ Match Setup Screen ═══ -->
  {#if showSetup}
    <div class="setup-panel">
      <h2 class="setup-title">Kotratefli</h2>
      <p class="setup-sub">Veldu stillingar og byrjaðu leik</p>

      <div class="setup-grid">
        <!-- Match length -->
        <div class="setup-group">
          <label class="setup-label">Keppni upp í:</label>
          <div class="setup-options">
            {#each [3, 5, 7, 11, 0] as ml}
              <button
                class="setup-btn"
                class:active={matchLength === ml}
                onclick={() => matchLength = ml}
              >{ml === 0 ? '∞' : ml}</button>
            {/each}
          </div>
          <span class="setup-hint">{matchLength === 0 ? 'Engin mörk (peningaleikur)' : `Fyrsti til ${matchLength} stiga`}</span>
        </div>

        <!-- Clock -->
        <div class="setup-group">
          <label class="setup-label">Klukka (mín):</label>
          <div class="setup-options">
            {#each [0, 5, 10, 15] as cm}
              <button
                class="setup-btn"
                class:active={clockMinutes === cm}
                onclick={() => clockMinutes = cm}
              >{cm === 0 ? 'Af' : cm}</button>
            {/each}
          </div>
          <span class="setup-hint">{clockMinutes === 0 ? 'Engin klukka' : `${clockMinutes} mínútur per leikmann`}</span>
        </div>

        <!-- Difficulty -->
        <div class="setup-group">
          <label class="setup-label">Erfiðleiki:</label>
          <div class="setup-options">
            {#each [['easy', 'Auðvelt'], ['medium', 'Miðlungs'], ['hard', 'Erfitt']] as [val, label]}
              <button
                class="setup-btn"
                class:active={internalDifficulty === val}
                onclick={() => internalDifficulty = val as AIDifficulty}
              >{label}</button>
            {/each}
          </div>
        </div>
      </div>

      <button class="btn-start-match" onclick={startMatch}>
        🎲 Byrja leik
      </button>
    </div>
  {:else}
  <!-- ═══ Game Board ═══ -->

  <!-- Message Bar -->
  <div class="message-bar" class:no-moves={noMovesFlash}>
    <span class="message-text">{message}</span>
    {#if analysisMessage && state.phase === 'game-over'}
      <span class="analysis-msg">{analysisMessage}</span>
    {/if}
    <div class="bar-right">
      {#if clockMinutes > 0 && !showSetup}
        <span class="clock-display" class:clock-low={isHumanTurn && humanClock <= 30}>
          ⏱ {formatTime(isHumanTurn ? humanClock : aiClock)}
        </span>
      {/if}
      {#if state.phase !== 'game-over'}
        <span class="pip-display">{humanPips} / {aiPips} pips</span>
      {/if}
    </div>
  </div>

  <!-- Match score bar -->
  {#if matchLength > 0}
    <div class="match-bar">
      <span class="match-score">Þú: <strong>{state.score[humanColor]}</strong></span>
      <span class="match-target">Keppni upp í {matchLength}</span>
      <span class="match-score">Tölva: <strong>{state.score[aiColor]}</strong></span>
    </div>
  {/if}

  <!-- Cube offer dialog -->
  {#if showCubeOffer}
    <div class="cube-dialog">
      <p>Tölvan býður tvöföldun → <strong>{game.state.cube.value * 2}×</strong></p>
      <div class="cube-btns">
        <button class="btn-take" onclick={() => handleCubeDecision(true)}>✓ Taka</button>
        <button class="btn-pass" onclick={() => handleCubeDecision(false)}>✗ Gefa upp</button>
      </div>
    </div>
  {/if}

  <!-- Board SVG -->
  <svg viewBox="0 0 {W} {H}" class="board-svg">
    <!-- Board background -->
    <rect x="0" y="0" width={W} height={H} rx="10" fill={C.boardBg} />

    <!-- Playing field -->
    <rect x={BOARD_PAD - 2} y={BOARD_PAD - 2} width={12 * POINT_W + BAR_W + 4} height={H - BOARD_PAD * 2 + 4} rx="5" fill={C.field} />

    <!-- Bar -->
    <rect x={barX() - BAR_W / 2} y={BOARD_PAD} width={BAR_W} height={H - BOARD_PAD * 2} fill={C.barBg} />

    <!-- Bear-off trays -->
    <rect x={trayX()} y={BOARD_PAD}
      width={TRAY_W} height={H / 2 - BOARD_PAD - 2} rx="4"
      fill={C.trayBg} stroke={C.trayStroke} stroke-width="1" />
    <rect x={trayX()} y={H / 2 + 2}
      width={TRAY_W} height={H / 2 - BOARD_PAD - 2} rx="4"
      fill={C.trayBg} stroke={C.trayStroke} stroke-width="1"
      class:tray-active={humanCanBearOff}
      onclick={() => onBearOffClick()} />

    <!-- Tray labels -->
    <text x={trayX() + TRAY_W / 2} y={BOARD_PAD - 6} text-anchor="middle" fill={C.textLight} font-size="9" opacity="0.5" font-family="var(--font-mono, monospace)">ÚT</text>
    <text x={trayX() + TRAY_W / 2} y={H - BOARD_PAD + 14} text-anchor="middle" fill={C.textLight} font-size="9" opacity="0.5" font-family="var(--font-mono, monospace)">ÚT</text>

    <!-- Triangles 1-24 -->
    {#each Array.from({ length: 24 }, (_, i) => i + 1) as idx}
      <path
        d={trianglePath(idx)}
        fill={triColor(idx)}
        opacity={movableSources.includes(idx) ? 0.9 : 0.55}
        stroke={movableSources.includes(idx) ? C.selected : 'none'}
        stroke-width="1.5"
        class="tri"
        class:clickable={movableSources.includes(idx)}
        onclick={() => onCheckerClick(idx)}
      />
      <!-- Point number -->
      <text
        x={pointX(idx)}
        y={isTop(idx) ? BOARD_PAD - 6 : H - BOARD_PAD + 14}
        text-anchor="middle" fill={C.textLight}
        font-size="9" font-family="var(--font-mono, monospace)" opacity="0.35"
      >{idx}</text>
    {/each}

    <!-- Checkers on points 1-24 -->
    {#each Array.from({ length: 24 }, (_, i) => i + 1) as idx}
      {#if state.points[idx].count > 0}
        {@const owner = state.points[idx].owner!}
        {@const cnt = state.points[idx].count}
        {#each Array.from({ length: Math.min(cnt, 7) }) as _, si}
          <circle
            cx={pointX(idx)} cy={checkerY(idx, si)} r={CHECKER_R}
            fill={cFill(owner)}
            stroke={movableSources.includes(idx) && owner === humanColor ? C.selected : cStroke(owner)}
            stroke-width={movableSources.includes(idx) && owner === humanColor ? 2.5 : 1.2}
            class="checker"
            class:clickable={movableSources.includes(idx) && isHumanTurn}
            onclick={() => onCheckerClick(idx)}
          />
        {/each}
        {#if cnt > 5}
          <text x={pointX(idx)} y={checkerY(idx, Math.min(cnt - 1, 6)) + 5}
            text-anchor="middle"
            fill={owner === 'white' ? C.textDark : C.textLight}
            font-size="11" font-weight="bold" font-family="var(--font-mono, monospace)"
          >{cnt}</text>
        {/if}
      {/if}
    {/each}

    <!-- Bar checkers — White -->
    {#if state.points[BAR_WHITE].count > 0}
      {@const cnt = state.points[BAR_WHITE].count}
      {#each Array.from({ length: Math.min(cnt, 4) }) as _, i}
        <circle cx={barX()} cy={barCheckerY('white', i)} r={CHECKER_R - 1}
          fill={cFill('white')}
          stroke={movableSources.includes(BAR_WHITE) ? C.selected : cStroke('white')}
          stroke-width={movableSources.includes(BAR_WHITE) ? 2.5 : 1.2}
          class="checker"
          class:clickable={movableSources.includes(BAR_WHITE) && humanColor === 'white'}
          onclick={() => onCheckerClick(BAR_WHITE)}
        />
      {/each}
      {#if cnt > 1}
        <text x={barX()} y={barCheckerY('white', 0) + 5} text-anchor="middle" fill={C.textDark} font-size="10" font-weight="bold">{cnt}</text>
      {/if}
    {/if}

    <!-- Bar checkers — Black -->
    {#if state.points[BAR_BLACK].count > 0}
      {@const cnt = state.points[BAR_BLACK].count}
      {#each Array.from({ length: Math.min(cnt, 4) }) as _, i}
        <circle cx={barX()} cy={barCheckerY('black', i)} r={CHECKER_R - 1}
          fill={cFill('black')}
          stroke={movableSources.includes(BAR_BLACK) ? C.selected : cStroke('black')}
          stroke-width={movableSources.includes(BAR_BLACK) ? 2.5 : 1.2}
          class="checker"
          class:clickable={movableSources.includes(BAR_BLACK) && humanColor === 'black'}
          onclick={() => onCheckerClick(BAR_BLACK)}
        />
      {/each}
      {#if cnt > 1}
        <text x={barX()} y={barCheckerY('black', 0) + 5} text-anchor="middle" fill={C.textLight} font-size="10" font-weight="bold">{cnt}</text>
      {/if}
    {/if}

    <!-- Borne-off checkers in trays — White (bottom tray) -->
    {#if state.points[OFF_WHITE].count > 0}
      {@const cnt = state.points[OFF_WHITE].count}
      {#each Array.from({ length: cnt }) as _, i}
        <rect
          x={trayX() + 4} y={trayCheckerY('white', i)}
          width={TRAY_W - 8} height={5} rx="2"
          fill={C.white} stroke={C.whiteStroke} stroke-width="0.5"
        />
      {/each}
      <text x={trayX() + TRAY_W / 2} y={H / 2 + 20}
        text-anchor="middle" fill={C.textLight}
        font-size="13" font-weight="bold" font-family="var(--font-mono, monospace)"
      >{cnt}</text>
    {/if}

    <!-- Borne-off checkers in trays — Black (top tray) -->
    {#if state.points[OFF_BLACK].count > 0}
      {@const cnt = state.points[OFF_BLACK].count}
      {#each Array.from({ length: cnt }) as _, i}
        <rect
          x={trayX() + 4} y={trayCheckerY('black', i)}
          width={TRAY_W - 8} height={5} rx="2"
          fill={C.black} stroke={C.blackStroke} stroke-width="0.5"
        />
      {/each}
      <text x={trayX() + TRAY_W / 2} y={H / 2 - 10}
        text-anchor="middle" fill={C.textLight}
        font-size="13" font-weight="bold" font-family="var(--font-mono, monospace)"
      >{cnt}</text>
    {/if}

    <!-- ─── Dice (SVG rendered, positioned by owner side) ─── -->
    {#if currentDice && state.phase === 'moving' && state.remainingDice.length > 0}
      {@const ox = diceAreaX(diceOwner)}
      {@const oy = H / 2}
      {@const diceToShow = orderedDice ?? currentDice}
      {@const rem = state.remainingDice}
      {#each [0, 1] as di}
        {@const val = diceToShow[di]}
        {@const used = (() => { 
          const countInOrdered = diceToShow.filter((d, i) => i <= di && d === val).length;
          const countInRemaining = rem.filter(d => d === val).length;
          return countInOrdered > countInRemaining;
        })()}
        <g transform="translate({ox + di * 42 - 21}, {oy})"
          class:dice-used={used}
          class:dice-clickable={!used && diceOwner === humanColor}
          onclick={() => flipDice()}
          style="cursor: {diceOwner === humanColor && !used ? 'pointer' : 'default'}"
        >
          <rect x="-16" y="-16" width="32" height="32" rx="5"
            fill={used ? 'rgba(255,255,255,0.15)' : C.diceBg}
            stroke={used ? 'none' : 'rgba(0,0,0,0.1)'}
            stroke-width="1" />
          {#each dieDots(val) as [dx, dy]}
            <circle cx={dx} cy={dy} r="3"
              fill={used ? 'rgba(255,255,255,0.2)' : C.diceDot} />
          {/each}
          <!-- Active indicator: first unused die -->
          {#if !used && val === activeDie && di === (diceToShow.indexOf(activeDie!))}
            <rect x="-18" y="-18" width="36" height="36" rx="7"
              fill="none" stroke={C.selected} stroke-width="2" opacity="0.7" />
          {/if}
        </g>
      {/each}
      <!-- Flip hint -->
      {#if diceOwner === humanColor && currentDice[0] !== currentDice[1]}
        <text x={ox + 21} y={oy + 28} text-anchor="middle"
          fill={C.textLight} font-size="8" opacity="0.4"
          font-family="var(--font-mono, monospace)">⇄ smelltu til að snúa</text>
      {/if}
    {/if}

    <!-- Doubling cube display -->
    {#if true}
      {@const cubeVal = state.cube.value}
      {@const cubeOwner = state.cube.owner}
      {@const cubeY = cubeOwner === null ? H / 2
        : cubeOwner === humanColor ? H - BOARD_PAD - 24
        : BOARD_PAD + 24}
      <g transform="translate({BOARD_PAD - 18}, {cubeY})">
        <rect x="-14" y="-14" width="28" height="28" rx="4"
          fill={C.cubeGold} stroke="rgba(0,0,0,0.3)" stroke-width="1" />
        <text x="0" y="6" text-anchor="middle"
          fill={C.textDark} font-size="14" font-weight="bold"
          font-family="var(--font-mono, monospace)">{cubeVal}</text>
      </g>
    {/if}

    <!-- No-moves flash overlay -->
    {#if noMovesFlash}
      <rect x="0" y="0" width={W} height={H} rx="10"
        fill="rgba(231,76,60,0.12)" class="no-moves-overlay" />
      <text x={W / 2} y={H / 2} text-anchor="middle"
        fill={C.noMoves} font-size="22" font-weight="bold"
        font-family="var(--font-body, sans-serif)"
        opacity="0.9">Enginn leikur mögulegur</text>
    {/if}
  </svg>

  <!-- Controls -->
  <div class="controls">
    {#if state.phase === 'rolling' && isHumanTurn && !state.result}
      <button class="btn-roll" onclick={humanRoll} disabled={aiThinking}>
        🎲 Kasta
      </button>
      {#if canHumanDouble}
        <button class="btn-double" onclick={humanOfferDouble} disabled={aiThinking}>
          ×2 Tvöfalda
        </button>
      {/if}
    {/if}

    {#if state.phase === 'moving' && isHumanTurn && state.currentMoves.length > 0}
      <button class="btn-undo" onclick={undoMove}>
        ↩ Afturkalla
      </button>
    {/if}

    {#if state.phase === 'game-over'}
      {#if matchOver}
        <button class="btn-new" onclick={newMatch}>
          🏆 Ný keppni
        </button>
      {:else if matchLength > 0}
        <button class="btn-new" onclick={nextGameInMatch}>
          ▶ Næsti leikur
        </button>
        <button class="btn-undo" onclick={newMatch}>
          ↩ Ný keppni
        </button>
      {:else}
        <button class="btn-new" onclick={startNewGame}>
          🔄 Nýr leikur
        </button>
      {/if}
    {/if}

    <div class="info-panel">
      {#if clockMinutes > 0}
        <span class="info-item">
          <span class="clock-icon">⏱</span>
          <span class="info-value clock-val" class:clock-low={humanClock <= 30}>{formatTime(humanClock)}</span>
          <span class="info-label"> / </span>
          <span class="info-value">{formatTime(aiClock)}</span>
        </span>
      {/if}
      <span class="info-item">
        <span class="info-label">Kubbur:</span>
        <span class="info-value">{state.cube.value}×</span>
      </span>
      <span class="info-item">
        <span class="info-label">Stig:</span>
        <span class="info-value">{state.score[humanColor]}–{state.score[aiColor]}</span>
        {#if matchLength > 0}
          <span class="info-label"> / {matchLength}</span>
        {/if}
      </span>
    </div>
  </div>

  {/if}<!-- end showSetup else -->
</div>

<style>
  .game-container {
    max-width: 960px;
    margin: 0 auto;
    user-select: none;
  }

  .message-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 20px;
    background: #451952;
    border-radius: 12px 12px 0 0;
    color: #FAF5F0;
    font-family: var(--font-body, sans-serif);
    font-size: 14px;
    font-weight: 500;
    transition: background 0.3s;
  }

  .message-bar.no-moves {
    background: #7c2d2d;
  }

  .analysis-msg {
    font-size: 11px;
    color: #F39F5A;
    margin-left: 12px;
    font-family: var(--font-mono, monospace);
    opacity: 0.9;
  }

  .pip-display {
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    opacity: 0.5;
  }

  .board-svg {
    display: block;
    width: 100%;
    height: auto;
  }

  /* Triangles */
  .tri {
    cursor: default;
    transition: opacity 0.12s;
  }
  .tri.clickable { cursor: pointer; }
  .tri.clickable:hover { opacity: 1 !important; }

  /* Checkers */
  .checker {
    transition: stroke 0.12s, stroke-width 0.12s;
  }
  .checker.clickable {
    cursor: pointer;
    filter: drop-shadow(0 1px 3px rgba(0,0,0,0.25));
  }
  .checker.clickable:hover {
    filter: drop-shadow(0 2px 8px rgba(243,159,90,0.5));
  }

  /* Dice */
  .dice-used { opacity: 0.35; }
  .dice-clickable:hover rect { fill: #f0e8de !important; }

  /* Tray glow for bear-off */
  .tray-active {
    cursor: pointer;
    stroke: #F39F5A !important;
    stroke-width: 2 !important;
    animation: pulse-tray 1.5s infinite;
  }
  @keyframes pulse-tray {
    0%, 100% { stroke-opacity: 0.5; }
    50% { stroke-opacity: 1; }
  }

  /* No-moves flash */
  .no-moves-overlay {
    animation: flash-red 0.6s ease-in-out 3;
    pointer-events: none;
  }
  @keyframes flash-red {
    0%, 100% { opacity: 0; }
    50% { opacity: 1; }
  }

  /* Cube dialog */
  .cube-dialog {
    background: linear-gradient(135deg, #451952, #662549);
    border: 2px solid #F39F5A;
    border-radius: 12px;
    padding: 20px 28px;
    text-align: center;
    color: #FAF5F0;
    margin-bottom: -1px;
    font-family: var(--font-body, sans-serif);
  }
  .cube-dialog p { margin: 0 0 12px; font-size: 15px; }
  .cube-btns { display: flex; gap: 12px; justify-content: center; }
  .btn-take, .btn-pass {
    padding: 8px 24px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    font-family: var(--font-body, sans-serif);
  }
  .btn-take { background: #27ae60; color: white; }
  .btn-take:hover { background: #2ecc71; }
  .btn-pass { background: #c0392b; color: white; }
  .btn-pass:hover { background: #e74c3c; }

  /* Controls bar */
  .controls {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 20px;
    background: #2D1B33;
    border-radius: 0 0 12px 12px;
    flex-wrap: wrap;
  }

  .btn-roll, .btn-undo, .btn-new, .btn-double {
    padding: 9px 20px;
    border: none;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    font-family: var(--font-body, sans-serif);
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-roll {
    background: linear-gradient(135deg, #AE445A, #F39F5A);
    color: white;
    box-shadow: 0 3px 10px rgba(174,68,90,0.3);
  }
  .btn-roll:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 5px 14px rgba(174,68,90,0.4);
  }
  .btn-roll:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-double {
    background: rgba(243,159,90,0.15);
    color: #F39F5A;
    border: 1.5px solid rgba(243,159,90,0.4);
  }
  .btn-double:hover:not(:disabled) {
    background: rgba(243,159,90,0.25);
  }
  .btn-double:disabled { opacity: 0.4; cursor: not-allowed; }

  .btn-undo {
    background: rgba(255,255,255,0.08);
    color: #FAF5F0;
    border: 1px solid rgba(255,255,255,0.15);
  }
  .btn-undo:hover { background: rgba(255,255,255,0.15); }

  .btn-new {
    background: linear-gradient(135deg, #AE445A, #F39F5A);
    color: white;
  }
  .btn-new:hover { transform: translateY(-1px); }

  .info-panel {
    margin-left: auto;
    display: flex;
    gap: 14px;
  }

  .info-item {
    color: rgba(250,245,240,0.45);
    font-size: 11px;
    font-family: var(--font-mono, monospace);
  }
  .info-label { margin-right: 3px; }
  .info-value { color: #F39F5A; font-weight: 600; }

  /* ─── Setup Panel ─── */
  .setup-panel {
    background: linear-gradient(135deg, #2D1B33, #451952);
    border-radius: 12px;
    padding: 40px 32px;
    text-align: center;
    color: #FAF5F0;
    font-family: var(--font-body, sans-serif);
  }
  .setup-title {
    font-size: 2rem;
    font-weight: 700;
    margin: 0 0 6px;
    font-family: var(--font-heading, var(--font-body, sans-serif));
    background: linear-gradient(135deg, #F39F5A, #AE445A);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .setup-sub {
    margin: 0 0 28px;
    color: rgba(250,245,240,0.6);
    font-size: 14px;
  }
  .setup-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 24px;
    justify-content: center;
    margin-bottom: 28px;
  }
  .setup-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .setup-label {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: rgba(250,245,240,0.5);
  }
  .setup-options {
    display: flex;
    gap: 6px;
  }
  .setup-btn {
    padding: 8px 16px;
    border: 1.5px solid rgba(250,245,240,0.2);
    border-radius: 8px;
    background: rgba(255,255,255,0.05);
    color: #FAF5F0;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    font-family: var(--font-body, sans-serif);
    transition: all 0.15s;
    min-width: 42px;
  }
  .setup-btn:hover {
    background: rgba(243,159,90,0.15);
    border-color: rgba(243,159,90,0.4);
  }
  .setup-btn.active {
    background: linear-gradient(135deg, #AE445A, #F39F5A);
    border-color: transparent;
    color: white;
  }
  .setup-hint {
    font-size: 11px;
    color: rgba(250,245,240,0.35);
    font-style: italic;
  }
  .btn-start-match {
    padding: 14px 40px;
    border: none;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 700;
    font-family: var(--font-body, sans-serif);
    cursor: pointer;
    background: linear-gradient(135deg, #AE445A, #F39F5A);
    color: white;
    box-shadow: 0 4px 16px rgba(174,68,90,0.35);
    transition: all 0.2s;
  }
  .btn-start-match:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(174,68,90,0.45);
  }

  /* ─── Match Bar ─── */
  .match-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 20px;
    background: rgba(69,25,82,0.7);
    font-family: var(--font-mono, monospace);
    font-size: 12px;
    color: rgba(250,245,240,0.6);
  }
  .match-score strong {
    color: #F39F5A;
    font-size: 14px;
  }
  .match-target {
    color: rgba(250,245,240,0.35);
    font-size: 11px;
  }

  /* ─── Clock ─── */
  .bar-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .clock-display {
    font-family: var(--font-mono, monospace);
    font-size: 13px;
    font-weight: 600;
    color: #FAF5F0;
    padding: 2px 8px;
    border-radius: 4px;
    background: rgba(255,255,255,0.08);
  }
  .clock-display.clock-low {
    color: #e74c3c;
    animation: pulse-clock 1s infinite;
  }
  .clock-val.clock-low {
    color: #e74c3c !important;
  }
  @keyframes pulse-clock {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  .clock-icon {
    font-size: 11px;
  }
</style>
