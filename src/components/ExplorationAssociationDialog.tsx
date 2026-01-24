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
import { Loader2, AlertCircle, CheckCircle, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useNonIntegratedExplorations,
  useLinkExploration,
  useCreateExploration,
  useUpdateExploration,
  useDeleteExploration,
  explorationKeys,
} from '../hooks/useExplorations';
import { useUpdateAction } from '../hooks/useActions';

interface ExplorationAssociationDialogProps {
  actionId: string;
  isOpen: boolean;
  onClose: () => void;
  onLinked?: (exploration: { id: string; exploration_code: string; name?: string }) => void;
  currentExplorationId?: string;
}

interface ExplorationItem {
  id: string;
  exploration_code: string;
  name?: string;
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
  currentExplorationId,
}: ExplorationAssociationDialogProps) {
  const [selectedExplorationId, setSelectedExplorationId] = useState<
    string | null
  >(null);
  const [deletingExplorationId, setDeletingExplorationId] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [suggestedCode, setSuggestedCode] = useState('');
  const [editingExplorationId, setEditingExplorationId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editName, setEditName] = useState('');
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
  const updateMutation = useUpdateExploration();
  const deleteMutation = useDeleteExploration();
  const updateActionMutation = useUpdateAction();

  // Pre-select current exploration when dialog opens
  useEffect(() => {
    if (isOpen && currentExplorationId) {
      setSelectedExplorationId(currentExplorationId);
      const exploration = explorations.find((e: ExplorationItem) => e.id === currentExplorationId);
      if (exploration) {
        setCodeInput(exploration.exploration_code);
        setNameInput(exploration.name || '');
      }
    }
  }, [isOpen, currentExplorationId, explorations]);

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
        message: '',
        isNew: false,
      });
    } else {
      // Code doesn't exist - can create it
      setCodeValidation({
        isValid: true,
        matchedId: null,
        message: '',
        isNew: true,
      });
    }
  }, [codeInput]);

  const [isCreatingAndLinking, setIsCreatingAndLinking] = useState(false);

  const handleCreateAndLink = async () => {
    const codeToUse = codeInput.trim() || suggestedCode;
    const nameToUse = nameInput.trim();
    
    if (!codeToUse || !nameToUse) {
      return;
    }

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
              name: nameToUse,
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
                onLinked?.({ id: String(newExploration.id), exploration_code: newExploration.exploration_code, name: newExploration.name });
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
      const exploration = explorations.find((e: ExplorationItem) => e.id === selectedExplorationId);
      onLinked?.({ id: selectedExplorationId, exploration_code: exploration?.exploration_code || '', name: exploration?.name });
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
                name: nameInput.trim(),
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
                  onLinked?.({ id: String(newExploration.id), exploration_code: newExploration.exploration_code, name: newExploration.name });
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
      const exploration = explorations.find((e: ExplorationItem) => e.id === codeValidation.matchedId);
      onLinked?.({ id: codeValidation.matchedId!, exploration_code: codeInput.toUpperCase().trim(), name: exploration?.name });
      onClose();
    }
  };

  const handleClose = () => {
    setSelectedExplorationId(null);
    setCodeInput('');
    setNameInput('');
    setEditingExplorationId(null);
    setEditCode('');
    setEditName('');
    onClose();
  };

  const handleExplorationSelect = (exploration: ExplorationItem) => {
    setSelectedExplorationId(exploration.id);
    setCodeInput(exploration.exploration_code);
    setNameInput(exploration.name || '');
  };

  const handleUpdateExploration = async () => {
    if (!selectedExplorationId || !codeInput.trim() || !nameInput.trim()) return;
    
    await updateMutation.mutateAsync({
      id: selectedExplorationId,
      data: {
        exploration_code: codeInput.toUpperCase().trim(),
        name: nameInput.trim()
      }
    });
    
    await queryClient.invalidateQueries({
      queryKey: explorationKeys.list('in_progress,ready_for_analysis'),
    });
  };

  const handleDeleteExploration = async (explorationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      await deleteMutation.mutateAsync(explorationId);
      await queryClient.invalidateQueries({
        queryKey: explorationKeys.list('in_progress,ready_for_analysis'),
      });
      setDeletingExplorationId(null);
    } catch (error) {
      console.error('Failed to delete exploration:', error);
      setDeletingExplorationId(null);
    }
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
          <div className="space-y-3 rounded-md border p-4 bg-gray-50">
            <div>
              <Label htmlFor="exploration-code" className="text-sm font-medium">
                Exploration Code *
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
              </div>
              {suggestedCode && !codeInput && (
                <p className="mt-2 text-xs text-gray-600">
                  Suggested for today: <span className="font-mono font-semibold">{suggestedCode}</span>
                </p>
              )}
            </div>

            {/* Name Input */}
            <div>
              <Label htmlFor="exploration-name" className="text-sm font-medium">
                Exploration Name *
              </Label>
              <Input
                id="exploration-name"
                placeholder="e.g., North Field Survey"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                disabled={isLoading_}
                className="mt-1"
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={selectedExplorationId ? handleUpdateExploration : handleCreateAndLink}
                disabled={isLoading_ || isCreatingAndLinking || !codeInput.trim() || !nameInput.trim() || updateMutation.isPending}
              >
                {isCreatingAndLinking ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Creating...
                  </>
                ) : updateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Updating...
                  </>
                ) : selectedExplorationId ? (
                  'Update'
                ) : (
                  'Create'
                )}
              </Button>
              {selectedExplorationId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedExplorationId(null);
                    setCodeInput('');
                    setNameInput('');
                  }}
                >
                  Clear
                </Button>
              )}
            </div>

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
                      <div
                        key={exploration.id}
                        className={`w-full rounded-md p-3 transition-colors ${
                          selectedExplorationId === exploration.id
                            ? 'bg-blue-50 ring-2 ring-blue-500'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <button
                            onClick={() => handleExplorationSelect(exploration)}
                            className="flex-1 text-left min-w-0"
                          >
                            <div className="text-sm">
                              <span className="font-medium">{exploration.exploration_code}</span>
                              {exploration.name && <span className="text-gray-700"> - {exploration.name}</span>}
                            </div>
                            {exploration.exploration_notes_text && (
                              <div className="mt-1 line-clamp-2 text-xs text-gray-600">
                                {exploration.exploration_notes_text}
                              </div>
                            )}
                          </button>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="text-xs text-gray-500">
                              {exploration.action_count}{' '}
                              {exploration.action_count === 1 ? 'action' : 'actions'}
                            </div>
                            {Number(exploration.action_count) === 0 && (
                              deletingExplorationId === exploration.id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={(e) => handleDeleteExploration(exploration.id, e)}
                                    className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                                    disabled={deleteMutation.isPending}
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setDeletingExplorationId(null); }}
                                    className="px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setDeletingExplorationId(exploration.id); }}
                                  className="p-1 hover:bg-red-100 rounded transition-colors"
                                  title="Delete exploration"
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      </div>
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