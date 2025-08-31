import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Target } from 'lucide-react';
import { useAssetScores, AssetScore } from '@/hooks/useAssetScores';
import { BaseAction } from '@/types/actions';

interface ScoreButtonProps {
  action: BaseAction;
  onScoreAction: (action: BaseAction, e: React.MouseEvent) => void;
}

export function ScoreButton({ action, onScoreAction }: ScoreButtonProps) {
  const [existingScore, setExistingScore] = useState<AssetScore | null>(null);
  const { getScoreForAction } = useAssetScores();

  useEffect(() => {
    const checkExistingScore = async () => {
      if (action.id) {
        const score = await getScoreForAction(action.id);
        setExistingScore(score);
      }
    };
    checkExistingScore();
  }, [action.id, getScoreForAction]);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={(e) => onScoreAction(action, e)}
      className={`h-7 px-2 text-xs ${existingScore ? 'border-green-500 border-2' : ''}`}
      title={existingScore ? "View/Edit Score" : "Assign Score"}
    >
      <Target className="h-3 w-3" />
    </Button>
  );
}