import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronRight,
  RotateCcw,
  Trophy,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useCognitoAuth';
import {
  useLearningObjectives,
  useQuizGeneration,
  useQuizEvaluation,
  useEvaluationStatus,
  type QuizQuestion,
  type LearningObjective,
} from '@/hooks/useLearning';
import { OpenFormInput } from '@/components/OpenFormInput';
import { ObjectivesView } from '@/components/ObjectivesView';
import { apiService } from '@/lib/apiService';
import {
  composeKnowledgeStateText,
  composeOpenFormStateText,
  isQuizComplete,
  getIncompleteObjectives,
  computeQuizSummary,
  type QuizAnswer,
} from '@/lib/learningUtils';
import { isOpenFormQuestion, type QuestionType } from '@/lib/progressionUtils';
import {
  actionsQueryKey,
  completedActionsQueryKey,
  learningObjectivesQueryKey,
} from '@/lib/queryKeys';
import type { BaseAction } from '@/types/actions';

// --- Types ---

type QuizState =
  | 'objectives_selection'
  | 'generating'
  | 'quiz_in_progress'
  | 'round_complete'
  | 'quiz_complete';

interface AnswerSelection {
  optionIndex: number;
  wasFirstAttempt: boolean;
}

// --- Constants ---

const GENERATION_TIMEOUT_MS = 30_000;

/** Growth milestone messages shown when transitioning to a new question type (Req 10.1, 10.2) */
const GROWTH_MILESTONE_MESSAGES: Partial<Record<QuestionType, string>> = {
  bridging: "You've built a strong foundation. Let's connect these concepts to your work.",
  self_explanation: "You're ready to explain your understanding",
  application: "Time to apply what you know to new situations",
  analysis: "You're ready to analyze and evaluate approaches",
  synthesis: "You're ready to create and teach",
};

/** Duration to show growth milestone message (ms) */
const MILESTONE_DISPLAY_MS = 4000;

/** Polling interval for evaluation status (ms) */
const EVALUATION_POLL_INTERVAL_MS = 5000;

// --- Component ---

