import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { useAuth } from "@/hooks/useAuth";
import { Upload, X, ExternalLink, Loader2 } from "lucide-react";
import { compressImage, formatFileSize } from "@/lib/imageUtils";
import { compressImageDetailed } from "@/lib/enhancedImageUtils";
import { useEnhancedToast } from "@/hooks/useEnhancedToast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

interface Tool {
  id: string;
  name: string;
  manual_url?: string;
  
}

interface ToolCheckoutDialogProps {
  tool: Tool | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  assignedTasks?: string[];
  missionId?: string;
  taskId?: string;
}

interface CheckoutForm {
  intendedUsage: string;
  notes: string;
  preCheckoutIssues: string;
  beforeImageFiles: File[];
}

export function ToolCheckoutDialog({ tool, open, onOpenChange, onSuccess, assignedTasks = [], missionId, taskId }: ToolCheckoutDialogProps) {
  const organizationId = useOrganizationId();
  const { user } = useAuth();
  const [form, setForm] = useState<CheckoutForm>({
    intendedUsage: "",
    notes: assignedTasks.length > 0 ? `Tasks: ${assignedTasks.join(', ')}` : "",
    preCheckoutIssues: "",
    beforeImageFiles: []
  });
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isCheckingIssues, setIsCheckingIssues] = useState(false);
  const [userFullName, setUserFullName] = useState<string>("");
  const { toast } = useToast();
  const enhancedToast = useEnhancedToast();

  // Fetch user profile when user changes
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', user.id)
          .single();
        
        setUserFullName(profile?.full_name || user.email || "");
      }
    };

    fetchUserProfile();
  }, [user]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setForm(prev => ({ ...prev, beforeImageFiles: [...prev.beforeImageFiles, ...files] }));
    
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setForm(prev => ({
      ...prev,
      beforeImageFiles: prev.beforeImageFiles.filter((_, i) => i !== index)
    }));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async (files: File[]): Promise<string[]> => {
    const uploadPromises = files.map(async (file) => {
      try {
        const compressionResult = await compressImageDetailed(file);
        enhancedToast.showCompressionComplete(compressionResult);
        const compressedFile = compressionResult.file;
      
        const fileName = `checkout-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${compressedFile.name}`;
        const { data, error } = await supabase.storage
          .from('tool-images')
          .upload(fileName, compressedFile);

        if (error) {
          // Extract status code from Supabase error
          const statusCode = error && typeof error === 'object' && 'status' in error ? error.status as number : undefined;
          enhancedToast.showUploadError(error.message, file.name, statusCode);
          return null;
        }

        const { data: urlData } = supabase.storage
          .from('tool-images')
          .getPublicUrl(fileName);

        enhancedToast.showUploadSuccess(fileName, urlData.publicUrl);
        return urlData.publicUrl;
      } catch (error) {
        enhancedToast.showCompressionError(error.message, file.name);
        return null;
      }
    });

    const results = await Promise.all(uploadPromises);
    const successCount = results.filter(url => url !== null).length;
    
    // Show upload completion toast
    toast({
      title: "Upload complete!",
      description: `${successCount} image${successCount > 1 ? 's' : ''} uploaded successfully`,
    });

    return results.filter((url): url is string => url !== null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tool) return;

    setIsSubmitting(true);

    try {
      // Step 1: Check for existing active checkouts before proceeding
      const { data: existingCheckouts, error: checkoutCheckError } = await supabase
        .from('checkouts')
        .select('id, user_name')
        .eq('tool_id', tool.id)
        .eq('is_returned', false);

      if (checkoutCheckError) {
        console.error('Error checking existing checkouts:', checkoutCheckError);
        throw new Error('Failed to verify tool availability');
      }

      if (existingCheckouts && existingCheckouts.length > 0) {
        const checkout = existingCheckouts[0];
        toast({
          title: "Tool Already Checked Out",
          description: `This tool is currently checked out to ${checkout.user_name}. Please ensure the tool is checked in before attempting a new checkout.`,
          variant: "destructive"
        });
        return;
      }

      // Step 2: Verify tool status is available
      const { data: toolData, error: toolCheckError } = await supabase
        .from('tools')
        .select('status')
        .eq('id', tool.id)
        .single();

      if (toolCheckError) {
        console.error('Error checking tool status:', toolCheckError);
        throw new Error('Failed to verify tool status');
      }

      if (toolData?.status !== 'available') {
        toast({
          title: "Tool Not Available",
          description: `This tool is currently ${toolData?.status || 'unavailable'}. Please refresh the page to see the current status.`,
          variant: "destructive"
        });
        return;
      }
      let beforeImageUrl = null;
      if (form.beforeImageFiles.length > 0) {
        const uploadedUrls = await uploadImages(form.beforeImageFiles);
        beforeImageUrl = uploadedUrls[0] || null; // Use first image for now
      }

      // Create checkout record
      const { data: checkoutData, error } = await supabase
        .from('checkouts')
        .insert({
          tool_id: tool.id,
          user_id: user?.id,
          user_name: userFullName,
          intended_usage: form.intendedUsage || null,
          notes: form.notes || null,
          before_image_url: beforeImageUrl,
          pre_existing_issues: form.preCheckoutIssues || null
        } as any)
        .select()
        .single();

      if (error) throw error;

      // If this checkout is for a mission, create mission tool usage record
      if (missionId && checkoutData) {
        const { error: missionToolError } = await supabase
          .from('mission_tool_usage')
          .insert({
            mission_id: missionId,
            task_id: taskId || null,
            checkout_id: checkoutData.id
          } as any);

        if (missionToolError) {
          console.error('Error linking tool to mission:', missionToolError);
          // Don't fail the entire checkout if mission linking fails
        }
      }

      // Update tool status to checked out
      const { error: toolError } = await supabase
        .from('tools')
        .update({ 
          status: 'checked_out'
        })
        .eq('id', tool.id);

      if (toolError) throw toolError;

      // Create issue record if pre-existing issues were reported
      if (form.preCheckoutIssues && form.preCheckoutIssues.trim()) {
        const { error: issueError } = await supabase
          .from('issues')
          .insert({
            context_type: 'tool',
            context_id: tool.id,
            reported_by: user?.id,
            description: form.preCheckoutIssues.trim(),
            issue_type: 'general',
            status: 'active',
            related_checkout_id: checkoutData.id,
            report_photo_urls: beforeImageUrl ? [beforeImageUrl] : []
          } as any);

        if (issueError) {
          console.error('Error creating issue from pre-checkout inspection:', issueError);
          // Don't fail the checkout if issue creation fails
        }
      }

      toast({
        title: "Success",
        description: `${tool.name} has been checked out successfully${missionId ? ' for mission' : ''}`
      });

      // Reset form
      setForm({
        intendedUsage: "",
        notes: "",
        preCheckoutIssues: "",
        beforeImageFiles: []
      });
      setImagePreviews([]);
      onOpenChange(false);
      onSuccess();

    } catch (error) {
      console.error('Error checking out tool:', error);
      toast({
        title: "Error",
        description: "Failed to check out tool",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };



  const resetForm = () => {
    setForm({
      intendedUsage: "",
      notes: "",
      preCheckoutIssues: "",
      beforeImageFiles: []
    });
    setImagePreviews([]);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) resetForm();
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Check Out Tool: {tool?.name}</DialogTitle>
        </DialogHeader>


        {tool?.manual_url && (
          <div className="bg-muted p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              <span className="font-medium">Standard Operating Procedure</span>
            </div>
            <a 
              href={tool.manual_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline text-sm"
            >
              {tool.manual_url}
            </a>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* User Name - Display Only */}
          <div className="space-y-2">
            <Label>Checking out as</Label>
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm font-medium">{userFullName}</p>
            </div>
          </div>

          {/* Intended Usage */}
          <div className="space-y-2">
            <Label htmlFor="intendedUsage">Intended Usage *</Label>
            <Select 
              value={form.intendedUsage} 
              onValueChange={(value) => setForm(prev => ({ ...prev, intendedUsage: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select the reason for checkout" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="task">Task/Project</SelectItem>
                <SelectItem value="repair">Repair</SelectItem>
                <SelectItem value="preventative_maintenance">Preventative Maintenance</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Additional Details</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Optional: Provide any additional details about your intended use"
              rows={3}
            />
          </div>


          {/* Pre-checkout Inspection */}
          <div className="space-y-2">
            <Label>Pre-Checkout Inspection</Label>
            <div className="bg-muted p-4 rounded-lg space-y-3">
              <p className="text-sm">
                Please perform a visual inspection of the tool and document any pre-existing issues or damage not already listed in known issues.
              </p>
              
              {/* Pre-existing Issues Text Field */}
              <div className="space-y-2">
                <Label htmlFor="preCheckoutIssues">Pre-existing Issues Found</Label>
                <Textarea
                  id="preCheckoutIssues"
                  value={form.preCheckoutIssues}
                  onChange={(e) => setForm(prev => ({ ...prev, preCheckoutIssues: e.target.value }))}
                  placeholder="Document any new issues found that are not already listed in known issues"
                  rows={3}
                />
              </div>

              {/* Image Upload */}
              <div className="space-y-2">
                <Label htmlFor="inspectionImages">Upload Images of Any Pre-existing Issues</Label>
                <div className="space-y-3">
                  {imagePreviews.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {imagePreviews.map((preview, index) => (
                        <div key={index} className="relative">
                          <img 
                            src={preview} 
                            alt={`Inspection ${index + 1}`} 
                            className="w-full h-20 object-cover rounded-lg"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute -top-2 -right-2 h-5 w-5 p-0"
                            onClick={() => removeImage(index)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Input
                        id="inspectionImages"
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageChange}
                      />
                    </div>
                    <Upload className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Document any scratches, dents, missing parts, or other issues (optional)
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || !form.intendedUsage || !userFullName}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking Out...
                </>
              ) : (
                "Check Out Tool"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}