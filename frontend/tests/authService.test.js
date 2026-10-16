import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import authService from '../src/services/authService.js';

describe('Auth Service & Supabase Security Verification', () => {
  it('identifies unconfigured state gracefully without throwing crashes', () => {
    // In test environment without active env vars, authService should report unconfigured or handle safely
    const isConfigured = authService.isCloudConfigured();
    assert.equal(typeof isConfigured, 'boolean');
  });

  it('correctly maps a Supabase user object into the client model', () => {
    const rawSbUser = {
      id: 'usr_abc12345',
      email: 'engineer@apexsecurity.io',
      created_at: '2026-10-15T12:00:00Z',
      user_metadata: {
        name: 'Sarah Connor',
        avatar_url: 'https://example.com/avatar.jpg',
      },
    };

    const profileData = {
      name: 'Sarah Connor',
      role: 'Security Engineer',
      scan_count: 14,
    };

    const mapped = authService._mapSupabaseUser(rawSbUser, false, profileData);

    assert.equal(mapped.id, 'usr_abc12345');
    assert.equal(mapped.email, 'engineer@apexsecurity.io');
    assert.equal(mapped.name, 'Sarah Connor');
    assert.equal(mapped.role, 'Security Engineer');
    assert.equal(mapped.emailConfirmationPending, false);
    assert.equal(mapped.isAnonymous, false);
  });

  it('handles fallback name from email username when metadata is empty', () => {
    const rawSbUser = {
      id: 'usr_xyz789',
      email: 'alex.mercer@cyberdyne.org',
      created_at: '2026-10-15T12:00:00Z',
      user_metadata: {},
    };

    const mapped = authService._mapSupabaseUser(rawSbUser, false, null);

    assert.equal(mapped.id, 'usr_xyz789');
    assert.equal(mapped.name, 'alex.mercer');
  });

  it('flags email confirmation pending when email_confirmed_at is missing', () => {
    const unconfirmedUser = {
      id: 'usr_unconfirmed',
      email: 'newuser@example.com',
      email_confirmed_at: null,
      confirmed_at: null,
    };

    const mapped = authService._mapSupabaseUser(unconfirmedUser, true, null);
    assert.equal(mapped.emailConfirmationPending, true);
  });
});
