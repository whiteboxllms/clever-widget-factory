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

    // Set up real-time subscription for actions changes
    const channel = supabase
      .channel('actions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'actions',
          filter: `mission_id=eq.${missionId}`
        },
        () => {
          console.log('Actions changed, refreshing...');
          fetchActions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [missionId]);

  const fetchActions = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('actions')
      .select('*')
      .eq('mission_id', missionId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching actions:', error);
      toast({
        title: "Error",
        description: "Failed to load actions",
        variant: "destructive",
      });
    } else {
      const actions = (data || []).map(action => ({
        ...action,
        required_stock: Array.isArray(action.required_stock) ? action.required_stock : []
      }) as unknown as BaseAction);

      // Fetch implementation update counts for all actions
      const actionsWithCounts = await Promise.all(
        actions.map(async (action) => {
          const { count } = await supabase
            .from('action_implementation_updates')
            .select('*', { count: 'exact', head: true })
            .eq('action_id', action.id);
          
          return { ...action, implementation_update_count: count || 0 };
        })
      );

      setActions(actionsWithCounts);
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