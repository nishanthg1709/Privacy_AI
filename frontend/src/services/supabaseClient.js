/**
 * PrivacyGuard AI - Supabase Client Initialization & Security Verification
 *
 * Strict Security Rules:
 * 1. Only loads publishable / anon client keys via VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY).
 * 2. NEVER exposes or accepts service-role / admin secret keys.
 * 3. Gracefully handles unconfigured states so that the AI scanner and local demo mode
 *    remain 100% operational even when Supabase environment variables are not yet populated.
 */

import { createClient } from '@supabase/supabase-js';

const rawUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const rawKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  ''
).trim();

/**
 * Check if a string looks like an unreplaced template placeholder
 */
function isPlaceholder(value) {
  if (!value) return true;
  const lower = value.toLowerCase();
  return (
    lower.includes('your-project') ||
    lower.includes('your-supabase') ||
    lower.includes('placeholder') ||
    lower.includes('example.co') ||
    lower === 'undefined' ||
    lower === 'null'
  );
}

/**
 * Detects if a key accidentally looks like a service_role secret key
 */
function isServiceRoleKey(key) {
  if (!key) return false;
  try {
    // Check if key is a JWT containing service_role role claim
    if (key.includes('.')) {
      const parts = key.split('.');
      if (parts.length >= 2) {
        const payloadStr = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
        const payload = JSON.parse(payloadStr);
        if (payload.role === 'service_role') {
          return true;
        }
      }
    }
  } catch {
    // not a jwt or parsing failed
  }
  return key.toLowerCase().includes('service_role');
}

/**
 * Identify specifically which Supabase credentials are missing or invalid
 */
export function getMissingSupabaseCredentials() {
  const missing = [];
  if (!rawUrl || isPlaceholder(rawUrl) || (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://'))) {
    missing.push('VITE_SUPABASE_URL');
  }
  if (!rawKey || isPlaceholder(rawKey) || isServiceRoleKey(rawKey)) {
    missing.push('VITE_SUPABASE_PUBLISHABLE_KEY');
  }
  return missing;
}

/**
 * Returns true if valid Supabase URL and Publishable/Anon keys are configured
 */
export function isSupabaseConfigured() {
  if (!rawUrl || !rawKey) return false;
  if (isPlaceholder(rawUrl) || isPlaceholder(rawKey)) return false;
  if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) return false;

  if (isServiceRoleKey(rawKey)) {
    console.error(
      '[CRITICAL SECURITY WARNING] Detected Supabase service_role key in frontend environment! ' +
        'Never expose service_role secret keys in browser builds. Use your Publishable/Anon key.'
    );
    return false;
  }

  return true;
}

/**
 * Diagnostic status for UI banners
 */
export function getSupabaseConfigStatus() {
  if (isSupabaseConfigured()) {
    return {
      configured: true,
      url: rawUrl,
      mode: 'live_cloud',
      missing: [],
      message: 'Connected to Supabase Project (Auth & Row Level Security active)',
    };
  }

  const missing = getMissingSupabaseCredentials();
  let message = 'Supabase credentials are not detected in frontend/.env (or project root .env).';
  if (missing.length === 2) {
    message = 'Missing VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in frontend/.env.';
  } else if (missing.includes('VITE_SUPABASE_URL')) {
    message = 'Missing or invalid VITE_SUPABASE_URL in frontend/.env.';
  } else if (missing.includes('VITE_SUPABASE_PUBLISHABLE_KEY')) {
    message = 'Missing or invalid VITE_SUPABASE_PUBLISHABLE_KEY in frontend/.env.';
  }

  return {
    configured: false,
    url: rawUrl || 'Unset',
    missing,
    mode: 'local_session',
    message,
  };
}

let supabaseClient = null;

if (isSupabaseConfigured()) {
  try {
    supabaseClient = createClient(rawUrl, rawKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'pg_supabase_auth_token',
      },
    });
  } catch (err) {
    console.warn('[PrivacyGuard AI] Failed to initialize Supabase client:', err);
    supabaseClient = null;
  }
}

export const supabase = supabaseClient;
export default supabase;
