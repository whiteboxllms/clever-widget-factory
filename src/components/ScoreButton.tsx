import { Button } from '@/components/ui/button';
import { Target } from 'lucide-react';
import { BaseAction } from '@/types/actions';

interface ScoreButtonProps {
  action: BaseAction;
  onScoreAction: (e: React.MouseEvent) => void;
}

export function ScoreButton({ action, onScoreAction }: ScoreButtonProps) {
  // Only show for completed actions
  if (action.status !== 'completed') {
    return null;
  }

  // Use the has_score field from the API
  const hasScore = (action as any).has_score === true;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onScoreAction(e);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      className={`h-7 px-2 text-xs ${hasScore ? 'border-green-500 border-2' : ''}`}
      title={hasScore ? "View/Edit Score" : "Assign Score"}
    >
      <Target className="h-3 w-3" />
    </Button>
  );
}