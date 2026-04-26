import { useState, useMemo } from 'react';
import { BookOpen, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { LearningObjective } from '@/hooks/useLearning';
import { classifySimilarity } from '@/lib/learningUtils';

export interface ObjectivesViewProps {
  objectives: LearningObjective[];
  axisLabel: string;
  onStartQuiz: (selectedObjectiveIds: string[]) => void;
  isLoading?: boolean;
}

/** Map similarity classification to badge display config */
function similarityBadge(score: number | null | undefined) {
  const classification = classifySimilarity(score ?? 0);
  switch (classification) {
    case 'likely_covered':
      return {
        label: 'Likely covered',
        variant: 'outline' as const,
        className: 'border-green-400 bg-green-50 text-green-700',
      };
    case 'related_learning':
      return {
        label: 'Related learning found',
        variant: 'outline' as const,
        className: 'border-yellow-400 bg-yellow-50 text-yellow-700',
      };
    case 'new_material':
      return { label: 'New material', variant: 'destructive' as const, className: '' };
  }
}

/**
 * Expandable section showing prior learning matches for an objective.
 * Uses Radix Collapsible for accessible disclosure.
 */
function PriorLearningSection({
  objective,
}: {
  objective: LearningObjective;
}) {
  const [open, setOpen] = useState(false);
  const matches = objective.priorLearning;

  if (!matches || matches.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
          aria-expanded={open}
        >
          {open ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
          Show prior learning ({matches.length})
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="mt-2 space-y-1.5 pl-4 border-l-2 border-muted">
          {matches.map((match, idx) => (
            <li key={idx} className="text-xs text-muted-foreground">
              <span className="font-medium tabular-nums">
                {Math.round(match.similarityScore * 100)}%
              </span>{' '}
              — {match.sourceText}
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * Displays learning objectives before quiz starts.
 * Required objectives (new_material / related_learning) are shown prominently and pre-selected.
 * Optional review objectives (likely_covered, similarityScore >= 0.8) are shown as toggleable.
 *
 * Requirements: 3.5.4, 3.5.5, 3.5.6, 3.5.8
 */
export function ObjectivesView({
  objectives,
  axisLabel,
  onStartQuiz,
  isLoading = false,
}: ObjectivesViewProps) {
  // Split objectives into required and optional based on similarity score
  const { required, optional } = useMemo(() => {
    const req: LearningObjective[] = [];
    const opt: LearningObjective[] = [];
    for (const obj of objectives) {
      const score = obj.similarityScore ?? 0;
      if (classifySimilarity(score) === 'likely_covered') {
        opt.push(obj);
      } else {
        req.push(obj);
      }
    }
    return { required: req, optional: opt };
  }, [objectives]);

  // Required objectives are checked by default; optional are unchecked
  const [selectedRequired, setSelectedRequired] = useState<Set<string>>(
    () => new Set(required.map((o) => o.id))
  );
  const [selectedOptional, setSelectedOptional] = useState<Set<string>>(
    () => new Set()
  );

  // Sync required defaults when objectives change
  // (handled via key prop on parent or re-mount — keep state simple)

  const selectedCount = selectedRequired.size + selectedOptional.size;
  const hasSelection = selectedCount > 0;

  function toggleRequired(id: string) {
    setSelectedRequired((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleOptional(id: string) {
    setSelectedOptional((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleStartQuiz() {
    const ids = [...selectedRequired, ...selectedOptional];
    onStartQuiz(ids);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Learning Objectives — {axisLabel}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Required objectives */}
        {required.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">
              Required objectives
            </h4>
            <ul className="space-y-2">
              {required.map((obj) => {
                const score = obj.similarityScore ?? 0;
                const badge = similarityBadge(score);
                const checked = selectedRequired.has(obj.id);
                return (
                  <li
                    key={obj.id}
                    className="rounded-md border px-3 py-2.5"
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id={`obj-${obj.id}`}
                        checked={checked}
                        onCheckedChange={() => toggleRequired(obj.id)}
                        className="mt-0.5"
                      />
                      <label
                        htmlFor={`obj-${obj.id}`}
                        className="flex-1 text-sm cursor-pointer select-none"
                      >
                        {obj.text}
                      </label>
                      <Badge
                        variant={badge.variant}
                        className={`shrink-0 text-xs ${badge.className}`}
                      >
                        {badge.label}
                      </Badge>
                    </div>
                    {/* Show matched text for related_learning objectives */}
                    {classifySimilarity(score) === 'related_learning' &&
                      obj.matchedObjectiveText && (
                        <p className="mt-1 ml-7 text-xs text-muted-foreground italic">
                          Closest match: {obj.matchedObjectiveText}
                        </p>
                      )}
                    {/* Expandable prior learning section */}
                    <div className="ml-7">
                      <PriorLearningSection objective={obj} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Optional review objectives */}
        {optional.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">
              Optional review
            </h4>
            <ul className="space-y-2">
              {optional.map((obj) => {
                const score = obj.similarityScore ?? 0;
                const badge = similarityBadge(score);
                const checked = selectedOptional.has(obj.id);
                return (
                  <li
                    key={obj.id}
                    className="rounded-md border border-dashed px-3 py-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <Switch
                        id={`opt-${obj.id}`}
                        checked={checked}
                        onCheckedChange={() => toggleOptional(obj.id)}
                      />
                      <label
                        htmlFor={`opt-${obj.id}`}
                        className="flex-1 text-sm cursor-pointer select-none text-muted-foreground"
                      >
                        {obj.text}
                      </label>
                      <Badge
                        variant={badge.variant}
                        className={`shrink-0 text-xs ${badge.className}`}
                      >
                        {badge.label}
                      </Badge>
                    </div>
                    {/* Show matched text for likely_covered objectives */}
                    {obj.matchedObjectiveText && (
                      <p className="mt-1 ml-12 text-xs text-muted-foreground italic">
                        Closest match: {obj.matchedObjectiveText}
                      </p>
                    )}
                    {/* Expandable prior learning section */}
                    <div className="ml-12">
                      <PriorLearningSection objective={obj} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Start Quiz button */}
        <div className="pt-2">
          <Button
            onClick={handleStartQuiz}
            disabled={!hasSelection || isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating quiz…
              </>
            ) : (
              <>
                <BookOpen className="h-4 w-4" />
                Start Quiz ({selectedCount} objective{selectedCount !== 1 ? 's' : ''})
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
