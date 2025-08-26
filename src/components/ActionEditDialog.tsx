import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ActionDetailEditor } from './ActionDetailEditor';

interface Action {
  id: string;
  title: string;
  description?: string;
  plan?: string;
  observations?: string;
  assigned_to: string | null;
  status: string;
  mission_id: string;
  estimated_completion_date?: Date;
  required_tools?: string[];
  required_stock?: { part_id: string; quantity: number; part_name: string; }[];
  attachments?: string[];
  issue_reference?: string;
  linked_issue_id?: string;
}

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
}

interface ActionEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: Action;
  profiles: Profile[];
  onSave: () => void;
  onCancel: () => void;
  isCreating?: boolean;
  missionId?: string;
}

export function ActionEditDialog({
  open,
  onOpenChange,
  action,
  profiles,
  onSave,
  onCancel,
  isCreating = false,
  missionId
}: ActionEditDialogProps) {
  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  const handleSave = () => {
    onSave();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isCreating ? 'Create New Action' : `Edit Action: ${action.title || 'Untitled Action'}`}
          </DialogTitle>
        </DialogHeader>
        
        <ActionDetailEditor
          action={{
            ...action,
            mission_id: action.mission_id || missionId || '',
          }}
          profiles={profiles}
          onSave={handleSave}
          onCancel={handleCancel}
          isCreating={isCreating}
        />
      </DialogContent>
    </Dialog>
  );
}