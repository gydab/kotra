<script lang="ts">
  // @ts-ignore — path aliases resolved by Vite at build time
  import { supabase } from '@lib/supabase';
  // @ts-ignore
  import { fetchPlayerStats, fetchRecentGames, fetchBlunderTrend } from '@lib/game-persistence';

  // ─── Props ────────────────────────────────────────────
  interface Props {
    locale?: string;
    profile?: string;
    recentGames?: string;
    weaknesses?: string;
  }
  let { locale = 'is', profile: profileStr = '{}', recentGames: gamesStr = '[]', weaknesses: weaknessStr = '[]' }: Props = $props();

  // ─── State (initialised once from server-rendered props) ───
  // svelte-ignore state_referenced_locally
  const _initProfile = JSON.parse(profileStr as string);
  // svelte-ignore state_referenced_locally
  const _initGames = JSON.parse(gamesStr as string);
  // svelte-ignore state_referenced_locally
  const _initWeaknesses = JSON.parse(weaknessStr as string);

  let activeTab = $state<'overview' | 'games' | 'profile'>('overview');
  let playerProfile = $state(_initProfile);
  let recentGames = $state(_initGames);
  let weaknesses = $state(_initWeaknesses);
  let stats = $state<any>(null);
  let editMode = $state(false);
  let editName = $state(_initProfile?.display_name ?? '');
  let editBio = $state(_initProfile?.bio ?? '');
  let editWbifId = $state(_initProfile?.wbif_id ?? '');
  let saving = $state(false);
  let wbifLinking = $state(false);
  let wbifLinkError = $state('');

  // svelte-ignore state_referenced_locally
  const isIs = (locale as string) === 'is';

  // Fetch client-side stats
  $effect(() => {
    loadStats();
  });

  async function loadStats() {
    const s = await fetchPlayerStats();
    if (s) stats = s;
  }

  async function saveProfile() {
    saving = true;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { saving = false; return; }

    const { error } = await supabase
      .from('player_profiles')
      .update({
        display_name: editName,
        bio: editBio,
        wbif_id: editWbifId || null,
      })
      .eq('id', user.id);

    if (!error) {
      playerProfile = { ...playerProfile, display_name: editName, bio: editBio, wbif_id: editWbifId || null };
      editMode = false;
    }
    saving = false;
  }

  async function linkWbifProfile() {
    if (!editWbifId.trim()) return;
    wbifLinking = true;
    wbifLinkError = '';
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { wbifLinking = false; return; }

    const { error } = await supabase
      .from('player_profiles')
      .update({
        wbif_id: editWbifId.trim(),
        wbif_verified: false,
      })
      .eq('id', user.id);

    if (error) {
      wbifLinkError = isIs ? 'Villa við að tengja WBIF prófíl' : 'Error linking WBIF profile';
    } else {
      playerProfile = { ...playerProfile, wbif_id: editWbifId.trim(), wbif_verified: false };
    }
    wbifLinking = false;
  }

  function formatDate(d: string): string {
    return new Date(d).toLocaleDateString(locale === 'is' ? 'is-IS' : 'en-US', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function diffLabel(d: string): string {
    const labels: Record<string, Record<string, string>> = {
      is: { easy: 'Auðvelt', medium: 'Miðlungs', hard: 'Erfitt' },
      en: { easy: 'Easy', medium: 'Medium', hard: 'Hard' },
    };
    return labels[locale]?.[d] ?? d;
  }
</script>

<div class="dashboard">
  <!-- Tab navigation -->
  <div class="tabs">
    <button class="tab" class:active={activeTab === 'overview'} onclick={() => activeTab = 'overview'}>
      📊 {isIs ? 'Yfirlit' : 'Overview'}
    </button>
    <button class="tab" class:active={activeTab === 'games'} onclick={() => activeTab = 'games'}>
      🎮 {isIs ? 'Leikir' : 'Games'}
    </button>
    <button class="tab" class:active={activeTab === 'profile'} onclick={() => activeTab = 'profile'}>
      👤 {isIs ? 'Próféll' : 'Profile'}
    </button>
  </div>

  <!-- OVERVIEW TAB -->
  {#if activeTab === 'overview'}
    <div class="tab-content">
      <!-- Stats cards -->
      {#if stats}
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">{stats.totalGames}</div>
            <div class="stat-label">{isIs ? 'Heild leikir' : 'Total Games'}</div>
          </div>
          <div class="stat-card accent">
            <div class="stat-value">{stats.winRate}%</div>
            <div class="stat-label">{isIs ? 'Sigurhlutfall' : 'Win Rate'}</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{stats.avgBlunders.toFixed(1)}</div>
            <div class="stat-label">{isIs ? 'Meðal villur' : 'Avg Blunders'}</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{stats.currentWinStreak}</div>
            <div class="stat-label">{isIs ? 'Sigurrás' : 'Win Streak'}</div>
          </div>
        </div>

        <!-- Difficulty breakdown -->
        <div class="section-card">
          <h3>{isIs ? 'Eftir erfiðleikastigi' : 'By Difficulty'}</h3>
          <div class="difficulty-grid">
            {#each ['easy', 'medium', 'hard'] as diff}
              {@const d = stats.byDifficulty[diff]}
              {@const pct = d.games > 0 ? Math.round(100 * d.wins / d.games) : 0}
              <div class="diff-row">
                <span class="diff-label">{diffLabel(diff)}</span>
                <div class="diff-bar-track">
                  <div class="diff-bar-fill" style={`width: ${pct}%`}></div>
                </div>
                <span class="diff-stat">{d.wins}/{d.games} ({pct}%)</span>
              </div>
            {/each}
          </div>
        </div>
      {:else}
        <div class="loading">{isIs ? 'Hleð inn...' : 'Loading...'}</div>
      {/if}

      <!-- Weaknesses / training recommendation -->
      {#if weaknesses.length > 0}
        <div class="section-card weaknesses">
          <h3>🎯 {isIs ? 'Veikleikar þínir' : 'Your Weaknesses'}</h3>
          <p class="section-subtitle">{isIs ? 'Byggt á leikjunum þínum' : 'Based on your games'}</p>
          <div class="weakness-list">
            {#each weaknesses as w, idx}
              <div class="weakness-item" class:top-priority={idx === 0}>
                <div class="weakness-rank">{idx + 1}</div>
                <div class="weakness-info">
                  <span class="weakness-category">{isIs ? (w.name_is ?? w.category_id) : (w.name_en ?? w.category_id)}</span>
                  <span class="weakness-stats">
                    {w.blunder_count} {isIs ? 'villur' : 'blunders'} · {isIs ? 'meðaltap' : 'avg loss'}: {w.avg_score_loss?.toFixed(1)}
                  </span>
                </div>
                <a href={`/${locale}/thjalfun#${w.category_id}`} class="weakness-cta">
                  {isIs ? 'Æfa' : 'Practice'} →
                </a>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Quick actions -->
      <div class="actions-grid">
        <a href={`/${locale}/spila`} class="action-card play">
          🎲 {isIs ? 'Spila nú' : 'Play Now'}
        </a>
        <a href={`/${locale}/thjalfun`} class="action-card train">
          📘 {isIs ? 'Hefja þjálfun' : 'Start Training'}
        </a>
      </div>
    </div>
  {/if}

  <!-- GAMES TAB -->
  {#if activeTab === 'games'}
    <div class="tab-content">
      <h2>{isIs ? 'Leikjasaga' : 'Game History'}</h2>

      {#if recentGames.length === 0}
        <div class="empty-state">
          <p>{isIs ? 'Þú hefur ekki spilað neina leiki ennþá.' : 'You haven\'t played any games yet.'}</p>
          <a href={`/${locale}/spila`} class="btn-primary">{isIs ? 'Spila nú' : 'Play Now'}</a>
        </div>
      {:else}
        <div class="games-table-wrapper">
          <table class="games-table">
            <thead>
              <tr>
                <th>{isIs ? 'Dagsetning' : 'Date'}</th>
                <th>{isIs ? 'Erfiðleiki' : 'Difficulty'}</th>
                <th>{isIs ? 'Úrslit' : 'Result'}</th>
                <th>{isIs ? 'Tegund' : 'Type'}</th>
                <th>{isIs ? 'Villur' : 'Blunders'}</th>
                <th>{isIs ? 'Lengd' : 'Duration'}</th>
                <th>{isIs ? 'Leikir' : 'Turns'}</th>
              </tr>
            </thead>
            <tbody>
              {#each recentGames as game}
                <tr class:won={game.player_won} class:lost={!game.player_won}>
                  <td>{formatDate(game.played_at)}</td>
                  <td>
                    <span class="badge diff-{game.difficulty}">{diffLabel(game.difficulty)}</span>
                  </td>
                  <td>
                    <span class="result-badge" class:win={game.player_won} class:loss={!game.player_won}>
                      {game.player_won ? (isIs ? 'Sigur' : 'Won') : (isIs ? 'Tap' : 'Lost')}
                    </span>
                  </td>
                  <td class="type-cell">
                    {game.win_type === 'gammon' ? '🎯 Gammon' : game.win_type === 'backgammon' ? '💥 BG' : 'Normal'}
                    {game.final_cube_value > 1 ? ` ×${game.final_cube_value}` : ''}
                  </td>
                  <td>
                    <span class="blunder-count" class:high={game.blunder_count > 3} class:zero={game.blunder_count === 0}>
                      {game.blunder_count}
                    </span>
                  </td>
                  <td>{formatDuration(game.duration_seconds)}</td>
                  <td>{game.total_turns}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  {/if}

  <!-- PROFILE TAB -->
  {#if activeTab === 'profile'}
    <div class="tab-content">
      <div class="profile-card">
        <div class="profile-header">
          <div class="profile-avatar">
            {#if playerProfile?.avatar_url}
              <img src={playerProfile.avatar_url} alt="Avatar" />
            {:else}
              <span class="avatar-placeholder">👤</span>
            {/if}
          </div>
          <div class="profile-info">
            {#if editMode}
              <input type="text" class="profile-input" bind:value={editName} placeholder={isIs ? 'Nafn' : 'Name'} />
            {:else}
              <h2>{playerProfile?.display_name || (isIs ? 'Nafnlaus' : 'Anonymous')}</h2>
            {/if}
            <span class="profile-email">{playerProfile?.email ?? ''}</span>
          </div>
          <button class="btn-edit" onclick={() => { editMode = !editMode; if (editMode) { editName = playerProfile?.display_name ?? ''; editBio = playerProfile?.bio ?? ''; }}}>
            {editMode ? (isIs ? 'Hætta við' : 'Cancel') : (isIs ? 'Breyta' : 'Edit')}
          </button>
        </div>

        {#if editMode}
          <div class="profile-edit-form">
            <label>
              {isIs ? 'Um mig' : 'About me'}
              <textarea class="profile-textarea" bind:value={editBio} rows="3" placeholder={isIs ? 'Segðu frá þér...' : 'Tell us about yourself...'}></textarea>
            </label>
            <button class="btn-save" onclick={saveProfile} disabled={saving}>
              {saving ? '⏳' : (isIs ? '💾 Vista' : '💾 Save')}
            </button>
          </div>
        {:else}
          {#if playerProfile?.bio}
            <p class="profile-bio">{playerProfile.bio}</p>
          {/if}
        {/if}

        <div class="profile-meta">
          <div class="meta-item">
            <span class="meta-label">{isIs ? 'Stig' : 'Level'}</span>
            <span class="meta-value">{playerProfile?.training_level ?? 'beginner'}</span>
          </div>
          {#if playerProfile?.bg_heroes_nick}
            <div class="meta-item">
              <span class="meta-label">BG Heroes</span>
              <span class="meta-value">{playerProfile.bg_heroes_nick}</span>
            </div>
          {/if}
          {#if playerProfile?.bg_galaxy_nick}
            <div class="meta-item">
              <span class="meta-label">BG Galaxy</span>
              <span class="meta-value">{playerProfile.bg_galaxy_nick}</span>
            </div>
          {/if}
        </div>
      </div>

      <!-- WBIF Profile Link -->
      <div class="wbif-section">
        <h3>🌐 {isIs ? 'WBIF prófíll' : 'WBIF Profile'}</h3>
        <p class="wbif-description">
          {isIs
            ? 'Tengdu WBIF (World Backgammon Internet Federation) prófílinn þinn til að sýna rating og tölfræði.'
            : 'Link your WBIF (World Backgammon Internet Federation) profile to show your rating and stats.'}
        </p>

        {#if playerProfile?.wbif_id}
          <!-- WBIF is linked -->
          <div class="wbif-linked">
            <div class="wbif-linked-info">
              <span class="wbif-linked-badge">✓ {isIs ? 'Tengt' : 'Linked'}</span>
              <span class="wbif-linked-id">WBIF ID: {playerProfile.wbif_id}</span>
            </div>
            <a
              href={`https://matches.wbif.net/wbif/matchlog?id=${playerProfile.wbif_id}`}
              target="_blank"
              rel="noopener noreferrer"
              class="wbif-view-link"
            >
              {isIs ? 'Skoða á WBIF' : 'View on WBIF'} ↗
            </a>
          </div>
        {:else}
          <!-- WBIF not linked – show link form -->
          <div class="wbif-link-form">
            <p class="wbif-help-text">
              {isIs
                ? 'Finndu WBIF ID-ið þitt á '
                : 'Find your WBIF ID at '}
              <a href="https://matches.wbif.net/wbif/ratings" target="_blank" rel="noopener noreferrer" class="wbif-help-link">
                matches.wbif.net
              </a>
              {isIs ? ' (númerið í slóðinni).' : ' (the number in the URL).'}
            </p>
            <div class="wbif-input-row">
              <input
                type="text"
                class="wbif-input"
                bind:value={editWbifId}
                placeholder={isIs ? 'WBIF ID (t.d. 3286)' : 'WBIF ID (e.g. 3286)'}
              />
              <button
                class="wbif-link-btn"
                onclick={linkWbifProfile}
                disabled={wbifLinking || !editWbifId.trim()}
              >
                {wbifLinking ? '⏳' : (isIs ? 'Tengja' : 'Link')}
              </button>
            </div>
            {#if wbifLinkError}
              <p class="wbif-error">{wbifLinkError}</p>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .dashboard { font-family: var(--font-body, sans-serif); }

  /* Tabs */
  .tabs {
    display: flex; gap: 4px; margin-bottom: 24px;
    background: rgba(0,0,0,0.3); border-radius: 12px; padding: 4px;
  }
  .tab {
    flex: 1; padding: 10px 16px; border: none; border-radius: 8px;
    background: transparent; color: rgba(250,245,240,0.5);
    font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit;
    transition: all 0.15s;
  }
  .tab.active { background: rgba(243,159,90,0.2); color: #F39F5A; }
  .tab:hover:not(.active) { color: rgba(250,245,240,0.8); }

  .tab-content { animation: fadeIn 0.2s ease; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

  /* Stats grid */
  .stats-grid {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px;
  }
  .stat-card {
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px; padding: 16px; text-align: center;
  }
  .stat-card.accent { border-color: rgba(243,159,90,0.3); background: rgba(243,159,90,0.08); }
  .stat-value { font-size: 28px; font-weight: 700; color: #FAF5F0; }
  .stat-card.accent .stat-value { color: #F39F5A; }
  .stat-label { font-size: 11px; color: rgba(250,245,240,0.5); margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }

  /* Section cards */
  .section-card {
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px; padding: 20px; margin-bottom: 20px;
  }
  .section-card h3 { color: #FAF5F0; font-size: 16px; margin: 0 0 4px; }
  .section-subtitle { color: rgba(250,245,240,0.4); font-size: 12px; margin: 0 0 16px; }

  /* Difficulty breakdown */
  .difficulty-grid { display: flex; flex-direction: column; gap: 10px; }
  .diff-row { display: flex; align-items: center; gap: 12px; }
  .diff-label { color: rgba(250,245,240,0.7); font-size: 13px; min-width: 80px; }
  .diff-bar-track { flex: 1; height: 8px; background: rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden; }
  .diff-bar-fill { height: 100%; background: linear-gradient(90deg, #AE445A, #F39F5A); border-radius: 4px; transition: width 0.5s ease; }
  .diff-stat { color: rgba(250,245,240,0.5); font-size: 12px; min-width: 90px; text-align: right; }

  /* Weaknesses */
  .weakness-list { display: flex; flex-direction: column; gap: 8px; }
  .weakness-item {
    display: flex; align-items: center; gap: 12px; padding: 10px 14px;
    background: rgba(0,0,0,0.15); border-radius: 8px; transition: background 0.15s;
  }
  .weakness-item:hover { background: rgba(0,0,0,0.25); }
  .weakness-item.top-priority { border-left: 3px solid #F39F5A; }
  .weakness-rank { width: 24px; height: 24px; border-radius: 50%; background: rgba(243,159,90,0.2); color: #F39F5A; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; }
  .weakness-info { flex: 1; }
  .weakness-category { display: block; color: #FAF5F0; font-size: 14px; font-weight: 600; }
  .weakness-stats { display: block; color: rgba(250,245,240,0.4); font-size: 11px; margin-top: 2px; }
  .weakness-cta {
    color: #F39F5A; font-size: 12px; font-weight: 600;
    text-decoration: none; padding: 4px 10px; border-radius: 6px;
    background: rgba(243,159,90,0.1); transition: all 0.15s;
  }
  .weakness-cta:hover { background: rgba(243,159,90,0.2); }

  /* Action cards */
  .actions-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 20px; }
  .action-card {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 16px; border-radius: 12px; font-size: 15px; font-weight: 600;
    text-decoration: none; transition: all 0.2s; cursor: pointer;
  }
  .action-card.play { background: linear-gradient(135deg, #AE445A, #F39F5A); color: white; }
  .action-card.play:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(174,68,90,0.4); }
  .action-card.train { background: rgba(255,255,255,0.08); color: #FAF5F0; border: 1px solid rgba(255,255,255,0.12); }
  .action-card.train:hover { background: rgba(255,255,255,0.12); }

  /* Games table */
  h2 { color: #FAF5F0; font-size: 20px; margin: 0 0 16px; }
  .games-table-wrapper { overflow-x: auto; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); }
  .games-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .games-table th {
    text-align: left; padding: 10px 14px; font-size: 11px; font-weight: 600;
    color: rgba(250,245,240,0.4); text-transform: uppercase; letter-spacing: 0.5px;
    background: rgba(0,0,0,0.2); border-bottom: 1px solid rgba(255,255,255,0.08);
  }
  .games-table td { padding: 10px 14px; color: rgba(250,245,240,0.8); border-bottom: 1px solid rgba(255,255,255,0.04); }
  .games-table tr:hover td { background: rgba(255,255,255,0.03); }

  .badge {
    display: inline-flex; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600;
  }
  .badge.diff-easy { background: rgba(39,174,96,0.15); color: #27ae60; }
  .badge.diff-medium { background: rgba(243,159,90,0.15); color: #F39F5A; }
  .badge.diff-hard { background: rgba(174,68,90,0.15); color: #AE445A; }

  .result-badge { display: inline-flex; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; }
  .result-badge.win { background: rgba(39,174,96,0.15); color: #27ae60; }
  .result-badge.loss { background: rgba(231,76,60,0.15); color: #e74c3c; }

  .type-cell { font-size: 12px; }
  .blunder-count { font-weight: 600; }
  .blunder-count.high { color: #e74c3c; }
  .blunder-count.zero { color: #27ae60; }

  .empty-state { text-align: center; padding: 40px 20px; color: rgba(250,245,240,0.5); }
  .empty-state p { margin-bottom: 16px; }
  .btn-primary {
    display: inline-flex; padding: 10px 24px; border-radius: 10px;
    background: linear-gradient(135deg, #AE445A, #F39F5A); color: white;
    font-weight: 600; text-decoration: none; transition: all 0.15s;
  }
  .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(174,68,90,0.3); }

  /* Profile */
  .profile-card {
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px; padding: 24px;
  }
  .profile-header { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
  .profile-avatar { width: 64px; height: 64px; border-radius: 50%; overflow: hidden; background: rgba(243,159,90,0.2); display: flex; align-items: center; justify-content: center; }
  .profile-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .avatar-placeholder { font-size: 28px; }
  .profile-info { flex: 1; }
  .profile-info h2 { margin: 0; font-size: 20px; }
  .profile-email { color: rgba(250,245,240,0.4); font-size: 12px; }
  .profile-input {
    width: 100%; padding: 8px 12px; border: 1px solid rgba(250,245,240,0.15);
    border-radius: 8px; background: rgba(0,0,0,0.2); color: #FAF5F0;
    font-size: 16px; font-family: inherit; box-sizing: border-box;
  }
  .profile-input:focus { outline: none; border-color: #F39F5A; }
  .btn-edit {
    padding: 6px 14px; border: 1px solid rgba(250,245,240,0.2); border-radius: 8px;
    background: transparent; color: rgba(250,245,240,0.6); font-size: 12px;
    cursor: pointer; font-family: inherit; transition: all 0.15s;
  }
  .btn-edit:hover { background: rgba(255,255,255,0.1); color: #FAF5F0; }

  .profile-edit-form { margin-bottom: 20px; }
  .profile-edit-form label { display: block; color: rgba(250,245,240,0.5); font-size: 12px; font-weight: 600; margin-bottom: 4px; }
  .profile-textarea {
    width: 100%; padding: 10px 12px; border: 1px solid rgba(250,245,240,0.15);
    border-radius: 8px; background: rgba(0,0,0,0.2); color: #FAF5F0;
    font-size: 13px; font-family: inherit; resize: vertical; box-sizing: border-box;
  }
  .profile-textarea:focus { outline: none; border-color: #F39F5A; }
  .btn-save {
    margin-top: 10px; padding: 8px 20px; border: none; border-radius: 8px;
    background: linear-gradient(135deg, #AE445A, #F39F5A); color: white;
    font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.15s;
  }
  .btn-save:hover:not(:disabled) { transform: translateY(-1px); }
  .btn-save:disabled { opacity: 0.5; }

  .profile-bio { color: rgba(250,245,240,0.7); font-size: 14px; line-height: 1.6; margin-bottom: 20px; }

  .profile-meta { display: flex; gap: 24px; flex-wrap: wrap; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.08); }
  .meta-item { display: flex; flex-direction: column; gap: 2px; }
  .meta-label { font-size: 10px; color: rgba(250,245,240,0.4); text-transform: uppercase; letter-spacing: 0.5px; }
  .meta-value { font-size: 14px; color: #FAF5F0; font-weight: 500; }

  .loading { text-align: center; padding: 40px; color: rgba(250,245,240,0.5); }

  /* WBIF section */
  .wbif-section {
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px; padding: 24px; margin-top: 16px;
  }
  .wbif-section h3 { color: #FAF5F0; font-size: 16px; margin: 0 0 6px; }
  .wbif-description { color: rgba(250,245,240,0.5); font-size: 13px; margin: 0 0 16px; line-height: 1.5; }

  .wbif-linked {
    display: flex; align-items: center; justify-content: space-between;
    background: rgba(39,174,96,0.08); border: 1px solid rgba(39,174,96,0.2);
    border-radius: 10px; padding: 14px 18px;
  }
  .wbif-linked-info { display: flex; align-items: center; gap: 12px; }
  .wbif-linked-badge {
    display: inline-flex; align-items: center; gap: 4px;
    background: rgba(39,174,96,0.15); color: #27ae60;
    padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 600;
  }
  .wbif-linked-id { color: rgba(250,245,240,0.6); font-size: 13px; font-family: var(--font-mono, monospace); }
  .wbif-view-link {
    color: #F39F5A; font-size: 13px; font-weight: 600;
    text-decoration: none; transition: color 0.15s;
  }
  .wbif-view-link:hover { color: #FAF5F0; }

  .wbif-link-form { margin-top: 4px; }
  .wbif-help-text { color: rgba(250,245,240,0.4); font-size: 12px; margin: 0 0 10px; }
  .wbif-help-link { color: #F39F5A; text-decoration: none; }
  .wbif-help-link:hover { text-decoration: underline; }

  .wbif-input-row { display: flex; gap: 8px; }
  .wbif-input {
    flex: 1; padding: 8px 14px; border: 1px solid rgba(250,245,240,0.15);
    border-radius: 8px; background: rgba(0,0,0,0.2); color: #FAF5F0;
    font-size: 14px; font-family: var(--font-mono, monospace); box-sizing: border-box;
  }
  .wbif-input:focus { outline: none; border-color: #F39F5A; }
  .wbif-input::placeholder { color: rgba(250,245,240,0.25); font-family: inherit; }
  .wbif-link-btn {
    padding: 8px 20px; border: none; border-radius: 8px;
    background: linear-gradient(135deg, #AE445A, #F39F5A); color: white;
    font-weight: 600; font-size: 13px; cursor: pointer; font-family: inherit;
    transition: all 0.15s; white-space: nowrap;
  }
  .wbif-link-btn:hover:not(:disabled) { transform: translateY(-1px); }
  .wbif-link-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .wbif-error { color: #e74c3c; font-size: 12px; margin-top: 8px; }

  /* Responsive */
  @media (max-width: 768px) {
    .stats-grid { grid-template-columns: repeat(2, 1fr); }
    .actions-grid { grid-template-columns: 1fr; }
    .profile-header { flex-wrap: wrap; }
  }
</style>
