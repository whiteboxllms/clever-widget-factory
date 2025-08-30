import { Search, X, User, AlertTriangle, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ReactNode } from "react";
interface ToolFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  showMyCheckedOut: boolean;
  onShowMyCheckedOutChange: (value: boolean) => void;
  showToolsWithIssues: boolean;
  onShowToolsWithIssuesChange: (value: boolean) => void;
  showRemovedItems: boolean;
  onShowRemovedItemsChange: (value: boolean) => void;
  actionButton?: ReactNode;
}
export const ToolFilters = ({
  searchTerm,
  onSearchChange,
  showMyCheckedOut,
  onShowMyCheckedOutChange,
  showToolsWithIssues,
  onShowToolsWithIssuesChange,
  showRemovedItems,
  onShowRemovedItemsChange,
  actionButton
}: ToolFiltersProps) => {
  return (
    <TooltipProvider>
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input placeholder="Search assets..." value={searchTerm} onChange={e => onSearchChange(e.target.value)} className="pl-10 pr-10" />
          {searchTerm && <button onClick={() => onSearchChange("")} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" type="button">
              <X className="h-4 w-4" />
            </button>}
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex items-center space-x-2">
            <Switch id="show-checked-out" checked={showMyCheckedOut} onCheckedChange={onShowMyCheckedOutChange} />
            <Tooltip>
              <TooltipTrigger asChild>
                <Label htmlFor="show-checked-out" className="text-sm flex items-center gap-1 cursor-pointer">
                  <User className="h-4 w-4" />
                </Label>
              </TooltipTrigger>
              <TooltipContent>
                <p>Show only assets checked out by me</p>
              </TooltipContent>
            </Tooltip>
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch id="show-issues" checked={showToolsWithIssues} onCheckedChange={onShowToolsWithIssuesChange} />
            <Tooltip>
              <TooltipTrigger asChild>
                <Label htmlFor="show-issues" className="text-sm flex items-center gap-1 cursor-pointer">
                  <AlertTriangle className="h-4 w-4" />
                </Label>
              </TooltipTrigger>
              <TooltipContent>
                <p>Show only assets with active issues</p>
              </TooltipContent>
            </Tooltip>
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch id="show-removed" checked={showRemovedItems} onCheckedChange={onShowRemovedItemsChange} />
            <Tooltip>
              <TooltipTrigger asChild>
                <Label htmlFor="show-removed" className="text-sm flex items-center gap-1 cursor-pointer">
                  <Trash2 className="h-4 w-4" />
                </Label>
              </TooltipTrigger>
              <TooltipContent>
                <p>Show removed assets</p>
              </TooltipContent>
            </Tooltip>
          </div>
          
          {actionButton}
        </div>
      </div>
    </TooltipProvider>
  );
};