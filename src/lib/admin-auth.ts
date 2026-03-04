import type { AstroGlobal } from 'astro';
import { supabase } from '@lib/supabase';

// ─── Types ──────────────────────────────────────────────

export type AdminRole = 'admin' | 'editor' | 'tournament_director';

export interface AdminUser {
  id: string;
  email: string;
  display_name: string | null;
  role: AdminRole;
}

export interface PlayerUser {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  training_level: string;
  onboarding_complete: boolean;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
}

// ─── Cookie helpers ─────────────────────────────────────

function refreshCookies(Astro: AstroGlobal, session: { access_token: string; refresh_token: string }) {
  Astro.cookies.set('sb-access-token', session.access_token, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60, // 1 hour
  });
  Astro.cookies.set('sb-refresh-token', session.refresh_token, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

// ─── Session validation ─────────────────────────────────

/**
 * Get the authenticated Supabase user from cookies.
 * Returns the base auth user or null.
 */
export async function getAuthUser(Astro: AstroGlobal): Promise<AuthenticatedUser | null> {
  const accessToken = Astro.cookies.get('sb-access-token')?.value;
  const refreshToken = Astro.cookies.get('sb-refresh-token')?.value;

  if (!accessToken || !refreshToken) {
    return null;
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (sessionError || !sessionData.user) {
    return null;
  }

  // Refresh cookies if session was refreshed
  if (sessionData.session) {
    refreshCookies(Astro, sessionData.session);
  }

  return {
    id: sessionData.user.id,
    email: sessionData.user.email ?? '',
  };
}

// ─── Admin auth ─────────────────────────────────────────

/**
 * Check if the current request has a valid admin session.
 * Returns the admin user if authenticated, or null if not.
 */
export async function getAdminUser(Astro: AstroGlobal): Promise<AdminUser | null> {
  const authUser = await getAuthUser(Astro);
  if (!authUser) return null;

  // Check if user is in admin_profiles
  const { data: adminProfile, error: profileError } = await supabase
    .from('admin_profiles')
    .select('*')
    .eq('id', authUser.id)
    .single();

  if (profileError || !adminProfile) {
    return null;
  }

  return {
    id: adminProfile.id,
    email: adminProfile.email,
    display_name: adminProfile.display_name,
    role: adminProfile.role as AdminRole,
  };
}

/**
 * Require admin authentication. Redirects to login if not authenticated.
 */
export async function requireAdmin(Astro: AstroGlobal): Promise<AdminUser> {
  const user = await getAdminUser(Astro);
  if (!user) {
    return Astro.redirect('/admin/login') as never;
  }
  return user;
}

/**
 * Require a specific admin role. Accepts multiple allowed roles.
 */
export async function requireRole(Astro: AstroGlobal, allowedRoles: AdminRole[]): Promise<AdminUser> {
  const user = await requireAdmin(Astro);
  if (!allowedRoles.includes(user.role)) {
    return Astro.redirect('/admin?error=unauthorized') as never;
  }
  return user;
}

/**
 * Check if user is an admin (full access).
 */
export function isFullAdmin(user: AdminUser): boolean {
  return user.role === 'admin';
}

/**
 * Check if user can manage tournaments.
 */
export function canManageTournaments(user: AdminUser): boolean {
  return user.role === 'admin' || user.role === 'tournament_director';
}

// ─── Player auth (for SSR pages) ────────────────────────

/**
 * Get logged-in player profile for SSR pages.
 */
export async function getPlayerUser(Astro: AstroGlobal): Promise<PlayerUser | null> {
  const authUser = await getAuthUser(Astro);
  if (!authUser) return null;

  const { data: profile, error } = await supabase
    .from('player_profiles')
    .select('*')
    .eq('id', authUser.id)
    .single();

  if (error || !profile) return null;

  return {
    id: profile.id,
    email: authUser.email,
    display_name: profile.display_name ?? '',
    avatar_url: profile.avatar_url,
    training_level: profile.training_level ?? 'beginner',
    onboarding_complete: profile.onboarding_complete ?? false,
  };
}

/**
 * Require player authentication. Redirects to login if not authenticated.
 */
export async function requirePlayer(Astro: AstroGlobal, locale = 'is'): Promise<PlayerUser> {
  const player = await getPlayerUser(Astro);
  if (!player) {
    return Astro.redirect(`/${locale}/spila?login=required`) as never;
  }
  return player;
}
