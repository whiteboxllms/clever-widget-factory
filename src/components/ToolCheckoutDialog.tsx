import { useState, useEffect } from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiService } from "@/lib/apiService";
import { useAssetMutations } from '@/hooks/useAssetMutations';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { useAuth } from "@/hooks/useCognitoAuth";
import { Upload, X, ExternalLink, Loader2 } from "lucide-react";
import { compressImage, formatFileSize } from "@/lib/imageUtils";
import { compressImageDetailed } from "@/lib/enhancedImageUtils";
import { useEnhancedToast } from "@/hooks/useEnhancedToast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { useOrganizationMembers } from "@/hooks/useOrganizationMembers";

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
  const { updateTool } = useAssetMutations();
  const enhancedToast = useEnhancedToast();
  const { members: organizationMembers = [] } = useOrganizationMembers();

  // Resolve user full name from Cognito metadata or organization members
  useEffect(() => {
    let isMounted = true;
    const resolveFullName = async () => {
      if (!user) {
        if (isMounted) setUserFullName("");
        return;
      }

      const preferName = (value?: string | null) => {
        if (!value) return null;
        const trimmed = value.trim();
        if (!trimmed || trimmed.includes('@')) return null;
        return trimmed;
      };

      const metadataName = preferName((user as unknown as { user_metadata?: { full_name?: string } })?.user_metadata?.full_name);
      const cognitoName = preferName(user.name);
      if (metadataName && isMounted) {
        setUserFullName(metadataName);
        return;
      }
      if (cognitoName && isMounted) {
        setUserFullName(cognitoName);
        return;
      }

      const member = organizationMembers.find(m => m.cognito_user_id === user.id || m.user_id === user.id);
      const memberName = preferName(member?.full_name);
      if (memberName && isMounted) {
        setUserFullName(memberName);
        return;
      }

      if (isMounted) {
        setUserFullName(user.email || user.username || "Unknown User");
      }
    };

    resolveFullName();
    return () => {
      isMounted = false;
    };
  }, [user, organizationMembers]);

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
    // TODO: Implement S3 upload via AWS API
    toast({
      title: "Image upload not yet implemented",
      description: "S3 upload functionality pending",
      variant: "destructive"
    });
    return [];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tool) return;

    setIsSubmitting(true);

    try {
      // Check for existing active checkouts
      const checkoutsResult = await apiService.get(`/checkouts?tool_id=${tool.id}&is_returned=false`);
      const existingCheckouts = checkoutsResult.data || [];

      if (existingCheckouts.length > 0) {
        const checkout = existingCheckouts[0];
        toast({
          title: "Tool Already Checked Out",
          description: `This tool is currently checked out to ${checkout.user_name}.`,
          variant: "destructive"
        });
        return;
      }

      // Create checkout record with immediate checkout_date
      await apiService.post('/checkouts', {
        tool_id: tool.id,
        user_id: user?.id,
        user_name: userFullName,
        intended_usage: form.intendedUsage || null,
        notes: form.notes || null,
        action_id: taskId || null,
        is_returned: false,
        checkout_date: new Date().toISOString()
      });

      // Update tool status
      await updateTool.mutateAsync({ id: tool.id, data: { status: 'checked_out' } });

      toast({
        title: "Success",
        description: `${tool.name} has been checked out successfully`
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

    } catch (error: any) {
      console.error('Error checking out tool:', error);
      
      // Handle duplicate key constraint violation
      if (error.error?.includes('active checkout') || 
          error.message?.includes('idx_unique_active_checkout_per_tool') ||
          error.message?.includes('duplicate key')) {
        const errorMessage = error.details || error.error || "This tool is already checked out";
        toast({
          title: "Tool Already Checked Out",
          description: errorMessage,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Error",
          description: error.details || error.error || "Failed to check out tool",
          variant: "destructive"
        });
      }
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