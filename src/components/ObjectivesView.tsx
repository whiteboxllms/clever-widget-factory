import { useState, useMemo } from 'react';
import { BookOpen, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import type { LearningObjective } from '@/hooks/useLearning';

export interface ObjectivesViewProps {
  objectives: LearningObjective[];
  axisLabel: string;
  onStartQuiz: (selectedObjectiveIds: string[]) => void;
  isLoading?: boolean;
}

/** Map evidence tags to badge display config */
function evidenceTagBadge(tag: LearningObjective['evidenceTag']) {
  switch (tag) {
    case 'no_evidence':
      return { label: 'Required', variant: 'destructive' as const, className: '' };
    case 'some_evidence':
      return {
        label: 'Some evidence',
        variant: 'outline' as const,
        className: 'border-yellow-400 bg-yellow-50 text-yellow-700',
      };
    case 'previously_correct':
      return {
        label: 'Previously correct',
        variant: 'outline' as const,
        className: 'border-green-400 bg-green-50 text-green-700',
      };
  }
}

/**
 * Displays learning objectives before quiz starts.
 * Required objectives (no_evidence / some_evidence) are shown prominently and pre-selected.
 * Optional review objectives (previously_correct) are shown as toggleable.
 *
 * Requirements: 3.5.4, 3.5.5, 3.5.6, 3.5.8
 */
export function ObjectivesView({
  objectives,
  axisLabel,
  onStartQuiz,
  isLoading = false,
}: ObjectivesViewProps) {
  // Split objectives into required and optional
  const { required, optional } = useMemo(() => {
    const req: LearningObjective[] = [];
    const opt: LearningObjective[] = [];
    for (const obj of objectives) {
      if (obj.evidenceTag === 'previously_correct') {
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
                const badge = evidenceTagBadge(obj.evidenceTag);
                const checked = selectedRequired.has(obj.id);
                return (
                  <li
                    key={obj.id}
                    className="flex items-start gap-3 rounded-md border px-3 py-2.5"
                  >
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
                const badge = evidenceTagBadge(obj.evidenceTag);
                const checked = selectedOptional.has(obj.id);
                return (
                  <li
                    key={obj.id}
                    className="flex items-center gap-3 rounded-md border border-dashed px-3 py-2.5"
                  >
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
