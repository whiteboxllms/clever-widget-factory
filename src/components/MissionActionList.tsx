import { useState, useEffect } from 'react';
import { ActionCard } from '@/components/ActionCard';
import { Button } from "@/components/ui/button";
import { Plus } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { UnifiedActionDialog } from './UnifiedActionDialog';
import { BaseAction, Profile, createMissionAction } from '@/types/actions';

interface MissionActionListProps {
  missionId: string;
  profiles: Profile[];
  canEdit?: boolean;
  missionNumber?: number;
}

export function MissionActionList({ missionId, profiles, canEdit = false, missionNumber }: MissionActionListProps) {
  const { toast } = useToast();
  const [actions, setActions] = useState<BaseAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingAction, setIsAddingAction] = useState(false);
  const [editingAction, setEditingAction] = useState<BaseAction | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchActions();
  }, [missionId]);

  const fetchActions = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('actions')
      .select('*')
      .eq('mission_id', missionId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching actions:', error);
      toast({
        title: "Error",
        description: "Failed to load actions",
        variant: "destructive",
      });
    } else {
      setActions(data || []);
    }
    
    setLoading(false);
  };

  const handleCreateAction = () => {
    setEditingAction(null);
    setIsCreating(true);
    setIsAddingAction(true);
  };

  const handleEditAction = (action: BaseAction) => {
    setEditingAction(action);
    setIsCreating(false);
    setIsAddingAction(true);
  };

  const handleSaveAction = () => {
    setIsAddingAction(false);
    setEditingAction(null);
    setIsCreating(false);
    fetchActions();
  };

  const handleCancelAction = () => {
    setIsAddingAction(false);
    setEditingAction(null);
    setIsCreating(false);
  };

  if (loading) {
    return <div className="text-center py-4">Loading actions...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Actions</h3>
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleCreateAction}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Action
          </Button>
        )}
      </div>

      {actions.length === 0 && !isAddingAction ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No actions defined for this mission.</p>
          {canEdit && (
            <p className="text-sm mt-2">Add actions to break down the mission into manageable steps.</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {actions.map((action) => (
            <ActionCard
              key={action.id}
              action={action}
              profiles={profiles}
              onUpdate={fetchActions}
              onEdit={canEdit ? () => handleEditAction(action) : undefined}
            />
          ))}
        </div>
      )}

      {/* Unified Action Dialog */}
      <UnifiedActionDialog
        open={isAddingAction}
        onOpenChange={(open) => !open && handleCancelAction()}
        action={editingAction || undefined}
        context={{
          type: 'mission',
          parentId: missionId,
          prefilledData: isCreating ? createMissionAction(missionId) : undefined
        }}
        profiles={profiles}
        onActionSaved={handleSaveAction}
        isCreating={isCreating}
      />
    </div>
  );
}