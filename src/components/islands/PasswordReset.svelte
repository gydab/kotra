<script lang="ts">
  import { supabase } from '../../lib/supabase';

  // Props
  let { locale = 'is' } = $props<{ locale?: string }>();

  let newPassword = $state('');
  let confirmPassword = $state('');
  let error = $state('');
  let success = $state(false);
  let loading = $state(false);
  let sessionReady = $state(false);

  const currentLocale = locale;
  const labels = currentLocale === 'is' ? {
    newPassword: 'Nýtt lykilorð',
    confirmPassword: 'Staðfesta lykilorð',
    placeholder: '••••••••',
    submit: 'Vista nýtt lykilorð',
    success: 'Lykilorðið þitt hefur verið uppfært! Þú getur nú skráð þig inn.',
    goToLogin: '← Til baka á mína síðu',
    mismatch: 'Lykilorðin stemma ekki.',
    tooShort: 'Lykilorð verður að vera a.m.k. 6 stafir.',
    processing: 'Augnablik...',
    noToken: 'Enginn endursetjingartengill fannst. Reyndu aftur.',
  } : {
    newPassword: 'New Password',
    confirmPassword: 'Confirm Password',
    placeholder: '••••••••',
    submit: 'Save New Password',
    success: 'Your password has been updated! You can now sign in.',
    goToLogin: '← Back to My Page',
    mismatch: 'Passwords do not match.',
    tooShort: 'Password must be at least 6 characters.',
    processing: 'Processing...',
    noToken: 'No reset link found. Please try again.',
  };

  // On mount, try to recover the session from the URL hash
  $effect(() => {
    recoverSession();
  });

  async function recoverSession() {
    // Supabase puts tokens in the hash fragment
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const type = params.get('type');

      if (accessToken && refreshToken && type === 'recovery') {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!sessionError) {
          sessionReady = true;
          return;
        }
      }
    }

    // Also check if there's already a session (e.g. from PKCE flow)
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      sessionReady = true;
    }
  }

  async function handleSubmit() {
    error = '';

    if (newPassword.length < 6) {
      error = labels.tooShort;
      return;
    }

    if (newPassword !== confirmPassword) {
      error = labels.mismatch;
      return;
    }

    loading = true;

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    loading = false;

    if (updateError) {
      error = updateError.message;
      return;
    }

    success = true;
  }
</script>

<div class="reset-container">
  {#if success}
    <div class="success-box">
      <span class="success-icon">✅</span>
      <p class="success-text">{labels.success}</p>
      <a href={`/${currentLocale}/minsida`} class="back-link">{labels.goToLogin}</a>
    </div>
  {:else}
    <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
      <label class="field-label">
        {labels.newPassword}
        <input
          type="password"
          class="field-input"
          bind:value={newPassword}
          placeholder={labels.placeholder}
          minlength="6"
          required
        />
      </label>

      <label class="field-label">
        {labels.confirmPassword}
        <input
          type="password"
          class="field-input"
          bind:value={confirmPassword}
          placeholder={labels.placeholder}
          minlength="6"
          required
        />
      </label>

      {#if error}
        <p class="error-msg">{error}</p>
      {/if}

      <button type="submit" class="submit-btn" disabled={loading}>
        {#if loading}
          ⏳ {labels.processing}
        {:else}
          → {labels.submit}
        {/if}
      </button>
    </form>
  {/if}
</div>

<style>
  .reset-container {
    background: linear-gradient(135deg, #2D1B33, #3a2242);
    border: 1px solid rgba(243,159,90,0.2);
    border-radius: 12px;
    padding: 28px;
  }

  .field-label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    color: rgba(250,245,240,0.5);
    margin-bottom: 14px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .field-input {
    display: block;
    width: 100%;
    margin-top: 4px;
    padding: 10px 12px;
    border: 1px solid rgba(250,245,240,0.15);
    border-radius: 8px;
    background: rgba(0,0,0,0.2);
    color: #FAF5F0;
    font-size: 14px;
    font-family: inherit;
    box-sizing: border-box;
  }
  .field-input:focus {
    outline: none;
    border-color: #F39F5A;
    box-shadow: 0 0 0 2px rgba(243,159,90,0.15);
  }

  .error-msg {
    margin: 0 0 12px;
    padding: 10px 14px;
    border-radius: 8px;
    background: rgba(231,76,60,0.15);
    color: #e74c3c;
    font-size: 13px;
  }

  .submit-btn {
    display: block;
    width: 100%;
    padding: 12px;
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
  .submit-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(174,68,90,0.3);
  }
  .submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .success-box {
    text-align: center;
    padding: 16px 0;
  }
  .success-icon {
    font-size: 48px;
    display: block;
    margin-bottom: 12px;
  }
  .success-text {
    color: #27ae60;
    font-size: 14px;
    margin: 0 0 20px;
    line-height: 1.5;
  }
  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #F39F5A;
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
    transition: color 0.15s;
  }
  .back-link:hover {
    color: #FAF5F0;
  }
</style>
