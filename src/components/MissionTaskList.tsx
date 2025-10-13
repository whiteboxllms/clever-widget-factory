import { useState, useEffect } from 'react';
import { ActionCard } from '@/components/ActionCard';
import { Button } from "@/components/ui/button";
import { Plus } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationId } from "@/hooks/useOrganizationId";

interface Action {
  id: string;
  title: string;
  policy?: string;
  observations?: string;
  assigned_to: string | null;
  status: string;
  mission_id: string;
  created_at: string;
  updated_at: string;
  completed_at: string;
  linked_issue_id?: string;
  issue_reference?: string;
  attachments?: string[];
}

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
}

interface MissionActionListProps {
  missionId: string;
  profiles: Profile[];
  canEdit?: boolean;
  missionNumber?: number;
}

export function MissionTaskList({ missionId, profiles, canEdit = false, missionNumber }: MissionActionListProps) {
  const { toast } = useToast();
  const organizationId = useOrganizationId();
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingAction, setIsAddingAction] = useState(false);

  useEffect(() => {
    fetchActions();
  }, [missionId]);

  const fetchActions = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('actions')
      .select('*, linked_issue_id, issue_reference, attachments')
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
      setActions(data || []);
    }
    
    setLoading(false);
  };

  const handleAddAction = async (actionData: any) => {
    try {
      const { data, error } = await supabase
        .from('actions')
        .insert({
          mission_id: missionId,
          title: actionData.title,
          policy: actionData.policy,
          observations: actionData.observations,
          assigned_to: actionData.assigned_to || null,
          organization_id: organizationId
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: "Action added successfully",
      });

      setIsAddingAction(false);
      fetchActions();
    } catch (error) {
      console.error('Error adding action:', error);
      toast({
        title: "Error",
        description: "Failed to add action",
        variant: "destructive",
      });
    }
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
            onClick={() => setIsAddingAction(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Action
          </Button>
        )}
      </div>

      {isAddingAction && (
        <ActionCard
          action={{
            id: 'new',
            title: '',
            policy: '',
            observations: '',
            assigned_to: null,
            status: 'not_started',
            mission_id: missionId
          }}
          profiles={profiles}
          onUpdate={fetchActions}
          isEditing={true}
          onSave={handleAddAction}
          onCancel={() => setIsAddingAction(false)}
        />
      )}

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
            />
          ))}
        </div>
      )}
    </div>
  );
}