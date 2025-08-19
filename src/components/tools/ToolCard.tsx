import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut, Edit, Trash2, Wrench, LogIn } from "lucide-react";
import { Tool } from "@/hooks/tools/useToolsData";
import { ToolStatusBadge } from "./ToolStatusBadge";
import { useNavigate } from "react-router-dom";

interface ToolCardProps {
  tool: Tool;
  activeCheckout?: { user_name: string, user_id: string };
  hasIssues?: boolean;
  canEditTools: boolean;
  isLeadership: boolean;
  currentUserId?: string;
  onToolClick: (tool: Tool) => void;
  onCheckoutClick: (tool: Tool) => void;
  onEditClick: (tool: Tool) => void;
  onRemoveClick: (tool: Tool) => void;
}

export const ToolCard = ({
  tool,
  activeCheckout,
  hasIssues,
  canEditTools,
  isLeadership,
  currentUserId,
  onToolClick,
  onCheckoutClick,
  onEditClick,
  onRemoveClick
 }: ToolCardProps) => {
  const navigate = useNavigate();
  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => onToolClick(tool)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate">{tool.name}</h3>
            {tool.category && (
              <p className="text-sm text-muted-foreground">{tool.category}</p>
            )}
          </div>
          <ToolStatusBadge status={tool.status} className="ml-2 flex-shrink-0" />
        </div>

        {tool.image_url && (
          <div className="w-full h-48 bg-muted rounded-md mb-3 overflow-hidden">
            <img
              src={tool.image_url}
              alt={tool.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium">Location:</span> {tool.storage_vicinity}
            {tool.storage_location && ` - ${tool.storage_location}`}
          </div>
          
          {tool.serial_number && (
            <div>
              <span className="font-medium">Serial:</span> {tool.serial_number}
            </div>
          )}
          
          {activeCheckout && (
            <div className="text-orange-600 font-medium">
              Checked out by: {activeCheckout.user_name}
            </div>
          )}

          {hasIssues && (
            <div className="flex items-center text-amber-600 text-sm">
              <Wrench className="h-4 w-4 mr-1" />
              Has reported issues
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
          {tool.status === 'available' && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onCheckoutClick(tool);
              }}
            >
              <LogOut className="h-4 w-4 mr-1" />
              Checkout
            </Button>
          )}

          {activeCheckout && activeCheckout.user_id === currentUserId && (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/checkin');
              }}
            >
              <LogIn className="h-4 w-4 mr-1" />
              Check In
            </Button>
          )}
          
          {canEditTools && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditClick(tool);
                }}
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
              
              {isLeadership && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveClick(tool);
                  }}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Remove
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};