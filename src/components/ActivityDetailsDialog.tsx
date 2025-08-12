import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { format } from "date-fns";

interface DetailedActivityRecord {
  id: string;
  date: string;
  user: string;
  userName: string;
  type: 'created' | 'modified' | 'used';
  partName: string;
  partDescription?: string;
  changeReason?: string;
  usageDescription?: string;
  quantityUsed?: number;
  missionTitle?: string;
  taskTitle?: string;
  timestamp: string;
}

interface ActivityDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: string | null;
  detailedActivity: DetailedActivityRecord[];
  selectedUsers: string[];
}

export function ActivityDetailsDialog({ 
  open, 
  onOpenChange, 
  selectedDate, 
  detailedActivity,
  selectedUsers 
}: ActivityDetailsDialogProps) {
  if (!selectedDate) return null;

  const dateActivities = detailedActivity.filter(
    activity => activity.date === selectedDate && selectedUsers.includes(activity.userName)
  );

  const createdActivities = dateActivities.filter(a => a.type === 'created');
  const modifiedActivities = dateActivities.filter(a => a.type === 'modified');
  const usedActivities = dateActivities.filter(a => a.type === 'used');

  const ActivitySection = ({ 
    title, 
    activities, 
    type 
  }: { 
    title: string; 
    activities: DetailedActivityRecord[]; 
    type: 'created' | 'modified' | 'used';
  }) => {
    if (activities.length === 0) return null;

    const getTypeColor = (type: string) => {
      switch (type) {
        case 'created': return 'hsl(var(--mission-education))';
        case 'modified': return 'hsl(var(--mission-construction))';
        case 'used': return 'hsl(var(--mission-research))';
        default: return 'hsl(var(--muted))';
      }
    };

    return (
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <h4 className="font-medium text-sm">{title}</h4>
          <Badge 
            variant="secondary" 
            style={{ backgroundColor: getTypeColor(type), color: 'white' }}
          >
            {activities.length}
          </Badge>
        </div>
        
        <div className="space-y-2">
          {activities.map((activity) => (
            <div key={activity.id} className="border rounded-lg p-3 space-y-2">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h5 className="font-medium text-sm">{activity.partName}</h5>
                  {activity.partDescription && (
                    <p className="text-xs text-muted-foreground">{activity.partDescription}</p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(activity.timestamp), 'HH:mm')}
                </span>
              </div>
              
              <div className="space-y-1">
                <p className="text-xs">
                  <span className="text-muted-foreground">User:</span> {activity.userName}
                </p>
                
                {type === 'used' && (
                  <>
                    {activity.quantityUsed && (
                      <p className="text-xs">
                        <span className="text-muted-foreground">Quantity:</span> {activity.quantityUsed}
                      </p>
                    )}
                    {activity.missionTitle && (
                      <p className="text-xs">
                        <span className="text-muted-foreground">Mission:</span> {activity.missionTitle}
                      </p>
                    )}
                    {activity.taskTitle && (
                      <p className="text-xs">
                        <span className="text-muted-foreground">Task:</span> {activity.taskTitle}
                      </p>
                    )}
                    {activity.usageDescription && (
                      <p className="text-xs">
                        <span className="text-muted-foreground">Description:</span> {activity.usageDescription}
                      </p>
                    )}
                  </>
                )}
                
                {(type === 'created' || type === 'modified') && activity.changeReason && (
                  <p className="text-xs">
                    <span className="text-muted-foreground">Reason:</span> {activity.changeReason}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Activity Details for {selectedDate}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {dateActivities.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No activity found for this date with the selected user filters.
            </p>
          ) : (
            <>
              <ActivitySection 
                title="Created" 
                activities={createdActivities} 
                type="created" 
              />
              
              {createdActivities.length > 0 && modifiedActivities.length > 0 && (
                <Separator />
              )}
              
              <ActivitySection 
                title="Modified" 
                activities={modifiedActivities} 
                type="modified" 
              />
              
              {(createdActivities.length > 0 || modifiedActivities.length > 0) && usedActivities.length > 0 && (
                <Separator />
              )}
              
              <ActivitySection 
                title="Used" 
                activities={usedActivities} 
                type="used" 
              />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}