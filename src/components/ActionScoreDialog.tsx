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
import { useScoringPrompts } from "@/hooks/useScoringPrompts";
import { useActionScores, ActionScore } from "@/hooks/useActionScores";
import { ScoreEntryForm } from "./ScoreEntryForm";
import { ScoreDisplayCard } from "./ScoreDisplayCard";
import { supabase } from "@/integrations/supabase/client";
import { BaseAction } from "@/types/actions";

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
  const [aiResponse, setAiResponse] = useState("");
  const [parsedScores, setParsedScores] = useState<Record<string, { score: number; reason: string }> | null>(null);
  const [rootCauses, setRootCauses] = useState<string[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [asset, setAsset] = useState<any>(null);
  const [assetName, setAssetName] = useState<string>("");
  const [linkedIssue, setLinkedIssue] = useState<any>(null);

  const { toast } = useToast();
  const { prompts } = useScoringPrompts();
  const { createScore, updateScore } = useActionScores();

  // Determine asset context for the action
  useEffect(() => {
    const determineAssetContext = async () => {
      try {
        let assetId = null;
        let name = "";

        // Priority 1: Direct asset_id
        if (action.asset_id) {
          const { data } = await supabase
            .from('tools')
            .select('*')
            .eq('id', action.asset_id)
            .single();
          if (data) {
            setAsset(data);
            setAssetName(data.name);
            return;
          }
        }

        // Priority 2: Linked issue's tool
        if (action.linked_issue_id) {
          const { data: issueData } = await supabase
            .from('issues')
            .select('*')
            .eq('id', action.linked_issue_id)
            .single();
          
          if (issueData) {
            setLinkedIssue(issueData);
            
            if (issueData.context_type === 'tool') {
              const { data: toolData } = await supabase
                .from('tools')
                .select('*')
                .eq('id', issueData.context_id)
                .single();
              if (toolData) {
                setAsset(toolData);
                setAssetName(toolData.name);
                return;
              }
            }
          }
        }

        // Priority 3: First required tool
        if (action.required_tools && action.required_tools.length > 0) {
          const { data: toolData } = await supabase
            .from('tools')
            .select('*')
            .eq('id', action.required_tools[0])
            .single();
          if (toolData) {
            setAsset(toolData);
            setAssetName(toolData.name);
            return;
          }
        }

        // Fallback: Use action title as asset name
        setAssetName(action.title || "Unknown Asset");
      } catch (error) {
        console.error('Error determining asset context:', error);
        setAssetName(action.title || "Unknown Asset");
      }
    };

    if (open) {
      determineAssetContext();
    }
  }, [open, action]);

  // Initialize form based on existing score or create mode
  useEffect(() => {
    if (open) {
      if (existingScore) {
        setIsEditMode(true);
        setSelectedPromptId(existingScore.prompt_id);
        setAiResponse(JSON.stringify(existingScore.ai_response || {}, null, 2));
        setParsedScores(existingScore.scores);
        setRootCauses(existingScore.likely_root_causes || []);
      } else {
        setIsEditMode(false);
        setSelectedPromptId("");
        setAiResponse("");
        setParsedScores(null);
        setRootCauses([]);
      }
    }
  }, [open, existingScore]);

  const selectedPrompt = prompts.find(p => p.id === selectedPromptId);

  const generatePrompt = () => {
    if (!selectedPrompt || !assetName) return "";
    
    // Build comprehensive context JSON similar to IssueScoreDialog
    const actionContext = {
      id: action.id,
      asset: assetName,
      asset_id: asset?.id || action.asset_id,
      asset_category: asset?.category,
      asset_location: asset?.storage_vicinity,
      serial_number: asset?.serial_number,
      action: {
        title: action.title,
        description: action.description,
        policy: action.policy,
        observations: action.observations,
        status: action.status,
        created_at: action.created_at,
        assigned_to: action.assignee?.full_name,
        estimated_duration: action.estimated_duration,
        required_tools: action.required_tools,
        required_stock: action.required_stock,
        completed_at: action.completed_at,
        issue_reference: action.issue_reference
      },
      ...(linkedIssue && {
        linked_issue: {
          description: linkedIssue.description,
          type: linkedIssue.issue_type,
          status: linkedIssue.status,
          reported_at: linkedIssue.reported_at,
          damage_assessment: linkedIssue.damage_assessment,
          efficiency_loss_percentage: linkedIssue.efficiency_loss_percentage,
          root_cause: linkedIssue.root_cause,
          resolution_notes: linkedIssue.resolution_notes
        }
      })
    };

    return `${selectedPrompt.prompt_text}\n\n${JSON.stringify(actionContext, null, 2)}`;
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
      console.log('Parsing AI response:', aiResponse);
      const parsed = JSON.parse(aiResponse);
      console.log('Parsed data:', parsed);
      console.log('Extracted scores:', parsed.scores);
      console.log('Extracted root causes:', parsed.likely_root_causes);
      
      setParsedScores(parsed.scores || {});
      setRootCauses(parsed.likely_root_causes || []);
      
      console.log('State should be updated - parsedScores:', parsed.scores || {});
      
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
      // First verify the action exists in the database, if not create it
      const { data: actionExists, error: actionError } = await supabase
        .from('actions')
        .select('id')
        .eq('id', action.id!)
        .single();

      if (actionError || !actionExists) {
        // Action doesn't exist, create it first
        const actionData = {
          id: action.id,
          title: action.title,
          description: action.description || null,
          policy: action.policy || null,
          observations: action.observations || null,
          status: action.status || 'not_started',
          assigned_to: action.assigned_to || null,
          mission_id: action.mission_id || null,
          asset_id: action.asset_id || null,
          linked_issue_id: action.linked_issue_id || null,
          issue_reference: action.issue_reference || null,
          estimated_duration: action.estimated_duration || null,
          required_tools: action.required_tools || [],
          required_stock: action.required_stock || [],
          attachments: action.attachments || [],
          plan_commitment: action.plan_commitment || false
        };

        const { error: createError } = await supabase
          .from('actions')
          .insert(actionData);

        if (createError) {
          console.error('Error creating action:', createError);
          toast({
            title: "Error",
            description: "Failed to save action before scoring. Please try again.",
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Action Saved",
          description: "Action was automatically saved before scoring.",
        });
      }

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
              : `Generate AI scoring for action performance on ${assetName}`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Asset Information */}
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
                  <p>{asset?.category || 'Uncategorized'}</p>
                </div>
                <div>
                  <Label className="text-sm font-semibold">Location</Label>
                  <p>{asset?.storage_vicinity || 'Not specified'}</p>
                </div>
                <div>
                  <Label className="text-sm font-semibold">Serial Number</Label>
                  <p>{asset?.serial_number || 'Not specified'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

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
          {parsedScores && (
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