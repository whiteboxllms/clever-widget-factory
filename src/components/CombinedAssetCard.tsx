import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wrench, Package, Edit, Trash2, LogOut, LogIn, AlertTriangle, AlertCircle, Plus, Minus, ShoppingCart, History } from "lucide-react";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { InventoryHistoryDialog } from "./InventoryHistoryDialog";
import { AssetHistoryDialog } from "./AssetHistoryDialog";
import { useVisibleImage } from "@/hooks/useVisibleImage";
import { useMemo, memo, useRef } from "react";

interface CombinedAsset {
  id: string;
  name: string;
  type: 'asset' | 'stock';
  description?: string;
  category?: string;
  status?: string;
  serial_number?: string;
  current_quantity?: number;
  minimum_quantity?: number;
  unit?: string;
  image_url?: string;
  storage_location?: string;
  storage_vicinity?: string;
  parent_structure_id?: string;
  parent_structure_name?: string; // Resolved name from parent_structure_id
  area_display?: string; // Computed field: parent_structure_name || legacy_storage_vicinity
  legacy_storage_vicinity?: string;
  has_issues?: boolean;
  is_checked_out?: boolean;
  checked_out_to?: string;
  checked_out_user_id?: string;
  checked_out_date?: string;
  accountable_person_id?: string;
  accountable_person_name?: string; // Will be populated from user lookup
  accountable_person_color?: string; // Favorite color of accountable person
  created_at?: string;
  updated_at?: string;
}

interface CombinedAssetCardProps {
  asset: CombinedAsset;
  canEdit: boolean;
  isAdmin: boolean;
  currentUserId?: string;
  currentUserEmail?: string;
  onView: (asset: CombinedAsset) => void;
  onEdit: (asset: CombinedAsset) => void;
  onRemove: (asset: CombinedAsset) => void;
  onCheckout?: (asset: CombinedAsset) => void;
  onCheckin?: (asset: CombinedAsset) => void;
  onReportIssue?: (asset: CombinedAsset) => void;
  onManageIssues?: (asset: CombinedAsset) => void;
  onAddQuantity?: (asset: CombinedAsset) => void;
  onUseQuantity?: (asset: CombinedAsset) => void;
  onOrderStock?: (asset: CombinedAsset) => void;
  onReceiveOrder?: (asset: CombinedAsset) => void;
  hasPendingOrders?: boolean;
  onShowHistory?: (asset: CombinedAsset) => void;
}

// Custom comparison function for memo to prevent unnecessary re-renders
const arePropsEqual = (prevProps: CombinedAssetCardProps, nextProps: CombinedAssetCardProps) => {
  // Compare primitive props
  if (prevProps.canEdit !== nextProps.canEdit ||
      prevProps.isAdmin !== nextProps.isAdmin ||
      prevProps.currentUserId !== nextProps.currentUserId ||
      prevProps.currentUserEmail !== nextProps.currentUserEmail ||
      prevProps.hasPendingOrders !== nextProps.hasPendingOrders) {
    return false;
  }

  // Deep compare the asset object
  const prevAsset = prevProps.asset;
  const nextAsset = nextProps.asset;
  
  // Check if asset reference is the same (fast path)
  if (prevAsset === nextAsset) {
    return true;
  }
  
  // Check if asset ID is different (different asset)
  if (prevAsset.id !== nextAsset.id) {
    return false;
  }
  
  // Check key properties that are most likely to change
  const keyChanges = {
    name: prevAsset.name !== nextAsset.name,
    type: prevAsset.type !== nextAsset.type,
    status: prevAsset.status !== nextAsset.status,
    current_quantity: prevAsset.current_quantity !== nextAsset.current_quantity,
    has_issues: prevAsset.has_issues !== nextAsset.has_issues,
    is_checked_out: prevAsset.is_checked_out !== nextAsset.is_checked_out,
    accountable_person_name: prevAsset.accountable_person_name !== nextAsset.accountable_person_name,
    accountable_person_color: prevAsset.accountable_person_color !== nextAsset.accountable_person_color,
    updated_at: prevAsset.updated_at !== nextAsset.updated_at
  };
  
  const hasKeyChanges = Object.values(keyChanges).some(Boolean);
  if (hasKeyChanges) {
    return false;
  }
  
  // Check all other properties
  if (prevAsset.description !== nextAsset.description ||
      prevAsset.category !== nextAsset.category ||
      prevAsset.serial_number !== nextAsset.serial_number ||
      prevAsset.minimum_quantity !== nextAsset.minimum_quantity ||
      prevAsset.unit !== nextAsset.unit ||
      prevAsset.cost_per_unit !== nextAsset.cost_per_unit ||
      prevAsset.cost_evidence_url !== nextAsset.cost_evidence_url ||
      prevAsset.supplier !== nextAsset.supplier ||
      prevAsset.image_url !== nextAsset.image_url ||
      prevAsset.storage_location !== nextAsset.storage_location ||
      prevAsset.storage_vicinity !== nextAsset.storage_vicinity ||
      prevAsset.parent_structure_id !== nextAsset.parent_structure_id ||
      prevAsset.parent_structure_name !== nextAsset.parent_structure_name ||
      prevAsset.legacy_storage_vicinity !== nextAsset.legacy_storage_vicinity ||
      prevAsset.area_display !== nextAsset.area_display ||
      prevAsset.checked_out_to !== nextAsset.checked_out_to ||
      prevAsset.checked_out_user_id !== nextAsset.checked_out_user_id ||
      prevAsset.checked_out_date !== nextAsset.checked_out_date ||
      prevAsset.accountable_person_id !== nextAsset.accountable_person_id ||
      prevAsset.created_at !== nextAsset.created_at) {
    return false;
  }

  return true;
};

