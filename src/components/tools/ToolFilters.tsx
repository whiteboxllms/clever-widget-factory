import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ReactNode } from "react";

interface ToolFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  showToolsWithIssues: boolean;
  onShowToolsWithIssuesChange: (value: boolean) => void;
  showRemovedItems: boolean;
  onShowRemovedItemsChange: (value: boolean) => void;
  actionButton?: ReactNode;
}

export const ToolFilters = ({
  searchTerm,
  onSearchChange,
  showToolsWithIssues,
  onShowToolsWithIssuesChange,
  showRemovedItems,
  onShowRemovedItemsChange,
  actionButton
}: ToolFiltersProps) => {
  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Search tools..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 pr-10"
        />
        {searchTerm && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex items-center space-x-2">
          <Switch
            id="show-issues"
            checked={showToolsWithIssues}
            onCheckedChange={onShowToolsWithIssuesChange}
          />
          <Label htmlFor="show-issues" className="text-sm">
            Show tools with issues
          </Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <Switch
            id="show-removed"
            checked={showRemovedItems}
            onCheckedChange={onShowRemovedItemsChange}
          />
          <Label htmlFor="show-removed" className="text-sm">
            Show removed items
          </Label>
        </div>
        
        {actionButton}
      </div>
    </div>
  );
};