export default function QuizPage() {
  const { actionId, axisKey } = useParams<{
    actionId: string;
    axisKey: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.userId;

  // --- Action data from cache ---
  const action = useMemo(() => {
    if (!actionId) return null;
    const unresolved =
      queryClient.getQueryData<BaseAction[]>(actionsQueryKey()) ?? [];
    const completed =
      queryClient.getQueryData<BaseAction[]>(completedActionsQueryKey()) ?? [];
    return (
      unresolved.find((a) => a.id === actionId) ??
      completed.find((a) => a.id === actionId) ??
      null
    );
  }, [actionId, queryClient]);

  // Derive axis label from skill profile
  const axisLabel = useMemo(() => {
    if (!action?.skill_profile?.axes || !axisKey) return axisKey ?? '';
    const axis = action.skill_profile.axes.find((a) => a.key === axisKey);
    return axis?.label ?? axisKey;
  }, [action, axisKey]);

  // --- Learning objectives ---
  const {
    data: learningData,
    isLoading: isLoadingObjectives,
  } = useLearningObjectives(actionId, userId);

  const axisObjectives = useMemo(() => {
    if (!learningData?.axes || !axisKey) return [];
    const axisData = learningData.axes.find((a) => a.axisKey === axisKey);
    return axisData?.objectives ?? [];
  }, [learningData, axisKey]);

  // --- Quiz state ---
  const [quizState, setQuizState] = useState<QuizState>('objectives_selection');
  const [selectedObjectiveIds, setSelectedObjectiveIds] = useState<string[]>(
    []
  );
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [allAnswers, setAllAnswers] = useState<QuizAnswer[]>([]);
  const [currentSelections, setCurrentSelections] = useState<
    Map<number, AnswerSelection>
  >(new Map());
  const [firstAttemptRecorded, setFirstAttemptRecorded] = useState(false);
  const [isSavingAnswer, setIsSavingAnswer] = useState(false);
  const [generationTimedOut, setGenerationTimedOut] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(
    null
  );
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roundNumberRef = useRef(1);

  // --- Open-form state ---
  const [openFormSubmitted, setOpenFormSubmitted] = useState(false);
  const [openFormSaving, setOpenFormSaving] = useState(false);
  const [openFormEvaluationResult, setOpenFormEvaluationResult] = useState<
    { score: number; sufficient: boolean; reasoning: string } | null
  >(null);
  const [openFormStateIds, setOpenFormStateIds] = useState<string[]>([]);
  const [growthMilestone, setGrowthMilestone] = useState<string | null>(null);
  const previousQuestionTypeRef = useRef<QuestionType | null>(null);

  // --- Quiz generation mutation ---
  const quizGeneration = useQuizGeneration();

  // --- Quiz evaluation mutation (fire-and-forget) ---
  const quizEvaluation = useQuizEvaluation();

  // --- Evaluation status polling ---
  // Poll when quiz is complete and there are pending open-form state IDs
  const shouldPollEvaluation =
    quizState === 'quiz_complete' && openFormStateIds.length > 0;
  const { data: evaluationStatusData } = useEvaluationStatus(
    actionId,
    userId,
    shouldPollEvaluation ? openFormStateIds : [],
    shouldPollEvaluation ? EVALUATION_POLL_INTERVAL_MS : false
  );

  // Current question
  const currentQuestion = questions[currentQuestionIndex] ?? null;

  // Has the user answered the current question correctly (first attempt)?
  const hasCorrectFirstAttempt = useMemo(() => {
    if (!currentQuestion || currentQuestion.correctIndex === null) return false;
    const selection = currentSelections.get(currentQuestion.correctIndex);
    return selection?.wasFirstAttempt === true;
  }, [currentQuestion, currentSelections]);

  // Has any selection been made on the current question?
  const hasAnySelection = currentSelections.size > 0;

  // --- Detect question type transitions for growth milestones ---
  useEffect(() => {
    if (!currentQuestion || quizState !== 'quiz_in_progress') return;

    const currentType = currentQuestion.questionType;
    const previousType = previousQuestionTypeRef.current;

    // Show milestone when transitioning to a new (non-recognition) question type
    if (
      previousType !== null &&
      currentType !== previousType &&
      currentType !== 'recognition'
    ) {
      const message = GROWTH_MILESTONE_MESSAGES[currentType];
      if (message) {
        setGrowthMilestone(message);
        const timer = setTimeout(() => {
          setGrowthMilestone(null);
        }, MILESTONE_DISPLAY_MS);
        return () => clearTimeout(timer);
      }
    }

    previousQuestionTypeRef.current = currentType;
  }, [currentQuestion, quizState]);

  // Reset open-form state when question changes
  useEffect(() => {
    setOpenFormSubmitted(false);
    setOpenFormSaving(false);
    setOpenFormEvaluationResult(null);
  }, [currentQuestionIndex]);

  // --- beforeunload guard ---
  useEffect(() => {
    if (
      quizState === 'quiz_in_progress' &&
      allAnswers.length > 0
    ) {
      const handler = (e: BeforeUnloadEvent) => {
        e.preventDefault();
      };
      window.addEventListener('beforeunload', handler);
      return () => window.removeEventListener('beforeunload', handler);
    }
  }, [quizState, allAnswers.length]);

  // Determine if we have unsaved progress
  const hasUnsavedProgress =
    quizState === 'quiz_in_progress' && allAnswers.length > 0;

  // --- Navigation guard ---
  const handleBack = useCallback(() => {
    if (hasUnsavedProgress) {
      setPendingNavigation(`/actions/${actionId}`);
      setShowExitDialog(true);
    } else {
      navigate(`/actions/${actionId}`);
    }
  }, [hasUnsavedProgress, actionId, navigate]);

  const confirmExit = useCallback(() => {
    setShowExitDialog(false);
    if (pendingNavigation) {
      navigate(pendingNavigation);
    }
  }, [pendingNavigation, navigate]);

  // --- Quiz generation ---
  const generateQuiz = useCallback(
    async (objectiveIds: string[], previousAnswers: QuizAnswer[] = []) => {
      if (!actionId || !userId || !axisKey) return;

      setQuizState('generating');
      setGenerationTimedOut(false);

      // Set timeout
      timeoutRef.current = setTimeout(() => {
        setGenerationTimedOut(true);
      }, GENERATION_TIMEOUT_MS);

      try {
        const result = await quizGeneration.mutateAsync({
          actionId,
          userId,
          axisKey,
          objectiveIds,
          previousAnswers: previousAnswers
            .filter((a) => a.wasFirstAttempt && !a.wasCorrect)
            .map((a) => ({
              objectiveId: a.objectiveId,
              questionText: a.questionId, // The question text is stored in questionId context
              selectedAnswer: a.selectedAnswer,
              correctAnswer: a.correctAnswer,
              wasCorrect: a.wasCorrect,
            })),
        });

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        if (result?.questions?.length) {
          setQuestions(result.questions);
          setCurrentQuestionIndex(0);
          setCurrentSelections(new Map());
          setFirstAttemptRecorded(false);
          setQuizState('quiz_in_progress');
        } else {
          // No questions generated — treat as complete
          setQuizState('quiz_complete');
        }
      } catch {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        setGenerationTimedOut(true);
      }
    },
    [actionId, userId, axisKey, quizGeneration]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // --- Start quiz from objectives selection ---
  const handleStartQuiz = useCallback(
    (objectiveIds: string[]) => {
      setSelectedObjectiveIds(objectiveIds);
      roundNumberRef.current = 1;
      setAllAnswers([]);
      generateQuiz(objectiveIds);
    },
    [generateQuiz]
  );

  // --- Answer selection (Recognition questions) ---
  const handleSelectOption = useCallback(
    (optionIndex: number) => {
      if (!currentQuestion || isSavingAnswer) return;

      setCurrentSelections((prev) => {
        // If this option was already selected, do nothing
        if (prev.has(optionIndex)) return prev;

        const isFirst = !firstAttemptRecorded;
        const next = new Map(prev);
        next.set(optionIndex, {
          optionIndex,
          wasFirstAttempt: isFirst,
        });
        return next;
      });

      // Mark first attempt as recorded after first click
      if (!firstAttemptRecorded) {
        setFirstAttemptRecorded(true);
      }
    },
    [currentQuestion, firstAttemptRecorded, isSavingAnswer]
  );

  // --- Open-form submission handler ---
  const handleOpenFormSubmit = useCallback(
    async (responseText: string) => {
      if (!currentQuestion || !actionId || !userId) return;

      setOpenFormSaving(true);

      const objective = axisObjectives.find(
        (o) => o.id === currentQuestion.objectiveId
      );
      const objectiveText = objective?.text ?? currentQuestion.objectiveId;

      // 1. Compose open-form state text and save knowledge state immediately
      try {
        const stateText = composeOpenFormStateText(
          objectiveText,
          currentQuestion.questionType,
          currentQuestion.text,
          responseText,
          currentQuestion.idealAnswer ?? ''
        );

        const stateResult = await apiService.post<{ data: { id: string } }>('/states', {
          state_text: stateText,
          photos: [],
          links: [
            {
              entity_type: 'learning_objective',
              entity_id: currentQuestion.objectiveId,
            },
          ],
        });

        const stateId = stateResult?.data?.id;

        // Track state ID for evaluation polling
        if (stateId) {
          setOpenFormStateIds((prev) => [...prev, stateId]);

          // 3. Fire-and-forget evaluation call
          quizEvaluation.mutate({
            actionId,
            stateId,
            responseText,
            idealAnswer: currentQuestion.idealAnswer ?? '',
            questionType: currentQuestion.questionType,
            objectiveText,
            questionText: currentQuestion.text,
          });
        }

        // Optimistically update learning objectives cache
        queryClient.setQueryData(
          learningObjectivesQueryKey(actionId, userId),
          (old: any) => {
            if (!old?.axes) return old;
            return {
              ...old,
              axes: old.axes.map((axis: any) => ({
                ...axis,
                objectives: axis.objectives.map((obj: any) => {
                  if (obj.id !== currentQuestion.objectiveId) return obj;
                  if (obj.status === 'not_started') {
                    return { ...obj, status: 'in_progress' };
                  }
                  return obj;
                }),
              })),
            };
          }
        );
      } catch (err) {
        console.error('Failed to save open-form knowledge state:', err);
        // Continue anyway — reveal ideal answer regardless
      }

      setOpenFormSaving(false);

      // 2. Reveal ideal answer panel
      setOpenFormSubmitted(true);
    },
    [currentQuestion, actionId, userId, axisObjectives, quizEvaluation, queryClient]
  );

  // --- Open-form "Next" handler ---
  const handleOpenFormNext = useCallback(() => {
    if (!currentQuestion) return;

    // Record the answer locally (open-form answers are always treated as "attempted")
    const answer: QuizAnswer = {
      questionId: currentQuestion.id,
      objectiveId: currentQuestion.objectiveId,
      selectedAnswer: '[open-form response]',
      correctAnswer: currentQuestion.idealAnswer ?? '',
      wasFirstAttempt: true,
      wasCorrect: true, // Open-form submissions count as completed for round progression
      timestamp: new Date().toISOString(),
    };

    const updatedAnswers = [...allAnswers, answer];
    setAllAnswers(updatedAnswers);

    // Advance to next question or evaluate round
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((i) => i + 1);
      setCurrentSelections(new Map());
      setFirstAttemptRecorded(false);
    } else {
      evaluateRound(updatedAnswers);
    }
  }, [currentQuestion, allAnswers, currentQuestionIndex, questions.length]);

  // --- Record answer and advance ---
  const handleNext = useCallback(async () => {
    if (!currentQuestion || !actionId || !userId) return;

    setIsSavingAnswer(true);

    // Find the first attempt selection
    const firstAttemptEntry = Array.from(currentSelections.entries()).find(
      ([, sel]) => sel.wasFirstAttempt
    );
    if (!firstAttemptEntry) {
      setIsSavingAnswer(false);
      return;
    }

    const [firstOptionIndex] = firstAttemptEntry;
    const wasCorrect = firstOptionIndex === currentQuestion.correctIndex;
    const selectedOption = currentQuestion.options?.[firstOptionIndex];
    const correctOption = currentQuestion.correctIndex !== null
      ? currentQuestion.options?.[currentQuestion.correctIndex]
      : null;

    // Find the objective for this question
    const objective = axisObjectives.find(
      (o) => o.id === currentQuestion.objectiveId
    );

    // Build the answer record
    const answer: QuizAnswer = {
      questionId: currentQuestion.id,
      objectiveId: currentQuestion.objectiveId,
      selectedAnswer: selectedOption?.text ?? '',
      correctAnswer: correctOption?.text ?? '',
      wasFirstAttempt: true,
      wasCorrect,
      timestamp: new Date().toISOString(),
    };

    const updatedAnswers = [...allAnswers, answer];
    setAllAnswers(updatedAnswers);

    // Create knowledge state via POST /api/states
    try {
      const stateText = composeKnowledgeStateText(
        objective?.text ?? currentQuestion.objectiveId,
        currentQuestion.text,
        selectedOption?.text ?? '',
        wasCorrect
      );

      await apiService.post('/states', {
        state_text: stateText,
        photos: [],
        links: [
          {
            entity_type: 'learning_objective',
            entity_id: currentQuestion.objectiveId,
          },
        ],
      });

      // Optimistically update learning objectives cache
      if (userId && actionId) {
        queryClient.setQueryData(
          learningObjectivesQueryKey(actionId, userId),
          (old: any) => {
            if (!old?.axes) return old;
            return {
              ...old,
              axes: old.axes.map((axis: any) => ({
                ...axis,
                objectives: axis.objectives.map((obj: any) => {
                  if (obj.id !== currentQuestion.objectiveId) return obj;
                  if (wasCorrect) {
                    return {
                      ...obj,
                      status: 'completed',
                      completionType: 'quiz',
                    };
                  }
                  if (obj.status === 'not_started') {
                    return { ...obj, status: 'in_progress' };
                  }
                  return obj;
                }),
              })),
            };
          }
        );
      }
    } catch (err) {
      console.error('Failed to save knowledge state:', err);
      // Continue anyway — the answer is recorded locally
    }

    setIsSavingAnswer(false);

    // Advance to next question or evaluate round
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((i) => i + 1);
      setCurrentSelections(new Map());
      setFirstAttemptRecorded(false);
    } else {
      // Round complete — evaluate
      evaluateRound(updatedAnswers);
    }
  }, [
    currentQuestion,
    currentSelections,
    actionId,
    userId,
    axisObjectives,
    allAnswers,
    currentQuestionIndex,
    questions.length,
    queryClient,
  ]);

  // --- Round evaluation ---
  const evaluateRound = useCallback(
    (answers: QuizAnswer[]) => {
      const incomplete = getIncompleteObjectives(selectedObjectiveIds, answers);

      if (incomplete.length === 0) {
        setQuizState('quiz_complete');
        // Invalidate learning objectives cache so the GrowthChecklist shows updated progress
        if (actionId && userId) {
          queryClient.invalidateQueries({
            queryKey: learningObjectivesQueryKey(actionId, userId),
          });
        }
      } else {
        setQuizState('round_complete');
        // Auto-generate next round after a brief pause
        roundNumberRef.current += 1;
        setTimeout(() => {
          generateQuiz(incomplete, answers);
        }, 1500);
      }
    },
    [selectedObjectiveIds, generateQuiz]
  );

  // --- Quiz summary ---
  const quizSummary = useMemo(
    () => computeQuizSummary(allAnswers),
    [allAnswers]
  );

  // --- Render ---

  if (!actionId || !axisKey) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <p className="text-muted-foreground">Invalid quiz URL.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3 px-4 py-3 max-w-2xl mx-auto">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-medium truncate">
              {action?.title ?? 'Quiz'}
            </h1>
            <p className="text-xs text-muted-foreground">{axisLabel}</p>
          </div>
          {quizState === 'quiz_in_progress' && questions.length > 0 && (
            <Badge variant="outline" className="shrink-0">
              {currentQuestionIndex + 1} / {questions.length}
            </Badge>
          )}
        </div>
        {quizState === 'quiz_in_progress' && questions.length > 0 && (
          <Progress
            value={((currentQuestionIndex + 1) / questions.length) * 100}
            className="h-1"
          />
        )}
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Objectives Selection */}
        {quizState === 'objectives_selection' && (
          <>
            {isLoadingObjectives ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Loading objectives…
                </p>
              </div>
            ) : axisObjectives.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No learning objectives found for this axis.
                </p>
                <Button variant="outline" onClick={handleBack}>
                  Back to action
                </Button>
              </div>
            ) : (
              <ObjectivesView
                objectives={axisObjectives}
                axisLabel={axisLabel}
                onStartQuiz={handleStartQuiz}
                isLoading={quizGeneration.isPending}
              />
            )}
          </>
        )}

        {/* Generating */}
        {quizState === 'generating' && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            {generationTimedOut ? (
              <>
                <AlertCircle className="h-10 w-10 text-destructive" />
                <p className="text-sm text-muted-foreground text-center">
                  Quiz generation is taking longer than expected.
                </p>
                <Button
                  variant="outline"
                  onClick={() =>
                    generateQuiz(
                      getIncompleteObjectives(selectedObjectiveIds, allAnswers)
                        .length > 0
                        ? getIncompleteObjectives(
                            selectedObjectiveIds,
                            allAnswers
                          )
                        : selectedObjectiveIds,
                      allAnswers
                    )
                  }
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              </>
            ) : (
              <>
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Generating quiz questions…
                </p>
                <p className="text-xs text-muted-foreground">
                  Round {roundNumberRef.current}
                </p>
              </>
            )}
          </div>
        )}

        {/* Quiz In Progress */}
        {quizState === 'quiz_in_progress' && currentQuestion && (
          <>
            {/* Growth milestone message */}
            {growthMilestone && (
              <Card className="border-2 border-purple-200 bg-purple-50/50 animate-in fade-in slide-in-from-top-2 duration-300">
                <CardContent className="p-3 flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-purple-600 shrink-0" />
                  <p className="text-sm font-medium text-purple-900">
                    {growthMilestone}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Render Recognition or Open-Form question */}
            {isOpenFormQuestion(currentQuestion.questionType) ? (
              <OpenFormInput
                question={currentQuestion}
                onSubmit={handleOpenFormSubmit}
                onNext={handleOpenFormNext}
                idealAnswer={currentQuestion.idealAnswer ?? ''}
                evaluationResult={openFormEvaluationResult}
                isSubmitted={openFormSubmitted}
                isSaving={openFormSaving}
              />
            ) : (
              <QuestionView
                question={currentQuestion}
                selections={currentSelections}
                hasCorrectFirstAttempt={hasCorrectFirstAttempt}
                hasAnySelection={hasAnySelection}
                isSaving={isSavingAnswer}
                onSelectOption={handleSelectOption}
                onNext={handleNext}
              />
            )}
          </>
        )}

        {/* Round Complete */}
        {quizState === 'round_complete' && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm font-medium">Round complete</p>
            <p className="text-xs text-muted-foreground">
              Generating next round for remaining objectives…
            </p>
          </div>
        )}

        {/* Quiz Complete */}
        {quizState === 'quiz_complete' && (
          <div className="flex flex-col items-center justify-center py-16 gap-6">
            <div className="rounded-full bg-green-100 p-4">
              <Trophy className="h-10 w-10 text-green-600" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-xl font-semibold">Quiz Complete</h2>
              <p className="text-muted-foreground">
                You answered{' '}
                <span className="font-medium text-foreground">
                  {quizSummary.correctFirstAttempt}
                </span>{' '}
                of{' '}
                <span className="font-medium text-foreground">
                  {quizSummary.totalQuestions}
                </span>{' '}
                questions correctly on the first attempt.
              </p>
            </div>
            <Button asChild>
              <Link to={`/actions/${actionId}`}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to action
              </Link>
            </Button>
          </div>
        )}
      </main>

      {/* Exit confirmation dialog */}
      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave quiz?</AlertDialogTitle>
            <AlertDialogDescription>
              You have quiz progress that hasn't been completed. Your answered
              questions have been saved, but you'll need to restart the current
              round.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue quiz</AlertDialogCancel>
            <AlertDialogAction onClick={confirmExit}>
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// --- QuestionView sub-component ---

