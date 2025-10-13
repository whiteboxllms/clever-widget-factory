import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Copy, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useSections } from '@/hooks/useSections';
import { usePrompts } from '@/hooks/usePrompts';
import { buildReportContext } from '@/services/reportDataService';
import { validateReportResponse } from '@/services/responseValidator';
import { useToast } from '@/hooks/use-toast';
import { atiFarmJournalPrompt } from '@/prompts/atiFarmJournalPrompt';

export default function ReportsTestPage() {
  const [dateStart, setDateStart] = useState<Date>(() => {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    return lastWeek;
  });
  const [dateEnd, setDateEnd] = useState<Date>(() => {
    const today = new Date();
    today.setDate(today.getDate() - 1); // Yesterday
    return today;
  });
  const [generatedContext, setGeneratedContext] = useState<string>('');
  const [aiResponse, setAiResponse] = useState<string>('');
  const [isGeneratingContext, setIsGeneratingContext] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [sectionTitle, setSectionTitle] = useState('');
  const [sectionFocus, setSectionFocus] = useState('');
  const [selectedPromptId, setSelectedPromptId] = useState<string>('');
  const [fullPrompt, setFullPrompt] = useState<string>('');

  const { createSection, isLoading: sectionsLoading } = useSections();
  const { prompts, isLoading: promptsLoading, getDefaultPrompt } = usePrompts();
  const { toast } = useToast();

  // Set default prompt when prompts load
  useEffect(() => {
    if (prompts.length > 0 && !selectedPromptId) {
      const defaultPrompt = getDefaultPrompt('ATI Journal') || getDefaultPrompt();
      if (defaultPrompt) {
        setSelectedPromptId(defaultPrompt.id);
      }
    }
  }, [prompts, selectedPromptId, getDefaultPrompt]);

  // Update full prompt when context or selected prompt changes
  useEffect(() => {
    if (generatedContext && selectedPromptId) {
      const selectedPrompt = prompts.find(p => p.id === selectedPromptId);
      if (selectedPrompt) {
        const fullPromptText = `${selectedPrompt.prompt_text}\n\n## Context Data\n${generatedContext}`;
        setFullPrompt(fullPromptText);
      }
    }
  }, [generatedContext, selectedPromptId, prompts]);

  const handleGenerateContext = async () => {
    if (!dateStart || !dateEnd) {
      toast({
        title: "Missing Information",
        description: "Please select date range",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsGeneratingContext(true);
      const startStr = format(dateStart, 'yyyy-MM-dd');
      const endStr = format(dateEnd, 'yyyy-MM-dd');
      
      const context = await buildReportContext(startStr, endStr);
      setGeneratedContext(JSON.stringify(context, null, 2));
      
      toast({
        title: "Context Generated",
        description: "Report context data ready for AI processing",
      });
    } catch (error) {
      console.error("Error generating context:", error);
      toast({
        title: "Error",
        description: "Failed to generate report context",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingContext(false);
    }
  };

  const handleCopyContext = async () => {
    try {
      await navigator.clipboard.writeText(generatedContext);
      toast({
        title: "Copied",
        description: "Context data copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy context",
        variant: "destructive",
      });
    }
  };

  const handleCopyFullPrompt = async () => {
    try {
      await navigator.clipboard.writeText(fullPrompt);
      toast({
        title: "Copied",
        description: "Full AI prompt copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy full prompt",
        variant: "destructive",
      });
    }
  };

  const handleSaveSection = async () => {
    if (!aiResponse || !sectionTitle || !sectionFocus) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSaving(true);
      
      // Parse AI response
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(aiResponse);
      } catch (error) {
        toast({
          title: "Invalid JSON",
          description: "Please provide valid JSON response from AI",
          variant: "destructive",
        });
        return;
      }

      // Validate response
      const validation = validateReportResponse(parsedResponse);
      if (!validation.isValid) {
        toast({
          title: "Validation Failed",
          description: `Errors: ${validation.errors.join(', ')}`,
          variant: "destructive",
        });
        return;
      }

      // Create section
      await createSection({
        section_focus: sectionFocus,
        title: sectionTitle,
        report: parsedResponse,
        prompt_id: 'default-report-prompt' // TODO: Create a default prompt or make prompt_id optional
      });

      toast({
        title: "Success",
        description: "Section saved successfully!",
      });

      // Reset form
      setAiResponse('');
      setSectionTitle('');
      setSectionFocus('');
    } catch (error) {
      console.error('Error saving section:', error);
      toast({
        title: "Error",
        description: "Failed to save section",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reports Test Page</h1>
          <p className="text-muted-foreground">
            Test the report generation system
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Generate Prompt</CardTitle>
            <CardDescription>
              Configure date range and generate context for AI
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Prompt Selection */}
            <div className="space-y-2">
              <Label>Select Prompt</Label>
              <Select value={selectedPromptId} onValueChange={setSelectedPromptId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a prompt" />
                </SelectTrigger>
                <SelectContent>
                  {prompts.map((prompt) => (
                    <SelectItem key={prompt.id} value={prompt.id}>
                      {prompt.name} ({prompt.intended_usage})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <Label>Date Range</Label>
              <div className="grid grid-cols-2 gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left font-normal",
                        !dateStart && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateStart ? format(dateStart, "PPP") : "Start date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateStart}
                      onSelect={setDateStart}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left font-normal",
                        !dateEnd && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateEnd ? format(dateEnd, "PPP") : "End date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateEnd}
                      onSelect={setDateEnd}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Generate Button */}
            <Button 
              onClick={handleGenerateContext}
              disabled={isGeneratingContext || promptsLoading}
              className="w-full"
            >
              {isGeneratingContext ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Context...
                </>
              ) : (
                'Generate Report Context'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Right Column - Generated Context */}
        <Card>
          <CardHeader>
            <CardTitle>Report Context</CardTitle>
            <CardDescription>
              Raw report context data (JSON format) - use this with AI tools
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Report Context Data</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyContext}
                  disabled={!generatedContext}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy
                </Button>
              </div>
              <Textarea
                value={generatedContext}
                onChange={(e) => setGeneratedContext(e.target.value)}
                placeholder="Generated context will appear here..."
                className="min-h-[200px] font-mono text-sm"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Full AI Prompt Section */}
      <Card>
        <CardHeader>
          <CardTitle>Full AI Prompt</CardTitle>
          <CardDescription>
            Complete prompt with context data ready for AI tools
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Complete Prompt with Context</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyFullPrompt}
                disabled={!fullPrompt}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy Full Prompt
              </Button>
            </div>
            <Textarea
              value={fullPrompt}
              onChange={(e) => setFullPrompt(e.target.value)}
              placeholder="Full prompt with context will appear here..."
              className="min-h-[200px] font-mono text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* AI Response Section */}
      <Card>
        <CardHeader>
          <CardTitle>AI Response & Section Creation</CardTitle>
          <CardDescription>
            Paste the AI response here and configure the section details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Section Details */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Section Title</Label>
                <Input
                  value={sectionTitle}
                  onChange={(e) => setSectionTitle(e.target.value)}
                  placeholder="e.g., Daily Accomplishments"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Section Focus</Label>
                <Select value={sectionFocus} onValueChange={setSectionFocus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select focus area" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="accomplishment">Accomplishment</SelectItem>
                    <SelectItem value="equipment_usage">Equipment Usage</SelectItem>
                    <SelectItem value="learning">Learning</SelectItem>
                    <SelectItem value="compliance">Compliance</SelectItem>
                    <SelectItem value="daily_summary">Daily Summary</SelectItem>
                    <SelectItem value="issues">Issues</SelectItem>
                    <SelectItem value="teamwork">Teamwork</SelectItem>
                    <SelectItem value="covey_effectiveness">Covey 7 Habits Effectiveness</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* AI Response */}
            <div className="space-y-2">
              <Label>AI Response (JSON)</Label>
              <Textarea
                value={aiResponse}
                onChange={(e) => setAiResponse(e.target.value)}
                placeholder="Paste the JSON response from your AI tool here..."
                className="min-h-[150px] font-mono text-sm"
              />
            </div>
          </div>

          <Button 
            onClick={handleSaveSection}
            disabled={isSaving || sectionsLoading}
            className="w-full"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving Section...
              </>
            ) : (
              'Validate & Save Section'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How to Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>1. <strong>Select Prompt:</strong> Choose the prompt template (defaults to ATI Journal)</p>
          <p>2. <strong>Select Date Range:</strong> Choose the dates you want to generate a report for (defaults to last week)</p>
          <p>3. <strong>Generate Context:</strong> Click "Generate Report Context" to get raw data</p>
          <p>4. <strong>Copy Full Prompt:</strong> Copy the complete prompt with context to ChatGPT, Claude, etc.</p>
          <p>5. <strong>Paste Response:</strong> Paste the AI's JSON response back into the textarea</p>
          <p>6. <strong>Save Section:</strong> Configure and save the section to the database</p>
          <p><strong>NEW:</strong> The system now includes <strong>action scoring data</strong> for AI analysis!</p>
        </CardContent>
      </Card>
    </div>
  );
}
