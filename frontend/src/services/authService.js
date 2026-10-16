/**
 * PrivacyGuard AI - Authentication Service
 *
 * Direct Supabase Auth integration with real session management via supabase.auth.getSession()
 * and supabase.auth.onAuthStateChange().
 *
 * Security & Integrity:
 * - Requires real authenticated Supabase sessions.
 * - No mock sessions, demo bypasses, or fabricated credentials.
 * - Only uses publishable/anon keys; never service-role secrets.
 * - Token management is handled securely by @supabase/supabase-js.
 */

import { supabase, isSupabaseConfigured } from './supabaseClient.js';

const LEGACY_STORAGE_KEY = 'pg_auth_session';
const LEGACY_USERS_STORE_KEY = 'pg_registered_users';

// Purge any lingering legacy mock sessions from browser storage
try {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    localStorage.removeItem(LEGACY_USERS_STORE_KEY);
    sessionStorage.removeItem(LEGACY_STORAGE_KEY);
  }
} catch {
  // storage unavailable
}

class AuthService {
  /**
   * Check if Supabase cloud authentication is configured and active
   */
  isCloudConfigured() {
    return isSupabaseConfigured() && Boolean(supabase);
  }

  /**
   * Check whether a real Supabase session exists on initial boot / page refresh
   */
  /**
   * Fetch user profile from public.profiles table
   */
  async getProfile(userId) {
    if (!this.isCloudConfigured() || !supabase || !userId) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, created_at, updated_at')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('[PrivacyGuard AI] Supabase profile fetch failed:', error.message);
        return null;
      }
      return data;
    } catch (err) {
      console.warn('[PrivacyGuard AI] Exception fetching profile:', err);
      return null;
    }
  }

  /**
   * Update authenticated user profile in public.profiles table
   * Strictly enforces that user ID is never changed.
   */
  async updateProfile(userId, { displayName }) {
    if (!this.isCloudConfigured() || !supabase || !userId) {
      throw new Error('Supabase client is not available or user is not logged in.');
    }

    const cleanName = (displayName || '').trim();
    if (!cleanName) {
      throw new Error('Display name cannot be empty.');
    }

    // Only update display_name; id is immutable and verified by RLS
    const { data, error } = await supabase
      .from('profiles')
      .update({ display_name: cleanName })
      .eq('id', userId)
      .select('id, display_name, created_at, updated_at')
      .single();

    if (error) {
      throw new Error(error.message || 'Failed to update profile.');
    }

    return data;
  }

  /**
   * Check whether a real Supabase session exists on initial boot / page refresh
   */
  async getInitialSession() {
    if (!this.isCloudConfigured() || !supabase) {
      return null;
    }

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.warn('[PrivacyGuard AI] Supabase getSession error:', error.message);
        return null;
      }

      if (data?.session?.user) {
        const profile = await this.getProfile(data.session.user.id);
        return this._mapSupabaseUser(data.session.user, false, profile);
      }
    } catch (err) {
      console.warn('[PrivacyGuard AI] Session verification error:', err);
    }

    return null;
  }

  /**
   * Authenticate a user with email and password via Supabase Auth
   */
  async login({ email, password }) {
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanEmail || !password) {
      throw new Error('Please enter both your email address and password.');
    }

    if (!this.isCloudConfigured() || !supabase) {
      throw new Error(
        'Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to frontend/.env.'
      );
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      const msg = error.message || '';
      if (msg.toLowerCase().includes('email not confirmed')) {
        throw new Error('Please confirm your email address before logging in. Check your inbox for the confirmation link.');
      }
      if (msg.toLowerCase().includes('invalid login credentials')) {
        throw new Error('Invalid email or password. Please verify your credentials.');
      }
      if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('network')) {
        throw new Error('Network error connecting to Supabase. Please verify your internet connection and Supabase URL.');
      }
      throw new Error(msg || 'Authentication failed. Please verify your credentials.');
    }

    if (!data?.user) {
      throw new Error('No user data returned from Supabase authentication.');
    }

    const profile = await this.getProfile(data.user.id);
    return this._mapSupabaseUser(data.user, false, profile);
  }

  /**
   * Register a new user via Supabase Auth
   */
  async signup({ name, email, password }) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanName = (name || '').trim();

    if (!cleanName) throw new Error('Please enter your full name.');
    if (!cleanEmail || !cleanEmail.includes('@')) throw new Error('Please enter a valid work email.');
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters in length.');
    }

    if (!this.isCloudConfigured() || !supabase) {
      throw new Error(
        'Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to frontend/.env.'
      );
    }

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: cleanName,
          name: cleanName,
          display_name: cleanName,
          organization: 'Enterprise Workspace',
          role: 'Privacy Administrator',
        },
      },
    });

    if (error) {
      const msg = error.message || '';
      if (msg.toLowerCase().includes('already registered')) {
        throw new Error('An account with this email address already exists. Please log in instead.');
      }
      if (msg.toLowerCase().includes('rate limit')) {
        throw new Error('Email rate limit exceeded. Please wait a few moments before trying again.');
      }
      if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('network')) {
        throw new Error('Network error connecting to Supabase. Please verify your internet connection and Supabase URL.');
      }
      throw new Error(msg || 'Registration failed.');
    }

    if (!data?.user) {
      throw new Error('Registration failed: no user returned from Supabase.');
    }

    const emailConfirmationPending = !data.session;
    return this._mapSupabaseUser(data.user, emailConfirmationPending);
  }

  /**
   * Log out and clear active session from Supabase
   */
  async logout() {
    if (this.isCloudConfigured() && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('[PrivacyGuard AI] Supabase signOut error:', err);
      }
    }
  }

  /**
   * Request password reset email via Supabase Auth
   */
  async resetPassword(email) {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }

    if (!this.isCloudConfigured() || !supabase) {
      throw new Error(
        'Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to frontend/.env.'
      );
    }

    const redirectTo =
      typeof window !== 'undefined' && window.location?.origin
        ? `${window.location.origin}/login`
        : undefined;

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      ...(redirectTo ? { redirectTo } : {}),
    });

    if (error) {
      const msg = error.message || '';
      if (msg.toLowerCase().includes('rate limit')) {
        throw new Error('Email rate limit exceeded. Please wait a few moments before trying again.');
      }
      if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('network')) {
        throw new Error('Network error connecting to Supabase. Please verify your connection.');
      }
      throw new Error(msg || 'Failed to send password reset email.');
    }

    return true;
  }

  // --- Private Helpers ---

  _mapSupabaseUser(sbUser, emailConfirmationPending = false, profileData = null) {
    if (!sbUser) return null;
    const meta = sbUser.user_metadata || {};
    const displayName =
      profileData?.display_name ||
      meta.full_name ||
      meta.name ||
      meta.display_name ||
      (sbUser.email ? sbUser.email.split('@')[0] : 'Workspace User');

    return {
      id: sbUser.id,
      email: sbUser.email,
      name: displayName,
      displayName,
      organization: profileData?.organization || meta.organization || 'Enterprise Workspace',
      role: profileData?.role || meta.role || 'Privacy Administrator',
      joinedDate: (profileData?.created_at || sbUser.created_at)
        ? (profileData?.created_at || sbUser.created_at).split('T')[0]
        : new Date().toISOString().split('T')[0],
      updatedAt: profileData?.updated_at || sbUser.updated_at || null,
      emailConfirmationPending,
      isAnonymous: Boolean(sbUser.is_anonymous),
    };
  }
}

export const authService = new AuthService();
export default authService;
