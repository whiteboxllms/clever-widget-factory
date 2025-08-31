import { useState, useEffect, useCallback } from 'react';
import { useAssetScores, AssetScore } from './useAssetScores';

interface Action {
  id: string;
  status: string;
  asset_id?: string;
}

export const useActionScores = (actions: Action[] = []) => {
  const [actionScores, setActionScores] = useState<Map<string, AssetScore>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const { getScoreForAction, createScore, updateScore } = useAssetScores();

  // Load scores for all provided actions
  const loadScoresForActions = useCallback(async (actionsToLoad: Action[]) => {
    if (actionsToLoad.length === 0) return;
    
    setIsLoading(true);
    const scoreMap = new Map<string, AssetScore>();
    
    try {
      // Load scores for all actions in parallel
      const scorePromises = actionsToLoad.map(async (action) => {
        if (action.id && !action.id.startsWith('temp-')) {
          const score = await getScoreForAction(action.id);
          if (score) {
            scoreMap.set(action.id, score);
          }
        }
      });

      await Promise.all(scorePromises);
      setActionScores(scoreMap);
    } catch (error) {
      console.error('Error loading action scores:', error);
    } finally {
      setIsLoading(false);
    }
  }, [getScoreForAction]);

  // Get score for a specific action
  const getActionScore = useCallback((actionId: string): AssetScore | null => {
    return actionScores.get(actionId) || null;
  }, [actionScores]);

  // Check if action has a score
  const hasScore = useCallback((actionId: string): boolean => {
    return actionScores.has(actionId);
  }, [actionScores]);

  // Create score for action
  const createActionScore = useCallback(async (scoreData: {
    asset_id: string;
    asset_name: string;
    source_id: string;
    prompt_id: string;
    prompt_text: string;
    scores: Record<string, { score: number; reason: string }>;
    ai_response?: Record<string, any>;
    likely_root_causes?: string[];
  }) => {
    const result = await createScore({
      ...scoreData,
      source_type: 'action' as const,
    });
    
    if (result) {
      // Update local state immediately
      setActionScores(prev => new Map(prev.set(scoreData.source_id, result as AssetScore)));
    }
    
    return result;
  }, [createScore]);

  // Update existing score
  const updateActionScore = useCallback(async (actionId: string, updates: Partial<AssetScore>) => {
    const existingScore = actionScores.get(actionId);
    if (existingScore) {
      await updateScore(existingScore.id, updates);
      // Update local state
      setActionScores(prev => new Map(prev.set(actionId, { ...existingScore, ...updates })));
    }
  }, [actionScores, updateScore]);

  // Load scores when actions change
  useEffect(() => {
    if (actions.length > 0) {
      loadScoresForActions(actions);
    }
  }, [actions, loadScoresForActions]);

  return {
    actionScores: actionScores,
    isLoading,
    getActionScore,
    hasScore,
    createActionScore,
    updateActionScore,
    loadScoresForActions,
  };
};