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
import { useScoringPrompts, ScoringPrompt } from '@/hooks/useScoringPrompts';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export default function ScoringPrompts() {
  const { prompts, isLoading, createPrompt, updatePrompt, setDefaultPrompt } = useScoringPrompts();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<ScoringPrompt | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    prompt_text: '',
    is_default: false,
  });
  const { toast } = useToast();

  const handleCreatePrompt = async () => {
    try {
      await createPrompt(formData);
      setIsCreateDialogOpen(false);
      setFormData({ name: '', prompt_text: '', is_default: false });
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleEditPrompt = async () => {
    if (!editingPrompt) return;
    
    try {
      await updatePrompt(editingPrompt.id, formData);
      setEditingPrompt(null);
      setFormData({ name: '', prompt_text: '', is_default: false });
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

  const openEditDialog = (prompt: ScoringPrompt) => {
    setEditingPrompt(prompt);
    setFormData({
      name: prompt.name,
      prompt_text: prompt.prompt_text,
      is_default: prompt.is_default,
    });
  };

  const PromptForm = ({ isEdit = false }: { isEdit?: boolean }) => (
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
        <Label htmlFor="prompt_text">Prompt Text</Label>
        <Textarea
          id="prompt_text"
          value={formData.prompt_text}
          onChange={(e) => setFormData({ ...formData, prompt_text: e.target.value })}
          placeholder="Enter the scoring prompt text"
          rows={15}
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
        <Button
          variant="outline"
          onClick={() => {
            setIsCreateDialogOpen(false);
            setEditingPrompt(null);
            setFormData({ name: '', prompt_text: '', is_default: false });
          }}
        >
          Cancel
        </Button>
        <Button onClick={isEdit ? handleEditPrompt : handleCreatePrompt}>
          {isEdit ? 'Update' : 'Create'} Prompt
        </Button>
      </div>
    </div>
  );

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
            <PromptForm />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6">
        {prompts.map((prompt) => (
          <Card key={prompt.id} className="relative">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CardTitle className="text-xl">{prompt.name}</CardTitle>
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
                      setFormData({ name: '', prompt_text: '', is_default: false });
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
                      <PromptForm isEdit />
                    </DialogContent>
                  </Dialog>
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
    </div>
  );
}