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
import { BaseAction } from "@/types/actions";
import { useQuery } from '@tanstack/react-query';
import { offlineQueryConfig } from '@/lib/queryConfig';

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
  const [linkedIssue, setLinkedIssue] = useState<any>(null);

  const { toast } = useToast();
  const { prompts } = useScoringPrompts();
  const { createScore, updateScore } = useActionScores();

  // Fetch linked issue if exists
  const { data: issueData } = useQuery({
    queryKey: ['issue', action.linked_issue_id],
    queryFn: async () => {
      const response = await apiService.get(`/issues/${action.linked_issue_id}`);
      return response.data;
    },
    enabled: open && !!action.linked_issue_id,
    ...offlineQueryConfig
  });

  // Set asset and linked issue when data changes
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
    
    if (issueData) {
      setLinkedIssue(issueData);
    }
  }, [action.asset, issueData]);

  // Initialize form based on existing score or create mode
  useEffect(() => {
    if (open) {
      if (existingScore) {
        setIsEditMode(true);
        setSelectedPromptId(existingScore.prompt_id);
        // Only set AI response if it exists and has content
        const aiResponseContent = existingScore.ai_response && Object.keys(existingScore.ai_response).length > 0 
          ? JSON.stringify(existingScore.ai_response, null, 2)
          : "";
        setAiResponse(aiResponseContent);
        // Don't auto-populate parsed scores - user must manually parse
        setParsedScores(null);
        setRootCauses([]);
        setShowScoreForm(false);
      } else {
        setIsEditMode(false);
        setSelectedPromptId("");
        setAiResponse(""); // Explicitly empty
        setParsedScores(null);
        setRootCauses([]);
        setShowScoreForm(false);
      }
    }
  }, [open, existingScore]);

  const selectedPrompt = prompts.find(p => p.id === selectedPromptId);

  const generatePrompt = () => {
    if (!selectedPrompt) return "";
    
    // Build action context - asset is optional
    const actionContext: any = {
      id: action.id,
      title: action.title,
      description: action.description,
      policy: stripHtml(action.policy),
      observations: stripHtml(action.observations),
      status: action.status,
      created_at: action.created_at,
      assigned_to: action.assignee?.full_name,
      estimated_duration: action.estimated_duration,
      required_tools: action.required_tools,
      required_stock: action.required_stock,
      completed_at: action.completed_at,
      issue_reference: action.issue_reference
    };

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

    // Add linked issue if available
    if (linkedIssue) {
      actionContext.linked_issue = {
        description: linkedIssue.description,
        type: linkedIssue.issue_type,
        status: linkedIssue.status,
        reported_at: linkedIssue.reported_at,
        damage_assessment: linkedIssue.damage_assessment,
        efficiency_loss_percentage: linkedIssue.efficiency_loss_percentage,
        root_cause: linkedIssue.root_cause,
        resolution_notes: linkedIssue.resolution_notes
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
                {action.observations && (
                  <div>
                    <Label className="text-sm font-semibold">Observations</Label>
                    <p className="text-sm mt-1">{stripHtml(action.observations)}</p>
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

          {/* Linked Issue Information */}
          {linkedIssue && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Linked Issue Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">{linkedIssue.issue_type}</Badge>
                    <Badge variant={linkedIssue.status === 'active' ? 'destructive' : 'secondary'}>
                      {linkedIssue.status}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Issue Description</Label>
                    <p className="text-sm mt-1">{linkedIssue.description}</p>
                  </div>
                  {linkedIssue.damage_assessment && (
                    <div>
                      <Label className="text-sm font-semibold">Damage Assessment</Label>
                      <p className="text-sm mt-1">{linkedIssue.damage_assessment}</p>
                    </div>
                  )}
                  {linkedIssue.efficiency_loss_percentage && (
                    <div>
                      <Label className="text-sm font-semibold">Efficiency Loss</Label>
                      <p className="text-sm mt-1">{linkedIssue.efficiency_loss_percentage}%</p>
                    </div>
                  )}
                  {linkedIssue.root_cause && (
                    <div>
                      <Label className="text-sm font-semibold">Root Cause</Label>
                      <p className="text-sm mt-1">{linkedIssue.root_cause}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

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