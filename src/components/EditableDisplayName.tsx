import { useState } from 'react';
import { Edit2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useProfile } from '@/hooks/useProfile';

export function EditableDisplayName() {
  const { displayName, updateFullName, isLoading } = useProfile();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const handleStartEdit = () => {
    setEditValue(displayName);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (editValue.trim() && editValue !== displayName) {
      const success = await updateFullName(editValue.trim());
      if (success) {
        setIsEditing(false);
      }
    } else {
      setIsEditing(false);
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
        <span className="text-muted-foreground">Welcome back,</span>
        <Input
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-6 px-2 py-0 text-sm w-40"
          disabled={isLoading}
          autoFocus
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
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">Welcome back, {displayName}</span>
      <Button
        onClick={handleStartEdit}
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 hover:bg-muted"
      >
        <Edit2 className="h-3 w-3" />
      </Button>
    </div>
  );
}