import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { APP_VERSION, getBrowserInfo } from '@/lib/version';
import { Tables, Database } from '@/integrations/supabase/types';
import { ExternalLink, Info, AlertTriangle, Plus } from 'lucide-react';
import { TOOL_CONDITION_OPTIONS } from '@/lib/constants';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToolIssues } from '@/hooks/useToolIssues';
import { IssueCard } from '@/components/IssueCard';
import { IssueResolutionDialog } from '@/components/IssueResolutionDialog';


type Tool = Tables<'tools'>;

type CheckoutWithTool = {
  id: string;
  tool_id: string;
  user_id: string;
  user_name: string;
  checkout_date: string;
  tools: Tool;
};

type CheckInForm = {
  tool_issues: string;
  notes: string;
  returned_to_correct_location: boolean;
  reflection: string;
  hours_used: string;
  checkin_reason: string;
  updated_known_issues: string;
};

interface ToolCheckInDialogProps {
  tool: Tool | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ToolCheckInDialog({ tool, open, onOpenChange, onSuccess }: ToolCheckInDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkout, setCheckout] = useState<CheckoutWithTool | null>(null);
  const [form, setForm] = useState<CheckInForm>({
    tool_issues: '',
    notes: '',
    returned_to_correct_location: true,
    reflection: '',
    hours_used: '',
    checkin_reason: '',
    updated_known_issues: ''
  });
  const [showValidation, setShowValidation] = useState(false);
  const [selectedIssueForResolution, setSelectedIssueForResolution] = useState<any>(null);
  const [isResolutionDialogOpen, setIsResolutionDialogOpen] = useState(false);
  const [newIssueType, setNewIssueType] = useState<'safety' | 'efficiency' | 'cosmetic' | 'maintenance'>('efficiency');
  const [blocksCheckout, setBlocksCheckout] = useState(false);
  
  // Use the new issues hook
  const { issues, isLoading: isLoadingIssues, fetchIssues, createIssuesFromText } = useToolIssues(tool?.id || null);

  useEffect(() => {
    if (tool && open) {
      fetchCheckout();
      // Reset form and initialize known issues
      setForm({
        tool_issues: '',
        notes: '',
        returned_to_correct_location: true,
        reflection: '',
        hours_used: '',
        checkin_reason: '',
        updated_known_issues: tool.known_issues || ''
      });
    }
  }, [tool, open]);

