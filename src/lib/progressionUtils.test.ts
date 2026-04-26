/**
 * Unit Tests: Progression Level Derivation and Bridging Functions
 *
 * Tests deriveProgressionLevel and isBridgingComplete in progressionUtils.ts.
 * These functions determine the current question type for a learner based on
 * their stored knowledge states.
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 7.7, 7.9
 */

import { describe, it, expect } from 'vitest';
import {
  deriveProgressionLevel,
  isBridgingComplete,
  questionTypeToBloomLevel,
} from './progressionUtils';
import type { ParsedOpenFormState } from '@/lib/learningUtils';

// --- Helpers ---

function makeState(
  overrides: Partial<ParsedOpenFormState> = {}
): ParsedOpenFormState {
  return {
    objectiveText: 'Test objective',
    questionType: 'bridging',
    questionText: 'Test question',
    responseText: 'Test response',
    idealAnswer: 'Test ideal',
    evaluationStatus: 'sufficient',
    continuousScore: 1.0,
    reasoning: 'Good response',
    ...overrides,
  };
}

// --- deriveProgressionLevel ---

describe('deriveProgressionLevel', () => {
  it('returns recognition when recognitionComplete is false and no states exist', () => {
    const result = deriveProgressionLevel([], false);
    expect(result).toEqual({ currentLevel: 'recognition', bloomLevel: 1 });
  });

  it('returns recognition when recognitionComplete is false even with open-form states', () => {
    const states = [makeState({ questionType: 'bridging', evaluationStatus: 'sufficient' })];
    const result = deriveProgressionLevel(states, false);
    expect(result).toEqual({ currentLevel: 'recognition', bloomLevel: 1 });
  });

  it('returns bridging when recognition is complete but no bridging states exist', () => {
    const result = deriveProgressionLevel([], true);
    expect(result).toEqual({ currentLevel: 'bridging', bloomLevel: 1 });
  });

  it('returns bridging when recognition is complete but bridging is pending', () => {
    const states = [makeState({ questionType: 'bridging', evaluationStatus: 'pending', continuousScore: null })];
    const result = deriveProgressionLevel(states, true);
    expect(result).toEqual({ currentLevel: 'bridging', bloomLevel: 1 });
  });

  it('returns bridging when recognition is complete but bridging has error status', () => {
    const states = [makeState({ questionType: 'bridging', evaluationStatus: 'error', continuousScore: null })];
    const result = deriveProgressionLevel(states, true);
    expect(result).toEqual({ currentLevel: 'bridging', bloomLevel: 1 });
  });

  it('returns self_explanation when bridging is sufficient', () => {
    const states = [makeState({ questionType: 'bridging', evaluationStatus: 'sufficient', continuousScore: 1.0 })];
    const result = deriveProgressionLevel(states, true);
    expect(result).toEqual({ currentLevel: 'self_explanation', bloomLevel: 2 });
  });

  it('returns self_explanation when self_explanation exists but is insufficient', () => {
    const states = [
      makeState({ questionType: 'bridging', evaluationStatus: 'sufficient', continuousScore: 1.0 }),
      makeState({ questionType: 'self_explanation', evaluationStatus: 'insufficient', continuousScore: 1.5 }),
    ];
    const result = deriveProgressionLevel(states, true);
    expect(result).toEqual({ currentLevel: 'self_explanation', bloomLevel: 2 });
  });

  it('stays at self_explanation when sufficient but score below threshold (2.0)', () => {
    const states = [
      makeState({ questionType: 'bridging', evaluationStatus: 'sufficient', continuousScore: 1.0 }),
      makeState({ questionType: 'self_explanation', evaluationStatus: 'sufficient', continuousScore: 1.8 }),
    ];
    const result = deriveProgressionLevel(states, true);
    // self_explanation is sufficient but score < 2.0, so level is not complete
    // The learner stays at self_explanation
    expect(result).toEqual({ currentLevel: 'self_explanation', bloomLevel: 2 });
  });

  it('advances to application when self_explanation score meets threshold (2.0)', () => {
    const states = [
      makeState({ questionType: 'bridging', evaluationStatus: 'sufficient', continuousScore: 1.0 }),
      makeState({ questionType: 'self_explanation', evaluationStatus: 'sufficient', continuousScore: 2.0 }),
    ];
    const result = deriveProgressionLevel(states, true);
    expect(result).toEqual({ currentLevel: 'application', bloomLevel: 3 });
  });

  it('advances to application when self_explanation score exceeds threshold (2.8)', () => {
    const states = [
      makeState({ questionType: 'bridging', evaluationStatus: 'sufficient', continuousScore: 1.0 }),
      makeState({ questionType: 'self_explanation', evaluationStatus: 'sufficient', continuousScore: 2.8 }),
    ];
    const result = deriveProgressionLevel(states, true);
    expect(result).toEqual({ currentLevel: 'application', bloomLevel: 3 });
  });

  it('advances to analysis when application score meets threshold (3.0)', () => {
    const states = [
      makeState({ questionType: 'bridging', evaluationStatus: 'sufficient', continuousScore: 1.0 }),
      makeState({ questionType: 'self_explanation', evaluationStatus: 'sufficient', continuousScore: 2.5 }),
      makeState({ questionType: 'application', evaluationStatus: 'sufficient', continuousScore: 3.0 }),
    ];
    const result = deriveProgressionLevel(states, true);
    expect(result).toEqual({ currentLevel: 'analysis', bloomLevel: 4 });
  });

  it('advances to synthesis when analysis score meets threshold (4.0)', () => {
    const states = [
      makeState({ questionType: 'bridging', evaluationStatus: 'sufficient', continuousScore: 1.0 }),
      makeState({ questionType: 'self_explanation', evaluationStatus: 'sufficient', continuousScore: 2.5 }),
      makeState({ questionType: 'application', evaluationStatus: 'sufficient', continuousScore: 3.5 }),
      makeState({ questionType: 'analysis', evaluationStatus: 'sufficient', continuousScore: 4.0 }),
    ];
    const result = deriveProgressionLevel(states, true);
    expect(result).toEqual({ currentLevel: 'synthesis', bloomLevel: 5 });
  });

  it('returns synthesis when all levels are complete', () => {
    const states = [
      makeState({ questionType: 'bridging', evaluationStatus: 'sufficient', continuousScore: 1.0 }),
      makeState({ questionType: 'self_explanation', evaluationStatus: 'sufficient', continuousScore: 2.5 }),
      makeState({ questionType: 'application', evaluationStatus: 'sufficient', continuousScore: 3.5 }),
      makeState({ questionType: 'analysis', evaluationStatus: 'sufficient', continuousScore: 4.5 }),
      makeState({ questionType: 'synthesis', evaluationStatus: 'sufficient', continuousScore: 5.0 }),
    ];
    const result = deriveProgressionLevel(states, true);
    expect(result).toEqual({ currentLevel: 'synthesis', bloomLevel: 5 });
  });

  it('never skips levels — ignores higher-level states when lower level is incomplete', () => {
    // Has application state but no self_explanation — should stay at self_explanation
    const states = [
      makeState({ questionType: 'bridging', evaluationStatus: 'sufficient', continuousScore: 1.0 }),
      makeState({ questionType: 'application', evaluationStatus: 'sufficient', continuousScore: 3.5 }),
    ];
    const result = deriveProgressionLevel(states, true);
    expect(result).toEqual({ currentLevel: 'self_explanation', bloomLevel: 2 });
  });

  it('treats pending evaluations as incomplete', () => {
    const states = [
      makeState({ questionType: 'bridging', evaluationStatus: 'sufficient', continuousScore: 1.0 }),
      makeState({ questionType: 'self_explanation', evaluationStatus: 'pending', continuousScore: null }),
    ];
    const result = deriveProgressionLevel(states, true);
    expect(result).toEqual({ currentLevel: 'self_explanation', bloomLevel: 2 });
  });

  it('treats error evaluations as incomplete', () => {
    const states = [
      makeState({ questionType: 'bridging', evaluationStatus: 'sufficient', continuousScore: 1.0 }),
      makeState({ questionType: 'self_explanation', evaluationStatus: 'error', continuousScore: null }),
    ];
    const result = deriveProgressionLevel(states, true);
    expect(result).toEqual({ currentLevel: 'self_explanation', bloomLevel: 2 });
  });

  it('uses the best score among multiple states for the same type', () => {
    const states = [
      makeState({ questionType: 'bridging', evaluationStatus: 'sufficient', continuousScore: 1.0 }),
      makeState({ questionType: 'self_explanation', evaluationStatus: 'sufficient', continuousScore: 1.5 }),
      makeState({ questionType: 'self_explanation', evaluationStatus: 'sufficient', continuousScore: 2.3 }),
    ];
    const result = deriveProgressionLevel(states, true);
    // The second self_explanation state has score 2.3 ≥ 2.0, so level is complete
    expect(result).toEqual({ currentLevel: 'application', bloomLevel: 3 });
  });

  it('returned bloomLevel matches questionTypeToBloomLevel for the currentLevel', () => {
    const states = [
      makeState({ questionType: 'bridging', evaluationStatus: 'sufficient', continuousScore: 1.0 }),
      makeState({ questionType: 'self_explanation', evaluationStatus: 'sufficient', continuousScore: 2.5 }),
    ];
    const result = deriveProgressionLevel(states, true);
    expect(result.bloomLevel).toBe(questionTypeToBloomLevel(result.currentLevel));
  });
});

