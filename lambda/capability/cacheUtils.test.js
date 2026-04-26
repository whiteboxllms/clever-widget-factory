/**
 * Unit tests for cacheUtils.js — capability profile caching utility functions.
 *
 * Tests:
 *   - composeCapabilityProfileStateText / parseCapabilityProfileStateText round-trip
 *   - computeEvidenceHash determinism and format
 *   - determineCacheAction logic (hit / stale / miss)
 */

const {
  composeCapabilityProfileStateText,
  parseCapabilityProfileStateText,
  computeEvidenceHash,
  determineCacheAction,
} = require('./cacheUtils');

// ── compose / parse round-trip ──────────────────────────────────────

describe('composeCapabilityProfileStateText', () => {
  it('produces a string with the [capability_profile] prefix', () => {
    const result = composeCapabilityProfileStateText(
      'action-1', 'user-1', 'abc123', { axes: [] }
    );
    expect(result).toMatch(/^\[capability_profile\]/);
  });

  it('includes actionId, userId, evidenceHash, and profile JSON', () => {
    const profile = { user_id: 'user-1', narrative: 'test' };
    const result = composeCapabilityProfileStateText(
      'action-1', 'user-1', 'abc123', profile
    );
    expect(result).toContain('action=action-1');
    expect(result).toContain('user=user-1');
    expect(result).toContain('hash=abc123');
    expect(result).toContain('computed_at=');
    expect(result).toContain(JSON.stringify(profile));
  });
});

describe('parseCapabilityProfileStateText', () => {
  it('round-trips with compose', () => {
    const profile = { user_id: 'user-1', narrative: 'test', axes: [{ name: 'Cement' }] };
    const stateText = composeCapabilityProfileStateText(
      'action-1', 'user-1', 'abc123', profile
    );
    const parsed = parseCapabilityProfileStateText(stateText);

    expect(parsed).not.toBeNull();
    expect(parsed.actionId).toBe('action-1');
    expect(parsed.userId).toBe('user-1');
    expect(parsed.evidenceHash).toBe('abc123');
    expect(parsed.computedAt).toBeTruthy();
    expect(parsed.profile).toEqual(profile);
  });

  it('returns null for non-matching text', () => {
    expect(parseCapabilityProfileStateText('random text')).toBeNull();
    expect(parseCapabilityProfileStateText('')).toBeNull();
    expect(parseCapabilityProfileStateText(null)).toBeNull();
    expect(parseCapabilityProfileStateText(undefined)).toBeNull();
  });

  it('returns null for malformed JSON in state text', () => {
    const bad = '[capability_profile] action=a user=b hash=c computed_at=2025-01-01T00:00:00Z | {not valid json';
    expect(parseCapabilityProfileStateText(bad)).toBeNull();
  });

  it('handles organization sentinel value', () => {
    const profile = { user_id: 'organization' };
    const stateText = composeCapabilityProfileStateText(
      'action-1', 'organization', 'hash123', profile
    );
    const parsed = parseCapabilityProfileStateText(stateText);
    expect(parsed.userId).toBe('organization');
  });
});

// ── computeEvidenceHash ─────────────────────────────────────────────

describe('computeEvidenceHash', () => {
  it('returns a 16-character hex string', () => {
    const hash = computeEvidenceHash(['state-1', 'state-2'], 3);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is deterministic — same inputs produce same hash', () => {
    const hash1 = computeEvidenceHash(['state-1', 'state-2'], 3);
    const hash2 = computeEvidenceHash(['state-1', 'state-2'], 3);
    expect(hash1).toBe(hash2);
  });

  it('is order-independent — sorted internally', () => {
    const hash1 = computeEvidenceHash(['state-2', 'state-1'], 3);
    const hash2 = computeEvidenceHash(['state-1', 'state-2'], 3);
    expect(hash1).toBe(hash2);
  });

  it('produces different hashes for different inputs', () => {
    const hash1 = computeEvidenceHash(['state-1'], 3);
    const hash2 = computeEvidenceHash(['state-1'], 4);
    const hash3 = computeEvidenceHash(['state-2'], 3);
    expect(hash1).not.toBe(hash2);
    expect(hash1).not.toBe(hash3);
  });

  it('handles empty state IDs array', () => {
    const hash = computeEvidenceHash([], 0);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });
});

// ── determineCacheAction ────────────────────────────────────────────

describe('determineCacheAction', () => {
  it('returns "miss" when cachedState is null', () => {
    expect(determineCacheAction(null, 'abc123')).toBe('miss');
  });

  it('returns "hit" when hashes match', () => {
    expect(determineCacheAction({ evidenceHash: 'abc123' }, 'abc123')).toBe('hit');
  });

  it('returns "stale" when hashes differ', () => {
    expect(determineCacheAction({ evidenceHash: 'abc123' }, 'def456')).toBe('stale');
  });
});