interface QuestionViewProps {
  question: QuizQuestion;
  selections: Map<number, AnswerSelection>;
  hasCorrectFirstAttempt: boolean;
  hasAnySelection: boolean;
  isSaving: boolean;
  onSelectOption: (index: number) => void;
  onNext: () => void;
}

function QuestionView({
  question,
  selections,
  hasCorrectFirstAttempt,
  hasAnySelection,
  isSaving,
  onSelectOption,
  onNext,
}: QuestionViewProps) {
  // The last selected option (for showing explanation)
  const lastSelectedIndex = useMemo(() => {
    let last: number | null = null;
    for (const [idx] of selections) {
      last = idx;
    }
    return last;
  }, [selections]);

  const lastSelectedOption =
    lastSelectedIndex !== null ? question.options?.[lastSelectedIndex] ?? null : null;

  return (
    <div className="space-y-4">
      {/* Photo */}
      {question.photoUrl && (
        <div className="rounded-lg overflow-hidden border">
          <img
            src={question.photoUrl}
            alt="Question context"
            className="w-full h-auto max-h-64 object-cover"
          />
        </div>
      )}

      {/* Question text */}
      <p className="text-base font-medium leading-relaxed">
        {question.text}
      </p>

      {/* Answer options */}
      <div className="space-y-2">
        {question.options?.map((option) => {
          const isSelected = selections.has(option.index);
          const isCorrect = option.index === question.correctIndex;
          const firstAttemptSelection = Array.from(
            selections.entries()
          ).find(([, sel]) => sel.wasFirstAttempt);
          const wasFirstAttemptOnThis =
            firstAttemptSelection?.[0] === option.index;

          // Determine card styling
          let cardClass =
            'cursor-pointer transition-all border-2 hover:border-primary/50';
          if (isSelected && isCorrect) {
            cardClass = 'border-2 border-green-500 bg-green-50';
          } else if (isSelected && !isCorrect && wasFirstAttemptOnThis) {
            cardClass = 'border-2 border-red-500 bg-red-50';
          } else if (isSelected && !isCorrect) {
            cardClass = 'border-2 border-orange-300 bg-orange-50';
          } else if (hasAnySelection && isCorrect && hasCorrectFirstAttempt) {
            // Show correct answer highlighted after correct first attempt
            cardClass = 'border-2 border-green-500 bg-green-50';
          }

          // Disable clicking on already-selected options
          const isClickable = !isSelected && !isSaving;

          return (
            <Card
              key={option.index}
              className={cardClass}
              onClick={() => isClickable && onSelectOption(option.index)}
              role="button"
              tabIndex={isClickable ? 0 : -1}
              onKeyDown={(e) => {
                if (
                  isClickable &&
                  (e.key === 'Enter' || e.key === ' ')
                ) {
                  e.preventDefault();
                  onSelectOption(option.index);
                }
              }}
            >
              <CardContent className="p-3 flex items-start gap-3">
                <div className="shrink-0 mt-0.5">
                  {isSelected && isCorrect && (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  )}
                  {isSelected && !isCorrect && (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  {!isSelected && (
                    <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                  )}
                </div>
                <span className="text-sm flex-1">{option.text}</span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Explanation */}
      {lastSelectedOption && hasAnySelection && (
        <Card className="bg-muted/50 border-muted">
          <CardContent className="p-3">
            <p className="text-sm text-muted-foreground">
              {lastSelectedOption.explanation}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Next button — shown after correct answer (first attempt or explored) */}
      {hasCorrectFirstAttempt && (
        <Button
          onClick={onNext}
          disabled={isSaving}
          className="w-full"
          size="lg"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Saving…
            </>
          ) : (
            <>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </>
          )}
        </Button>
      )}
    </div>
  );
}