  const fetchCheckout = async () => {
    if (!tool) return;

    try {
      const { data, error } = await supabase
        .from('checkouts')
        .select(`
          *,
          tools(*)
        `)
        .eq('tool_id', tool.id)
        .eq('is_returned', false)
        .single();

      if (error) throw error;
      setCheckout(data);
    } catch (error) {
      console.error('Error fetching checkout:', error);
      toast({
        title: "Error",
        description: "Failed to load checkout information",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkout || !tool) return;

    // Get debugging information
    const browserInfo = getBrowserInfo();
    const debugInfo = {
      appVersion: APP_VERSION,
      userId: user?.id,
      userName: user?.user_metadata?.full_name || (() => {
        throw new Error('User full name is required for check-in');
      })(),
      toolId: tool.id,
      toolName: tool.name,
      checkoutId: checkout.id,
      formData: form,
      browserInfo,
      timestamp: new Date().toISOString()
    };

    console.log('=== TOOL CHECK-IN ATTEMPT ===', debugInfo);

    // Show validation errors
    setShowValidation(true);
    
    // Check required fields
    const isCheckingInForSomeoneElse = user?.id !== checkout?.user_id;
    if (!form.reflection || (isCheckingInForSomeoneElse && !form.checkin_reason)) {
      const validationError = {
        ...debugInfo,
        error: 'Missing required fields',
        missingFields: {
          reflection: !form.reflection,
          checkin_reason: isCheckingInForSomeoneElse ? !form.checkin_reason : false
        }
      };
      console.error('=== CHECK-IN VALIDATION ERROR ===', validationError);
      
      toast({
        title: "Missing Required Fields",
        description: "Please fill in all required fields marked with an asterisk (*)",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Create checkin record
      const checkinData: any = {
        checkout_id: checkout.id,
        tool_id: checkout.tool_id,
        user_name: checkout.user_name,
        condition_after: 'no_problems_observed',
        problems_reported: form.tool_issues || null,
        location_found: tool.storage_vicinity + (tool.storage_location ? ` - ${tool.storage_location}` : ''),
        notes: form.notes || null,
        returned_to_correct_location: form.returned_to_correct_location,
        sop_best_practices: form.reflection,
        what_did_you_do: form.reflection,
        checkin_reason: form.checkin_reason || null,
      };

      console.log('Checkin data:', checkinData);

      // Add hours used if tool has motor and hours were provided
      if (tool.has_motor && form.hours_used) {
        checkinData.hours_used = parseFloat(form.hours_used);
      }

      const { error: checkinError } = await supabase
        .from('checkins')
        .insert(checkinData);

      if (checkinError) throw checkinError;

      // Update checkout as returned
      const { error: updateError } = await supabase
        .from('checkouts')
        .update({ is_returned: true })
        .eq('id', checkout.id);

      if (updateError) throw updateError;

      // Create structured issues from new issues text with selected severity
      if (form.tool_issues.trim()) {
        const issueDescriptions = form.tool_issues
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0);

        for (const description of issueDescriptions) {
          const user = await supabase.auth.getUser();
          if (user.data.user) {
            await supabase
              .from('tool_issues')
              .insert({
                tool_id: tool.id,
                description: description.trim(),
                issue_type: newIssueType,
                blocks_checkout: blocksCheckout,
                reported_by: user.data.user.id
              });

            // Create history record
            await supabase
              .from('tool_issue_history')
              .insert({
                issue_id: (await supabase
                  .from('tool_issues')
                  .select('id')
                  .eq('tool_id', tool.id)
                  .eq('description', description.trim())
                  .order('created_at', { ascending: false })
                  .limit(1)
                  .single()).data?.id,
                old_status: null,
                new_status: 'active',
                changed_by: user.data.user.id,
                notes: 'Issue reported during check-in'
              });
          }
        }
      }

      // Update tool status - determine based on active issues
      const hasActiveIssues = issues.some(issue => issue.status === 'active');
      const hasBlockingIssues = issues.some(issue => issue.status === 'active' && issue.blocks_checkout);
      const hasSafetyIssues = issues.some(issue => issue.status === 'active' && issue.issue_type === 'safety');
      
      const { error: toolError } = await supabase
        .from('tools')
        .update({ 
          condition: hasActiveIssues ? (hasSafetyIssues ? 'not_functional' : 'functional_but_not_efficient') : 'no_problems_observed',
          status: hasBlockingIssues ? 'unavailable' : 'available',
          actual_location: tool.storage_vicinity + (tool.storage_location ? ` - ${tool.storage_location}` : '')
        })
        .eq('id', tool.id);

      if (toolError) throw toolError;

      toast({
        title: "Tool checked in successfully",
        description: `${tool.name} has been checked in`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error checking in tool:', error);
      
      let errorMessage = "Failed to check in tool";
      let errorDetails = "";
      
      if (error && typeof error === 'object' && 'message' in error) {
        errorDetails = String(error.message);
        
        // Provide specific guidance based on common error types
        if (errorDetails.includes('violates row-level security')) {
          errorMessage = "Permission denied";
          errorDetails = "You don't have permission to check in this tool. Please ensure you're logged in and have the necessary access rights.";
        } else if (errorDetails.includes('null value') || errorDetails.includes('not-null constraint')) {
          errorMessage = "Missing required information";
          errorDetails = "Please fill in the reflection field as it's mandatory for check-in.";
        } else if (errorDetails.includes('foreign key')) {
          errorMessage = "Data reference error";
          errorDetails = "There's an issue with the checkout record. Please try refreshing the page and checking in again.";
        } else if (errorDetails.includes('duplicate key')) {
          errorMessage = "Check-in already exists";
          errorDetails = "This tool may have already been checked in. Please refresh the page to see the current status.";
        }
      }
      
      toast({
        title: errorMessage,
        description: errorDetails || "An unexpected error occurred. Please try again or contact support if the problem persists.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!tool) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Check In Tool: {tool.name}</DialogTitle>
        </DialogHeader>

        {checkout && (
          <div className="mb-4 p-3 bg-muted rounded-lg">
            <p className="text-sm"><strong>Checked out to:</strong> {checkout.user_name}</p>
            <p className="text-sm"><strong>Checkout date:</strong> {new Date(checkout.checkout_date).toLocaleDateString()}</p>
          </div>
        )}

        <TooltipProvider>
          <div className="space-y-4">
            {/* Check-in Reason - Only show when checking in for someone else */}
            {user?.id !== checkout?.user_id && (
              <div>
                <Label htmlFor="checkin_reason">Reason for checking in this tool *</Label>
                <Select value={form.checkin_reason} onValueChange={(value) => setForm(prev => ({ ...prev, checkin_reason: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cleanup">Cleanup</SelectItem>
                    <SelectItem value={`requested_by_${checkout?.user_name}`}>Requested by {checkout?.user_name}</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}


            {/* Current Active Issues */}
            {issues.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <Label>Current Active Issues ({issues.length})</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="touch-manipulation">
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="center" className="max-w-xs">
                      <p>Mark issues as resolved with photo evidence and root cause analysis, or remove if incorrectly reported</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {issues.map((issue) => (
                    <IssueCard
                      key={issue.id}
                      issue={issue}
                      onResolve={(issue) => {
                        setSelectedIssueForResolution(issue);
                        setIsResolutionDialogOpen(true);
                      }}
                      onRefresh={fetchIssues}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* New Issues Section */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Plus className="h-4 w-4 text-green-600" />
                <Label htmlFor="tool_issues">Report New Issues</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="touch-manipulation">
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" align="center" className="max-w-xs">
                    <p>Report new problems discovered during use. Each line will become a separate tracked issue.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Select value={newIssueType} onValueChange={(value: any) => setNewIssueType(value)}>
                    <SelectTrigger className="w-fit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="safety">🚨 Safety</SelectItem>
                      <SelectItem value="efficiency">⚙️ Efficiency</SelectItem>
                      <SelectItem value="cosmetic">✨ Cosmetic</SelectItem>
                      <SelectItem value="maintenance">🔧 Maintenance</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="blocks_checkout"
                      checked={blocksCheckout}
                      onChange={(e) => setBlocksCheckout(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="blocks_checkout" className="text-sm">
                      Mark tool as offline until repaired
                    </Label>
                  </div>
                </div>
                <Textarea
                  id="tool_issues"
                  value={form.tool_issues}
                  onChange={(e) => setForm(prev => ({ ...prev, tool_issues: e.target.value }))}
                  placeholder="Describe any new problems, damage, or malfunctions discovered during use. Put each issue on a separate line."
                  rows={3}
                />
              </div>
            </div>

            {tool.has_motor && (
              <div>
                <Label htmlFor="hours_used">Hours Used</Label>
                <Input
                  id="hours_used"
                  type="number"
                  step="0.1"
                  min="0"
                  value={form.hours_used}
                  onChange={(e) => setForm(prev => ({ ...prev, hours_used: e.target.value }))}
                  placeholder="Enter hours used (e.g., 2.5)"
                />
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Label htmlFor="reflection">Reflect *</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="touch-manipulation">
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" align="center" className="max-w-xs">
                    <p>Reflect on your tool usage and how it aligns with our farm values.</p>
                    <p className="mt-1 text-xs">Stargazer Farm values Growth Mindset, Quality, Efficiency, Safety, Transparency, Teamwork.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Textarea
                id="reflection"
                value={form.reflection}
                onChange={(e) => setForm(prev => ({ ...prev, reflection: e.target.value }))}
                placeholder="Reflect on your tool usage and how it aligns with our farm values"
                rows={3}
                className={showValidation && !form.reflection ? "border-red-500" : ""}
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Any additional comments, observations, or notes about sub-optimal operation"
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="returned_to_correct_location"
                checked={form.returned_to_correct_location}
                onChange={(e) => setForm(prev => ({ ...prev, returned_to_correct_location: e.target.checked }))}
                className="rounded border-gray-300"
              />
              <Label htmlFor="returned_to_correct_location">
                Tool was returned to its correct storage location: {tool.storage_vicinity}{tool.storage_location ? ` - ${tool.storage_location}` : ''}
              </Label>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? "Checking In..." : "Complete Check In"}
              </Button>
            </div>
          </div>
        </TooltipProvider>
      </DialogContent>
      
      {/* Issue Resolution Dialog */}
      <IssueResolutionDialog
        issue={selectedIssueForResolution}
        open={isResolutionDialogOpen}
        onOpenChange={setIsResolutionDialogOpen}
        onSuccess={() => {
          fetchIssues();
          setSelectedIssueForResolution(null);
        }}
      />
    </Dialog>
  );
}