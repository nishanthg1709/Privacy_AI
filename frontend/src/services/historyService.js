/**
 * PrivacyGuard AI - Scan History Telemetry Service
 *
 * Implements minimal metadata persistence via Supabase PostgreSQL table 'scan_history'.
 *
 * STRICT ZERO-LOG POLICY:
 * - Never transmits or persists original document / prompt text.
 * - Never transmits or persists detected entity snippets, raw tokens, or sensitive values.
 * - Never transmits or persists sanitized / redacted document bodies.
 * - Only stores operational telemetry (scanId, timestamp, mode, finding counts by category, score).
 *
 * Row Level Security:
 * - Writes and queries strictly rely on the authenticated user's session JWT.
 * - No service-role keys are ever used.
 */

import { supabase, isSupabaseConfigured } from './supabaseClient';

class HistoryService {
  /**
   * Persists minimal scan metadata to Supabase scan_history table.
   * Gracefully fails without disrupting the scan result if database is unavailable.
   */
  async saveScanHistory(scanResult, user) {
    if (!scanResult) {
      return { saved: false, reason: 'missing_scan_result' };
    }

    if (!user || !user.id) {
      return { saved: false, reason: 'unauthenticated' };
    }

    if (!isSupabaseConfigured() || !supabase) {
      return { saved: false, reason: 'supabase_not_configured' };
    }

    try {
      // Aggregate category counts without retaining any raw entity strings
      const categoryCounts = (scanResult.findings || []).reduce((acc, f) => {
        const cat = f.category || 'General PII';
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
      }, {});

      const findingsCount =
        scanResult.findings?.length ??
        scanResult.counts?.total ??
        Object.values(categoryCounts).reduce((a, b) => a + b, 0);

      // Clean metadata payload - zero sensitive text
      const minimalRecord = {
        user_id: user.id,
        scan_id: scanResult.scanId || scanResult.scan_id || `SCN-${Date.now()}`,
        task: scanResult.taskName || scanResult.task || 'Prompt Privacy Audit',
        privacy_mode: scanResult.mode || scanResult.privacy_mode || 'strict',
        strictness: scanResult.strictness || 'gdpr-hipaa',
        status: findingsCount === 0 ? 'clean' : 'protected',
        findings_count: findingsCount,
        category_counts: categoryCounts,
        privacy_score: scanResult.privacyScore ?? scanResult.privacy_score ?? 100,
        verification_passed: scanResult.verification?.passed ?? true,
      };

      const { data, error } = await supabase
        .from('scan_history')
        .insert([minimalRecord])
        .select();

      if (error) {
        console.warn('[PrivacyGuard AI] Supabase scan_history insert failed:', error.message);
        return { saved: false, error: error.message };
      }

      return { saved: true, record: data ? data[0] : null };
    } catch (err) {
      console.warn('[PrivacyGuard AI] Error in saveScanHistory:', err);
      return { saved: false, error: err.message || 'Unknown network error' };
    }
  }

  /**
   * Fetch scan history metadata records for the authenticated user from Supabase.
   */
  async fetchScanHistory(user) {
    if (!user || !user.id || !isSupabaseConfigured() || !supabase) {
      return { records: [], fromCloud: false };
    }

    try {
      const { data, error } = await supabase
        .from('scan_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        return { records: [], error: error.message, fromCloud: false };
      }

      // Format records to match frontend expectations
      const mapped = (data || []).map((row) => ({
        id: row.id,
        scanId: row.scan_id,
        taskName: row.task,
        timestamp: row.created_at,
        mode: row.privacy_mode,
        strictness: row.strictness,
        privacyScore: Number(row.privacy_score),
        findings: [], // zero stored findings for privacy
        counts: {
          total: row.findings_count,
        },
        categories: Object.keys(row.category_counts || {}),
        categoryCounts: row.category_counts || {},
        status: row.status,
        verificationPassed: row.verification_passed,
        persistedToCloud: true,
      }));

      return { records: mapped, fromCloud: true };
    } catch (err) {
      return { records: [], error: err.message || 'Network error', fromCloud: false };
    }
  }

  /**
   * Delete a scan record from Supabase (enforced by RLS user_id check)
   */
  async deleteScanRecord(recordId, user) {
    if (!user || !user.id || !isSupabaseConfigured() || !supabase) {
      return { success: false, reason: 'unauthenticated' };
    }

    try {
      const { error } = await supabase.from('scan_history').delete().eq('id', recordId);
      if (error) throw error;
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

export const historyService = new HistoryService();
export default historyService;
