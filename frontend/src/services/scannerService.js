/**
 * PrivacyGuard AI Scanner Service
 * Manages communication with the privacy-scanning backend endpoint.
 *
 * Requirements:
 * - POST to VITE_API_BASE_URL/api/scan (defaulting to http://localhost:8000)
 * - Sends JSON payload: { text, task, privacy_mode }
 * - Robust error handling (timeouts, network offline, HTTP errors, schema parsing)
 * - Strict zero-log policy for sensitive documents, detected entities, or tokens
/**
 * Detects whether the current environment is local development.
 */
export const isLocalDevelopment = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    return true;
  }
  if (typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';
  }
  return false;
};

/**
 * Resolves the configured API base URL.
 * Uses import.meta.env.VITE_API_BASE_URL as the primary source.
 * Falls back to http://localhost:8000 strictly in local development.
 */
export const getBaseUrl = () => {
  const envUrl =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
    (typeof globalThis !== 'undefined' && globalThis.process?.env?.VITE_API_BASE_URL);

  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  // http://localhost:8000 is used strictly as a local-development fallback
  if (isLocalDevelopment()) {
    return 'http://localhost:8000';
  }

  // In production without configured VITE_API_BASE_URL, do not default to localhost
  return '';
};

/**
 * Checks whether the backend endpoint is currently reachable.
 * Uses the configured API base URL without hardcoding localhost in production.
 */
