import { CombinedAsset } from "@/hooks/useCombinedAssets";
import { CombinedAssetCard } from "./CombinedAssetCard";
import { VirtuosoGrid } from "react-virtuoso";
import { useCallback, useRef } from "react";

interface CombinedAssetGridProps {
  assets: CombinedAsset[];
  canEdit: boolean;
  isAdmin: boolean;
  currentUserId?: string;
  currentUserEmail?: string;
  onView: (asset: CombinedAsset) => void;
  onEdit: (asset: CombinedAsset) => void;
  onRemove: (asset: CombinedAsset) => void;
  onCheckout: (asset: CombinedAsset) => void;
  onCheckin: (asset: CombinedAsset) => void;
  onReportIssue?: (asset: CombinedAsset) => void;
  onManageIssues?: (asset: CombinedAsset) => void;
  onAddQuantity?: (asset: CombinedAsset) => void;
  onUseQuantity?: (asset: CombinedAsset) => void;
  onOrderStock?: (asset: CombinedAsset) => void;
  onReceiveOrder?: (asset: CombinedAsset) => void;
  pendingOrders?: Record<string, unknown[]>;
  // Infinite scroll props
  onLoadMore?: () => void;
  hasMore?: boolean;
  loading?: boolean;
}

export const CombinedAssetGrid = ({
  assets,
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
  pendingOrders,
  // Infinite scroll props
  onLoadMore,
  hasMore = false,
  loading = false
}: CombinedAssetGridProps) => {
  // Memoize the itemContent function to prevent recreating it on every render
  const itemContent = useCallback((index: number) => {
    const asset = assets[index];
    if (!asset) {
      return <div className="h-40 rounded-md border animate-pulse" style={{ height: '300px' }} />;
    }
    return (
      <div style={{ height: '300px' }}>
        <CombinedAssetCard
          key={asset.id}
          asset={asset}
          canEdit={canEdit}
          isAdmin={isAdmin}
          currentUserId={currentUserId}
          currentUserEmail={currentUserEmail}
          onView={onView}
          onEdit={onEdit}
          onRemove={onRemove}
          onCheckout={onCheckout}
          onCheckin={onCheckin}
          onReportIssue={onReportIssue}
          onManageIssues={onManageIssues}
          onAddQuantity={onAddQuantity}
          onUseQuantity={onUseQuantity}
          onOrderStock={onOrderStock}
          onReceiveOrder={onReceiveOrder}
          hasPendingOrders={pendingOrders?.[asset.id]?.length > 0}
        />
      </div>
    );
  }, [assets, canEdit, isAdmin, currentUserId, currentUserEmail, onView, onEdit, onRemove, onCheckout, onCheckin, onReportIssue, onManageIssues, onAddQuantity, onUseQuantity, onOrderStock, onReceiveOrder, pendingOrders]);

  if (assets.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No assets or stock items found matching your criteria.
      </div>
    );
  }

  return (
    <VirtuosoGrid
      totalCount={assets.length}
      overscan={200}
      style={{ height: '75vh' }}
      computeItemKey={(index) => assets[index]?.id || `item-${index}`}
      listClassName="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      itemContent={itemContent}
      // Infinite scroll functionality
      endReached={onLoadMore}
      components={{
        Footer: () => {
          if (!hasMore) return null;
          return (
            <div className="flex justify-center p-4">
              {loading ? (
                <div className="text-muted-foreground">Loading more...</div>
              ) : (
                <div className="text-muted-foreground">Scroll for more</div>
              )}
            </div>
          );
        }
      }}
    />
  );
};