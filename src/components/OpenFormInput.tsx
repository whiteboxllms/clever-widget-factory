import { useState } from 'react';
import { ChevronRight, Loader2, Lightbulb, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { questionTypeToBloomLevel } from '@/lib/progressionUtils';
import type { QuizQuestion } from '@/hooks/useLearning';

// --- Types ---

export interface OpenFormInputProps {
  question: QuizQuestion;
  onSubmit: (responseText: string) => void;
  onNext: () => void;
  idealAnswer: string;
  evaluationResult?: { score: number; sufficient: boolean; reasoning: string } | null;
  isSubmitted: boolean;
  isSaving: boolean;
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

      {/* Ideal answer panel (after submission) */}
      {isSubmitted && (
        <Card className="border-2 border-blue-200 bg-blue-50/50">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-blue-700">
              <Lightbulb className="h-4 w-4 shrink-0" />
              <span className="text-sm font-semibold">Here's a strong example</span>
            </div>
            <p className="text-sm leading-relaxed text-blue-900/80">
              {idealAnswer}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Evaluation result (shown inline when available) */}
      {isSubmitted && evaluationResult && (
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
