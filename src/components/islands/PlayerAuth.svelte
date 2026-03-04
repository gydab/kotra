<script lang="ts">
  import { supabase } from '@lib/supabase';

  // ─── State ────────────────────────────────────────────

  let isLoggedIn = $state(false);
  let userName = $state('');
  let userId = $state('');
  let showAuthPanel = $state(false);
  let authMode = $state<'login' | 'signup'>('login');
  let email = $state('');
  let password = $state('');
  let displayName = $state('');
  let authError = $state('');
  let authLoading = $state(false);

  // Check session on mount
  $effect(() => {
    checkSession();
  });

  async function checkSession() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        isLoggedIn = true;
        userId = user.id;
        userName = user.user_metadata?.display_name || user.email?.split('@')[0] || 'Leikmaður';
      }
    } catch {
      // Not logged in
    }
  }

  async function handleLogin() {
    authError = '';
    authLoading = true;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    authLoading = false;
    if (error) {
      authError = error.message === 'Invalid login credentials'
        ? 'Rangt netfang eða lykilorð'
        : error.message;
      return;
    }
    if (data.user) {
      isLoggedIn = true;
      userId = data.user.id;
      userName = data.user.user_metadata?.display_name || email.split('@')[0];
      showAuthPanel = false;
      resetForm();
    }
  }

  async function handleSignup() {
    authError = '';
    authLoading = true;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName || email.split('@')[0] },
      },
    });
    authLoading = false;
    if (error) {
      authError = error.message;
      return;
    }
    if (data.user) {
      isLoggedIn = true;
      userId = data.user.id;
      userName = displayName || email.split('@')[0];
      showAuthPanel = false;
      resetForm();
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    isLoggedIn = false;
    userId = '';
    userName = '';
  }

  function resetForm() {
    email = '';
    password = '';
    displayName = '';
    authError = '';
  }

  function togglePanel() {
    showAuthPanel = !showAuthPanel;
    if (showAuthPanel) {
      resetForm();
      authMode = 'login';
    }
  }
</script>