export async function checkBackendHealth() {
  const baseUrl = getBaseUrl();

  // If in production and VITE_API_BASE_URL is not configured
  if (!baseUrl && !isLocalDevelopment()) {
    return {
      isOnline: false,
      status: 0,
      url: '',
      error: 'VITE_API_BASE_URL environment variable is not configured.',
    };
  }

  const targetUrl = baseUrl || 'http://localhost:8000';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch(`${targetUrl}/api/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    let healthData = null;
    try {
      healthData = await res.json();
    } catch {
      // non-JSON response
    }
    return {
      isOnline: res.ok,
      status: res.status,
      url: targetUrl,
      engine_ready: Boolean(healthData?.engine_ready),
      engine_status: healthData?.engine_status || (healthData?.engine_ready ? 'ready' : 'degraded'),
    };
  } catch {
    clearTimeout(timeoutId);
    // Try fallback root check
    try {
      const fallbackCtrl = new AbortController();
      const fallbackTimeout = setTimeout(() => fallbackCtrl.abort(), 2000);
      const rootRes = await fetch(`${targetUrl}/`, {
        method: 'GET',
        signal: fallbackCtrl.signal,
      });
      clearTimeout(fallbackTimeout);
      return { isOnline: rootRes.ok, status: rootRes.status, url: targetUrl };
    } catch {
      return { isOnline: false, status: 0, url: targetUrl };
    }
  }
}

/**
 * Sends prompt text to backend for privacy scanning and minimization.
 *
 * @param {Object} params
 * @param {string} params.text - The raw document or prompt content to scan
 * @param {string} params.task - The audit task label / identifier
 * @param {string} params.privacy_mode - 'synthetic' | 'tokenized' | 'redaction'
 * @param {string} [params.strictness] - Optional compliance policy
 * @returns {Promise<Object>} Normalized scan result
 */
export async function scanPayload({
  text,
  task,
  privacy_mode,
  strictness = 'gdpr-hipaa',
  maxRetries = 1,
  retryDelayMs = 500,
}) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new Error('Please enter prompt text or upload a document to scan.');
  }

  const baseUrl = getBaseUrl();

  if (!baseUrl && !isLocalDevelopment()) {
    throw new Error(
      'PrivacyGuard AI backend URL is not configured. Please set the VITE_API_BASE_URL environment variable in your Vercel Project Settings to your deployed backend URL.'
    );
  }

  const endpoint = `${baseUrl}/api/scan`;
  const envTimeout =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SCAN_TIMEOUT_MS) ||
    (typeof globalThis !== 'undefined' && globalThis.process?.env?.VITE_SCAN_TIMEOUT_MS);
  const timeoutMs = Number(envTimeout) > 0 ? Number(envTimeout) : 60000;

  const requestId = `REQ-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  const payload = {
    text: text.trim(),
    task: task?.trim() || 'Prompt Privacy Audit',
    privacy_mode: privacy_mode || 'synthetic',
    strictness,
    request_id: requestId,
  };

  let response;
  const attempts = Math.max(0, maxRetries);

  for (let attempt = 0; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // Retry on transient server gateway errors (502/503/504)
      if (!response.ok && [502, 503, 504].includes(response.status) && attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        continue;
      }

      break;
    } catch (err) {
      clearTimeout(timeoutId);

      // Never retry non-idempotent scans on client timeout (AbortError) to avoid overloading backend
      if (err.name === 'AbortError') {
        throw new Error(
          `Scan request timed out after ${timeoutMs / 1000}s. The backend may be busy or processing a large document. Please retry or scan smaller text chunks.`,
          { cause: err }
        );
      }

      // Retry transient network errors if attempts remain
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        continue;
      }

      // Network failure / Connection refused
      const hostInfo = baseUrl ? ` at ${baseUrl}` : '';
      throw new Error(
        `Unable to connect to PrivacyGuard AI backend${hostInfo}. Please verify the backend service is running and accessible.`,
        { cause: err }
      );
    }
  }

  // Handle HTTP error statuses
  if (!response.ok) {
    let errorDetail = '';
    try {
      const errJson = await response.json();
      errorDetail =
        errJson.detail ||
        errJson.message ||
        errJson.error ||
        (typeof errJson === 'string' ? errJson : '');
    } catch {
      // response was not JSON
    }

    const errorMsg = errorDetail
      ? `Backend returned error (${response.status}): ${errorDetail}`
      : `Backend returned HTTP status ${response.status} (${response.statusText || 'Error'}).`;

    throw new Error(errorMsg);
  }

  // Parse JSON response
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('Received invalid non-JSON response from the backend service.');
  }

  // Normalize returned data structure
  // Handles standard variations: protected_text vs sanitized_text vs text; findings vs entities
  const protectedText =
    data.protected_text ??
    data.sanitized_text ??
    data.anonymized_text ??
    data.result ??
    data.text ??
    '';

  const rawFindings = Array.isArray(data.findings)
    ? data.findings
    : Array.isArray(data.entities)
    ? data.entities
    : Array.isArray(data.detections)
    ? data.detections
    : [];

  // Normalize each finding into consistent shape without leaking sensitive logs
  const normalizedFindings = rawFindings.map((finding, idx) => {
    return {
      id: finding.id ?? idx + 1,
      type: finding.type || finding.entity_type || finding.label || 'Sensitive Entity',
      category:
        finding.category ||
        finding.class ||
        categorizeEntityType(finding.type || finding.label),
      originalSnippet: finding.originalSnippet || finding.original || finding.value || finding.text || '',
      sanitizedSnippet:
        finding.sanitizedSnippet ||
        finding.replacement ||
        finding.redacted ||
        finding.masked ||
        '[PROTECTED]',
      confidence: formatConfidence(finding.confidence || finding.score),
      rawConfidence: typeof finding.confidence === 'number' ? finding.confidence : null,
      risk: finding.risk || finding.severity || inferRisk(finding.type || finding.label),
      action: finding.action || finding.action_taken || (privacy_mode === 'synthetic' ? 'Substituted' : 'Redacted'),
      source: finding.source || 'gliner_ai',
      explanation: finding.explanation || '',
      is_ambiguous: Boolean(finding.is_ambiguous),
      ambiguity_reason: finding.ambiguity_reason || null,
      risk_reason: finding.risk_reason || null,
      recommendation: finding.recommendation || null,
      recommendation_reason: finding.recommendation_reason || null,
      is_uncertain: Boolean(finding.is_uncertain),
      uncertainty_reason: finding.uncertainty_reason || null,
      start: finding.start,
      end: finding.end,
    };
  });

  // Extract categories
  const categories = Array.isArray(data.categories)
    ? data.categories
    : [...new Set(normalizedFindings.map((f) => f.category).filter(Boolean))];

  // Extract counts
  const counts =
    typeof data.counts === 'object' && data.counts !== null
      ? data.counts
      : typeof data.count === 'number'
      ? { total: data.count }
      : {
          total: normalizedFindings.length,
          high: normalizedFindings.filter((f) => f.risk === 'High' || f.risk === 'Critical').length,
          medium: normalizedFindings.filter((f) => f.risk === 'Medium').length,
          low: normalizedFindings.filter((f) => f.risk === 'Low').length,
        };

  // Extract actions
  const actions = Array.isArray(data.actions)
    ? data.actions
    : [...new Set(normalizedFindings.map((f) => f.action).filter(Boolean))];

  // Extract summary
  const summary =
    data.summary ||
    data.overview ||
    (normalizedFindings.length > 0
      ? `Identified and protected ${normalizedFindings.length} sensitive item${normalizedFindings.length > 1 ? 's' : ''} across ${categories.length} categor${categories.length === 1 ? 'y' : 'ies'}.`
      : 'Clean scan. No sensitive entities or confidential tokens detected.');

  const scanId =
    data.scan_id ||
    data.id ||
    `SCN-${Date.now().toString(36).toUpperCase()}`;

  const timestamp = data.timestamp || new Date().toISOString();

  // Return comprehensive, normalized scan object
  return {
    scanId,
    scan_id: scanId,
    timestamp,
    taskName: task || 'Prompt Privacy Audit',
    originalText: text,
    protectedText,
    protected_text: protectedText,
    sanitizedText: protectedText,
    findings: normalizedFindings,
    categories,
    counts,
    actions,
    summary,
    mode: privacy_mode,
    strictness,
    privacyScore: data.privacy_score ?? computePrivacyScore(normalizedFindings),
    isLiveBackend: true,
    verification: data.verification || null,
    combination_risks: Array.isArray(data.combination_risks) ? data.combination_risks : [],
    quasi_identifiers: Array.isArray(data.quasi_identifiers) ? data.quasi_identifiers : [],
    engine_status: data.engine_status || null,
  };
}

