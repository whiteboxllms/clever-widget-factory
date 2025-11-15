import { useState } from 'react';
import { Edit2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/client';

interface EditableMemberNameProps {
  memberId: string;
  currentName: string | null;
  email: string;
  onNameUpdated: () => void;
}

export function EditableMemberName({ memberId, currentName, email, onNameUpdated }: EditableMemberNameProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const displayName = currentName || 'Unknown User';

  const handleStartEdit = () => {
    setEditValue(currentName || '');
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!editValue.trim()) {
      setIsEditing(false);
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('organization_members')
        .update({ full_name: editValue.trim() })
        .eq('id', memberId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Member name updated successfully",
      });
      
      setIsEditing(false);
      onNameUpdated();
    } catch (error) {
      console.error('Error updating member name:', error);
      toast({
        title: "Error",
        description: "Failed to update member name",
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
          className="h-7 px-2 py-0 text-sm"
          disabled={isLoading}
          autoFocus
          placeholder="Enter member name"
        />
        <Button
          onClick={handleSave}
          disabled={isLoading || !editValue.trim()}
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
        >
          <Check className="h-3 w-3" />
        </Button>
        <Button
          onClick={handleCancel}
          disabled={isLoading}
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 group">
      <span className="font-medium">{displayName}</span>
      <Button
        onClick={handleStartEdit}
        variant="ghost"
        size="sm"
        className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Edit2 className="h-3 w-3" />
      </Button>
    </div>
  );
}