import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search, Filter, Plus, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CombinedAssetFiltersProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  showMyCheckedOut: boolean;
  setShowMyCheckedOut: (show: boolean) => void;
  showWithIssues: boolean;
  setShowWithIssues: (show: boolean) => void;
  showLowStock: boolean;
  setShowLowStock: (show: boolean) => void;
  showOnlyAssets: boolean;
  setShowOnlyAssets: (show: boolean) => void;
  showOnlyStock: boolean;
  setShowOnlyStock: (show: boolean) => void;
  showRemovedItems: boolean;
  setShowRemovedItems: (show: boolean) => void;
  actionButton?: React.ReactNode;
}

export const CombinedAssetFilters = ({
  searchTerm,
  setSearchTerm,
  showMyCheckedOut,
  setShowMyCheckedOut,
  showWithIssues,
  setShowWithIssues,
  showLowStock,
  setShowLowStock,
  showOnlyAssets,
  setShowOnlyAssets,
  showOnlyStock,
  setShowOnlyStock,
  showRemovedItems,
  setShowRemovedItems,
  actionButton
}: CombinedAssetFiltersProps) => {
  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search assets and stock by name, serial number, or storage location..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 pr-10"
          autoFocus
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm("")}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Filters:</span>
          </div>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="my-checked-out"
                    checked={showMyCheckedOut}
                    onCheckedChange={setShowMyCheckedOut}
                  />
                  <Label htmlFor="my-checked-out" className="text-sm">
                    My Checked Out
                  </Label>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Show only assets currently checked out to me</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="with-issues"
                    checked={showWithIssues}
                    onCheckedChange={setShowWithIssues}
                  />
                  <Label htmlFor="with-issues" className="text-sm">
                    With Issues
                  </Label>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Show only items that have reported issues</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="low-stock"
                    checked={showLowStock}
                    onCheckedChange={setShowLowStock}
                  />
                  <Label htmlFor="low-stock" className="text-sm">
                    Low Stock
                  </Label>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Show only stock items below minimum quantity</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="flex items-center gap-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="only-assets"
                      checked={showOnlyAssets}
                      onCheckedChange={(checked) => {
                        setShowOnlyAssets(checked);
                        if (checked) setShowOnlyStock(false);
                      }}
                    />
                    <Label htmlFor="only-assets" className="text-sm">
                      Assets Only
                    </Label>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Show only trackable assets (items with serial numbers)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="only-stock"
                      checked={showOnlyStock}
                      onCheckedChange={(checked) => {
                        setShowOnlyStock(checked);
                        if (checked) setShowOnlyAssets(false);
                      }}
                    />
                    <Label htmlFor="only-stock" className="text-sm">
                      Stock Only
                    </Label>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Show only consumable stock items</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="removed-items"
                    checked={showRemovedItems}
                    onCheckedChange={setShowRemovedItems}
                  />
                  <Label htmlFor="removed-items" className="text-sm">
                    Show Removed
                  </Label>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Include removed/deleted items in the list</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {actionButton && (
          <div className="w-full lg:w-auto">
            {actionButton}
          </div>
        )}
      </div>
    </div>
  );
};