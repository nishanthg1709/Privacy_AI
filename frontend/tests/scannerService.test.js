import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getBaseUrl,
  isLocalDevelopment,
  checkBackendHealth,
  scanPayload,
} from '../src/services/scannerService.js';

describe('Scanner Service & API Connectivity', () => {
  const originalFetch = globalThis.fetch;
  const originalProcessEnv = { ...process.env };

  beforeEach(() => {
    // Reset process.env overrides
    delete process.env.VITE_API_BASE_URL;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...originalProcessEnv };
  });

  // Test 1: Production API base URL configuration
  describe('getBaseUrl()', () => {
    it('returns configured VITE_API_BASE_URL without trailing slashes', () => {
      process.env.VITE_API_BASE_URL = 'https://privacy-api.example.com///';
      const url = getBaseUrl();
      assert.equal(url, 'https://privacy-api.example.com');
    });

    it('returns empty string in production when VITE_API_BASE_URL is not set', () => {
      delete process.env.VITE_API_BASE_URL;
      // In Node environment without window.location, isLocalDevelopment() is false unless DEV is true
      if (!isLocalDevelopment()) {
        assert.equal(getBaseUrl(), '');
      }
    });
  });

  // Test 2: Backend health checking
  describe('checkBackendHealth()', () => {
    it('reports offline with explicit error when VITE_API_BASE_URL is missing in production', async () => {
      delete process.env.VITE_API_BASE_URL;
      if (!isLocalDevelopment()) {
        const health = await checkBackendHealth();
        assert.equal(health.isOnline, false);
        assert.equal(health.url, '');
        assert.match(health.error, /VITE_API_BASE_URL/);
      }
    });

    it('returns isOnline: true when backend /api/health responds with 200', async () => {
      process.env.VITE_API_BASE_URL = 'https://api.test-privacyguard.com';

      globalThis.fetch = async (url) => {
        assert.equal(url, 'https://api.test-privacyguard.com/api/health');
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: 'healthy', model: 'urchade/gliner_small-v2.1' }),
        };
      };

      const health = await checkBackendHealth();
      assert.equal(health.isOnline, true);
      assert.equal(health.status, 200);
      assert.equal(health.url, 'https://api.test-privacyguard.com');
    });

    it('returns isOnline: false when backend is unreachable or connection refused', async () => {
      process.env.VITE_API_BASE_URL = 'https://api.test-privacyguard.com';

      globalThis.fetch = async () => {
        throw new Error('fetch failed (ECONNREFUSED)');
      };

      const health = await checkBackendHealth();
      assert.equal(health.isOnline, false);
      assert.equal(health.status, 0);
      assert.equal(health.url, 'https://api.test-privacyguard.com');
    });
  });

  // Test 3: Document scan submission and payload format
  describe('scanPayload()', () => {
    it('rejects empty or whitespace-only document text without network request', async () => {
      process.env.VITE_API_BASE_URL = 'https://api.test-privacyguard.com';

      await assert.rejects(
        () => scanPayload({ text: '   ', task: 'Test' }),
        /Please enter prompt text or upload a document to scan/
      );
    });

    it('throws actionable error in production when VITE_API_BASE_URL is not configured', async () => {
      delete process.env.VITE_API_BASE_URL;
      if (!isLocalDevelopment()) {
        await assert.rejects(
          () => scanPayload({ text: 'Valid test content', task: 'Test' }),
          /Please set the VITE_API_BASE_URL environment variable/
        );
      }
    });

    it('sends correct payload and headers to configured endpoint', async () => {
      process.env.VITE_API_BASE_URL = 'https://api.test-privacyguard.com';
      let capturedRequest = null;

      globalThis.fetch = async (endpoint, options) => {
        capturedRequest = { endpoint, ...options };
        return {
          ok: true,
          status: 200,
          json: async () => ({
            scan_id: 'SCN-12345678',
            protected_text: 'Hello [PERSON_1]',
            findings: [{ entity_type: 'PERSON', original_text: 'Sarah', score: 0.98 }],
            verification: { passed: true, residual_findings_count: 0, residual_risks: [] },
          }),
        };
      };

      const result = await scanPayload({
        text: 'Hello Sarah',
        task: 'Customer Support Audit',
        privacy_mode: 'synthetic',
        strictness: 'gdpr-hipaa',
      });

      // Verify endpoint and method
      assert.equal(capturedRequest.endpoint, 'https://api.test-privacyguard.com/api/scan');
      assert.equal(capturedRequest.method, 'POST');
      assert.equal(capturedRequest.headers['Content-Type'], 'application/json');

      // Verify payload
      const sentBody = JSON.parse(capturedRequest.body);
      assert.equal(sentBody.text, 'Hello Sarah');
      assert.equal(sentBody.task, 'Customer Support Audit');
      assert.equal(sentBody.privacy_mode, 'synthetic');
      assert.equal(sentBody.strictness, 'gdpr-hipaa');

      // Verify response normalization (not fabricated)
      assert.equal(result.scan_id, 'SCN-12345678');
      assert.equal(result.protected_text, 'Hello [PERSON_1]');
      assert.equal(result.findings.length, 1);
      assert.equal(result.verification.passed, true);
    });

    it('handles backend HTTP 422/500 errors and surfaces error detail', async () => {
      process.env.VITE_API_BASE_URL = 'https://api.test-privacyguard.com';

      globalThis.fetch = async () => ({
        ok: false,
        status: 422,
        json: async () => ({ detail: 'Document length exceeds maximum token capacity' }),
      });

      await assert.rejects(
        () => scanPayload({ text: 'Test content' }),
        /Backend returned error \(422\): Document length exceeds maximum token capacity/
      );
    });

    it('never fabricates scan results on network failures', async () => {
      process.env.VITE_API_BASE_URL = 'https://api.test-privacyguard.com';

      globalThis.fetch = async () => {
        throw new Error('Network connection failed');
      };

      // Must throw an error, never return fake findings
      await assert.rejects(
        () => scanPayload({ text: 'Confidential patient notes' }),
        /Unable to connect to PrivacyGuard AI backend/
      );
    });
  });
});
