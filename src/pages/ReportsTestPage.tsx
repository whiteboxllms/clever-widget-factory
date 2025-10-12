import React, { useState } from 'react';
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
import { usePrompts } from '@/hooks/usePrompts';
import { useSections } from '@/hooks/useSections';
import { generateFullPrompt } from '@/services/reportContextBuilder';
import { validateReportResponse } from '@/services/responseValidator';
import { useToast } from '@/hooks/use-toast';

export default function ReportsTestPage() {
  const [dateStart, setDateStart] = useState<Date>();
  const [dateEnd, setDateEnd] = useState<Date>();
  const [selectedPromptId, setSelectedPromptId] = useState<string>('');
  const [generatedPrompt, setGeneratedPrompt] = useState<string>('');
  const [aiResponse, setAiResponse] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [sectionTitle, setSectionTitle] = useState('');
  const [sectionFocus, setSectionFocus] = useState('');

  const { prompts, getReportGenerationPrompts, isLoading: promptsLoading } = usePrompts();
  const { createSection, isLoading: sectionsLoading } = useSections();
  const { toast } = useToast();

  const reportPrompts = getReportGenerationPrompts();

  const handleGeneratePrompt = async () => {
    if (!dateStart || !dateEnd || !selectedPromptId) {
      toast({
        title: "Missing Information",
        description: "Please select date range and prompt",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsGenerating(true);
      const startStr = format(dateStart, 'yyyy-MM-dd');
      const endStr = format(dateEnd, 'yyyy-MM-dd');
      
      const fullPrompt = await generateFullPrompt(
        prompts.find(p => p.id === selectedPromptId)?.prompt_text || '',
        startStr,
        endStr
      );
      
      setGeneratedPrompt(fullPrompt);
      toast({
        title: "Success",
        description: "Prompt generated successfully! Copy it to your AI tool.",
      });
    } catch (error) {
      console.error('Error generating prompt:', error);
      toast({
        title: "Error",
        description: "Failed to generate prompt",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(generatedPrompt);
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

  const handleSaveSection = async () => {
    if (!aiResponse || !sectionTitle || !sectionFocus || !selectedPromptId) {
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
        prompt_id: selectedPromptId
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
            <CardTitle>Generate Report Section</CardTitle>
            <CardDescription>
              Configure date range and prompt, then generate context for AI
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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

            {/* Prompt Selection */}
            <div className="space-y-2">
              <Label>Report Generation Prompt</Label>
              <Select value={selectedPromptId} onValueChange={setSelectedPromptId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a prompt" />
                </SelectTrigger>
                <SelectContent>
                  {reportPrompts.map((prompt) => (
                    <SelectItem key={prompt.id} value={prompt.id}>
                      {prompt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Generate Button */}
            <Button 
              onClick={handleGeneratePrompt}
              disabled={isGenerating || promptsLoading}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate Prompt with Context'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Right Column - Generated Prompt */}
        <Card>
          <CardHeader>
            <CardTitle>Generated Prompt</CardTitle>
            <CardDescription>
              Copy this prompt to your AI tool, then paste the response below
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Full Prompt with Context</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyPrompt}
                  disabled={!generatedPrompt}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy
                </Button>
              </div>
              <Textarea
                value={generatedPrompt}
                onChange={(e) => setGeneratedPrompt(e.target.value)}
                placeholder="Generated prompt will appear here..."
                className="min-h-[200px] font-mono text-sm"
              />
            </div>
          </CardContent>
        </Card>
      </div>

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
          <p>1. <strong>Select Date Range:</strong> Choose the dates you want to generate a report for</p>
          <p>2. <strong>Select Prompt:</strong> Choose a report generation prompt (you may need to create one first)</p>
          <p>3. <strong>Generate Prompt:</strong> Click the button to generate the full prompt with context data</p>
          <p>4. <strong>Copy & Use AI:</strong> Copy the generated prompt and use it with ChatGPT, Claude, or another AI tool</p>
          <p>5. <strong>Paste Response:</strong> Paste the AI's JSON response back into the textarea</p>
          <p>6. <strong>Configure Section:</strong> Add a title and select the focus area for the section</p>
          <p>7. <strong>Save Section:</strong> Click to validate and save the section to the database</p>
          <p><strong>NEW:</strong> The system now includes <strong>action scoring data</strong> for AI analysis!</p>
        </CardContent>
      </Card>
    </div>
  );
}
