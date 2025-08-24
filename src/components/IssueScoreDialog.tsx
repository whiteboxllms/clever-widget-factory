import { useState } from 'react';
import { Copy, Save } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useScoringPrompts } from '@/hooks/useScoringPrompts';
import { useAssetScores } from '@/hooks/useAssetScores';
import { useToast } from '@/hooks/use-toast';
import { ScoreEntryForm } from './ScoreEntryForm';

interface ToolIssue {
  id: string;
  tool_id: string;
  description: string;
  issue_type: string;
  status: string;
  reported_at: string;
  damage_assessment?: string;
  report_photo_urls?: string[];
  efficiency_loss_percentage?: number;
}

interface Tool {
  id: string;
  name: string;
  category?: string;
  storage_vicinity: string;
  serial_number?: string;
}

interface IssueScoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issue: ToolIssue;
  tool: Tool;
}

export function IssueScoreDialog({ open, onOpenChange, issue, tool }: IssueScoreDialogProps) {
  const { prompts, getDefaultPrompt } = useScoringPrompts();
  const { createScore } = useAssetScores();
  const { toast } = useToast();
  
  const [selectedPromptId, setSelectedPromptId] = useState<string>('');
  const [aiResponse, setAiResponse] = useState('');
  const [parsedScores, setParsedScores] = useState<Record<string, { score: number; reason: string }>>({});
  const [parsedRootCauses, setParsedRootCauses] = useState<string[]>([]);
  const [fullAiResponse, setFullAiResponse] = useState<Record<string, any>>({});
  const [showScoreForm, setShowScoreForm] = useState(false);

  // Initialize with default prompt when dialog opens
  useState(() => {
    if (open && prompts.length > 0 && !selectedPromptId) {
      const defaultPrompt = getDefaultPrompt();
      if (defaultPrompt) {
        setSelectedPromptId(defaultPrompt.id);
      }
    }
  });

  const selectedPrompt = prompts.find(p => p.id === selectedPromptId);

  const issueJson = {
    id: issue.id,
    asset: tool.name,
    asset_id: tool.id,
    asset_category: tool.category,
    asset_location: tool.storage_vicinity,
    serial_number: tool.serial_number,
    issue: {
      description: issue.description,
      type: issue.issue_type,
      status: issue.status,
      reported_at: issue.reported_at,
      damage_assessment: issue.damage_assessment,
      efficiency_loss_percentage: issue.efficiency_loss_percentage,
      photos_count: issue.report_photo_urls?.length || 0,
    }
  };

  const fullPromptText = selectedPrompt 
    ? `${selectedPrompt.prompt_text}\n\n${JSON.stringify(issueJson, null, 2)}`
    : '';

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(fullPromptText);
      toast({
        title: "Copied",
        description: "Prompt copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy prompt",
        variant: "destructive",
      });
    }
  };

  const handleParseResponse = () => {
    try {
      const parsed = JSON.parse(aiResponse);
      if (parsed.scores && typeof parsed.scores === 'object') {
        setParsedScores(parsed.scores);
        setParsedRootCauses(parsed.likely_root_causes || []);
        setFullAiResponse(parsed);
        setShowScoreForm(true);
      } else {
        toast({
          title: "Error",
          description: "Response must contain a 'scores' field with scoring data.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Invalid JSON response. Please check the format and try again.",
        variant: "destructive",
      });
    }
  };

  const handleSaveScore = async (scores: Record<string, { score: number; reason: string }>) => {
    if (!selectedPrompt) return;

    try {
      await createScore({
        asset_id: tool.id,
        asset_name: tool.name,
        source_type: 'issue',
        source_id: issue.id,
        prompt_id: selectedPrompt.id,
        prompt_text: selectedPrompt.prompt_text,
        scores,
        ai_response: fullAiResponse,
        likely_root_causes: parsedRootCauses,
      });

      toast({
        title: "Success",
        description: "Asset score saved successfully",
      });
      
      onOpenChange(false);
      setAiResponse('');
      setParsedScores({});
      setShowScoreForm(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setAiResponse('');
    setParsedScores({});
    setParsedRootCauses([]);
    setFullAiResponse({});
    setShowScoreForm(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Score Asset Performance</DialogTitle>
          <DialogDescription>
            Generate AI scoring for {tool.name} based on issue report
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
                  <p>{tool.name}</p>
                </div>
                <div>
                  <Label className="text-sm font-semibold">Category</Label>
                  <p>{tool.category || 'Uncategorized'}</p>
                </div>
                <div>
                  <Label className="text-sm font-semibold">Location</Label>
                  <p>{tool.storage_vicinity}</p>
                </div>
                <div>
                  <Label className="text-sm font-semibold">Serial Number</Label>
                  <p>{tool.serial_number || 'Not specified'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Issue Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Issue Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">{issue.issue_type}</Badge>
                  <Badge variant={issue.status === 'active' ? 'destructive' : 'secondary'}>
                    {issue.status}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm font-semibold">Description</Label>
                  <p className="text-sm mt-1">{issue.description}</p>
                </div>
                {issue.damage_assessment && (
                  <div>
                    <Label className="text-sm font-semibold">Damage Assessment</Label>
                    <p className="text-sm mt-1">{issue.damage_assessment}</p>
                  </div>
                )}
                {issue.efficiency_loss_percentage && (
                  <div>
                    <Label className="text-sm font-semibold">Efficiency Loss</Label>
                    <p className="text-sm mt-1">{issue.efficiency_loss_percentage}%</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Prompt Selection */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="prompt-select">Select Scoring Prompt</Label>
              <Select value={selectedPromptId} onValueChange={setSelectedPromptId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a scoring prompt" />
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

            {selectedPrompt && (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">AI Prompt with Issue Data</CardTitle>
                    <Button variant="outline" size="sm" onClick={handleCopyPrompt}>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy to Clipboard
                    </Button>
                  </div>
                  <CardDescription>
                    Copy this prompt and paste it into ChatGPT or your AI tool
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted p-4 rounded-lg max-h-64 overflow-y-auto">
                    <pre className="text-xs whitespace-pre-wrap font-mono">
                      {fullPromptText}
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
          {showScoreForm && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Review & Save Scores</CardTitle>
                <CardDescription>
                  Review the parsed scores and make any adjustments before saving
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScoreEntryForm
                  initialScores={parsedScores}
                  rootCauses={parsedRootCauses}
                  onSave={handleSaveScore}
                  onCancel={() => setShowScoreForm(false)}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}