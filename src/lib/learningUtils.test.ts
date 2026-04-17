/**
 * Unit Tests: Gap Computation and Severity Functions
 *
 * Tests the pure functions in learningUtils.ts that power the growth checklist.
 * Covers classifyGapSeverity, computeGapItems, sortGapsBySeverity,
 * computeGapSummary, and toBloomLevel.
 *
 * Validates: Requirements 1.2, 1.4, 1.5, 2.1, 2.3, 2.4, 2.5
 */

import { describe, it, expect } from 'vitest';
import {
  classifyGapSeverity,
  computeGapItems,
  sortGapsBySeverity,
  computeGapSummary,
  toBloomLevel,
} from './learningUtils';
import type { SkillProfile } from '@/hooks/useSkillProfile';
import type { CapabilityProfile } from '@/hooks/useCapability';

// --- Helpers ---

function makeSkillProfile(
  axes: Array<{ key: string; label: string; required_level: number }>
): SkillProfile {
  return {
    narrative: 'Test profile',
    axes,
    generated_at: '2025-01-01T00:00:00Z',
    approved_at: '2025-01-01T00:00:00Z',
  };
}

function makeCapabilityProfile(
  axes: Array<{ key: string; label: string; level: number }>
): CapabilityProfile {
  return {
    user_id: 'user-1',
    user_name: 'Test User',
    action_id: 'action-1',
    narrative: 'Test capability',
    axes: axes.map((a) => ({
      ...a,
      evidence_count: 0,
      evidence: [],
    })),
    total_evidence_count: 0,
    computed_at: '2025-01-01T00:00:00Z',
  };
}

// --- toBloomLevel ---

describe('toBloomLevel', () => {
  it('clamps 0 to 0', () => {
    expect(toBloomLevel(0)).toBe(0);
  });

  it('clamps 5 to 5', () => {
    expect(toBloomLevel(5)).toBe(5);
  });

  it('passes through valid integers', () => {
    expect(toBloomLevel(2)).toBe(2);
    expect(toBloomLevel(3)).toBe(3);
  });

  it('rounds to nearest integer', () => {
    expect(toBloomLevel(2.4)).toBe(2);
    expect(toBloomLevel(2.6)).toBe(3);
  });

  it('clamps values above 5 to 5', () => {
    expect(toBloomLevel(10)).toBe(5);
    expect(toBloomLevel(100)).toBe(5);
  });

  it('clamps negative values to 0', () => {
    expect(toBloomLevel(-1)).toBe(0);
  });
});

// --- classifyGapSeverity ---

describe('classifyGapSeverity', () => {
  it('returns "met" when currentLevel >= requiredLevel', () => {
    expect(classifyGapSeverity(3, 3)).toBe('met');
    expect(classifyGapSeverity(3, 4)).toBe('met');
    expect(classifyGapSeverity(0, 0)).toBe('met');
    expect(classifyGapSeverity(5, 5)).toBe('met');
  });

  it('returns "needs_learning" when currentLevel < 2 and < requiredLevel', () => {
    expect(classifyGapSeverity(3, 0)).toBe('needs_learning');
    expect(classifyGapSeverity(3, 1)).toBe('needs_learning');
    expect(classifyGapSeverity(2, 0)).toBe('needs_learning');
    expect(classifyGapSeverity(2, 1)).toBe('needs_learning');
  });

  it('returns "partial_readiness" when currentLevel >= 2 but < requiredLevel', () => {
    expect(classifyGapSeverity(3, 2)).toBe('partial_readiness');
    expect(classifyGapSeverity(5, 2)).toBe('partial_readiness');
    expect(classifyGapSeverity(5, 3)).toBe('partial_readiness');
    expect(classifyGapSeverity(5, 4)).toBe('partial_readiness');
  });

  it('handles boundary: currentLevel = 2, requiredLevel = 2 → met', () => {
    expect(classifyGapSeverity(2, 2)).toBe('met');
  });

  it('handles boundary: currentLevel = 1, requiredLevel = 1 → met', () => {
    expect(classifyGapSeverity(1, 1)).toBe('met');
  });
});

// --- computeGapItems ---

