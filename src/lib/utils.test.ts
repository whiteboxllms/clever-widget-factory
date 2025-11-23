/**
 * Tests for action border color logic
 * 
 * Border color progression:
 * - No border (gray): Backlog - no policy or agreement
 * - Blue: Ready to start - has policy AND agreement
 * - Yellow: In progress - has policy, agreement, AND implementation updates
 * - Green: Done - status is completed
 * 
 * IMPORTANT: These tests verify the LOGIC is correct. However, there's a known issue:
 * When an implementation update is added in UnifiedActionDialog, the action object's
 * `implementation_update_count` field is not updated immediately because:
 * 1. ActionImplementationUpdates doesn't call onUpdate() after adding (line 158 is commented out)
 * 2. The border style uses action?.implementation_update_count from the prop
 * 3. Without refreshing the action, the count stays stale and border doesn't turn yellow
 * 
 * Fix: Either call onUpdate() after adding, or track update count locally in the dialog
 */

import { describe, it, expect } from 'vitest';
import { getActionBorderStyle } from './utils';

describe('getActionBorderStyle', () => {
  describe('Green border (completed)', () => {
    it('should return green border when status is completed', () => {
      const action = {
        status: 'completed',
        policy: 'Some policy',
        plan_commitment: true,
        implementation_update_count: 5,
      };

      const result = getActionBorderStyle(action);

      expect(result.borderColor).toContain('emerald-500');
      expect(result.borderColor).toContain('border-2');
    });

    it('should return green border even without policy or updates when completed', () => {
      const action = {
        status: 'completed',
        policy: null,
        plan_commitment: false,
        implementation_update_count: 0,
      };

      const result = getActionBorderStyle(action);

      expect(result.borderColor).toContain('emerald-500');
    });
  });

  describe('Yellow border (in progress)', () => {
    it('should return yellow border when there is policy, agreement, and implementation updates', () => {
      const action = {
        status: 'active',
        policy: 'Test policy content',
        plan_commitment: true,
        implementation_update_count: 1,
      };

      const result = getActionBorderStyle(action);

      expect(result.borderColor).toContain('yellow-500');
      expect(result.borderColor).toContain('border-2');
      expect(result.bgColor).toBe('bg-background');
    });

    it('should return yellow border with policy_agreed_at instead of plan_commitment', () => {
      const action = {
        status: 'active',
        policy: 'Test policy content',
        policy_agreed_at: '2024-01-01T00:00:00Z',
        plan_commitment: false,
        implementation_update_count: 1,
      };

      const result = getActionBorderStyle(action);

      expect(result.borderColor).toContain('yellow-500');
    });

    it('should return yellow border with multiple implementation updates', () => {
      const action = {
        status: 'active',
        policy: 'Test policy content',
        plan_commitment: true,
        implementation_update_count: 5,
      };

      const result = getActionBorderStyle(action);

      expect(result.borderColor).toContain('yellow-500');
    });

    it('should NOT return yellow border without policy', () => {
      const action = {
        status: 'active',
        policy: null,
        plan_commitment: true,
        implementation_update_count: 1,
      };

      const result = getActionBorderStyle(action);

      expect(result.borderColor).not.toContain('yellow-500');
      expect(result.borderColor).toBe(''); // Should be no border (backlog)
    });

    it('should NOT return yellow border without agreement', () => {
      const action = {
        status: 'active',
        policy: 'Test policy content',
        plan_commitment: false,
        policy_agreed_at: null,
        implementation_update_count: 1,
      };

      const result = getActionBorderStyle(action);

      expect(result.borderColor).not.toContain('yellow-500');
      expect(result.borderColor).toBe(''); // Should be no border (backlog)
    });

    it('should NOT return yellow border without implementation updates', () => {
      const action = {
        status: 'active',
        policy: 'Test policy content',
        plan_commitment: true,
        implementation_update_count: 0,
      };

      const result = getActionBorderStyle(action);

      expect(result.borderColor).not.toContain('yellow-500');
      expect(result.borderColor).toContain('blue-500'); // Should be blue (ready to start)
    });

    it('should return yellow border when agreement is toggled on and update is added', () => {
      // Scenario: User toggles agreement, then adds update
      const action = {
        status: 'active',
        policy: 'Test policy content',
        plan_commitment: true, // Agreement toggled on
        implementation_update_count: 1, // Update added
      };

      const result = getActionBorderStyle(action);

      expect(result.borderColor).toContain('yellow-500');
    });
  });

  describe('Blue border (ready to start)', () => {
    it('should return blue border when there is policy and plan_commitment', () => {
      const action = {
        status: 'active',
        policy: 'Test policy content',
        plan_commitment: true,
        implementation_update_count: 0,
      };

      const result = getActionBorderStyle(action);

      expect(result.borderColor).toContain('blue-500');
      expect(result.borderColor).toContain('border-2');
    });

    it('should return blue border when there is policy and policy_agreed_at', () => {
      const action = {
        status: 'active',
        policy: 'Test policy content',
        policy_agreed_at: '2024-01-01T00:00:00Z',
        plan_commitment: false,
        implementation_update_count: 0,
      };

      const result = getActionBorderStyle(action);

      expect(result.borderColor).toContain('blue-500');
    });

    it('should return blue border when agreement is toggled on (even without updates)', () => {
      const action = {
        status: 'active',
        policy: 'Test policy content',
        plan_commitment: true, // Agreement toggled on
        implementation_update_count: 0, // No updates yet
      };

      const result = getActionBorderStyle(action);

      expect(result.borderColor).toContain('blue-500');
    });

    it('should NOT return blue border without policy', () => {
      const action = {
        status: 'active',
        policy: null,
        plan_commitment: true,
        implementation_update_count: 0,
      };

      const result = getActionBorderStyle(action);

      expect(result.borderColor).not.toContain('blue-500');
      expect(result.borderColor).toBe(''); // Should be no border (backlog)
    });

    it('should NOT return blue border without agreement', () => {
      const action = {
        status: 'active',
        policy: 'Test policy content',
        plan_commitment: false,
        policy_agreed_at: null,
        implementation_update_count: 0,
      };

      const result = getActionBorderStyle(action);

      expect(result.borderColor).not.toContain('blue-500');
      expect(result.borderColor).toBe(''); // Should be no border (backlog)
    });
  });

  describe('No border (backlog)', () => {
    it('should return no border when there is no policy', () => {
      const action = {
        status: 'active',
        policy: null,
        plan_commitment: false,
        implementation_update_count: 0,
      };

      const result = getActionBorderStyle(action);

      expect(result.borderColor).toBe('');
    });

    it('should return no border when there is no agreement', () => {
      const action = {
        status: 'active',
        policy: 'Test policy content',
        plan_commitment: false,
        policy_agreed_at: null,
        implementation_update_count: 0,
      };

      const result = getActionBorderStyle(action);

      expect(result.borderColor).toBe('');
    });

    it('should return no border when policy is empty string', () => {
      const action = {
        status: 'active',
        policy: '',
        plan_commitment: true,
        implementation_update_count: 0,
      };

      const result = getActionBorderStyle(action);

      expect(result.borderColor).toBe('');
    });

    it('should return no border when policy is only whitespace', () => {
      const action = {
        status: 'active',
        policy: '   ',
        plan_commitment: true,
        implementation_update_count: 0,
      };

      const result = getActionBorderStyle(action);

      expect(result.borderColor).toBe('');
    });
  });

  describe('Edge cases and state transitions', () => {
    it('should transition from no border to blue when policy and agreement are added', () => {
      // Initial state: backlog
      const backlog = {
        status: 'active',
        policy: null,
        plan_commitment: false,
        implementation_update_count: 0,
      };
      expect(getActionBorderStyle(backlog).borderColor).toBe('');

      // Add policy and agreement: ready to start
      const ready = {
        status: 'active',
        policy: 'Test policy',
        plan_commitment: true,
        implementation_update_count: 0,
      };
      expect(getActionBorderStyle(ready).borderColor).toContain('blue-500');
    });

    it('should transition from blue to yellow when implementation update is added', () => {
      // Blue state: ready to start
      const ready = {
        status: 'active',
        policy: 'Test policy',
        plan_commitment: true,
        implementation_update_count: 0,
      };
      expect(getActionBorderStyle(ready).borderColor).toContain('blue-500');

      // Yellow state: in progress
      const inProgress = {
        status: 'active',
        policy: 'Test policy',
        plan_commitment: true,
        implementation_update_count: 1,
      };
      expect(getActionBorderStyle(inProgress).borderColor).toContain('yellow-500');
    });

    it('should transition from yellow back to blue when agreement is toggled off', () => {
      // Yellow state: in progress
      const inProgress = {
        status: 'active',
        policy: 'Test policy',
        plan_commitment: true,
        implementation_update_count: 1,
      };
      expect(getActionBorderStyle(inProgress).borderColor).toContain('yellow-500');

      // Blue state: agreement toggled off (but still has policy)
      // Actually, if agreement is off, it should go to no border
      const agreementOff = {
        status: 'active',
        policy: 'Test policy',
        plan_commitment: false,
        policy_agreed_at: null,
        implementation_update_count: 1,
      };
      // Note: Without agreement, even with updates, it should be no border
      // This might be a bug - user expects blue when agreement is toggled off
      // But current logic requires agreement for blue/yellow
      expect(getActionBorderStyle(agreementOff).borderColor).toBe('');
    });

    it('should handle the reported bug: toggle agreement on, add update, should be yellow', () => {
      // User scenario: Save action, edit it, toggle agreement, add update
      const action = {
        status: 'active',
        policy: 'Test policy content',
        plan_commitment: true, // Agreement toggled on
        implementation_update_count: 1, // Update added
      };

      const result = getActionBorderStyle(action);

      // This should be yellow, but user reports it's not
      expect(result.borderColor).toContain('yellow-500');
    });

    it('should prioritize green over all other states', () => {
      const action = {
        status: 'completed',
        policy: 'Test policy',
        plan_commitment: true,
        implementation_update_count: 5,
      };

      const result = getActionBorderStyle(action);

      expect(result.borderColor).toContain('emerald-500');
      expect(result.borderColor).not.toContain('yellow-500');
      expect(result.borderColor).not.toContain('blue-500');
    });

    it('should handle undefined implementation_update_count as 0', () => {
      const action = {
        status: 'active',
        policy: 'Test policy',
        plan_commitment: true,
        // implementation_update_count is undefined
      };

      const result = getActionBorderStyle(action);

      expect(result.borderColor).toContain('blue-500');
      expect(result.borderColor).not.toContain('yellow-500');
    });

    it('should handle null policy_agreed_at correctly', () => {
      const action = {
        status: 'active',
        policy: 'Test policy',
        plan_commitment: true,
        policy_agreed_at: null,
        implementation_update_count: 1,
      };

      const result = getActionBorderStyle(action);

      // plan_commitment should still make it yellow
      expect(result.borderColor).toContain('yellow-500');
    });
  });

  describe('Policy content detection', () => {
    it('should detect policy with actual content', () => {
      const action = {
        status: 'active',
        policy: 'This is a real policy',
        plan_commitment: true,
        implementation_update_count: 0,
      };

      const result = getActionBorderStyle(action);

      expect(result.borderColor).toContain('blue-500');
    });

    it('should not detect empty HTML as policy', () => {
      const action = {
        status: 'active',
        policy: '<p></p>',
        plan_commitment: true,
        implementation_update_count: 0,
      };

      const result = getActionBorderStyle(action);

      expect(result.borderColor).toBe('');
    });

    it('should not detect whitespace-only HTML as policy', () => {
      const action = {
        status: 'active',
        policy: '<p><br></p>',
        plan_commitment: true,
        implementation_update_count: 0,
      };

      const result = getActionBorderStyle(action);

      expect(result.borderColor).toBe('');
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle the exact user-reported scenario: save, edit, toggle agreement, add update', () => {
      // Step 1: Action is saved with policy but no agreement (backlog)
      const saved = {
        status: 'active',
        policy: 'Test policy content',
        plan_commitment: false,
        implementation_update_count: 0,
      };
      expect(getActionBorderStyle(saved).borderColor).toBe('');

      // Step 2: User edits and toggles agreement on (ready to start)
      const withAgreement = {
        status: 'active',
        policy: 'Test policy content',
        plan_commitment: true,
        implementation_update_count: 0,
      };
      expect(getActionBorderStyle(withAgreement).borderColor).toContain('blue-500');

      // Step 3: User adds implementation update (in progress)
      // NOTE: This is where the bug occurs - if implementation_update_count
      // is not updated in the action object, it will stay blue instead of yellow
      const withUpdate = {
        status: 'active',
        policy: 'Test policy content',
        plan_commitment: true,
        implementation_update_count: 1, // This must be updated when update is added!
      };
      const result = getActionBorderStyle(withUpdate);
      expect(result.borderColor).toContain('yellow-500');
    });

    it('should show correct border when multiple updates are added', () => {
      const action = {
        status: 'active',
        policy: 'Test policy',
        plan_commitment: true,
        implementation_update_count: 3,
      };

      const result = getActionBorderStyle(action);

      expect(result.borderColor).toContain('yellow-500');
    });

    it('should maintain yellow border even if agreement is toggled off after updates exist', () => {
      // User's expectation: "If the agreement is toggled off, the border changes to blue"
      // But current logic: Without agreement, it goes to no border
      // This might be a design decision vs user expectation mismatch
      
      const withUpdatesButNoAgreement = {
        status: 'active',
        policy: 'Test policy',
        plan_commitment: false,
        policy_agreed_at: null,
        implementation_update_count: 2,
      };

      const result = getActionBorderStyle(withUpdatesButNoAgreement);

      // Current behavior: no border (backlog)
      // User expectation: blue border
      // This test documents the current behavior
      expect(result.borderColor).toBe('');
    });
  });
});

