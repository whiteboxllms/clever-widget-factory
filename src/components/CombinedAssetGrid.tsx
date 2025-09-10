import { CombinedAsset } from "@/hooks/useCombinedAssets";
import { CombinedAssetCard } from "./CombinedAssetCard";

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
  onReportIssue
}: CombinedAssetGridProps) => {
  if (assets.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No assets or stock items found matching your criteria.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {assets.map((asset) => (
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
        />
      ))}
    </div>
  );
};