describe('computeGapItems', () => {
  it('returns empty array when all axes are met', () => {
    const skill = makeSkillProfile([
      { key: 'a', label: 'A', required_level: 3 },
      { key: 'b', label: 'B', required_level: 2 },
    ]);
    const cap = makeCapabilityProfile([
      { key: 'a', label: 'A', level: 3 },
      { key: 'b', label: 'B', level: 4 },
    ]);

    expect(computeGapItems(skill, cap)).toEqual([]);
  });

  it('returns gap items for axes where currentLevel < requiredLevel', () => {
    const skill = makeSkillProfile([
      { key: 'a', label: 'A', required_level: 3 },
      { key: 'b', label: 'B', required_level: 4 },
    ]);
    const cap = makeCapabilityProfile([
      { key: 'a', label: 'A', level: 3 }, // met
      { key: 'b', label: 'B', level: 1 }, // gap
    ]);

    const gaps = computeGapItems(skill, cap);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toEqual({
      axisKey: 'b',
      axisLabel: 'B',
      requiredLevel: 4,
      currentLevel: 1,
      severity: 'needs_learning',
      distanceBelowUnderstand: 1,
    });
  });

  it('returns all axes as gaps when all are below required', () => {
    const skill = makeSkillProfile([
      { key: 'a', label: 'A', required_level: 3 },
      { key: 'b', label: 'B', required_level: 4 },
    ]);
    const cap = makeCapabilityProfile([
      { key: 'a', label: 'A', level: 0 },
      { key: 'b', label: 'B', level: 1 },
    ]);

    const gaps = computeGapItems(skill, cap);
    expect(gaps).toHaveLength(2);
  });

  it('defaults to level 0 when capability axis is missing', () => {
    const skill = makeSkillProfile([
      { key: 'a', label: 'A', required_level: 3 },
    ]);
    const cap = makeCapabilityProfile([]); // no axes

    const gaps = computeGapItems(skill, cap);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].currentLevel).toBe(0);
    expect(gaps[0].severity).toBe('needs_learning');
    expect(gaps[0].distanceBelowUnderstand).toBe(2);
  });

  it('computes correct distanceBelowUnderstand', () => {
    const skill = makeSkillProfile([
      { key: 'a', label: 'A', required_level: 5 },
      { key: 'b', label: 'B', required_level: 5 },
      { key: 'c', label: 'C', required_level: 5 },
    ]);
    const cap = makeCapabilityProfile([
      { key: 'a', label: 'A', level: 0 }, // distance = 2
      { key: 'b', label: 'B', level: 1 }, // distance = 1
      { key: 'c', label: 'C', level: 3 }, // distance = 0
    ]);

    const gaps = computeGapItems(skill, cap);
    expect(gaps[0].distanceBelowUnderstand).toBe(2);
    expect(gaps[1].distanceBelowUnderstand).toBe(1);
    expect(gaps[2].distanceBelowUnderstand).toBe(0);
  });
});

// --- sortGapsBySeverity ---

describe('sortGapsBySeverity', () => {
  it('sorts by distanceBelowUnderstand descending', () => {
    const gaps = [
      { axisKey: 'a', axisLabel: 'A', requiredLevel: 5, currentLevel: 3, severity: 'partial_readiness' as const, distanceBelowUnderstand: 0 },
      { axisKey: 'b', axisLabel: 'B', requiredLevel: 5, currentLevel: 0, severity: 'needs_learning' as const, distanceBelowUnderstand: 2 },
      { axisKey: 'c', axisLabel: 'C', requiredLevel: 5, currentLevel: 1, severity: 'needs_learning' as const, distanceBelowUnderstand: 1 },
    ];

    const sorted = sortGapsBySeverity(gaps);
    expect(sorted.map((g) => g.axisKey)).toEqual(['b', 'c', 'a']);
  });

  it('maintains stable order for ties', () => {
    const gaps = [
      { axisKey: 'first', axisLabel: 'First', requiredLevel: 5, currentLevel: 0, severity: 'needs_learning' as const, distanceBelowUnderstand: 2 },
      { axisKey: 'second', axisLabel: 'Second', requiredLevel: 5, currentLevel: 0, severity: 'needs_learning' as const, distanceBelowUnderstand: 2 },
      { axisKey: 'third', axisLabel: 'Third', requiredLevel: 5, currentLevel: 0, severity: 'needs_learning' as const, distanceBelowUnderstand: 2 },
    ];

    const sorted = sortGapsBySeverity(gaps);
    expect(sorted.map((g) => g.axisKey)).toEqual(['first', 'second', 'third']);
  });

  it('does not mutate the original array', () => {
    const gaps = [
      { axisKey: 'a', axisLabel: 'A', requiredLevel: 5, currentLevel: 3, severity: 'partial_readiness' as const, distanceBelowUnderstand: 0 },
      { axisKey: 'b', axisLabel: 'B', requiredLevel: 5, currentLevel: 0, severity: 'needs_learning' as const, distanceBelowUnderstand: 2 },
    ];

    const sorted = sortGapsBySeverity(gaps);
    expect(gaps[0].axisKey).toBe('a'); // original unchanged
    expect(sorted[0].axisKey).toBe('b'); // sorted copy
  });

  it('returns empty array for empty input', () => {
    expect(sortGapsBySeverity([])).toEqual([]);
  });
});

// --- computeGapSummary ---

