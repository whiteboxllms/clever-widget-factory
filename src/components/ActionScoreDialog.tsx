import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Copy, User, Calendar, Wrench, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { useScoringPrompts } from "@/hooks/useScoringPrompts";
import { useActionScores, ActionScore } from "@/hooks/useActionScores";
import { ScoreEntryForm } from "./ScoreEntryForm";
import { ScoreDisplayCard } from "./ScoreDisplayCard";
import { apiService } from '@/lib/apiService';
import { BaseAction, ImplementationUpdate } from "@/types/actions";
import { useQuery } from '@tanstack/react-query';
import { offlineQueryConfig } from '@/lib/queryConfig';
import { actionImplementationUpdatesQueryKey } from '@/lib/queryKeys';

// Utility function to strip HTML tags and decode entities
const stripHtml = (html: string | null | undefined): string => {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
};

interface ActionScoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: BaseAction;
  onScoreUpdated: () => void;
  existingScore?: ActionScore | null;
}

export function ActionScoreDialog({ 
  open, 
  onOpenChange, 
  action,
  onScoreUpdated,
  existingScore 
}: ActionScoreDialogProps) {
  const [selectedPromptId, setSelectedPromptId] = useState<string>("");
  const organizationId = useOrganizationId();
  const [aiResponse, setAiResponse] = useState("");
  const [parsedScores, setParsedScores] = useState<Record<string, { score: number; reason: string }> | null>(null);
  const [rootCauses, setRootCauses] = useState<string[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showScoreForm, setShowScoreForm] = useState(false); // New state to control form visibility
  const [asset, setAsset] = useState<any>(null);
  const [assetName, setAssetName] = useState<string>("");

  const { toast } = useToast();
  const { prompts } = useScoringPrompts();
  const { createScore, updateScore } = useActionScores();

  // Fetch implementation updates (observations are stored as update_type = 'progress')
  const { data: implementationUpdates = [] } = useQuery<ImplementationUpdate[]>({
    queryKey: actionImplementationUpdatesQueryKey(action.id),
    queryFn: async () => {
      const result = await apiService.get(`/action_implementation_updates?action_id=${action.id}`);
      return result.data || [];
    },
    enabled: open && !!action.id,
    ...offlineQueryConfig
  });

  // Set asset when data changes
  useEffect(() => {
    if (action.asset) {
      setAsset(action.asset);
      setAssetName(action.asset.name);
    } else {
      // Ensure we don't leak asset context between different actions
      // If the current action has no asset, clear any previous asset state
      setAsset(null);
      setAssetName("");
    }
  }, [action.asset]);

  // Initialize form based on existing score or create mode
  useEffect(() => {
    console.log('[ActionScoreDialog] useEffect triggered', {
      open,
      actionId: action.id,
      actionTitle: action.title,
      existingScore: existingScore ? {
        id: existingScore.id,
        action_id: existingScore.action_id,
        hasAiResponse: !!existingScore.ai_response,
        aiResponsePreview: existingScore.ai_response ? JSON.stringify(existingScore.ai_response).substring(0, 100) : 'none'
      } : null
    });
    
    if (open) {
      // Always clear state first when opening for a new action
      console.log('[ActionScoreDialog] Clearing all state');
      setIsEditMode(false);
      setSelectedPromptId("");
      setAiResponse("");
      setParsedScores(null);
      setRootCauses([]);
      setShowScoreForm(false);
      
      // Then populate if there's an existing score
      if (existingScore) {
        console.log('[ActionScoreDialog] Populating from existing score');
        setIsEditMode(true);
        setSelectedPromptId(existingScore.prompt_id);
        // Only set AI response if it exists and has content
        const aiResponseContent = existingScore.ai_response && Object.keys(existingScore.ai_response).length > 0 
          ? JSON.stringify(existingScore.ai_response, null, 2)
          : "";
        console.log('[ActionScoreDialog] Setting AI response:', aiResponseContent.substring(0, 100));
        setAiResponse(aiResponseContent);
      } else {
        console.log('[ActionScoreDialog] No existing score, leaving fields empty');
      }
    } else {
      // Clear everything when dialog closes
      console.log('[ActionScoreDialog] Dialog closed, clearing state');
      setIsEditMode(false);
      setSelectedPromptId("");
      setAiResponse("");
      setParsedScores(null);
      setRootCauses([]);
      setShowScoreForm(false);
    }
  }, [open, existingScore, action.id]); // Add action.id to dependencies

  const selectedPrompt = prompts.find(p => p.id === selectedPromptId);

  // Aggregate observations from implementation updates with update_type = 'progress'
  const aggregatedObservations = implementationUpdates
    .filter(update => update.update_type === 'progress')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map(update => {
      const date = new Date(update.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      return `[${date}] ${stripHtml(update.update_text)}`;
    })
    .join('\n\n');

  const generatePrompt = () => {
    if (!selectedPrompt) return "";
    
    // Build action context - only include fields with meaningful content
    const actionContext: any = {
      id: action.id,
      title: action.title,
      status: action.status,
      created_at: action.created_at,
      completed_at: action.completed_at
    };

    // Add optional fields only if they have content
    if (action.description) {
      actionContext.description = action.description;
    }
    
    const policyText = stripHtml(action.policy);
    if (policyText) {
      actionContext.policy = policyText;
    }
    
    // Use aggregated observations from implementation updates, fallback to action.observations
    const observationsText = aggregatedObservations || stripHtml(action.observations);
    if (observationsText) {
      actionContext.observations = observationsText;
    }
    
    if (action.assignee?.full_name) {
      actionContext.assigned_to = action.assignee.full_name;
    }
    
    if (action.estimated_duration) {
      actionContext.estimated_duration = action.estimated_duration;
    }
    
    if (action.required_tools && action.required_tools.length > 0) {
      actionContext.required_tools = action.required_tools;
    }
    
    if (action.required_stock && action.required_stock.length > 0) {
      actionContext.required_stock = action.required_stock;
    }
    
    if (action.issue_reference) {
      actionContext.issue_reference = action.issue_reference;
    }

    // Add asset info only if available
    if (asset || assetName) {
      actionContext.asset = {
        name: assetName,
        id: asset?.id,
        category: asset?.category,
        location: asset?.storage_vicinity,
        serial_number: asset?.serial_number
      };
    }

    // Add strict instructions to avoid defaulting or guessing assets
    const antiLeakageAddendum = `

IMPORTANT OVERRIDES (do not ignore):
- Do NOT invent, infer, or reuse any asset from prior context or examples.
- Only include an "asset" field in the output if actionContext.asset is present.
- If actionContext.asset is not present, OMIT the "asset" field entirely (do not write "unspecified").
- If present, the asset name MUST exactly match actionContext.asset.name.
`;

    return `${selectedPrompt.prompt_text}${antiLeakageAddendum}\n\n${JSON.stringify(actionContext, null, 2)}`;
  };

  const handleCopyPrompt = () => {
    const prompt = generatePrompt();
    navigator.clipboard.writeText(prompt);
    toast({
      title: "Copied to clipboard",
      description: "The scoring prompt has been copied to your clipboard."
    });
  };

  const handleParseResponse = () => {
    try {
      const parsed = JSON.parse(aiResponse);
      
      setParsedScores(parsed.scores || {});
      setRootCauses(parsed.likely_root_causes || []);
      setShowScoreForm(true); // Show the form after parsing
      
      
      toast({
        title: "Response parsed successfully",
        description: "You can now review and adjust the scores."
      });
    } catch (error) {
      console.error('Parse error:', error);
      toast({
        title: "Invalid JSON",
        description: "Please check your AI response format.",
        variant: "destructive"
      });
    }
  };

  const handleSaveScore = async (finalScores: Record<string, { score: number; reason: string }>) => {
    if (!selectedPrompt) return;

    try {
      // Action should already exist if we're scoring it (completed actions only)
      // No need to verify/create

      const scoreData = {
        action_id: action.id!,
        prompt_id: selectedPromptId,
        prompt_text: selectedPrompt.prompt_text,
        scores: finalScores,
        ai_response: aiResponse ? JSON.parse(aiResponse) : undefined,
        likely_root_causes: rootCauses,
        asset_context_id: asset?.id || action.asset_id,
        asset_context_name: assetName,
      };

      if (existingScore) {
        await updateScore(existingScore.id, scoreData);
      } else {
        await createScore(scoreData);
      }

      onScoreUpdated();
      handleClose();
    } catch (error) {
      console.error('Error saving score:', error);
      toast({
        title: "Error",
        description: "Failed to save action score. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    setSelectedPromptId("");
    setAiResponse("");
    setParsedScores(null);
    setRootCauses([]);
    setIsEditMode(false);
    setShowScoreForm(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existingScore ? "Edit Action Score" : "Score Action Performance"}
          </DialogTitle>
          <DialogDescription>
            {existingScore
              ? `Review and edit existing AI scoring for action: ${action.title}`
              : `Generate AI scoring for action: ${action.title}`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Asset Information - only show if asset exists */}
          {asset && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Asset Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-semibold">Asset Name</Label>
                    <p>{assetName}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Category</Label>
                    <p>{asset.category || 'Uncategorized'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Location</Label>
                    <p>{asset.storage_vicinity || 'Not specified'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Serial Number</Label>
                    <p>{asset.serial_number || 'Not specified'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Action Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Badge variant={action.status === 'completed' ? 'default' : 'outline'}>
                    {action.status === 'completed' && <CheckCircle className="w-3 h-3 mr-1" />}
                    {action.status === 'in_progress' && <Clock className="w-3 h-3 mr-1" />}
                    {action.status}
                  </Badge>
                  {action.assignee && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <User className="h-3 w-3" />
                      {action.assignee.full_name}
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-semibold">Title</Label>
                  <p className="text-sm mt-1">{action.title}</p>
                </div>
                {action.description && (
                  <div>
                    <Label className="text-sm font-semibold">Description</Label>
                    <p className="text-sm mt-1">{action.description}</p>
                  </div>
                )}
                {action.policy && (
                  <div>
                    <Label className="text-sm font-semibold">Policy</Label>
                    <p className="text-sm mt-1">{stripHtml(action.policy)}</p>
                  </div>
                )}
                {(aggregatedObservations || action.observations) && (
                  <div>
                    <Label className="text-sm font-semibold">Observations</Label>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{aggregatedObservations || stripHtml(action.observations)}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-semibold">Created</Label>
                    <p className="text-sm mt-1">{new Date(action.created_at).toLocaleDateString()}</p>
                  </div>
                  {action.completed_at && (
                    <div>
                      <Label className="text-sm font-semibold">Completed</Label>
                      <p className="text-sm mt-1">{new Date(action.completed_at).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Show existing score if in edit mode */}
          {isEditMode && existingScore && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Current Score</CardTitle>
              </CardHeader>
              <CardContent>
                <ScoreDisplayCard scores={[existingScore]} assetName={assetName} />
              </CardContent>
            </Card>
          )}

          {/* Scoring Prompt Selection */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="prompt-select">Select Scoring Prompt</Label>
              <Select value={selectedPromptId} onValueChange={setSelectedPromptId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a scoring prompt..." />
                </SelectTrigger>
                <SelectContent>
                  {prompts.map((prompt) => (
                    <SelectItem key={prompt.id} value={prompt.id}>
                      {prompt.name} {prompt.is_default && '(Default)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Generated Prompt Display */}
            {selectedPrompt && (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">AI Prompt with Action Context</CardTitle>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleCopyPrompt}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy to Clipboard
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted p-4 rounded-lg max-h-64 overflow-y-auto">
                    <pre className="text-xs whitespace-pre-wrap font-mono">
                      {generatePrompt()}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* AI Response Input */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="ai-response">Paste AI Response (JSON format)</Label>
              <Textarea
                id="ai-response"
                value={aiResponse}
                onChange={(e) => setAiResponse(e.target.value)}
                placeholder="Paste the JSON response from your AI tool here..."
                rows={8}
                className="font-mono text-sm"
              />
            </div>
            
            <div className="flex space-x-2">
              <Button 
                onClick={handleParseResponse}
                disabled={!aiResponse.trim()}
              >
                Parse & Review Scores
              </Button>
            </div>
          </div>

          {/* Score Entry Form */}
          {showScoreForm && parsedScores && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Review & Save Scores</CardTitle>
              </CardHeader>
              <CardContent>
                <ScoreEntryForm
                  initialScores={parsedScores}
                  rootCauses={rootCauses}
                  onSave={handleSaveScore}
                  onCancel={handleClose}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}