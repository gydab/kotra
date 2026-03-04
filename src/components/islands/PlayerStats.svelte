<script lang="ts">
  import { fetchPlayerStats, fetchRecentGames, fetchBlunderTrend, isLoggedIn, type PlayerStats } from '@lib/game-persistence';

  // ─── State ────────────────────────────────────────────

  let loggedIn = $state(false);
  let loading = $state(true);
  let stats = $state<PlayerStats | null>(null);
  let recentGames = $state<any[]>([]);
  let blunderTrend = $state<{ date: string; avgBlunders: number; games: number }[]>([]);

  // ─── Load data on mount ───────────────────────────────

  $effect(() => {
    loadStats();
  });

  async function loadStats() {
    loading = true;
    loggedIn = await isLoggedIn();
    if (!loggedIn) {
      loading = false;
      return;
    }

    const [s, rg, bt] = await Promise.all([
      fetchPlayerStats(),
      fetchRecentGames(20),
      fetchBlunderTrend(),
    ]);

    stats = s;
    recentGames = rg;
    blunderTrend = bt;
    loading = false;
  }

  // ─── Helpers ──────────────────────────────────────────

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('is-IS', { day: 'numeric', month: 'short' });
  }

  function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function diffLabel(d: string): string {
    return d === 'easy' ? 'Auðvelt' : d === 'medium' ? 'Miðlungs' : 'Erfitt';
  }

  function winRateColor(rate: number): string {
    if (rate >= 60) return '#27ae60';
    if (rate >= 45) return '#F39F5A';
    return '#e74c3c';
  }

  // Simple ASCII sparkline for blunder trend
  function blunderSparkline(trend: typeof blunderTrend): string {
    if (trend.length < 2) return '';
    const max = Math.max(...trend.map(t => t.avgBlunders), 1);
    const chars = '▁▂▃▄▅▆▇█';
    return trend.map(t => {
      const idx = Math.round((t.avgBlunders / max) * (chars.length - 1));
      return chars[idx];
    }).join('');
  }
</script>

