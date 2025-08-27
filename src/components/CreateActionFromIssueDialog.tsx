import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { 
  Paperclip, 
  Calendar as CalendarIcon, 
  Users, 
  Plus,
  X,
  Wrench,
  Clock
} from "lucide-react";
import { useImageUpload } from "@/hooks/useImageUpload";
import { LexicalEditor } from './LexicalEditor';
import { cn } from "@/lib/utils";

interface ToolIssue {
  id: string;
  description: string;
  issue_type: string;
  status: string;
  reported_at: string;
  tool_id: string;
}

interface Mission {
  id: string;
  title: string;
  mission_number: number;
  status: string;
}

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
}

interface CreateActionFromIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issue: ToolIssue;
  onActionCreated: () => void;
}

export function CreateActionFromIssueDialog({
  open,
  onOpenChange,
  issue,
  onActionCreated
}: CreateActionFromIssueDialogProps) {
  const [formData, setFormData] = useState({
    title: '',
    plan: '',
    observations: '',
    assigned_to: '',
    estimated_completion_date: undefined as Date | undefined,
    required_tools: [] as string[],
    attachments: [] as string[]
  });
  const [defaultTitle, setDefaultTitle] = useState('');
  const [defaultPlan, setDefaultPlan] = useState('');
  const [newTool, setNewTool] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  
  const { uploadImages, isUploading } = useImageUpload();

  // Fetch profiles for assignee selector
  useEffect(() => {
    const fetchProfiles = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, role')
        .order('full_name');
      
      if (error) {
        console.error('Error fetching profiles:', error);
        return;
      }
      
      setProfiles(data || []);
    };

    if (open) {
      fetchProfiles();
    }
  }, [open]);

  // Pre-fill form with issue data when dialog opens
  useEffect(() => {
    if (open && issue) {
      const defaultTitleText = `Resolve ${issue.issue_type} issue`;
      const defaultPlanText = `Action needed to address issue: ${issue.description}`;
      
      setDefaultTitle(defaultTitleText);
      setDefaultPlan(defaultPlanText);
      
      setFormData({
        title: defaultTitleText,
        plan: defaultPlanText,
        observations: '',
        assigned_to: '',
        estimated_completion_date: undefined,
        required_tools: [],
        attachments: []
      });
    }
  }, [open, issue]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
      const fileArray = Array.from(files);
      const uploadResults = await uploadImages(fileArray, {
        bucket: 'mission-attachments'
      });
      
      // Ensure uploadResults is always an array
      const resultsArray = Array.isArray(uploadResults) ? uploadResults : [uploadResults];
      const uploadedUrls = resultsArray.map(result => result.url);
      
      setFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...uploadedUrls]
      }));
      
      toast({
        title: "Success",
        description: `${uploadedUrls.length} file(s) uploaded successfully`
      });
    } catch (error) {
      console.error('Error uploading files:', error);
      toast({
        title: "Error",
        description: "Failed to upload files",
        variant: "destructive"
      });
    }
  };

  const addTool = () => {
    if (newTool.trim() && !formData.required_tools.includes(newTool.trim())) {
      setFormData(prev => ({
        ...prev,
        required_tools: [...prev.required_tools, newTool.trim()]
      }));
      setNewTool('');
    }
  };

  const removeTool = (tool: string) => {
    setFormData(prev => ({
      ...prev,
      required_tools: prev.required_tools.filter(t => t !== tool)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast({
        title: "Error",
        description: "Please enter an action title",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Convert date to ISO string for database storage
      const estimatedDuration = formData.estimated_completion_date ? 
        formData.estimated_completion_date.toISOString() : null;

      const { error } = await supabase
        .from('actions')
        .insert({
          title: formData.title,
          plan: formData.plan || null,
          observations: formData.observations || null,
          assigned_to: formData.assigned_to === 'unassigned' ? null : formData.assigned_to || null,
          estimated_duration: estimatedDuration,
          required_tools: formData.required_tools,
          mission_id: null,
          linked_issue_id: issue?.id,
          issue_reference: issue ? `Issue: ${issue.description}` : null,
          attachments: formData.attachments,
          status: 'not_started'
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Action created successfully"
      });

      setFormData({
        title: '',
        plan: '',
        observations: '',
        assigned_to: '',
        estimated_completion_date: undefined,
        required_tools: [],
        attachments: []
      });
      
      onActionCreated?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating action:', error);
      toast({
        title: "Error",
        description: "Failed to create action",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeAttachment = (index: number) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Action from Issue</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Issue Reference Display */}
          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-semibold text-sm mb-2">Linked Issue Reference</h4>
            <p className="text-sm text-muted-foreground">
              Issue #{issue.id.slice(0, 8)} - {issue.issue_type} - {issue.description}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <CalendarIcon className="h-3 w-3" />
              <span className="text-xs text-muted-foreground">
                Reported: {new Date(issue.reported_at).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Action Title */}
          <div>
            <Label htmlFor="actionTitle" className="text-sm font-medium">
              Action Title *
            </Label>
            <Input
              id="actionTitle"
              value={formData.title}
              onFocus={() => {
                if (formData.title === defaultTitle) {
                  setFormData(prev => ({ ...prev, title: '' }));
                }
              }}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Short description of what must be done"
              className="mt-1"
            />
          </div>

          {/* Assigned To and Estimated Completion Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="assignedTo" className="text-sm font-medium">
                Assigned To
              </Label>
              <Select value={formData.assigned_to || 'unassigned'} onValueChange={(value) => setFormData(prev => ({ ...prev, assigned_to: value === 'unassigned' ? '' : value }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select assignee..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.user_id} value={profile.user_id}>
                      {profile.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="estimated_completion_date">
                <Clock className="w-4 h-4 inline mr-1" />
                Estimated Completion Date
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal mt-1",
                      !formData.estimated_completion_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.estimated_completion_date ? (
                      format(formData.estimated_completion_date, "PPP")
                    ) : (
                      <span>Pick a completion date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.estimated_completion_date}
                    onSelect={(date) => setFormData(prev => ({ ...prev, estimated_completion_date: date }))}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Required Assets */}
          <div>
            <Label className="flex items-center gap-1 mb-2">
              <Wrench className="w-4 h-4" />
              Required Assets
            </Label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={newTool}
                  onChange={(e) => setNewTool(e.target.value)}
                  placeholder="Add an asset..."
                  onKeyPress={(e) => e.key === 'Enter' && addTool()}
                />
                <Button onClick={addTool} size="sm" variant="outline">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {formData.required_tools.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.required_tools.map((tool, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {tool}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-auto p-0 ml-1"
                        onClick={() => removeTool(tool)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Rich Text Content */}
          <Tabs defaultValue="plan" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="plan">Plan</TabsTrigger>
              <TabsTrigger value="observations">Implementation</TabsTrigger>
            </TabsList>
            
            <TabsContent value="plan" className="mt-4">
              <div>
                <Label>Action Plan</Label>
                <div className="mt-2 border rounded-lg">
                  <LexicalEditor
                    value={formData.plan}
                    onChange={(value) => setFormData(prev => ({ ...prev, plan: value }))}
                    placeholder="Describe the plan for this action..."
                    onFocus={() => {
                      if (formData.plan === defaultPlan) {
                        setFormData(prev => ({ ...prev, plan: '' }));
                      }
                    }}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="observations" className="mt-4">
              <div>
                <Label>Implementation Notes</Label>
                <div className="mt-2 border rounded-lg">
                  <LexicalEditor
                    value={formData.observations}
                    onChange={(value) => setFormData(prev => ({ ...prev, observations: value }))}
                    placeholder="Document the implementation progress and observations..."
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>


          {/* Attachments */}
          <div>
            <Label className="text-sm font-medium">Before, during and after photos</Label>
            <div className="mt-1">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                id="attachmentUpload"
                disabled={isUploading}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('attachmentUpload')?.click()}
                disabled={isUploading}
                className="w-full"
              >
                <Paperclip className="h-4 w-4 mr-2" />
                {isUploading ? 'Uploading...' : 'Upload Photos/Documents'}
              </Button>
            </div>
            
            {/* Display uploaded attachments */}
            {formData.attachments.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-sm text-muted-foreground">Uploaded attachments:</p>
                <div className="flex flex-wrap gap-2">
                  {formData.attachments.map((url, index) => (
                    <div key={index} className="relative">
                      <img
                        src={url}
                        alt={`Attachment ${index + 1}`}
                        className="h-16 w-16 object-cover rounded border cursor-pointer"
                        onClick={() => window.open(url, '_blank')}
                      />
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => removeAttachment(index)}
                        className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0"
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || isUploading}
              className="flex-1"
            >
              {isSubmitting ? 'Creating...' : 'Create Action'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}