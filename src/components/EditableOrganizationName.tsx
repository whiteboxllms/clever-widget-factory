import { useState } from 'react';
import { Edit2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useOrganizations } from '@/hooks/useOrganizations';

interface EditableOrganizationNameProps {
  organizationId: string;
  currentName: string;
  onNameUpdated: () => void;
  canEdit: boolean;
}

export function EditableOrganizationName({ 
  organizationId, 
  currentName, 
  onNameUpdated, 
  canEdit 
}: EditableOrganizationNameProps) {
  const { toast } = useToast();
  const { updateOrganization } = useOrganizations();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleStartEdit = () => {
    if (!canEdit) return;
    setEditValue(currentName);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!editValue.trim()) {
      setIsEditing(false);
      return;
    }

    setIsLoading(true);
    try {
      const success = await updateOrganization(organizationId, { 
        name: editValue.trim() 
      });

      if (success) {
        setIsEditing(false);
        onNameUpdated();
      }
    } catch (error) {
      console.error('Error updating organization name:', error);
      toast({
        title: "Error",
        description: "Failed to update organization name",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setEditValue('');
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="text-lg font-medium"
          disabled={isLoading}
          autoFocus
          placeholder="Enter organization name"
        />
        <Button
          onClick={handleSave}
          disabled={isLoading || !editValue.trim()}
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          onClick={handleCancel}
          disabled={isLoading}
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 group">
      <p className="text-lg font-medium">{currentName}</p>
      {canEdit && (
        <Button
          onClick={handleStartEdit}
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Edit2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}