import { useState } from 'react';
import { Edit2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useOrganizations } from '@/hooks/useOrganizations';

interface EditableOrganizationDomainProps {
  organizationId: string;
  currentDomain: string | null;
  onDomainUpdated: () => void;
  canEdit: boolean;
}

export function EditableOrganizationDomain({ 
  organizationId, 
  currentDomain, 
  onDomainUpdated, 
  canEdit 
}: EditableOrganizationDomainProps) {
  const { toast } = useToast();
  const { updateOrganization } = useOrganizations();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleStartEdit = () => {
    if (!canEdit) return;
    setEditValue(currentDomain || '');
    setIsEditing(true);
  };

  const handleSave = async () => {
    // Allow empty value to clear the subdomain
    const trimmedValue = editValue.trim();

    setIsLoading(true);
    try {
      const success = await updateOrganization(organizationId, { 
        subdomain: trimmedValue || null
      });

      if (success) {
        setIsEditing(false);
        onDomainUpdated();
        toast({
          title: "Success",
          description: "Domain updated successfully",
        });
      }
    } catch (error) {
      console.error('Error updating organization domain:', error);
      toast({
        title: "Error",
        description: "Failed to update organization domain",
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
          placeholder="Enter domain (e.g., opa)"
        />
        <Button
          onClick={handleSave}
          disabled={isLoading}
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
      <p className="text-lg font-medium">{currentDomain || 'No domain set'}</p>
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