export const CombinedAssetCard = memo(({
  asset,
  canEdit,
  isAdmin,
  currentUserId,
  currentUserEmail,
  onView,
  onEdit,
  onRemove,
  onCheckout,
  onCheckin,
  onReportIssue,
  onManageIssues,
  onAddQuantity,
  onUseQuantity,
  onOrderStock,
  onReceiveOrder,
  hasPendingOrders,
  onShowHistory
}: CombinedAssetCardProps) => {
  
  
  const { containerRef, imageUrl } = useVisibleImage(asset.id, asset.type, asset.image_url);
  
  function getStatusBadge() {
    if (asset.type === 'asset') {
      if (asset.is_checked_out) {
        return <Badge variant="outline" className="text-orange-600 border-orange-600">Checked Out</Badge>;
      }
      
      switch (asset.status) {
        case 'available':
          return <Badge variant="outline" className="text-green-600 border-green-600">Available</Badge>;
        case 'in_use':
          return <Badge variant="outline" className="text-blue-600 border-blue-600">In Use</Badge>;
        case 'unavailable':
          return <Badge variant="outline" className="text-red-600 border-red-600">Unavailable</Badge>;
        default:
          return <Badge variant="outline">Unknown</Badge>;
      }
    } else {
      const isLowStock = asset.minimum_quantity && asset.current_quantity && asset.current_quantity <= asset.minimum_quantity;
      if (isLowStock) {
        return <Badge variant="outline" className="text-red-600 border-red-600">Low Stock</Badge>;
      }
      return <Badge variant="outline" className="text-green-600 border-green-600">In Stock</Badge>;
    }
  };

  const getIconColor = () => {
    if (asset.type === 'asset') {
      return asset.has_issues ? "text-red-600" : "text-blue-600";
    }
    return "text-green-600";
  };

  const statusBadge = useMemo(() => {
    return getStatusBadge();
  }, [asset.type, asset.is_checked_out, asset.status, asset.minimum_quantity, asset.current_quantity]);
  
  const iconColor = useMemo(() => {
    return getIconColor();
  }, [asset.type, asset.has_issues]);

  return (
    <Card className="relative hover:shadow-md transition-shadow cursor-pointer h-full flex flex-col" onClick={() => onView(asset)}>
      <CardHeader className="pb-3 pt-3 flex-shrink-0">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
          </div>
        </div>
        
        <div className="flex items-center justify-between gap-2 -mt-1">
          <CardTitle className="text-base line-clamp-2 flex-1 leading-tight">{asset.name}</CardTitle>
          {asset.type === 'stock' && (
            <Badge variant="secondary" className="text-xs shrink-0">
              Stock
            </Badge>
          )}
        </div>
        
        {(asset.type === 'asset' || asset.category) && (
          <div className="flex flex-wrap gap-1 -mt-1">
            {asset.type === 'asset' && statusBadge}
            {asset.category && (
              <Badge variant="outline" className="text-xs">{asset.category}</Badge>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0 flex-1 flex flex-col">
        <div ref={containerRef} className="mb-3">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={asset.name}
              className="w-full h-32 object-cover rounded-md border"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="w-full h-32 rounded-md border bg-muted animate-pulse" />
          )}
        </div>

        <div className="space-y-2 text-sm text-muted-foreground">
          {asset.serial_number && (
            <div>
              <span className="font-medium">Serial:</span> {asset.serial_number}
            </div>
          )}
          
          
          {asset.type === 'stock' && (
            <div>
              <span className="font-medium">Quantity:</span> {asset.current_quantity} {asset.unit || 'units'}
              {asset.minimum_quantity && (
                <span className="text-xs ml-1">(min: {asset.minimum_quantity})</span>
              )}
            </div>
          )}

          {asset.is_checked_out && asset.checked_out_to && (
            <div>
              <span className="font-medium">Checked out to:</span> {asset.checked_out_to}
              {asset.checked_out_date && (
                <div className="text-xs text-muted-foreground mt-1">
                  Since {new Date(asset.checked_out_date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  }) + ' at ' + new Date(asset.checked_out_date).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })}
                </div>
              )}
            </div>
          )}

          {(asset.area_display || asset.storage_location) && (
            <div>
              <span className="font-medium">Location:</span>{' '}
              {asset.area_display}
              {asset.storage_location && ` • ${asset.storage_location}`}
            </div>
          )}

          {asset.accountable_person_name && (
            <div>
              <span className="font-medium">Accountable:</span> 
              <span style={{ color: asset.accountable_person_color || '#6B7280' }} className="ml-1">
                {asset.accountable_person_name}
              </span>
            </div>
          )}

          {asset.description && (
            <div className="line-clamp-2">
              <span className="font-medium">Description:</span> {asset.description}
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-4 mt-auto pt-4" onClick={(e) => e.stopPropagation()}>
          {/* Asset-specific buttons */}
          {asset.type === 'asset' && asset.status === 'available' && !asset.is_checked_out && onCheckout && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-12 px-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCheckout(asset);
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Checkout</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {asset.type === 'asset' && asset.is_checked_out && asset.checked_out_user_id === currentUserId && onCheckin && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-12 px-2 text-orange-600 border-orange-600 hover:bg-orange-50 hover:border-orange-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCheckin(asset);
                    }}
                  >
                    <LogIn className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Check In</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Asset History Button - Always show for assets */}
          {asset.type === 'asset' && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <AssetHistoryDialog assetId={asset.id} assetName={asset.name}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-12 px-2"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      <History className="h-4 w-4" />
                    </Button>
                  </AssetHistoryDialog>
                </TooltipTrigger>
                <TooltipContent>
                  <p>View History</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}



          {/* Stock-specific buttons */}
          {asset.type === 'stock' && canEdit && (
            <>
              <div className="flex gap-2 flex-1">
                {onUseQuantity && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUseQuantity(asset);
                    }}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                )}

                {onAddQuantity && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddQuantity(asset);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )}

                {onOrderStock && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-12 px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOrderStock(asset);
                          }}
                        >
                          <ShoppingCart className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Create Order</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}

                {hasPendingOrders && onReceiveOrder && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-12 px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            onReceiveOrder(asset);
                          }}
                        >
                          <Package className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Receive Order</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}

                {/* Stock History Button */}
                <InventoryHistoryDialog partId={asset.id} partName={asset.name}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-12 px-2"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    <History className="h-4 w-4" />
                  </Button>
                </InventoryHistoryDialog>
              </div>
            </>
          )}
          
          {/* Common edit/admin buttons */}
          {canEdit && (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-12 px-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(asset);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Edit</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              {(asset.type === 'asset' || asset.type === 'stock') && onManageIssues && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className={`w-12 px-2 ${
                          asset.has_issues 
                            ? "text-orange-600 hover:text-orange-700 border-orange-200 hover:border-orange-300" 
                            : ""
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onManageIssues(asset);
                        }}
                      >
                        <AlertTriangle className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Manage Issues</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              
              {isAdmin && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemove(asset);
                        }}
                        className="text-muted-foreground hover:text-destructive h-9 w-9"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Delete</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

CombinedAssetCard.displayName = 'CombinedAssetCard';