<div class="player-auth">
  {#if isLoggedIn}
    <!-- Logged in: show user badge -->
    <div class="user-badge">
      <span class="user-avatar">👤</span>
      <span class="user-name">{userName}</span>
      <button class="btn-logout" onclick={handleLogout}>Útskrá</button>
    </div>
    <p class="save-notice">✓ Leikir þínir eru vistaðir</p>
  {:else}
    <!-- Not logged in: invite to log in -->
    <button class="btn-auth-toggle" onclick={togglePanel}>
      🔑 Skráðu þig inn til að vista leiki
    </button>

    {#if showAuthPanel}
      <div class="auth-panel">
        <!-- Tab switcher -->
        <div class="auth-tabs">
          <button
            class="auth-tab"
            class:active={authMode === 'login'}
            onclick={() => { authMode = 'login'; authError = ''; }}
          >Innskráning</button>
          <button
            class="auth-tab"
            class:active={authMode === 'signup'}
            onclick={() => { authMode = 'signup'; authError = ''; }}
          >Nýskráning</button>
        </div>

        <form onsubmit={(e) => { e.preventDefault(); authMode === 'login' ? handleLogin() : handleSignup(); }}>
          {#if authMode === 'signup'}
            <label class="auth-label">
              Nafn
              <input
                type="text"
                class="auth-input"
                bind:value={displayName}
                placeholder="Nafnið þitt"
              />
            </label>
          {/if}

          <label class="auth-label">
            Netfang
            <input
              type="email"
              class="auth-input"
              bind:value={email}
              placeholder="þú@dæmi.is"
              required
            />
          </label>

          <label class="auth-label">
            Lykilorð
            <input
              type="password"
              class="auth-input"
              bind:value={password}
              placeholder="••••••••"
              minlength="6"
              required
            />
          </label>

          {#if authError}
            <p class="auth-error">{authError}</p>
          {/if}

          <button type="submit" class="btn-auth-submit" disabled={authLoading}>
            {#if authLoading}
              ⏳ Augnablik...
            {:else}
              {authMode === 'login' ? '→ Skrá inn' : '→ Stofna aðgang'}
            {/if}
          </button>
        </form>

        <p class="auth-note">
          {#if authMode === 'login'}
            Engin aðgangur? <button class="link-btn" onclick={() => authMode = 'signup'}>Stofna nýjan</button>
          {:else}
            Ertu nú þegar með aðgang? <button class="link-btn" onclick={() => authMode = 'login'}>Skrá inn</button>
          {/if}
        </p>
      </div>
    {/if}
  {/if}
</div>

<style>
  .player-auth {
    margin-top: 16px;
    font-family: var(--font-body, sans-serif);
  }

  .user-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    background: rgba(255,255,255,0.05);
    border-radius: 10px;
    color: #FAF5F0;
    font-size: 13px;
  }

  .user-avatar { font-size: 16px; }
  .user-name { font-weight: 600; }

  .btn-logout {
    margin-left: auto;
    padding: 4px 12px;
    border: 1px solid rgba(250,245,240,0.2);
    border-radius: 6px;
    background: transparent;
    color: rgba(250,245,240,0.6);
    font-size: 11px;
    cursor: pointer;
    font-family: inherit;
  }
  .btn-logout:hover {
    background: rgba(255,255,255,0.1);
    color: #FAF5F0;
  }

  .save-notice {
    margin: 6px 0 0;
    font-size: 11px;
    color: #27ae60;
    opacity: 0.8;
  }

  .btn-auth-toggle {
    display: block;
    width: 100%;
    padding: 10px 16px;
    border: 1.5px dashed rgba(243,159,90,0.3);
    border-radius: 10px;
    background: rgba(243,159,90,0.05);
    color: rgba(243,159,90,0.8);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .btn-auth-toggle:hover {
    border-color: rgba(243,159,90,0.5);
    background: rgba(243,159,90,0.1);
    color: #F39F5A;
  }

  .auth-panel {
    margin-top: 12px;
    background: linear-gradient(135deg, #2D1B33, #3a2242);
    border: 1px solid rgba(243,159,90,0.2);
    border-radius: 12px;
    padding: 20px;
  }

  .auth-tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 16px;
    background: rgba(0,0,0,0.2);
    border-radius: 8px;
    padding: 3px;
  }
  .auth-tab {
    flex: 1;
    padding: 7px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: rgba(250,245,240,0.5);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .auth-tab.active {
    background: rgba(243,159,90,0.2);
    color: #F39F5A;
  }

  .auth-label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    color: rgba(250,245,240,0.5);
    margin-bottom: 10px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .auth-input {
    display: block;
    width: 100%;
    margin-top: 4px;
    padding: 8px 12px;
    border: 1px solid rgba(250,245,240,0.15);
    border-radius: 8px;
    background: rgba(0,0,0,0.2);
    color: #FAF5F0;
    font-size: 13px;
    font-family: inherit;
    box-sizing: border-box;
  }
  .auth-input:focus {
    outline: none;
    border-color: #F39F5A;
    box-shadow: 0 0 0 2px rgba(243,159,90,0.15);
  }

  .auth-error {
    margin: 0 0 10px;
    padding: 8px 12px;
    border-radius: 8px;
    background: rgba(231,76,60,0.15);
    color: #e74c3c;
    font-size: 12px;
  }

  .btn-auth-submit {
    display: block;
    width: 100%;
    padding: 10px;
    border: none;
    border-radius: 10px;
    background: linear-gradient(135deg, #AE445A, #F39F5A);
    color: white;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .btn-auth-submit:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(174,68,90,0.3);
  }
  .btn-auth-submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .auth-note {
    margin: 12px 0 0;
    text-align: center;
    font-size: 11px;
    color: rgba(250,245,240,0.4);
  }

  .link-btn {
    background: none;
    border: none;
    color: #F39F5A;
    cursor: pointer;
    font-size: 11px;
    text-decoration: underline;
    font-family: inherit;
    padding: 0;
  }
</style>