<div class="stats-container">
  {#if loading}
    <div class="loading-state">
      <span class="spinner">⏳</span> Hleð tölfræði...
    </div>
  {:else if !loggedIn}
    <div class="not-logged-in">
      <h2>📊 Tölfræðin þín</h2>
      <p>Skráðu þig inn á leikjasíðunni til að byrja að safna tölfræði.</p>
      <p class="hint">Þú getur spilað eins mikið og þú vilt án þess að skrá þig — en innskráning vistar leikina þína.</p>
    </div>
  {:else if !stats || stats.totalGames === 0}
    <div class="no-games">
      <h2>📊 Tölfræðin þín</h2>
      <p>Engir leikir ennþá! Farðu í leik til að byrja að safna gögnum.</p>
      <a href="/is/spila" class="btn-play">🎲 Spila</a>
    </div>
  {:else}
    <!-- ═══ Dashboard ═══ -->
    <h2 class="dash-title">📊 Tölfræðin þín</h2>

    <!-- Top stats cards -->
    <div class="stat-cards">
      <div class="stat-card">
        <span class="stat-value" style="color: {winRateColor(stats.winRate)}">{stats.winRate}%</span>
        <span class="stat-label">Vinningshlutfall</span>
        <span class="stat-sub">{stats.wins}W / {stats.losses}L</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{stats.totalGames}</span>
        <span class="stat-label">Leikir</span>
        <span class="stat-sub">Fyrsti: {stats.firstGame ? formatDate(stats.firstGame) : '—'}</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{stats.avgBlunders.toFixed(1)}</span>
        <span class="stat-label">Meðal villur/leik</span>
        <span class="stat-sub">{stats.totalBlunders} samtals</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{stats.currentWinStreak}</span>
        <span class="stat-label">Sigurrás</span>
        <span class="stat-sub">{stats.gammonsWon} gammon, {stats.backgammonsWon} bakgammon</span>
      </div>
    </div>

    <!-- By difficulty -->
    <div class="section">
      <h3 class="section-title">Eftir erfiðleika</h3>
      <div class="diff-grid">
        {#each ['easy', 'medium', 'hard'] as diff}
          {@const d = stats.byDifficulty[diff as 'easy' | 'medium' | 'hard']}
          <div class="diff-item">
            <span class="diff-label">{diffLabel(diff)}</span>
            <div class="diff-bar-bg">
              <div class="diff-bar-fill" style="width: {d.games > 0 ? (d.wins / d.games * 100) : 0}%"></div>
            </div>
            <span class="diff-stat">{d.wins}/{d.games}</span>
          </div>
        {/each}
      </div>
    </div>

    <!-- Blunder trend -->
    {#if blunderTrend.length >= 2}
      <div class="section">
        <h3 class="section-title">Villur yfir tíma</h3>
        <div class="trend-chart">
          <span class="sparkline">{blunderSparkline(blunderTrend)}</span>
          <div class="trend-detail">
            {#each blunderTrend.slice(-6) as week}
              <div class="trend-week">
                <span class="trend-date">{formatDate(week.date)}</span>
                <span class="trend-val">{week.avgBlunders}</span>
              </div>
            {/each}
          </div>
        </div>
        {#if blunderTrend.length >= 3}
          {@const recent = blunderTrend.slice(-3).reduce((a, b) => a + b.avgBlunders, 0) / 3}
          {@const earlier = blunderTrend.slice(0, 3).reduce((a, b) => a + b.avgBlunders, 0) / 3}
          {#if recent < earlier * 0.8}
            <p class="trend-note positive">📉 Þú ert að minnka villur — vel gert!</p>
          {:else if recent > earlier * 1.2}
            <p class="trend-note negative">📈 Villur hafa aukist — einbeittu þér að taktíkinni</p>
          {:else}
            <p class="trend-note neutral">→ Stöðugt — haltu áfram að æfa</p>
          {/if}
        {/if}
      </div>
    {/if}

    <!-- Recent games -->
    <div class="section">
      <h3 class="section-title">Síðustu leikir</h3>
      <div class="games-list">
        {#each recentGames as g}
          <div class="game-row" class:won={g.player_won} class:lost={!g.player_won}>
            <span class="game-result">{g.player_won ? '✓' : '✗'}</span>
            <span class="game-info">
              <span class="game-diff">{diffLabel(g.difficulty)}</span>
              {#if g.win_type !== 'normal'}
                <span class="game-wintype">{g.win_type === 'gammon' ? 'Gammon' : 'Bakgammon'}</span>
              {/if}
            </span>
            <span class="game-blunders" title="Villur">
              {g.blunder_count > 0 ? `${g.blunder_count} villur` : '✓ hreint'}
            </span>
            <span class="game-turns">{g.total_turns} umf.</span>
            <span class="game-time">{g.duration_seconds ? formatDuration(g.duration_seconds) : '—'}</span>
            <span class="game-date">{formatDate(g.played_at)}</span>
          </div>
        {/each}
      </div>
    </div>

    <!-- Improvement tips -->
    <div class="section tips-section">
      <h3 class="section-title">💡 Tillögur</h3>
      <ul class="tips-list">
        {#if stats.avgBlunders > 3}
          <li>Þú gerir að meðaltali {stats.avgBlunders.toFixed(1)} villur á leik. Reyndu að hugsa lengur áður en þú færir.</li>
        {/if}
        {#if stats.byDifficulty.hard.games > 0 && (stats.byDifficulty.hard.wins / stats.byDifficulty.hard.games) < 0.3}
          <li>Þú átt erfitt gegn erfiðasta stiginu. Prófaðu miðlungs til að byggja upp taktík.</li>
        {/if}
        {#if stats.avgBlunders <= 2 && stats.totalGames >= 10}
          <li>Frábært! Þú gerir fáar villur. Reyndu að einbeita þér að tvöföldunar-ákvörðunum.</li>
        {/if}
        {#if stats.totalGames < 10}
          <li>Spilaðu fleiri leiki til að fá nákvæmari tölfræði (a.m.k. 10 leiki).</li>
        {/if}
      </ul>
    </div>
  {/if}
</div>

<style>
  .stats-container {
    max-width: 700px;
    margin: 0 auto;
    font-family: var(--font-body, sans-serif);
    color: #FAF5F0;
  }

  .loading-state, .not-logged-in, .no-games {
    text-align: center;
    padding: 40px 20px;
    color: rgba(250,245,240,0.6);
  }

  .not-logged-in h2, .no-games h2 {
    color: #FAF5F0;
    margin: 0 0 12px;
    font-size: 1.5rem;
  }

  .hint {
    font-size: 12px;
    opacity: 0.5;
    margin-top: 8px;
  }

  .btn-play {
    display: inline-block;
    margin-top: 16px;
    padding: 10px 28px;
    background: linear-gradient(135deg, #AE445A, #F39F5A);
    color: white;
    text-decoration: none;
    border-radius: 10px;
    font-weight: 600;
    font-size: 14px;
  }

  .spinner { font-size: 24px; }

  .dash-title {
    text-align: center;
    margin: 0 0 20px;
    font-size: 1.5rem;
    font-family: var(--font-heading, var(--font-body, sans-serif));
  }

  /* Stat cards */
  .stat-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
    margin-bottom: 24px;
  }
  .stat-card {
    background: rgba(255,255,255,0.05);
    border-radius: 12px;
    padding: 16px;
    text-align: center;
    border: 1px solid rgba(255,255,255,0.08);
  }
  .stat-value {
    display: block;
    font-size: 1.8rem;
    font-weight: 700;
    color: #F39F5A;
    font-family: var(--font-mono, monospace);
  }
  .stat-label {
    display: block;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: rgba(250,245,240,0.5);
    margin-top: 4px;
  }
  .stat-sub {
    display: block;
    font-size: 10px;
    color: rgba(250,245,240,0.3);
    margin-top: 4px;
    font-family: var(--font-mono, monospace);
  }

  /* Sections */
  .section {
    background: rgba(255,255,255,0.03);
    border-radius: 12px;
    padding: 16px 20px;
    margin-bottom: 16px;
    border: 1px solid rgba(255,255,255,0.06);
  }
  .section-title {
    font-size: 13px;
    font-weight: 700;
    margin: 0 0 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: rgba(250,245,240,0.6);
  }

  /* Difficulty grid */
  .diff-grid { display: flex; flex-direction: column; gap: 8px; }
  .diff-item { display: flex; align-items: center; gap: 10px; }
  .diff-label {
    width: 70px;
    font-size: 12px;
    font-weight: 600;
    color: rgba(250,245,240,0.7);
  }
  .diff-bar-bg {
    flex: 1;
    height: 8px;
    background: rgba(255,255,255,0.08);
    border-radius: 4px;
    overflow: hidden;
  }
  .diff-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #AE445A, #F39F5A);
    border-radius: 4px;
    transition: width 0.5s;
  }
  .diff-stat {
    font-size: 11px;
    font-family: var(--font-mono, monospace);
    color: rgba(250,245,240,0.5);
    min-width: 40px;
    text-align: right;
  }

  /* Trend chart */
  .trend-chart { margin-bottom: 8px; }
  .sparkline {
    font-size: 20px;
    letter-spacing: 2px;
    color: #F39F5A;
    font-family: var(--font-mono, monospace);
  }
  .trend-detail {
    display: flex;
    gap: 16px;
    margin-top: 8px;
    font-size: 11px;
    font-family: var(--font-mono, monospace);
    color: rgba(250,245,240,0.4);
    overflow-x: auto;
  }
  .trend-week { display: flex; flex-direction: column; align-items: center; }
  .trend-date { font-size: 9px; }
  .trend-val { color: #F39F5A; font-weight: 600; }

  .trend-note {
    font-size: 12px;
    margin: 8px 0 0;
    padding: 6px 10px;
    border-radius: 6px;
  }
  .trend-note.positive { background: rgba(39,174,96,0.1); color: #27ae60; }
  .trend-note.negative { background: rgba(231,76,60,0.1); color: #e74c3c; }
  .trend-note.neutral { color: rgba(250,245,240,0.5); }

  /* Games list */
  .games-list { display: flex; flex-direction: column; gap: 4px; }
  .game-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 12px;
    font-family: var(--font-mono, monospace);
  }
  .game-row.won { background: rgba(39,174,96,0.06); }
  .game-row.lost { background: rgba(231,76,60,0.06); }
  .game-result { font-size: 14px; }
  .game-row.won .game-result { color: #27ae60; }
  .game-row.lost .game-result { color: #e74c3c; }
  .game-info { flex: 1; }
  .game-diff {
    font-size: 11px;
    color: rgba(250,245,240,0.6);
  }
  .game-wintype {
    font-size: 10px;
    color: #F39F5A;
    margin-left: 4px;
  }
  .game-blunders {
    font-size: 10px;
    color: rgba(250,245,240,0.4);
  }
  .game-turns {
    font-size: 10px;
    color: rgba(250,245,240,0.3);
  }
  .game-time {
    font-size: 10px;
    color: rgba(250,245,240,0.3);
  }
  .game-date {
    font-size: 10px;
    color: rgba(250,245,240,0.3);
  }

  /* Tips */
  .tips-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .tips-list li {
    font-size: 12px;
    color: rgba(250,245,240,0.7);
    padding: 8px 12px;
    background: rgba(243,159,90,0.06);
    border-radius: 8px;
    border-left: 3px solid #F39F5A;
  }
</style>
