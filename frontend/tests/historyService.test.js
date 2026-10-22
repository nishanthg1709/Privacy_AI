import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import historyService from '../src/services/historyService.js';

describe('History Service & Supabase Zero-Log Audit', () => {
  it('gracefully handles missing scanResult or unauthenticated user', async () => {
    const res1 = await historyService.saveScanHistory(null, { id: 'usr-123' });
    assert.equal(res1.saved, false);
    assert.equal(res1.reason, 'missing_scan_result');

    const res2 = await historyService.saveScanHistory({ scanId: 'SCN-1' }, null);
    assert.equal(res2.saved, false);
    assert.equal(res2.reason, 'unauthenticated');
  });

  it('deduplicates identical scanId in memory to prevent duplicate records', async () => {
    const mockScan = {
      scanId: 'SCN-DEDUP-001',
      taskName: 'Deduplication Test',
      mode: 'strict',
      findings: [{ category: 'Contact PII' }],
      privacyScore: 95,
      verification: { passed: true },
    };
    const mockUser = { id: 'usr-456' };

    // Seed the in-memory cache directly
    historyService._persistedScanIds.add('SCN-DEDUP-001');

    const result = await historyService.saveScanHistory(mockScan, mockUser);
    assert.equal(result.saved, true);
    assert.equal(result.deduplicated, true);
  });
});