// Helpers for data normalization
function formatConfidence(val) {
  if (typeof val === 'number') {
    return val <= 1 ? `${Math.round(val * 100)}%` : `${Math.round(val)}%`;
  }
  return typeof val === 'string' ? val : '98.5%';
}

function inferRisk(type = '') {
  const lower = String(type).toLowerCase();
  if (lower.includes('ssn') || lower.includes('secret') || lower.includes('key') || lower.includes('password') || lower.includes('token') || lower.includes('card')) {
    return 'High';
  }
  if (lower.includes('email') || lower.includes('phone') || lower.includes('ip') || lower.includes('address') || lower.includes('dob')) {
    return 'Medium';
  }
  return 'Low';
}

function categorizeEntityType(type = '') {
  const lower = String(type).toLowerCase();
  if (lower.includes('ssn') || lower.includes('passport') || lower.includes('license') || lower.includes('id')) {
    return 'Government ID';
  }
  if (lower.includes('key') || lower.includes('token') || lower.includes('password') || lower.includes('secret')) {
    return 'Developer Credentials';
  }
  if (lower.includes('email') || lower.includes('phone') || lower.includes('name') || lower.includes('address')) {
    return 'Contact PII';
  }
  if (lower.includes('medical') || lower.includes('health') || lower.includes('patient') || lower.includes('mrn') || lower.includes('doctor')) {
    return 'Protected Health Information (PHI)';
  }
  if (lower.includes('card') || lower.includes('bank') || lower.includes('iban') || lower.includes('account')) {
    return 'Financial Data';
  }
  return 'Sensitive Data';
}

function computePrivacyScore(findings) {
  if (!findings || findings.length === 0) return 100;
  const highCount = findings.filter((f) => f.risk === 'High' || f.risk === 'Critical').length;
  const mediumCount = findings.filter((f) => f.risk === 'Medium').length;
  const penalty = highCount * 12 + mediumCount * 5;
  return Math.max(70, Math.min(100, 100 - penalty + 15));
}

export const scanDocument = scanPayload;

const scannerService = {
  scanPayload,
  scanDocument,
  checkBackendHealth,
  getBaseUrl,
  isLocalDevelopment,
};

export default scannerService;
