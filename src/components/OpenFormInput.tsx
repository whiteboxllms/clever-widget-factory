import { useState } from 'react';
import { ChevronRight, Loader2, CheckCircle2, ArrowRight, ExternalLink, Sparkles } from 'lucide-react';
import { buildLearnMoreUrl, bloomLevelLabel } from '@/lib/bloomUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { questionTypeToBloomLevel } from '@/lib/progressionUtils';
import type { QuizQuestion } from '@/hooks/useLearning';

// --- Types ---

export interface EvaluationResultWithBloom {
  score: number;
  sufficient: boolean;
  reasoning: string;
  demonstratedLevel?: number;
  conceptDemonstrated?: string;
  nextLevelHint?: string;
}

export interface OpenFormInputProps {
  question: QuizQuestion;
  onSubmit: (responseText: string) => void;
  onNext: () => void;
  idealAnswer: string;
  evaluationResult?: EvaluationResultWithBloom | null;
  isSubmitted: boolean;
  isSaving: boolean;
}

// --- Bloom Feedback Section ---

const BLOOM_LEVELS = [1, 2, 3, 4, 5] as const;

interface BloomFeedbackProps {
  demonstratedLevel: number;
  conceptDemonstrated: string;
  nextLevelHint: string;
  score: number;
}

/**
 * Structured Bloom's feedback display.
 * Shows a horizontal level indicator, concept demonstrated text,
 * and either a next-level hint or mastery message.
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */
export function BloomFeedbackSection({
  demonstratedLevel,
  conceptDemonstrated,
  nextLevelHint,
}: BloomFeedbackProps) {
  return (
    <div className="space-y-3">
      {/* Bloom's level indicator — horizontal progression */}
      <div className="flex items-center gap-1" role="list" aria-label="Bloom's taxonomy level">
        {BLOOM_LEVELS.map((level) => {
          const isHighlighted = level <= demonstratedLevel;
          return (
            <div
              key={level}
              role="listitem"
              className={`flex-1 text-center rounded-md px-1 py-1.5 text-xs font-medium transition-colors ${
                isHighlighted
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : 'bg-muted/50 text-muted-foreground/50 border border-transparent'
              }`}
              aria-current={level === demonstratedLevel ? 'true' : undefined}
            >
              {bloomLevelLabel(level)}
            </div>
          );
        })}
      </div>

      {/* Concept demonstrated text */}
      <p className="text-sm text-foreground leading-relaxed">
        {conceptDemonstrated}
      </p>

      {/* Next-level hint or mastery message */}
      {demonstratedLevel < 5 ? (
        <Card className="bg-blue-50/50 border-blue-100">
          <CardContent className="p-3">
            <p className="text-sm text-blue-800">
              <span className="font-medium">
                To reach {bloomLevelLabel(demonstratedLevel + 1)}:
              </span>{' '}
              {nextLevelHint}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-100 px-3 py-2">
          <Sparkles className="h-4 w-4 text-emerald-600 shrink-0" />
          <p className="text-sm font-medium text-emerald-800">
            Mastery-level thinking demonstrated
          </p>
        </div>
      )}
    </div>
  );
}

// --- Bloom's Level Context Badges ---

/**
 * Maps Bloom's level to a growth-oriented context badge label.
 * These frame the question type as a learning activity, not a test.
 */
function getBloomContextLabel(question: QuizQuestion): string {
  const bloomLevel = questionTypeToBloomLevel(question.questionType);
  switch (bloomLevel) {
    case 2:
      return 'Explain in your own words';
    case 3:
      return 'Apply to a new context';
    case 4:
      return 'Analyze and evaluate';
    case 5:
      return 'Create and teach';
    case 1:
      // Bridging (Level 1 open-form)
      return 'Connect to your context';
    default:
      return 'Share your thinking';
  }
}

// --- Component ---

export function OpenFormInput({
  question,
  onSubmit,
  onNext,
  idealAnswer,
  evaluationResult,
  isSubmitted,
  isSaving,
}: OpenFormInputProps) {
  const [responseText, setResponseText] = useState('');

  const canSubmit = responseText.trim().length > 0 && !isSubmitted && !isSaving;
  const contextLabel = getBloomContextLabel(question);

  const handleSubmit = () => {
    if (canSubmit) {
      onSubmit(responseText.trim());
    }
  };

  return (
    <div className="space-y-4">
      {/* Bloom's level context badge */}
      <Badge
        variant="secondary"
        className="text-xs"
      >
        {contextLabel}
      </Badge>

      {/* Photo (if present) */}
      {question.photoUrl && (
        <div className="rounded-lg overflow-hidden border">
          <img
            src={question.photoUrl}
            alt="Question context"
            className="w-full h-auto max-h-64 object-cover"
          />
        </div>
      )}

      {/* Learn-more link (when concept reference is present) */}
      {question.conceptName && (
        <a
          href={buildLearnMoreUrl(question.conceptName, question.conceptAuthor)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          {question.conceptName}
          <ExternalLink className="h-3 w-3" />
        </a>
      )}

      {/* Question text */}
      <p className="text-base font-medium leading-relaxed">
        {question.text}
      </p>

      {/* Textarea input */}
      <div className="space-y-1.5">
        <Textarea
          value={responseText}
          onChange={(e) => setResponseText(e.target.value)}
          placeholder="Write your response here…"
          disabled={isSubmitted || isSaving}
          rows={5}
          className="resize-y"
          aria-label="Your response"
        />
        {!isSubmitted && (
          <p className="text-xs text-muted-foreground">
            A few sentences is enough
          </p>
        )}
      </div>

      {/* Submit button (before submission) */}
      {!isSubmitted && (
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full"
          size="lg"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Saving…
            </>
          ) : (
            'Submit'
          )}
        </Button>
      )}

      {/* Evaluation result (shown inline when available) */}
      {isSubmitted && evaluationResult && (
        evaluationResult.demonstratedLevel && evaluationResult.conceptDemonstrated ? (
          <BloomFeedbackSection
            demonstratedLevel={evaluationResult.demonstratedLevel}
            conceptDemonstrated={evaluationResult.conceptDemonstrated}
            nextLevelHint={evaluationResult.nextLevelHint ?? ''}
            score={evaluationResult.score}
          />
        ) : (
          /* Fallback: legacy badge display for older evaluations without structured Bloom fields */
          <Card className="bg-muted/50 border-muted">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                {evaluationResult.sufficient ? (
                  <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Great depth
                  </Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">
                    <ArrowRight className="h-3 w-3 mr-1" />
                    Keep developing
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {evaluationResult.reasoning}
              </p>
            </CardContent>
          </Card>
        )
      )}

      {/* Next button (after ideal answer reveal) */}
      {isSubmitted && (
        <Button
          onClick={onNext}
          className="w-full"
          size="lg"
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      )}
    </div>
  );
}
