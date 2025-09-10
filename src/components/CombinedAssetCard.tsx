import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wrench, Package, Eye, Edit, Trash2, LogOut, LogIn, AlertTriangle, AlertCircle, Plus, Minus, ShoppingCart } from "lucide-react";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

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
  legacy_storage_vicinity?: string;
  has_issues?: boolean;
  is_checked_out?: boolean;
  checked_out_to?: string;
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
}

export const CombinedAssetCard = ({
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
  hasPendingOrders
}: CombinedAssetCardProps) => {
  const getStatusBadge = () => {
    if (asset.type === 'asset') {
      if (asset.is_checked_out) {
        return <Badge variant="outline" className="text-orange-600 border-orange-600">Checked Out</Badge>;
      }
      
      switch (asset.status) {
        case 'available':
          return <Badge variant="outline" className="text-green-600 border-green-600">Available</Badge>;
        case 'unavailable':
          return <Badge variant="outline" className="text-red-600 border-red-600">Unavailable</Badge>;
        case 'unable_to_find':
          return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Missing</Badge>;
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

  return (
    <Card className="relative hover:shadow-md transition-shadow cursor-pointer" onClick={() => onView(asset)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {asset.type === 'asset' && (
              <Wrench className={`w-5 h-5 ${getIconColor()}`} />
            )}
          </div>
          
          {asset.has_issues && (
            <AlertCircle className="w-4 h-4 text-red-600" />
          )}
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
            {asset.type === 'asset' && getStatusBadge()}
            {asset.category && (
              <Badge variant="outline" className="text-xs">{asset.category}</Badge>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {asset.image_url && (
          <div className="mb-3">
            <img
              src={asset.image_url}
              alt={asset.name}
              className="w-full h-32 object-cover rounded-md border"
            />
          </div>
        )}

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
            </div>
          )}

          {(asset.legacy_storage_vicinity || asset.storage_location) && (
            <div>
              <span className="font-medium">Location:</span>{' '}
              {asset.legacy_storage_vicinity}
              {asset.storage_location && ` • ${asset.storage_location}`}
            </div>
          )}

          {asset.description && (
            <div className="line-clamp-2">
              <span className="font-medium">Description:</span> {asset.description}
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
          {/* Asset-specific buttons */}
          {asset.type === 'asset' && asset.status === 'available' && !asset.is_checked_out && onCheckout && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onCheckout(asset);
              }}
            >
              <LogOut className="h-4 w-4 mr-1" />
              Checkout
            </Button>
          )}

          {asset.type === 'asset' && asset.is_checked_out && asset.checked_out_to === currentUserEmail && onCheckin && (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onCheckin(asset);
              }}
            >
              <LogIn className="h-4 w-4 mr-1" />
              Check In
            </Button>
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
                    <Minus className="h-4 w-4 mr-1" />
                    Use
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
                    <Plus className="h-4 w-4 mr-1" />
                    Add
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
              </div>
            </>
          )}
          
          {/* Common edit/admin buttons */}
          {canEdit && (
            <>
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
              
              {(asset.type === 'asset' || asset.type === 'stock') && onManageIssues && (
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
              )}
              
              {isAdmin && (
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
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};