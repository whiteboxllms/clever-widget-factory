import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useOrganizationId } from '@/hooks/useOrganizationId';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { APP_VERSION, getBrowserInfo } from '@/lib/version';
import { Tables, Database } from '@/integrations/supabase/types';
import { ExternalLink, Info, AlertTriangle, Plus, Camera, X } from 'lucide-react';
import { TOOL_CONDITION_OPTIONS } from '@/lib/constants';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToolIssues } from '@/hooks/useToolIssues';
import { IssueCard } from '@/components/IssueCard';
import { IssueResolutionDialog } from '@/components/IssueResolutionDialog';
import { useImageUpload } from '@/hooks/useImageUpload';


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
  
};

interface ToolCheckInDialogProps {
  tool: Tool | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ToolCheckInDialog({ tool, open, onOpenChange, onSuccess }: ToolCheckInDialogProps) {
  const organizationId = useOrganizationId();
  const { toast } = useToast();
  const { user } = useAuth();
  const { uploadImages, isUploading: isUploadingImages } = useImageUpload();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkout, setCheckout] = useState<CheckoutWithTool | null>(null);
  const [form, setForm] = useState<CheckInForm>({
    tool_issues: '',
    notes: '',
    returned_to_correct_location: true,
    reflection: '',
    hours_used: '',
    checkin_reason: ''
  });
  const [showValidation, setShowValidation] = useState(false);
  const [selectedIssueForResolution, setSelectedIssueForResolution] = useState<any>(null);
  const [isResolutionDialogOpen, setIsResolutionDialogOpen] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [uploadedPhotoUrls, setUploadedPhotoUrls] = useState<string[]>([]);
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);
  const [showNewIssueForm, setShowNewIssueForm] = useState(false);
  
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
        checkin_reason: ''
      });
      // Reset photo state
      setSelectedPhotos([]);
      setUploadedPhotoUrls([]);
      setPhotoUploadError(null);
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

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setPhotoUploadError(null);
    
    try {
      const uploadResults = await uploadImages(files, {
        bucket: 'checkin-photos',
        maxSizeMB: 0.8,
        maxWidthOrHeight: 1920,
        generateFileName: (file, index) => {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const toolName = tool?.name.replace(/[^a-zA-Z0-9]/g, '-') || 'tool';
          const suffix = index ? `-${index}` : '';
          return `checkin-${toolName}-${timestamp}${suffix}-${file.name}`;
        }
      });

      const results = Array.isArray(uploadResults) ? uploadResults : [uploadResults];
      const newUrls = results.map(result => result.url);
      
      setUploadedPhotoUrls(prev => [...prev, ...newUrls]);
      setSelectedPhotos(prev => [...prev, ...files]);

      toast({
        title: "Photos uploaded successfully",
        description: `${files.length} photo${files.length > 1 ? 's' : ''} uploaded`,
      });
    } catch (error) {
      console.error('Photo upload failed:', error);
      setPhotoUploadError(error instanceof Error ? error.message : 'Failed to upload photos');
      toast({
        title: "Photo upload failed",
        description: error instanceof Error ? error.message : 'Failed to upload photos',
        variant: "destructive",
      });
    }
  };

  const removePhoto = (index: number) => {
    setUploadedPhotoUrls(prev => prev.filter((_, i) => i !== index));
    setSelectedPhotos(prev => prev.filter((_, i) => i !== index));
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
        user_name: user?.user_metadata?.full_name || 'Unknown User',
        problems_reported: form.tool_issues || null,
        notes: form.notes || null,
        sop_best_practices: form.reflection,
        what_did_you_do: form.reflection,
        checkin_reason: form.checkin_reason || null,
      };

      console.log('Checkin data:', checkinData);

      // Add hours used if tool has motor and hours were provided
      if (tool.has_motor && form.hours_used) {
        checkinData.hours_used = parseFloat(form.hours_used);
      }

      // Add photo URLs to checkin data if any were uploaded
      if (uploadedPhotoUrls.length > 0) {
        checkinData.after_image_urls = uploadedPhotoUrls;
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

      // Create issues from new issues text using default type
      if (form.tool_issues.trim()) {
        const { error: issueError } = await supabase
          .from('issues')
          .insert({
            context_type: 'tool',
            context_id: tool.id,
            reported_by: user?.id,
            description: form.tool_issues.trim(),
            issue_type: 'general',
            status: 'active',
            related_checkout_id: checkout.id,
            report_photo_urls: uploadedPhotoUrls.length > 0 ? uploadedPhotoUrls : []
          });

        if (issueError) {
          console.error('Error creating issue from check-in:', issueError);
          // Don't fail the checkout if issue creation fails
        }
      }

      // Update tool status to available and location
      const { error: toolError } = await supabase
        .from('tools')
        .update({ 
          status: 'available',
          actual_location: tool.legacy_storage_vicinity + (tool.storage_location ? ` - ${tool.storage_location}` : '')
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
      
      const checkInErrorLog = {
        ...debugInfo,
        error: error,
        errorMessage: error && typeof error === 'object' && 'message' in error ? error.message : 'Unknown error',
        step: 'check_in_failed'
      };
      console.error('=== CHECK-IN ERROR LOG ===', checkInErrorLog);
      
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
        } else if (errorDetails.includes('Tool already has an active checkout')) {
          errorMessage = "Data inconsistency detected";
          errorDetails = "There seems to be a data inconsistency. Please refresh the page and try again.";
        }
      }
      
      toast({
        title: errorMessage,
        description: errorDetails || "An unexpected error occurred. Please try again or contact support if the problem persists.",
        variant: "destructive"
      });

      // For critical errors, suggest page refresh
      if (errorDetails.includes('data inconsistency') || errorDetails.includes('foreign key')) {
        setTimeout(() => {
          toast({
            title: "Suggestion",
            description: "Consider refreshing the page to sync with the latest data.",
          });
        }, 2000);
      }
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
                      issue={issue as any}
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
              {!showNewIssueForm ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowNewIssueForm(true)}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Report New Issue
                </Button>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
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
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowNewIssueForm(false);
                        setForm(prev => ({ ...prev, tool_issues: '' }));
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="bg-muted p-4 rounded-lg space-y-3">
                    <p className="text-sm">
                      Describe any issues discovered during tool use. Each separate issue should be described clearly.
                    </p>
                    
                    <div className="space-y-2">
                      <Textarea
                        id="tool_issues"
                        value={form.tool_issues}
                        onChange={(e) => setForm(prev => ({ ...prev, tool_issues: e.target.value }))}
                        placeholder="Describe any problems, damage, or issues found during use..."
                        rows={3}
                      />
                    </div>

                    {/* Photo Upload */}
                    <div className="space-y-2">
                      <Label htmlFor="issuePhotos">Upload Photos of Issues (Optional)</Label>
                      <div className="space-y-3">
                        {uploadedPhotoUrls.length > 0 && (
                          <div className="grid grid-cols-3 gap-2">
                            {uploadedPhotoUrls.map((url, index) => (
                              <div key={index} className="relative">
                                <img 
                                  src={url} 
                                  alt={`Issue photo ${index + 1}`} 
                                  className="w-full h-20 object-cover rounded-lg"
                                />
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  className="absolute -top-2 -right-2 h-5 w-5 p-0"
                                  onClick={() => removePhoto(index)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        <Input
                          id="issuePhotos"
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handlePhotoUpload}
                          disabled={isUploadingImages}
                        />
                        <p className="text-xs text-muted-foreground">
                          Document any damage, wear, or problems with photos (optional)
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
                Tool was returned to its correct storage location: {tool.legacy_storage_vicinity}{tool.storage_location ? ` - ${tool.storage_location}` : ''}
              </Label>
            </div>

            {/* Photo Upload Section */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Camera className="h-4 w-4 text-blue-600" />
                <Label>Add Photos (Optional)</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="touch-manipulation">
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" align="center" className="max-w-xs">
                    <p>Upload photos showing the tool's condition after use. Photos are automatically compressed for optimal storage.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              
              <div className="space-y-3">
                <div>
                  <input
                    type="file"
                    id="checkin-photos"
                    multiple
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                    disabled={isUploadingImages}
                  />
                  <label
                    htmlFor="checkin-photos"
                    className={`
                      inline-flex items-center justify-center gap-2 px-4 py-2 border border-dashed border-muted-foreground/50 rounded-lg 
                      cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors
                      ${isUploadingImages ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    <Camera className="h-4 w-4" />
                    {isUploadingImages ? 'Uploading...' : 'Add Photos'}
                  </label>
                </div>

                {photoUploadError && (
                  <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                    {photoUploadError}
                  </div>
                )}

                {/* Photo Previews */}
                {uploadedPhotoUrls.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {uploadedPhotoUrls.map((url, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={url}
                          alt={`Check-in photo ${index + 1}`}
                          className="w-full h-20 object-cover rounded border"
                        />
                        <button
                          type="button"
                          onClick={() => removePhoto(index)}
                          className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove photo"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {uploadedPhotoUrls.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {uploadedPhotoUrls.length} photo{uploadedPhotoUrls.length > 1 ? 's' : ''} will be attached to this check-in
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || isUploadingImages}
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