import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus } from "lucide-react";
import { CombinedAssetFilters } from "./CombinedAssetFilters";
import { CombinedAssetGrid } from "./CombinedAssetGrid";
import { CombinedAssetDialog } from "./CombinedAssetDialog";
import { ToolCheckoutDialog } from "./ToolCheckoutDialog";
import { ToolCheckInDialog } from "./ToolCheckInDialog";
import { IssueReportDialog } from "./IssueReportDialog";
import { ToolRemovalDialog } from "./tools/ToolRemovalDialog";
import { useCombinedAssets, CombinedAsset } from "@/hooks/useCombinedAssets";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const CombinedAssetsContainer = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [showMyCheckedOut, setShowMyCheckedOut] = useState(false);
  const [showWithIssues, setShowWithIssues] = useState(false);
  const [showLowStock, setShowLowStock] = useState(false);
  const [showOnlyAssets, setShowOnlyAssets] = useState(false);
  const [showOnlyStock, setShowOnlyStock] = useState(false);
  const [showRemovedItems, setShowRemovedItems] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showCheckoutDialog, setShowCheckoutDialog] = useState(false);
  const [showCheckinDialog, setShowCheckinDialog] = useState(false);
  const [showIssueDialog, setShowIssueDialog] = useState(false);
  const [showRemovalDialog, setShowRemovalDialog] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<CombinedAsset | null>(null);

  const { assets, loading, createAsset, updateAsset, refetch } = useCombinedAssets(showRemovedItems);

  // Filter assets based on current filters
  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
      // Search filter
      const matchesSearch = 
        asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (asset.serial_number && asset.serial_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (asset.category && asset.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (asset.description && asset.description.toLowerCase().includes(searchTerm.toLowerCase()));

      // Type filters
      if (showOnlyAssets && asset.type !== 'asset') return false;
      if (showOnlyStock && asset.type !== 'stock') return false;

      // My checked out filter
      if (showMyCheckedOut && (!asset.is_checked_out || asset.checked_out_to !== user?.email)) return false;

      // Issues filter
      if (showWithIssues && !asset.has_issues) return false;

      // Low stock filter
      if (showLowStock) {
        if (asset.type !== 'stock') return false;
        const isLowStock = asset.minimum_quantity && asset.current_quantity && asset.current_quantity <= asset.minimum_quantity;
        if (!isLowStock) return false;
      }

      return matchesSearch;
    });
  }, [assets, searchTerm, showOnlyAssets, showOnlyStock, showMyCheckedOut, showWithIssues, showLowStock, user?.email]);

  const handleCreateAsset = async (assetData: any, isAsset: boolean) => {
    const result = await createAsset(assetData, isAsset);
    if (result) {
      await refetch();
    }
    return result;
  };

  const handleView = (asset: CombinedAsset) => {
    if (asset.type === 'asset') {
      navigate(`/tools?toolId=${asset.id}`);
    } else {
      navigate(`/inventory?partId=${asset.id}`);
    }
  };

  const handleEdit = (asset: CombinedAsset) => {
    if (asset.type === 'asset') {
      navigate(`/tools?toolId=${asset.id}&edit=true`);
    } else {
      navigate(`/inventory?partId=${asset.id}&edit=true`);
    }
  };

  const handleRemove = (asset: CombinedAsset) => {
    setSelectedAsset(asset);
    setShowRemovalDialog(true);
  };

  const handleCheckout = (asset: CombinedAsset) => {
    setSelectedAsset(asset);
    setShowCheckoutDialog(true);
  };

  const handleCheckin = (asset: CombinedAsset) => {
    setSelectedAsset(asset);
    setShowCheckinDialog(true);
  };

  const handleReportIssue = (asset: CombinedAsset) => {
    setSelectedAsset(asset);
    setShowIssueDialog(true);
  };

  const handleConfirmRemoval = async (toolId: string) => {
    if (!selectedAsset) return;

    try {
      const table = selectedAsset.type === 'asset' ? 'tools' : 'parts';
      
      if (selectedAsset.type === 'asset') {
        // For assets, set status to 'removed'
        const { error } = await supabase
          .from('tools')
          .update({ status: 'removed' })
          .eq('id', toolId);

        if (error) throw error;
      } else {
        // For stock items, you might want to delete or set a removed flag
        // For now, we'll just show a message since parts table might not have status
        toast({
          title: "Feature Coming Soon",
          description: "Stock item removal will be available soon.",
        });
        setShowRemovalDialog(false);
        return;
      }

      await refetch();
      setShowRemovalDialog(false);
      setSelectedAsset(null);
      
      toast({
        title: "Success",
        description: `${selectedAsset.type === 'asset' ? 'Asset' : 'Stock item'} removed successfully`,
      });
    } catch (error) {
      console.error('Error removing item:', error);
      toast({
        title: "Error",
        description: `Failed to remove ${selectedAsset.type === 'asset' ? 'asset' : 'stock item'}`,
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-8">Loading combined assets...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Combined Assets</h1>
          <p className="text-muted-foreground">
            {filteredAssets.length} items ({assets.filter(a => a.type === 'asset').length} assets, {assets.filter(a => a.type === 'stock').length} stock items)
          </p>
        </div>
      </div>

      {/* Filters */}
      <CombinedAssetFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        showMyCheckedOut={showMyCheckedOut}
        setShowMyCheckedOut={setShowMyCheckedOut}
        showWithIssues={showWithIssues}
        setShowWithIssues={setShowWithIssues}
        showLowStock={showLowStock}
        setShowLowStock={setShowLowStock}
        showOnlyAssets={showOnlyAssets}
        setShowOnlyAssets={setShowOnlyAssets}
        showOnlyStock={showOnlyStock}
        setShowOnlyStock={setShowOnlyStock}
        showRemovedItems={showRemovedItems}
        setShowRemovedItems={setShowRemovedItems}
        actionButton={
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Asset/Stock
          </Button>
        }
      />

      {/* Assets Grid */}
      <CombinedAssetGrid
        assets={filteredAssets}
        canEdit={true} // You can add proper permission logic here
        currentUserId={user?.id}
        onView={handleView}
        onEdit={handleEdit}
        onRemove={handleRemove}
        onCheckout={handleCheckout}
        onCheckin={handleCheckin}
        onReportIssue={handleReportIssue}
      />

      {/* Add Asset Dialog */}
      <CombinedAssetDialog
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onSubmit={handleCreateAsset}
      />

      {/* Checkout Dialog */}
      {selectedAsset && selectedAsset.type === 'asset' && (
        <ToolCheckoutDialog
          open={showCheckoutDialog}
          onOpenChange={() => {
            setShowCheckoutDialog(false);
            setSelectedAsset(null);
          }}
          tool={selectedAsset as any}
          onSuccess={() => {
            refetch();
            setShowCheckoutDialog(false);
            setSelectedAsset(null);
          }}
        />
      )}

      {/* Check-in Dialog */}
      {selectedAsset && selectedAsset.type === 'asset' && (
        <ToolCheckInDialog
          open={showCheckinDialog}
          onOpenChange={() => {
            setShowCheckinDialog(false);
            setSelectedAsset(null);
          }}
          tool={selectedAsset as any}
          onSuccess={() => {
            refetch();
            setShowCheckinDialog(false);
            setSelectedAsset(null);
          }}
        />
      )}

      {/* Issue Report Dialog */}
      {selectedAsset && selectedAsset.type === 'asset' && (
        <IssueReportDialog
          open={showIssueDialog}
          onOpenChange={() => {
            setShowIssueDialog(false);
            setSelectedAsset(null);
          }}
          tool={selectedAsset as any}
          onSuccess={() => {
            refetch();
            setShowIssueDialog(false);
            setSelectedAsset(null);
          }}
        />
      )}

      {/* Removal Dialog */}
      {selectedAsset && selectedAsset.type === 'asset' && (
        <ToolRemovalDialog
          open={showRemovalDialog}
          onOpenChange={() => {
            setShowRemovalDialog(false);
            setSelectedAsset(null);
          }}
          tool={selectedAsset as any}
          onConfirm={handleConfirmRemoval}
        />
      )}
    </div>
  );
};