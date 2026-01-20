/**
 * ExplorationAssociationDialog Component
 * 
 * Dialog for selecting or entering exploration codes to link with actions.
 * Features:
 * - List non-integrated explorations
 * - Manual code entry with validation
 * - Select exploration to link
 * - Show action count per exploration
 * - Real-time code validation against existing explorations
 * - Error handling and loading states
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useNonIntegratedExplorations,
  useLinkExploration,
  useCreateExploration,
  explorationKeys,
} from '../hooks/useExplorations';
import { useUpdateAction } from '../hooks/useActions';

interface ExplorationAssociationDialogProps {
  actionId: string;
  isOpen: boolean;
  onClose: () => void;
  onLinked?: (explorationId: string) => void;
}

interface ExplorationItem {
  id: string;
  exploration_code: string;
  exploration_notes_text?: string;
  status: string;
  action_count: number;
  created_at: string;
}

export function ExplorationAssociationDialog({
  actionId,
  isOpen,
  onClose,
  onLinked,
}: ExplorationAssociationDialogProps) {
  const [selectedExplorationId, setSelectedExplorationId] = useState<
    string | null
  >(null);
  const [codeInput, setCodeInput] = useState('');
  const [suggestedCode, setSuggestedCode] = useState('');
  const [codeValidation, setCodeValidation] = useState<{
    isValid: boolean;
    matchedId: string | null;
    message: string;
    isNew: boolean;
  }>({ isValid: false, matchedId: null, message: '', isNew: false });

  // Queries and mutations
  const { data: explorations = [], isLoading, error } = useNonIntegratedExplorations();
  const queryClient = useQueryClient();
  const linkMutation = useLinkExploration();
  const createMutation = useCreateExploration();
  const updateActionMutation = useUpdateAction();

  // Generate suggested code for today's date
  useEffect(() => {
    if (!explorations || explorations.length === 0) {
      return;
    }

    const today = new Date();
    const mmddyy = formatDate(today);
    const prefix = `SF${mmddyy}EX`;
    
    // Find all codes with today's date
    const todaysCodes = explorations
      .filter((exp: ExplorationItem) => exp.exploration_code.startsWith(prefix))
      .map((exp: ExplorationItem) => {
        const numStr = exp.exploration_code.substring(prefix.length);
        return parseInt(numStr) || 0;
      })
      .sort((a, b) => a - b);
    
    // Find next available number
    let nextNumber = 1;
    for (const num of todaysCodes) {
      if (num === nextNumber) {
        nextNumber++;
      } else {
        break;
      }
    }
    
    const suggested = `${prefix}${nextNumber.toString().padStart(2, '0')}`;
    setSuggestedCode(suggested);
  }, [explorations]);

  // Format date as mmddyy
  const formatDate = (date: Date): string => {
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    const dd = date.getDate().toString().padStart(2, '0');
    const yy = date.getFullYear().toString().slice(-2);
    return `${mm}${dd}${yy}`;
  };

  // Validate code input - can be existing or new
  useEffect(() => {
    if (!codeInput.trim()) {
      setCodeValidation({ isValid: false, matchedId: null, message: '', isNew: false });
      return;
    }

    const upperCode = codeInput.toUpperCase().trim();
    const matched = explorations.find(
      (exp: ExplorationItem) => exp.exploration_code.toUpperCase() === upperCode
    );

    if (matched) {
      // Code exists - can link to it
      setCodeValidation({
        isValid: true,
        matchedId: matched.id,
        message: `✓ Found: ${matched.exploration_code} (${matched.action_count} actions)`,
        isNew: false,
      });
    } else {
      // Code doesn't exist - can create it
      setCodeValidation({
        isValid: true,
        matchedId: null,
        message: `✓ Will create new exploration: ${upperCode}`,
        isNew: true,
      });
    }
  }, [codeInput, explorations]);

  const [isCreatingAndLinking, setIsCreatingAndLinking] = useState(false);

  const handleCreateAndLink = async () => {
    const codeToUse = codeInput.trim() || suggestedCode;
    if (!codeToUse) return;

    setIsCreatingAndLinking(true);
    updateActionMutation.mutate(
      {
        id: actionId,
        data: { is_exploration: true },
      },
      {
        onSuccess: () => {
          createMutation.mutate(
            {
              exploration_code: codeToUse.toUpperCase().trim(),
            },
            {
              onSuccess: async (newExploration) => {
                await linkMutation.mutateAsync({
                  actionId,
                  explorationId: String(newExploration.id),
                });
                await queryClient.invalidateQueries({
                  queryKey: explorationKeys.list('in_progress,ready_for_analysis'),
                });
                onLinked?.(String(newExploration.id));
                onClose();
              },
              onError: (err) => {
                console.error('Failed to create and link exploration:', err);
                setIsCreatingAndLinking(false);
              },
            }
          );
        },
        onError: (err) => {
          console.error('Failed to update action for exploration:', err);
          setIsCreatingAndLinking(false);
        },
      }
    );
  };

  const handleLink = async () => {
    // Prioritize selected exploration from list over code input
    if (selectedExplorationId) {
      await linkMutation.mutateAsync({
        actionId,
        explorationId: selectedExplorationId,
      });
      await queryClient.invalidateQueries({
        queryKey: explorationKeys.list('in_progress,ready_for_analysis'),
      });
      onLinked?.(selectedExplorationId);
      onClose();
      return;
    }
    
    // Handle code input
    if (!codeValidation.isValid) return;

    if (codeValidation.isNew) {
      updateActionMutation.mutate(
        {
          id: actionId,
          data: { is_exploration: true },
        },
        {
          onSuccess: () => {
            createMutation.mutate(
              {
                exploration_code: codeInput.toUpperCase().trim(),
              },
              {
                onSuccess: async (newExploration) => {
                  await linkMutation.mutateAsync({
                    actionId,
                    explorationId: String(newExploration.id),
                  });
                  await queryClient.invalidateQueries({
                    queryKey: explorationKeys.list('in_progress,ready_for_analysis'),
                  });
                  onLinked?.(String(newExploration.id));
                  onClose();
                },
                onError: (err) => {
                  console.error('Failed to create exploration for linking:', err);
                },
              }
            );
          },
          onError: (err) => {
            console.error('Failed to update action for exploration:', err);
          },
        }
      );
    } else {
      await linkMutation.mutateAsync({
        actionId,
        explorationId: codeValidation.matchedId!,
      });
      await queryClient.invalidateQueries({
        queryKey: explorationKeys.list('in_progress,ready_for_analysis'),
      });
      onLinked?.(codeValidation.matchedId!);
      onClose();
    }
  };

  const handleClose = () => {
    setSelectedExplorationId(null);
    setCodeInput('');
    onClose();
  };

  const isLoading_ = isLoading || linkMutation.isPending || createMutation.isPending || updateActionMutation.isPending;
  const isError = error || linkMutation.isError || createMutation.isError || updateActionMutation.isError;
  const canLink = selectedExplorationId || codeValidation.isValid;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Link Exploration</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Code Input Section */}
          <div className="space-y-3 rounded-md border p-4 bg-blue-50">
            <div>
              <Label htmlFor="exploration-code" className="text-sm font-medium">
                Enter or Create Exploration Code
              </Label>
              <div className="mt-1 flex gap-2">
                <Input
                  id="exploration-code"
                  placeholder="e.g., SF011626EX01"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  disabled={isLoading_}
                  className="flex-1"
                />
                {suggestedCode && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCreateAndLink}
                    disabled={isLoading_ || isCreatingAndLinking || (!codeInput && !suggestedCode)}
                    title={codeInput ? `Create and link: ${codeInput}` : `Create and link suggested: ${suggestedCode}`}
                  >
                    {isCreatingAndLinking ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create'
                    )}
                  </Button>
                )}
              </div>
              {suggestedCode && !codeInput && (
                <p className="mt-2 text-xs text-gray-600">
                  Suggested for today: <span className="font-mono font-semibold">{suggestedCode}</span>
                </p>
              )}
            </div>

            {/* Code Validation Message */}
            {codeInput && (
              <div
                className={`flex items-center gap-2 rounded-md p-3 text-sm ${
                  codeValidation.isValid
                    ? 'bg-green-50 text-green-700'
                    : 'bg-red-50 text-red-700'
                }`}
              >
                {codeValidation.isValid ? (
                  <CheckCircle className="h-4 w-4 flex-shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                )}
                <span>{codeValidation.message}</span>
              </div>
            )}

            {/* Hint */}
            <p className="text-xs text-gray-600">
              Enter an exploration code from your stake. If it exists, you'll link to it. If not, a new exploration will be created.
            </p>
          </div>

          {/* Error Message */}
          {isError && (
            <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>
                {error instanceof Error
                  ? error.message
                  : 'Failed to load explorations'}
              </span>
            </div>
          )}

          {/* Explorations List */}
          <div>
            <h3 className="text-sm font-medium mb-2">Available Explorations</h3>
            <div className="rounded-md border">
              {isLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : explorations.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-500">
                  No active explorations available
                </div>
              ) : (
                <ScrollArea className="h-64">
                  <div className="space-y-1 p-4">
                    {explorations.map((exploration: ExplorationItem) => (
                      <button
                        key={exploration.id}
                        onClick={() => setSelectedExplorationId(exploration.id)}
                        className={`w-full rounded-md p-3 text-left transition-colors ${
                          selectedExplorationId === exploration.id
                            ? 'bg-blue-50 ring-2 ring-blue-500'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-sm">
                              {exploration.exploration_code}
                            </div>
                            {exploration.exploration_notes_text && (
                              <div className="mt-1 line-clamp-2 text-xs text-gray-600">
                                {exploration.exploration_notes_text}
                              </div>
                            )}
                          </div>
                          <div className="ml-2 flex-shrink-0 text-xs text-gray-500">
                            {exploration.action_count}{' '}
                            {exploration.action_count === 1 ? 'action' : 'actions'}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>

          {/* Status Message */}
          {selectedExplorationId && !codeInput && (
            <div className="text-sm text-green-700">
              ✓ Exploration selected
            </div>
          )}
          {codeInput && codeValidation.isValid && (
            <div className="text-sm text-green-700">
              ✓ Ready to link
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleLink}
            disabled={!canLink || linkMutation.isPending || createMutation.isPending}
          >
            {linkMutation.isPending || createMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {createMutation.isPending ? 'Creating...' : 'Linking...'}
              </>
            ) : (
              'Link Exploration'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}