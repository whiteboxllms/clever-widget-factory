import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/lib/apiService';
import { learningObjectivesQueryKey } from '@/lib/queryKeys';

// --- Types ---

export interface LearningObjective {
  id: string;
  text: string;
  evidenceTag: 'no_evidence' | 'some_evidence' | 'previously_correct';
  status: 'not_started' | 'in_progress' | 'completed';
  completionType: 'quiz' | 'demonstrated' | null;
}

export interface LearningAxis {
  axisKey: string;
  axisLabel: string;
  requiredLevel: number;
  currentLevel: number;
  objectives: LearningObjective[];
}

export interface LearningObjectivesResponse {
  axes: LearningAxis[];
}

export interface QuizGenerationRequest {
  actionId: string;
  userId: string;
  axisKey: string;
  objectiveIds: string[];
  previousAnswers: {
    objectiveId: string;
    questionText: string;
    selectedAnswer: string;
    correctAnswer: string;
    wasCorrect: boolean;
  }[];
}

export interface QuizQuestion {
  id: string;
  objectiveId: string;
  type: string;
  text: string;
  photoUrl: string | null;
  options: {
    index: number;
    text: string;
    explanation: string;
  }[];
  correctIndex: number;
}

export interface QuizGenerationResponse {
  questions: QuizQuestion[];
}

export interface ObservationVerificationRequest {
  actionId: string;
  observationId: string;
  selfAssessedObjectiveIds: string[];
  userId: string;
}

export interface VerificationResponse {
  confirmed: string[];
  unconfirmed: string[];
  aiDetected: string[];
}

// --- Hooks ---

/**
 * Query hook to fetch learning objectives for a user on an action.
 * GET /api/learning/:actionId/:userId/objectives
 * Enabled only when both actionId and userId are truthy.
 * Requirements: 3.5.1
 */
export function useLearningObjectives(
  actionId: string | undefined,
  userId: string | undefined
) {
  return useQuery({
    queryKey: learningObjectivesQueryKey(actionId!, userId!),
    queryFn: async () => {
      const result = await apiService.get<{ data: LearningObjectivesResponse }>(
        `/learning/${actionId}/${userId}/objectives`
      );
      return result.data;
    },
    enabled: !!(actionId && userId),
    staleTime: 60000, // 1 minute — objectives may be generated on first request
  });
}

/**
 * Mutation hook to generate quiz questions for selected learning objectives.
 * POST /api/learning/:actionId/quiz/generate
 * Requirements: 4.1
 */
export function useQuizGeneration() {
  return useMutation({
    mutationFn: async (variables: QuizGenerationRequest) => {
      const { actionId, ...body } = variables;
      const result = await apiService.post<{ data: QuizGenerationResponse }>(
        `/learning/${actionId}/quiz/generate`,
        body
      );
      return result.data;
    },
    onError: (error) => {
      console.error('Failed to generate quiz questions:', error);
    },
  });
}

/**
 * Mutation hook to verify an observation against learning objectives.
 * POST /api/learning/:actionId/verify
 * On success, invalidates the learning objectives query cache.
 * Requirements: 9.3
 */
export function useObservationVerification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: ObservationVerificationRequest) => {
      const { actionId, ...body } = variables;
      const result = await apiService.post<{ data: VerificationResponse }>(
        `/learning/${actionId}/verify`,
        body
      );
      return result.data;
    },
    onSuccess: (_data, variables) => {
      // Invalidate learning objectives cache so progress updates are reflected
      queryClient.invalidateQueries({
        queryKey: learningObjectivesQueryKey(variables.actionId, variables.userId),
      });
    },
    onError: (error) => {
      console.error('Failed to verify observation:', error);
    },
  });
}
