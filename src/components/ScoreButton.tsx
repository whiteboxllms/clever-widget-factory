import { Button } from '@/components/ui/button';
import { Target } from 'lucide-react';
import { BaseAction } from '@/types/actions';

interface ScoreButtonProps {
  action: BaseAction;
  onScoreAction: (action: BaseAction, e: React.MouseEvent) => void;
}

export function ScoreButton({ action, onScoreAction }: ScoreButtonProps) {
  // Only show for completed actions
  if (action.status !== 'completed') {
    return null;
  }

  // Check if action has a score - be explicit about the check to avoid false positives
  // has_score should be explicitly true (not just truthy)
  // Check for strict boolean true to avoid false positives from string "true", number 1, etc.
  const hasScore = (action as any).has_score === true && typeof (action as any).has_score === 'boolean';

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={(e) => onScoreAction(action, e)}
      className={`h-7 px-2 text-xs ${hasScore ? 'border-green-500 border-2' : ''}`}
      title={hasScore ? "View/Edit Score" : "Assign Score"}
    >
      <Target className="h-3 w-3" />
    </Button>
  );
}