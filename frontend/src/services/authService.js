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

import { supabase, isSupabaseConfigured } from './supabaseClient';

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
        return this._mapSupabaseUser(data.session.user);
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
      throw new Error(error.message || 'Authentication failed. Please verify your credentials.');
    }

    if (!data?.user) {
      throw new Error('No user data returned from Supabase authentication.');
    }

    return this._mapSupabaseUser(data.user);
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
          organization: 'Enterprise Workspace',
          role: 'Privacy Administrator',
        },
      },
    });

    if (error) {
      throw new Error(error.message || 'Registration failed.');
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

  // --- Private Helpers ---

  _mapSupabaseUser(sbUser, emailConfirmationPending = false) {
    if (!sbUser) return null;
    const meta = sbUser.user_metadata || {};
    return {
      id: sbUser.id,
      email: sbUser.email,
      name:
        meta.full_name ||
        meta.name ||
        (sbUser.email ? sbUser.email.split('@')[0] : 'Workspace User'),
      organization: meta.organization || 'Enterprise Workspace',
      role: meta.role || 'Privacy Administrator',
      joinedDate: sbUser.created_at
        ? sbUser.created_at.split('T')[0]
        : new Date().toISOString().split('T')[0],
      emailConfirmationPending,
    };
  }
}

export const authService = new AuthService();
export default authService;
