import { useState } from 'react';
import { Plus, Star, StarOff, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePrompts } from '@/hooks/usePrompts';
import { Prompt } from '@/types/report';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface PromptFormData {
  name: string;
  prompt_text: string;
  intended_usage: string;
  expected_response_json: string;
  is_default: boolean;
}

interface UsageTypeManagerProps {
  allPrompts: Prompt[];
  onRename: (oldUsage: string, newUsage: string) => void;
  onDelete: (usageType: string) => void;
  onAddNew?: (newUsageType: string) => void;
}

const UsageTypeManager = ({ allPrompts, onRename, onDelete, onAddNew }: UsageTypeManagerProps) => {
  const [editingUsage, setEditingUsage] = useState<string | null>(null);
  const [newUsageName, setNewUsageName] = useState<string>('');
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);

  // Get all unique usage types
  const allUsageTypes = Array.from(new Set(allPrompts.map(p => p.intended_usage))).sort();

  const handleStartRename = (usageType: string) => {
    setEditingUsage(usageType);
    setNewUsageName(usageType);
  };

  const handleConfirmRename = () => {
    if (editingUsage && newUsageName.trim() && newUsageName !== editingUsage) {
      onRename(editingUsage, newUsageName.trim());
    }
    setEditingUsage(null);
    setNewUsageName('');
  };

  const handleCancelRename = () => {
    setEditingUsage(null);
    setNewUsageName('');
  };

  const handleStartAdd = () => {
    setIsAddingNew(true);
    setNewUsageName('');
  };

  const handleConfirmAdd = () => {
    if (newUsageName.trim()) {
      if (onAddNew) {
        onAddNew(newUsageName.trim());
      }
      setIsAddingNew(false);
      setNewUsageName('');
    }
  };

  const handleCancelAdd = () => {
    setIsAddingNew(false);
    setNewUsageName('');
  };

  return (
    <div className="space-y-4">
      {/* Add New Usage Type */}
      <div className="space-y-2">
        {isAddingNew ? (
          <div className="flex gap-2">
            <Input
              value={newUsageName}
              onChange={(e) => setNewUsageName(e.target.value)}
              placeholder="Enter new usage type name"
              autoFocus
            />
            <Button size="sm" onClick={handleConfirmAdd}>
              Add
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancelAdd}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={handleStartAdd}>
            <Plus className="w-4 h-4 mr-2" />
            Add
          </Button>
        )}
      </div>

      {/* All Usage Types */}
      <div className="space-y-2">
        <Label>Usage Types</Label>
        {allUsageTypes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No usage types found.</p>
        ) : (
          <div className="space-y-2">
            {allUsageTypes.map((usageType) => {
              const promptCount = allPrompts.filter(p => p.intended_usage === usageType).length;
              
              return (
                <div key={usageType} className="flex items-center justify-between p-2 border rounded">
                  {editingUsage === usageType ? (
                    <div className="flex gap-2 flex-1">
                      <Input
                        value={newUsageName}
                        onChange={(e) => setNewUsageName(e.target.value)}
                        autoFocus
                      />
                      <Button size="sm" onClick={handleConfirmRename}>
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleCancelRename}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1">
                        <span className="font-medium">{usageType}</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          ({promptCount} prompt{promptCount !== 1 ? 's' : ''})
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleStartRename(usageType)}
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onDelete(usageType)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

interface PromptFormProps {
  isEdit?: boolean;
  formData: PromptFormData;
  setFormData: (data: PromptFormData) => void;
  onSubmit: () => void;
  onCancel: () => void;
  customUsage: string;
  setCustomUsage: (value: string) => void;
  allPrompts: Prompt[];
  onOpenManageDialog: () => void;
}

const PromptForm = ({ isEdit = false, formData, setFormData, onSubmit, onCancel, customUsage, setCustomUsage, allPrompts, onOpenManageDialog }: PromptFormProps) => {
  // Get all unique intended usage options from existing prompts
  const allIntentOptions = Array.from(new Set(allPrompts.map(p => p.intended_usage))).sort();
  
  return (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="name">Prompt Name</Label>
      <Input
        id="name"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        placeholder="Enter prompt name"
      />
    </div>
    
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="intended_usage">Intended Usage</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpenManageDialog}
        >
          Manage
        </Button>
      </div>
      <Select 
        value={formData.intended_usage} 
        onValueChange={(value) => {
          setFormData({ ...formData, intended_usage: value });
          if (value !== 'custom') {
            setCustomUsage('');
          }
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select usage type" />
        </SelectTrigger>
        <SelectContent>
          {/* All existing usage types */}
          {allIntentOptions.map((intent) => (
            <SelectItem key={intent} value={intent}>
              {intent.charAt(0).toUpperCase() + intent.slice(1).replace('_', ' ')}
            </SelectItem>
          ))}
          
          <SelectItem value="custom">Custom (specify below)</SelectItem>
        </SelectContent>
      </Select>
      {formData.intended_usage === 'custom' && (
        <Input
          placeholder="Enter custom usage type (e.g., 'safety_analysis', 'compliance_check')"
          value={customUsage}
          onChange={(e) => {
            setCustomUsage(e.target.value);
          }}
          autoFocus
        />
      )}
    </div>

    <div className="space-y-2">
      <Label htmlFor="prompt_text">Prompt Text</Label>
      <Textarea
        id="prompt_text"
        value={formData.prompt_text}
        onChange={(e) => setFormData({ ...formData, prompt_text: e.target.value })}
        placeholder="Enter the prompt text"
        rows={15}
        className="font-mono text-sm"
      />
    </div>

    <div className="space-y-2">
      <Label htmlFor="expected_response_json">Expected Response JSON (Optional)</Label>
      <Textarea
        id="expected_response_json"
        value={formData.expected_response_json}
        onChange={(e) => setFormData({ ...formData, expected_response_json: e.target.value })}
        placeholder='{"key": "value"} - JSON schema for validation'
        rows={5}
        className="font-mono text-sm"
      />
    </div>

    <div className="flex items-center space-x-2">
      <Switch
        id="is_default"
        checked={formData.is_default}
        onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
      />
      <Label htmlFor="is_default">Set as default prompt</Label>
    </div>

    <div className="flex justify-end space-x-2">
      <Button variant="outline" onClick={onCancel}>
        Cancel
      </Button>
      <Button onClick={onSubmit}>
        {isEdit ? 'Update' : 'Create'} Prompt
      </Button>
    </div>
  </div>
  );
};

export default function ScoringPrompts() {
  const { prompts, isLoading, createPrompt, updatePrompt, deletePrompt, setDefaultPrompt, fetchPrompts } = usePrompts();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [filterIntent, setFilterIntent] = useState<string>('all');
  const [showDefaultPrompts, setShowDefaultPrompts] = useState<boolean>(true);
  const [customUsage, setCustomUsage] = useState<string>('');
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    prompt_text: '',
    intended_usage: 'scoring',
    expected_response_json: '',
    is_default: false,
  });
  const { toast } = useToast();

  const handleCreatePrompt = async () => {
    try {
      const finalFormData = {
        ...formData,
        intended_usage: formData.intended_usage === 'custom' ? customUsage : formData.intended_usage
      };
      
      // Validate custom usage
      if (formData.intended_usage === 'custom' && !customUsage.trim()) {
        toast({
          title: "Validation Error",
          description: "Please enter a custom usage type",
          variant: "destructive",
        });
        return;
      }
      
      await createPrompt(finalFormData);
      setIsCreateDialogOpen(false);
      setFormData({ name: '', prompt_text: '', intended_usage: 'scoring', expected_response_json: '', is_default: false });
      setCustomUsage('');
      
      // Debug: Log the created prompt data
      console.log('Created prompt with intended_usage:', finalFormData.intended_usage);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleEditPrompt = async () => {
    if (!editingPrompt) return;
    
    try {
      const finalFormData = {
        ...formData,
        intended_usage: formData.intended_usage === 'custom' ? customUsage : formData.intended_usage
      };
      
      // Validate custom usage
      if (formData.intended_usage === 'custom' && !customUsage.trim()) {
        toast({
          title: "Validation Error",
          description: "Please enter a custom usage type",
          variant: "destructive",
        });
        return;
      }
      
      await updatePrompt(editingPrompt.id, finalFormData);
      setEditingPrompt(null);
      setFormData({ name: '', prompt_text: '', intended_usage: 'scoring', expected_response_json: '', is_default: false });
      setCustomUsage('');
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleSetDefault = async (promptId: string) => {
    try {
      await setDefaultPrompt(promptId);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleDeletePrompt = async (promptId: string) => {
    try {
      const prompt = prompts.find(p => p.id === promptId);
      if (!prompt) return;
      
      if (prompt.is_default) {
        toast({
          title: "Cannot Delete Default Prompt",
          description: "Default prompts cannot be deleted. Please set another prompt as default first.",
          variant: "destructive",
        });
        return;
      }

      // Confirm deletion
      const confirmed = window.confirm(`Are you sure you want to delete "${prompt.name}"? This action cannot be undone.`);
      if (!confirmed) return;

      await deletePrompt(promptId);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleRenameUsageType = async (oldUsage: string, newUsage: string) => {
    try {
      // Update all prompts that use the old usage type
      const promptsToUpdate = prompts.filter(p => p.intended_usage === oldUsage);
      
      for (const prompt of promptsToUpdate) {
        await updatePrompt(prompt.id, { intended_usage: newUsage });
      }
      
      toast({
        title: "Success",
        description: `Renamed usage type from "${oldUsage}" to "${newUsage}". Updated ${promptsToUpdate.length} prompts.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to rename usage type",
        variant: "destructive",
      });
    }
  };

  const handleDeleteUsageType = async (usageType: string) => {
    try {
      const promptsUsingType = prompts.filter(p => p.intended_usage === usageType);
      
      if (promptsUsingType.length > 0) {
        const confirmed = window.confirm(
          `Delete usage type "${usageType}"? This will unset the intended usage on ${promptsUsingType.length} prompts. The prompts themselves will not be deleted.`
        );
        
        if (!confirmed) return;
        
        // Unset intended_usage on all prompts using this type
        for (const prompt of promptsUsingType) {
          await updatePrompt(prompt.id, { intended_usage: 'scoring' }); // Set to default
        }
      }
      
      toast({
        title: "Success",
        description: `Deleted usage type "${usageType}". Updated ${promptsUsingType.length} prompts to use "scoring".`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete usage type",
        variant: "destructive",
      });
    }
  };

  const handleAddNewUsageType = (newUsageType: string) => {
    // Just show a success message - the new type will appear in the dropdown
    // when the user creates a prompt with it
    toast({
      title: "Success",
      description: `Usage type "${newUsageType}" is ready to use. Create a prompt with this type to add it to the system.`,
    });
  };

  const openEditDialog = (prompt: Prompt) => {
    setEditingPrompt(prompt);
    setFormData({
      name: prompt.name,
      prompt_text: prompt.prompt_text,
      intended_usage: prompt.intended_usage,
      expected_response_json: prompt.expected_response_json || '',
      is_default: prompt.is_default,
    });
    setCustomUsage('');
  };

  const handleCancel = () => {
    setIsCreateDialogOpen(false);
    setEditingPrompt(null);
    setFormData({ name: '', prompt_text: '', intended_usage: 'scoring', expected_response_json: '', is_default: false });
    setCustomUsage('');
  };

  // Filter prompts based on selected intent and default toggle
  const filteredPrompts = prompts.filter(prompt => {
    const matchesIntent = filterIntent === 'all' || prompt.intended_usage === filterIntent;
    const matchesDefaultToggle = showDefaultPrompts || !prompt.is_default;
    return matchesIntent && matchesDefaultToggle;
  });

  // Get unique intent values for filter options
  const intentOptions = Array.from(new Set(prompts.map(p => p.intended_usage))).sort();
  
  // Debug: Log the options
  console.log('All intent options:', intentOptions);
  console.log('All prompts:', prompts.map(p => ({ name: p.name, intended_usage: p.intended_usage })));

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-center items-center h-64">
          <div className="text-lg">Loading prompts...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Scoring Prompts</h1>
          <p className="text-muted-foreground">
            Manage AI prompts for asset scoring
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Prompt
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Scoring Prompt</DialogTitle>
              <DialogDescription>
                Create a new prompt for AI-powered asset scoring
              </DialogDescription>
            </DialogHeader>
                    <PromptForm 
                      formData={formData}
                      setFormData={setFormData}
                      onSubmit={handleCreatePrompt}
                      onCancel={handleCancel}
                      customUsage={customUsage}
                      setCustomUsage={setCustomUsage}
                      allPrompts={prompts}
                      onOpenManageDialog={() => setIsManageDialogOpen(true)}
                    />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter Section */}
      <div className="mb-6">
        <div className="flex items-center gap-4">
          <Label htmlFor="intent-filter" className="text-sm font-medium">
            Filter by Intent:
          </Label>
          <Select value={filterIntent} onValueChange={setFilterIntent}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select intent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Prompts</SelectItem>
              
              {/* All Usage Types */}
              {intentOptions.map((intent) => (
                <SelectItem key={intent} value={intent}>
                  {intent.charAt(0).toUpperCase() + intent.slice(1).replace('_', ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground">
            Showing {filteredPrompts.length} of {prompts.length} prompts
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="show-default-prompts"
              checked={showDefaultPrompts}
              onCheckedChange={setShowDefaultPrompts}
            />
            <Label htmlFor="show-default-prompts" className="text-sm">
              Show default prompts
            </Label>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              console.log('Manual refresh triggered');
              fetchPrompts();
            }}
          >
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {filteredPrompts.map((prompt) => (
          <Card key={prompt.id} className="relative">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CardTitle className="text-xl">{prompt.name}</CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {prompt.intended_usage.charAt(0).toUpperCase() + prompt.intended_usage.slice(1).replace('_', ' ')}
                  </Badge>
                  {prompt.is_default && (
                    <Badge variant="secondary" className="flex items-center space-x-1">
                      <Star className="w-3 h-3 fill-current" />
                      <span>Default</span>
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSetDefault(prompt.id)}
                    disabled={prompt.is_default}
                  >
                    {prompt.is_default ? (
                      <StarOff className="w-4 h-4" />
                    ) : (
                      <Star className="w-4 h-4" />
                    )}
                  </Button>
                  
                  <Dialog open={editingPrompt?.id === prompt.id} onOpenChange={(open) => {
                    if (!open) {
                      setEditingPrompt(null);
                      setFormData({ name: '', prompt_text: '', intended_usage: 'scoring', expected_response_json: '', is_default: false });
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(prompt)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Edit Scoring Prompt</DialogTitle>
                        <DialogDescription>
                          Update the scoring prompt configuration
                        </DialogDescription>
                      </DialogHeader>
                      <PromptForm
                        isEdit
                        formData={formData}
                        setFormData={setFormData}
                        onSubmit={handleEditPrompt}
                        onCancel={handleCancel}
                        customUsage={customUsage}
                        setCustomUsage={setCustomUsage}
                        allPrompts={prompts}
                        onOpenManageDialog={() => setIsManageDialogOpen(true)}
                      />
                    </DialogContent>
                  </Dialog>
                  
                  {!prompt.is_default && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeletePrompt(prompt.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
              
              <CardDescription>
                Created {format(new Date(prompt.created_at), 'MMM d, yyyy')}
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <div className="bg-muted p-4 rounded-lg">
                <pre className="text-sm whitespace-pre-wrap font-mono overflow-x-auto">
                  {prompt.prompt_text.length > 500 
                    ? `${prompt.prompt_text.substring(0, 500)}...` 
                    : prompt.prompt_text
                  }
                </pre>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {prompts.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground mb-4">No scoring prompts found</p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Prompt
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Manage Usage Types Dialog */}
      <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Usage Types</DialogTitle>
            <DialogDescription>
              Add, rename, or delete usage types. All types can be modified or deleted.
            </DialogDescription>
          </DialogHeader>
          <UsageTypeManager
            allPrompts={prompts}
            onRename={handleRenameUsageType}
            onDelete={handleDeleteUsageType}
            onAddNew={handleAddNewUsageType}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}