describe('computeGapSummary', () => {
  it('returns total axes and gap count', () => {
    const skill = makeSkillProfile([
      { key: 'a', label: 'A', required_level: 3 },
      { key: 'b', label: 'B', required_level: 4 },
      { key: 'c', label: 'C', required_level: 2 },
    ]);
    const cap = makeCapabilityProfile([
      { key: 'a', label: 'A', level: 3 }, // met
      { key: 'b', label: 'B', level: 1 }, // gap
      { key: 'c', label: 'C', level: 2 }, // met
    ]);

    const summary = computeGapSummary(skill, cap);
    expect(summary).toEqual({ total: 3, gaps: 1 });
  });

  it('returns 0 gaps when all met', () => {
    const skill = makeSkillProfile([
      { key: 'a', label: 'A', required_level: 2 },
    ]);
    const cap = makeCapabilityProfile([
      { key: 'a', label: 'A', level: 5 },
    ]);

    expect(computeGapSummary(skill, cap)).toEqual({ total: 1, gaps: 0 });
  });

  it('returns all as gaps when none met', () => {
    const skill = makeSkillProfile([
      { key: 'a', label: 'A', required_level: 5 },
      { key: 'b', label: 'B', required_level: 5 },
    ]);
    const cap = makeCapabilityProfile([
      { key: 'a', label: 'A', level: 0 },
      { key: 'b', label: 'B', level: 0 },
    ]);

    expect(computeGapSummary(skill, cap)).toEqual({ total: 2, gaps: 2 });
  });
});

// --- Quiz Evaluation Tests ---
// Validates: Requirements 4.5, 4.6, 4.8, 6.6

import {
  getIncompleteObjectives,
  isQuizComplete,
  computeQuizSummary,
} from './learningUtils';
import type { QuizAnswer } from './learningUtils';

// --- Helpers ---