// --- isBridgingComplete ---

describe('isBridgingComplete', () => {
  it('returns false when no states exist', () => {
    expect(isBridgingComplete([], 'test_axis')).toBe(false);
  });

  it('returns false when only non-bridging states exist', () => {
    const states = [
      makeState({ questionType: 'self_explanation', evaluationStatus: 'sufficient' }),
    ];
    expect(isBridgingComplete(states, 'test_axis')).toBe(false);
  });

  it('returns false when bridging state is pending', () => {
    const states = [
      makeState({ questionType: 'bridging', evaluationStatus: 'pending', continuousScore: null }),
    ];
    expect(isBridgingComplete(states, 'test_axis')).toBe(false);
  });

  it('returns false when bridging state has error status', () => {
    const states = [
      makeState({ questionType: 'bridging', evaluationStatus: 'error', continuousScore: null }),
    ];
    expect(isBridgingComplete(states, 'test_axis')).toBe(false);
  });

  it('returns false when bridging state is insufficient', () => {
    const states = [
      makeState({ questionType: 'bridging', evaluationStatus: 'insufficient', continuousScore: 0.5 }),
    ];
    expect(isBridgingComplete(states, 'test_axis')).toBe(false);
  });

  it('returns true when bridging state is sufficient', () => {
    const states = [
      makeState({ questionType: 'bridging', evaluationStatus: 'sufficient', continuousScore: 1.0 }),
    ];
    expect(isBridgingComplete(states, 'test_axis')).toBe(true);
  });

  it('returns true when at least one bridging state is sufficient among multiple', () => {
    const states = [
      makeState({ questionType: 'bridging', evaluationStatus: 'pending', continuousScore: null }),
      makeState({ questionType: 'bridging', evaluationStatus: 'sufficient', continuousScore: 1.0 }),
    ];
    expect(isBridgingComplete(states, 'test_axis')).toBe(true);
  });

  it('returns true regardless of axisKey value (caller pre-filters)', () => {
    const states = [
      makeState({ questionType: 'bridging', evaluationStatus: 'sufficient', continuousScore: 1.0 }),
    ];
    expect(isBridgingComplete(states, 'any_axis')).toBe(true);
    expect(isBridgingComplete(states, 'different_axis')).toBe(true);
  });
});
