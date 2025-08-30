import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Copy, User, Calendar, Wrench, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useScoringPrompts } from "@/hooks/useScoringPrompts";
import { useAssetScores, AssetScore } from "@/hooks/useAssetScores";
import { ScoreEntryForm } from "./ScoreEntryForm";
import { ScoreDisplayCard } from "./ScoreDisplayCard";
import { supabase } from "@/integrations/supabase/client";
import { BaseAction } from "@/types/actions";

interface ActionScoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: BaseAction;
  onScoreUpdated: () => void;
  existingScore?: AssetScore | null;
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

  const { toast } = useToast();
  const { prompts } = useScoringPrompts();
  const { createScore, updateScore } = useAssetScores();

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
            .select('context_id, context_type')
            .eq('id', action.linked_issue_id)
            .single();
          
          if (issueData && issueData.context_type === 'tool') {
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
    
    return selectedPrompt.prompt_text
      .replace(/\{asset_name\}/g, assetName)
      .replace(/\{action_title\}/g, action.title || "")
      .replace(/\{action_description\}/g, action.description || "")
      .replace(/\{action_plan\}/g, action.plan || "")
      .replace(/\{action_observations\}/g, action.observations || "");
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
      toast({
        title: "Response parsed successfully",
        description: "You can now review and adjust the scores."
      });
    } catch (error) {
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
      const scoreData = {
        asset_id: asset?.id || action.asset_id || action.linked_issue_id || action.id,
        asset_name: assetName,
        source_type: 'action' as const,
        source_id: action.id,
        prompt_id: selectedPromptId,
        prompt_text: selectedPrompt.prompt_text,
        scores: finalScores,
        ai_response: aiResponse ? JSON.parse(aiResponse) : undefined,
        likely_root_causes: rootCauses,
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existingScore ? "Edit Action Score" : "Score Action Performance"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Action Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                Action Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <strong>Title:</strong> {action.title}
              </div>
              <div>
                <strong>Asset:</strong> {assetName}
              </div>
              {action.description && (
                <div>
                  <strong>Description:</strong> {action.description}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {action.status}
                </Badge>
                {action.assignee && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <User className="h-3 w-3" />
                    {action.assignee.full_name}
                  </div>
                )}
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {new Date(action.created_at).toLocaleDateString()}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Show existing score if in edit mode */}
          {isEditMode && existingScore && (
            <ScoreDisplayCard scores={[existingScore]} assetName={assetName} />
          )}

          {/* Scoring Prompt Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Scoring Prompt</label>
            <Select value={selectedPromptId} onValueChange={setSelectedPromptId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a scoring prompt..." />
              </SelectTrigger>
              <SelectContent>
                {prompts.map((prompt) => (
                  <SelectItem key={prompt.id} value={prompt.id}>
                    {prompt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Generated Prompt Display */}
          {selectedPrompt && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-sm">Generated Prompt</CardTitle>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleCopyPrompt}
                    className="h-7"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-3 rounded whitespace-pre-wrap">
                  {generatePrompt()}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* AI Response Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Paste AI Response (JSON)</label>
            <Textarea
              value={aiResponse}
              onChange={(e) => setAiResponse(e.target.value)}
              placeholder="Paste the AI response JSON here..."
              className="min-h-[100px] font-mono text-xs"
            />
            <Button 
              onClick={handleParseResponse}
              disabled={!aiResponse}
              variant="outline"
              size="sm"
            >
              Parse Response
            </Button>
          </div>

          {/* Score Entry Form */}
          {parsedScores && (
            <ScoreEntryForm
              initialScores={parsedScores}
              rootCauses={rootCauses}
              onSave={handleSaveScore}
              onCancel={handleClose}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}