function makeAnswer(overrides: Partial<QuizAnswer> = {}): QuizAnswer {
  return {
    questionId: 'q-1',
    objectiveId: 'obj-1',
    selectedAnswer: 'A',
    correctAnswer: 'A',
    wasFirstAttempt: true,
    wasCorrect: true,
    timestamp: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

// --- getIncompleteObjectives ---

describe('getIncompleteObjectives', () => {
  it('returns all objectives when no answers exist', () => {
    const result = getIncompleteObjectives(['obj-1', 'obj-2'], []);
    expect(result).toEqual(['obj-1', 'obj-2']);
  });

  it('returns empty array when all objectives have correct first-attempt answers', () => {
    const answers: QuizAnswer[] = [
      makeAnswer({ questionId: 'q-1', objectiveId: 'obj-1' }),
      makeAnswer({ questionId: 'q-2', objectiveId: 'obj-2' }),
    ];
    const result = getIncompleteObjectives(['obj-1', 'obj-2'], answers);
    expect(result).toEqual([]);
  });

  it('returns objectives that lack a correct first-attempt answer', () => {
    const answers: QuizAnswer[] = [
      makeAnswer({ questionId: 'q-1', objectiveId: 'obj-1' }),
      makeAnswer({ questionId: 'q-2', objectiveId: 'obj-2', wasCorrect: false }),
    ];
    const result = getIncompleteObjectives(['obj-1', 'obj-2', 'obj-3'], answers);
    expect(result).toEqual(['obj-2', 'obj-3']);
  });

  it('does not count correct non-first-attempt answers as complete', () => {
    const answers: QuizAnswer[] = [
      makeAnswer({ questionId: 'q-1', objectiveId: 'obj-1', wasFirstAttempt: false, wasCorrect: true }),
    ];
    const result = getIncompleteObjectives(['obj-1'], answers);
    expect(result).toEqual(['obj-1']);
  });

  it('returns empty array when objectiveIds is empty', () => {
    const result = getIncompleteObjectives([], [makeAnswer()]);
    expect(result).toEqual([]);
  });

  it('handles multiple answers for the same objective — completes if any is correct first-attempt', () => {
    const answers: QuizAnswer[] = [
      makeAnswer({ questionId: 'q-1', objectiveId: 'obj-1', wasFirstAttempt: true, wasCorrect: false }),
      makeAnswer({ questionId: 'q-2', objectiveId: 'obj-1', wasFirstAttempt: true, wasCorrect: true }),
    ];
    const result = getIncompleteObjectives(['obj-1'], answers);
    expect(result).toEqual([]);
  });
});

// --- isQuizComplete ---

describe('isQuizComplete', () => {
  it('returns true when all objectives have correct first-attempt answers', () => {
    const answers: QuizAnswer[] = [
      makeAnswer({ questionId: 'q-1', objectiveId: 'obj-1' }),
      makeAnswer({ questionId: 'q-2', objectiveId: 'obj-2' }),
    ];
    expect(isQuizComplete(['obj-1', 'obj-2'], answers)).toBe(true);
  });

  it('returns false when some objectives are incomplete', () => {
    const answers: QuizAnswer[] = [
      makeAnswer({ questionId: 'q-1', objectiveId: 'obj-1' }),
    ];
    expect(isQuizComplete(['obj-1', 'obj-2'], answers)).toBe(false);
  });

  it('returns true when objectiveIds is empty (vacuously true)', () => {
    expect(isQuizComplete([], [])).toBe(true);
  });

  it('returns false when no answers exist but objectives are required', () => {
    expect(isQuizComplete(['obj-1'], [])).toBe(false);
  });
});

// --- computeQuizSummary ---

describe('computeQuizSummary', () => {
  it('returns zeros for empty answers', () => {
    expect(computeQuizSummary([])).toEqual({
      totalQuestions: 0,
      correctFirstAttempt: 0,
    });
  });

  it('counts unique questions and correct first attempts', () => {
    const answers: QuizAnswer[] = [
      makeAnswer({ questionId: 'q-1', wasFirstAttempt: true, wasCorrect: true }),
      makeAnswer({ questionId: 'q-2', wasFirstAttempt: true, wasCorrect: false }),
      makeAnswer({ questionId: 'q-3', wasFirstAttempt: true, wasCorrect: true }),
    ];
    expect(computeQuizSummary(answers)).toEqual({
      totalQuestions: 3,
      correctFirstAttempt: 2,
    });
  });

  it('counts each question only once even with multiple answers', () => {
    const answers: QuizAnswer[] = [
      makeAnswer({ questionId: 'q-1', wasFirstAttempt: true, wasCorrect: false }),
      makeAnswer({ questionId: 'q-1', wasFirstAttempt: false, wasCorrect: true }),
      makeAnswer({ questionId: 'q-2', wasFirstAttempt: true, wasCorrect: true }),
    ];
    expect(computeQuizSummary(answers)).toEqual({
      totalQuestions: 2,
      correctFirstAttempt: 1,
    });
  });

  it('uses the first occurrence of a questionId for scoring', () => {
    const answers: QuizAnswer[] = [
      makeAnswer({ questionId: 'q-1', wasFirstAttempt: true, wasCorrect: true }),
      makeAnswer({ questionId: 'q-1', wasFirstAttempt: false, wasCorrect: false }),
    ];
    expect(computeQuizSummary(answers)).toEqual({
      totalQuestions: 1,
      correctFirstAttempt: 1,
    });
  });

  it('handles all incorrect first attempts', () => {
    const answers: QuizAnswer[] = [
      makeAnswer({ questionId: 'q-1', wasFirstAttempt: true, wasCorrect: false }),
      makeAnswer({ questionId: 'q-2', wasFirstAttempt: true, wasCorrect: false }),
    ];
    expect(computeQuizSummary(answers)).toEqual({
      totalQuestions: 2,
      correctFirstAttempt: 0,
    });
  });
});

// --- Learning Progress Tests ---
// Validates: Requirements 4.9, 7.1, 7.2, 7.3, 7.4

import {
  deriveObjectiveStatus,
  isAxisComplete,
  isAllLearningComplete,
  computeAxisProgress,
} from './learningUtils';
import type { KnowledgeState, ObjectiveProgress } from './learningUtils';

// --- Helpers ---

function makeKnowledgeState(overrides: Partial<KnowledgeState> = {}): KnowledgeState {
  return {
    objectiveId: 'obj-1',
    wasFirstAttempt: false,
    wasCorrect: false,
    isDemonstration: false,
    ...overrides,
  };
}

function makeObjectiveProgress(overrides: Partial<ObjectiveProgress> = {}): ObjectiveProgress {
  return {
    objectiveId: 'obj-1',
    status: 'not_started',
    completionType: null,
    ...overrides,
  };
}

// --- deriveObjectiveStatus ---

describe('deriveObjectiveStatus', () => {
  it('returns not_started when no knowledge states exist for the objective', () => {
    const result = deriveObjectiveStatus('obj-1', []);
    expect(result).toEqual({ status: 'not_started', completionType: null });
  });

  it('returns not_started when knowledge states exist but none match the objectiveId', () => {
    const states = [
      makeKnowledgeState({ objectiveId: 'obj-other', wasFirstAttempt: true, wasCorrect: true }),
    ];
    const result = deriveObjectiveStatus('obj-1', states);
    expect(result).toEqual({ status: 'not_started', completionType: null });
  });

  it('returns completed/quiz when a correct first-attempt answer exists', () => {
    const states = [
      makeKnowledgeState({ objectiveId: 'obj-1', wasFirstAttempt: true, wasCorrect: true }),
    ];
    const result = deriveObjectiveStatus('obj-1', states);
    expect(result).toEqual({ status: 'completed', completionType: 'quiz' });
  });

  it('returns completed/demonstrated when a demonstration state exists', () => {
    const states = [
      makeKnowledgeState({ objectiveId: 'obj-1', isDemonstration: true }),
    ];
    const result = deriveObjectiveStatus('obj-1', states);
    expect(result).toEqual({ status: 'completed', completionType: 'demonstrated' });
  });

  it('quiz completion takes precedence over demonstration', () => {
    const states = [
      makeKnowledgeState({ objectiveId: 'obj-1', isDemonstration: true }),
      makeKnowledgeState({ objectiveId: 'obj-1', wasFirstAttempt: true, wasCorrect: true }),
    ];
    const result = deriveObjectiveStatus('obj-1', states);
    expect(result).toEqual({ status: 'completed', completionType: 'quiz' });
  });

  it('returns in_progress when states exist but no correct first-attempt or demonstration', () => {
    const states = [
      makeKnowledgeState({ objectiveId: 'obj-1', wasFirstAttempt: true, wasCorrect: false }),
      makeKnowledgeState({ objectiveId: 'obj-1', wasFirstAttempt: false, wasCorrect: true }),
    ];
    const result = deriveObjectiveStatus('obj-1', states);
    expect(result).toEqual({ status: 'in_progress', completionType: null });
  });

  it('returns in_progress when only incorrect answers exist', () => {
    const states = [
      makeKnowledgeState({ objectiveId: 'obj-1', wasFirstAttempt: true, wasCorrect: false }),
    ];
    const result = deriveObjectiveStatus('obj-1', states);
    expect(result).toEqual({ status: 'in_progress', completionType: null });
  });

  it('handles mixed knowledge states for multiple objectives', () => {
    const states = [
      makeKnowledgeState({ objectiveId: 'obj-1', wasFirstAttempt: true, wasCorrect: true }),
      makeKnowledgeState({ objectiveId: 'obj-2', wasFirstAttempt: true, wasCorrect: false }),
      makeKnowledgeState({ objectiveId: 'obj-3', isDemonstration: true }),
    ];
    expect(deriveObjectiveStatus('obj-1', states)).toEqual({ status: 'completed', completionType: 'quiz' });
    expect(deriveObjectiveStatus('obj-2', states)).toEqual({ status: 'in_progress', completionType: null });
    expect(deriveObjectiveStatus('obj-3', states)).toEqual({ status: 'completed', completionType: 'demonstrated' });
  });
});

// --- isAxisComplete ---

describe('isAxisComplete', () => {
  it('returns true when all objectives are completed', () => {
    const objectives: ObjectiveProgress[] = [
      makeObjectiveProgress({ objectiveId: 'obj-1', status: 'completed', completionType: 'quiz' }),
      makeObjectiveProgress({ objectiveId: 'obj-2', status: 'completed', completionType: 'demonstrated' }),
    ];
    expect(isAxisComplete(objectives)).toBe(true);
  });

  it('returns false when any objective is not completed', () => {
    const objectives: ObjectiveProgress[] = [
      makeObjectiveProgress({ objectiveId: 'obj-1', status: 'completed', completionType: 'quiz' }),
      makeObjectiveProgress({ objectiveId: 'obj-2', status: 'in_progress' }),
    ];
    expect(isAxisComplete(objectives)).toBe(false);
  });

  it('returns false when any objective is not_started', () => {
    const objectives: ObjectiveProgress[] = [
      makeObjectiveProgress({ objectiveId: 'obj-1', status: 'completed', completionType: 'quiz' }),
      makeObjectiveProgress({ objectiveId: 'obj-2', status: 'not_started' }),
    ];
    expect(isAxisComplete(objectives)).toBe(false);
  });

  it('returns true for empty array (vacuously true)', () => {
    expect(isAxisComplete([])).toBe(true);
  });

  it('returns false when all objectives are in_progress', () => {
    const objectives: ObjectiveProgress[] = [
      makeObjectiveProgress({ objectiveId: 'obj-1', status: 'in_progress' }),
      makeObjectiveProgress({ objectiveId: 'obj-2', status: 'in_progress' }),
    ];
    expect(isAxisComplete(objectives)).toBe(false);
  });
});

// --- isAllLearningComplete ---

describe('isAllLearningComplete', () => {
  it('returns true when all axes have all objectives completed', () => {
    const axisObjectives = new Map<string, ObjectiveProgress[]>([
      ['axis-1', [
        makeObjectiveProgress({ objectiveId: 'obj-1', status: 'completed', completionType: 'quiz' }),
      ]],
      ['axis-2', [
        makeObjectiveProgress({ objectiveId: 'obj-2', status: 'completed', completionType: 'demonstrated' }),
      ]],
    ]);
    expect(isAllLearningComplete(axisObjectives)).toBe(true);
  });

  it('returns false when any axis has incomplete objectives', () => {
    const axisObjectives = new Map<string, ObjectiveProgress[]>([
      ['axis-1', [
        makeObjectiveProgress({ objectiveId: 'obj-1', status: 'completed', completionType: 'quiz' }),
      ]],
      ['axis-2', [
        makeObjectiveProgress({ objectiveId: 'obj-2', status: 'in_progress' }),
      ]],
    ]);
    expect(isAllLearningComplete(axisObjectives)).toBe(false);
  });

  it('returns true for empty map (vacuously true)', () => {
    expect(isAllLearningComplete(new Map())).toBe(true);
  });

  it('returns false when one axis is complete and another has not_started objectives', () => {
    const axisObjectives = new Map<string, ObjectiveProgress[]>([
      ['axis-1', [
        makeObjectiveProgress({ objectiveId: 'obj-1', status: 'completed', completionType: 'quiz' }),
      ]],
      ['axis-2', [
        makeObjectiveProgress({ objectiveId: 'obj-2', status: 'not_started' }),
      ]],
    ]);
    expect(isAllLearningComplete(axisObjectives)).toBe(false);
  });

  it('handles axes with empty objective arrays (vacuously complete)', () => {
    const axisObjectives = new Map<string, ObjectiveProgress[]>([
      ['axis-1', []],
      ['axis-2', [
        makeObjectiveProgress({ objectiveId: 'obj-1', status: 'completed', completionType: 'quiz' }),
      ]],
    ]);
    expect(isAllLearningComplete(axisObjectives)).toBe(true);
  });
});

// --- computeAxisProgress ---

describe('computeAxisProgress', () => {
  it('returns correct completed and total counts', () => {
    const objectives: ObjectiveProgress[] = [
      makeObjectiveProgress({ objectiveId: 'obj-1', status: 'completed', completionType: 'quiz' }),
      makeObjectiveProgress({ objectiveId: 'obj-2', status: 'in_progress' }),
      makeObjectiveProgress({ objectiveId: 'obj-3', status: 'not_started' }),
      makeObjectiveProgress({ objectiveId: 'obj-4', status: 'completed', completionType: 'demonstrated' }),
    ];
    expect(computeAxisProgress(objectives)).toEqual({ completed: 2, total: 4 });
  });

  it('returns all completed when every objective is done', () => {
    const objectives: ObjectiveProgress[] = [
      makeObjectiveProgress({ objectiveId: 'obj-1', status: 'completed', completionType: 'quiz' }),
      makeObjectiveProgress({ objectiveId: 'obj-2', status: 'completed', completionType: 'demonstrated' }),
    ];
    expect(computeAxisProgress(objectives)).toEqual({ completed: 2, total: 2 });
  });

  it('returns zero completed when none are done', () => {
    const objectives: ObjectiveProgress[] = [
      makeObjectiveProgress({ objectiveId: 'obj-1', status: 'not_started' }),
      makeObjectiveProgress({ objectiveId: 'obj-2', status: 'in_progress' }),
    ];
    expect(computeAxisProgress(objectives)).toEqual({ completed: 0, total: 2 });
  });

  it('returns zeros for empty array', () => {
    expect(computeAxisProgress([])).toEqual({ completed: 0, total: 0 });
  });
});


// --- Self-Assessment Comparison Tests ---
// Validates: Requirements 9.4

import { compareAssessments } from './learningUtils';
import type { VerificationResult } from './learningUtils';

describe('compareAssessments', () => {
  it('returns all confirmed when both sets are identical', () => {
    const result = compareAssessments(['a', 'b', 'c'], ['a', 'b', 'c']);
    expect(result.confirmed.sort()).toEqual(['a', 'b', 'c']);
    expect(result.unconfirmed).toEqual([]);
    expect(result.aiDetected).toEqual([]);
  });

  it('returns all unconfirmed when AI set is empty', () => {
    const result = compareAssessments(['a', 'b'], []);
    expect(result.confirmed).toEqual([]);
    expect(result.unconfirmed.sort()).toEqual(['a', 'b']);
    expect(result.aiDetected).toEqual([]);
  });

  it('returns all aiDetected when self-assessed set is empty', () => {
    const result = compareAssessments([], ['x', 'y']);
    expect(result.confirmed).toEqual([]);
    expect(result.unconfirmed).toEqual([]);
    expect(result.aiDetected.sort()).toEqual(['x', 'y']);
  });

  it('returns empty results when both sets are empty', () => {
    const result = compareAssessments([], []);
    expect(result).toEqual({ confirmed: [], unconfirmed: [], aiDetected: [] });
  });

  it('correctly partitions overlapping sets', () => {
    const result = compareAssessments(['a', 'b', 'c'], ['b', 'c', 'd']);
    expect(result.confirmed.sort()).toEqual(['b', 'c']);
    expect(result.unconfirmed).toEqual(['a']);
    expect(result.aiDetected).toEqual(['d']);
  });

  it('correctly partitions completely disjoint sets', () => {
    const result = compareAssessments(['a', 'b'], ['x', 'y']);
    expect(result.confirmed).toEqual([]);
    expect(result.unconfirmed.sort()).toEqual(['a', 'b']);
    expect(result.aiDetected.sort()).toEqual(['x', 'y']);
  });

  it('produces three disjoint sets', () => {
    const result = compareAssessments(['a', 'b', 'c'], ['b', 'd', 'e']);
    const allIds = [...result.confirmed, ...result.unconfirmed, ...result.aiDetected];
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(allIds.length);
  });

  it('union of three sets equals union of inputs', () => {
    const self = ['a', 'b', 'c'];
    const ai = ['b', 'd', 'e'];
    const result = compareAssessments(self, ai);

    const resultUnion = new Set([...result.confirmed, ...result.unconfirmed, ...result.aiDetected]);
    const inputUnion = new Set([...self, ...ai]);
    expect(resultUnion).toEqual(inputUnion);
  });

  it('handles duplicate IDs in self-assessed input', () => {
    const result = compareAssessments(['a', 'a', 'b'], ['a']);
    expect(result.confirmed).toEqual(['a']);
    expect(result.unconfirmed).toEqual(['b']);
    expect(result.aiDetected).toEqual([]);
  });

  it('handles duplicate IDs in AI-evaluated input', () => {
    const result = compareAssessments(['a'], ['a', 'a', 'b']);
    expect(result.confirmed).toEqual(['a']);
    expect(result.unconfirmed).toEqual([]);
    expect(result.aiDetected).toEqual(['b']);
  });

  it('handles single element in each set with overlap', () => {
    const result = compareAssessments(['x'], ['x']);
    expect(result).toEqual({ confirmed: ['x'], unconfirmed: [], aiDetected: [] });
  });

  it('handles single element in each set without overlap', () => {
    const result = compareAssessments(['x'], ['y']);
    expect(result).toEqual({ confirmed: [], unconfirmed: ['x'], aiDetected: ['y'] });
  });
});


// --- State Text Format Tests ---
// Validates: Requirements 5.1, 5.2

import {
  composeLearningObjectiveStateText,
  parseLearningObjectiveStateText,
  composeKnowledgeStateText,
  parseKnowledgeStateText,
} from './learningUtils';

// --- composeLearningObjectiveStateText ---

describe('composeLearningObjectiveStateText', () => {
  it('produces the canonical format', () => {
    const result = composeLearningObjectiveStateText(
      'chemistry_understanding',
      'action-123',
      'user-456',
      'Understand why the water-to-cement ratio affects concrete strength'
    );
    expect(result).toBe(
      '[learning_objective] axis=chemistry_understanding action=action-123 user=user-456 | Understand why the water-to-cement ratio affects concrete strength'
    );
  });

  it('handles UUID-style IDs', () => {
    const result = composeLearningObjectiveStateText(
      'safety_protocols',
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      'f0e1d2c3-b4a5-6789-0123-456789abcdef',
      'Understand PPE requirements for chemical handling'
    );
    expect(result).toContain('[learning_objective]');
    expect(result).toContain('axis=safety_protocols');
    expect(result).toContain('action=a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    expect(result).toContain('user=f0e1d2c3-b4a5-6789-0123-456789abcdef');
    expect(result).toContain('| Understand PPE requirements for chemical handling');
  });
});

// --- parseLearningObjectiveStateText ---

describe('parseLearningObjectiveStateText', () => {
  it('extracts all fields from a valid state_text', () => {
    const stateText =
      '[learning_objective] axis=chemistry_understanding action=action-123 user=user-456 | Understand why the water-to-cement ratio affects concrete strength';
    const result = parseLearningObjectiveStateText(stateText);
    expect(result).toEqual({
      axisKey: 'chemistry_understanding',
      actionId: 'action-123',
      userId: 'user-456',
      objectiveText: 'Understand why the water-to-cement ratio affects concrete strength',
    });
  });

  it('returns null for empty string', () => {
    expect(parseLearningObjectiveStateText('')).toBeNull();
  });

  it('returns null for missing prefix', () => {
    expect(
      parseLearningObjectiveStateText(
        'axis=key action=id user=id | Some text'
      )
    ).toBeNull();
  });

  it('returns null for missing pipe separator', () => {
    expect(
      parseLearningObjectiveStateText(
        '[learning_objective] axis=key action=id user=id Some text'
      )
    ).toBeNull();
  });

  it('returns null for random text', () => {
    expect(parseLearningObjectiveStateText('Hello world')).toBeNull();
  });

  it('handles objective text containing special characters', () => {
    const stateText =
      '[learning_objective] axis=math action=a1 user=u1 | Understand why x² + y² = z² (Pythagorean theorem)';
    const result = parseLearningObjectiveStateText(stateText);
    expect(result).not.toBeNull();
    expect(result!.objectiveText).toBe(
      'Understand why x² + y² = z² (Pythagorean theorem)'
    );
  });

  it('round-trips with compose', () => {
    const axisKey = 'chemistry_understanding';
    const actionId = 'action-uuid-123';
    const userId = 'user-uuid-456';
    const objectiveText = 'Understand why curing time matters for structural integrity';

    const composed = composeLearningObjectiveStateText(axisKey, actionId, userId, objectiveText);
    const parsed = parseLearningObjectiveStateText(composed);

    expect(parsed).toEqual({ axisKey, actionId, userId, objectiveText });
  });
});

// --- composeKnowledgeStateText ---

describe('composeKnowledgeStateText', () => {
  it('produces correct format for a correct answer', () => {
    const result = composeKnowledgeStateText(
      'Understand water-cement ratio',
      'Why does adding too much water weaken concrete?',
      'Excess water creates voids when it evaporates',
      true
    );
    expect(result).toBe(
      "For learning objective 'Understand water-cement ratio' and question 'Why does adding too much water weaken concrete?', I selected 'Excess water creates voids when it evaporates' which was the correct answer."
    );
  });

  it('produces correct format for an incorrect answer', () => {
    const result = composeKnowledgeStateText(
      'Understand water-cement ratio',
      'Why does adding too much water weaken concrete?',
      'It makes the concrete dry faster',
      false
    );
    expect(result).toBe(
      "For learning objective 'Understand water-cement ratio' and question 'Why does adding too much water weaken concrete?', I selected 'It makes the concrete dry faster' which was the incorrect answer."
    );
  });
});

// --- parseKnowledgeStateText ---

describe('parseKnowledgeStateText', () => {
  it('extracts all fields from a correct answer state_text', () => {
    const stateText =
      "For learning objective 'Understand water-cement ratio' and question 'Why does adding too much water weaken concrete?', I selected 'Excess water creates voids' which was the correct answer.";
    const result = parseKnowledgeStateText(stateText);
    expect(result).toEqual({
      objectiveText: 'Understand water-cement ratio',
      questionText: 'Why does adding too much water weaken concrete?',
      selectedAnswer: 'Excess water creates voids',
      wasCorrect: true,
    });
  });

  it('extracts all fields from an incorrect answer state_text', () => {
    const stateText =
      "For learning objective 'Understand curing' and question 'What happens if concrete is not cured?', I selected 'Nothing' which was the incorrect answer.";
    const result = parseKnowledgeStateText(stateText);
    expect(result).toEqual({
      objectiveText: 'Understand curing',
      questionText: 'What happens if concrete is not cured?',
      selectedAnswer: 'Nothing',
      wasCorrect: false,
    });
  });

  it('returns null for empty string', () => {
    expect(parseKnowledgeStateText('')).toBeNull();
  });

  it('returns null for random text', () => {
    expect(parseKnowledgeStateText('Hello world')).toBeNull();
  });

  it('returns null for missing trailing period', () => {
    expect(
      parseKnowledgeStateText(
        "For learning objective 'obj' and question 'q', I selected 'a' which was the correct answer"
      )
    ).toBeNull();
  });

  it('returns null for invalid correctness value', () => {
    expect(
      parseKnowledgeStateText(
        "For learning objective 'obj' and question 'q', I selected 'a' which was the wrong answer."
      )
    ).toBeNull();
  });

  it('round-trips with compose for correct answer', () => {
    const objectiveText = 'Understand why curing time matters';
    const questionText = 'What is the purpose of curing concrete?';
    const selectedAnswer = 'To allow hydration to complete for maximum strength';
    const wasCorrect = true;

    const composed = composeKnowledgeStateText(objectiveText, questionText, selectedAnswer, wasCorrect);
    const parsed = parseKnowledgeStateText(composed);

    expect(parsed).toEqual({ objectiveText, questionText, selectedAnswer, wasCorrect });
  });

  it('round-trips with compose for incorrect answer', () => {
    const objectiveText = 'Understand safety protocols';
    const questionText = 'When should you wear gloves?';
    const selectedAnswer = 'Only when it is cold outside';
    const wasCorrect = false;

    const composed = composeKnowledgeStateText(objectiveText, questionText, selectedAnswer, wasCorrect);
    const parsed = parseKnowledgeStateText(composed);

    expect(parsed).toEqual({ objectiveText, questionText, selectedAnswer, wasCorrect });
  });
});
