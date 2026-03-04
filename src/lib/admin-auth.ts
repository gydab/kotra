import type { AstroGlobal } from 'astro';
import { supabase } from '@lib/supabase';

export interface AdminUser {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
}

/**
 * Check if the current request has a valid admin session.
 * Returns the admin user if authenticated, or null if not.
 */
export async function getAdminUser(Astro: AstroGlobal): Promise<AdminUser | null> {
  const accessToken = Astro.cookies.get('sb-access-token')?.value;
  const refreshToken = Astro.cookies.get('sb-refresh-token')?.value;

  if (!accessToken || !refreshToken) {
    return null;
  }

  // Set the session from cookies
  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (sessionError || !sessionData.user) {
    return null;
  }

  // Check if user is in admin_profiles
  const { data: adminProfile, error: profileError } = await supabase
    .from('admin_profiles')
    .select('*')
    .eq('id', sessionData.user.id)
    .single();

  if (profileError || !adminProfile) {
    return null;
  }

  // Refresh cookies if tokens were refreshed
  if (sessionData.session) {
    Astro.cookies.set('sb-access-token', sessionData.session.access_token, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60, // 1 hour
    });
    Astro.cookies.set('sb-refresh-token', sessionData.session.refresh_token, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
  }

  return {
    id: adminProfile.id,
    email: adminProfile.email,
    display_name: adminProfile.display_name,
    role: adminProfile.role,
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
