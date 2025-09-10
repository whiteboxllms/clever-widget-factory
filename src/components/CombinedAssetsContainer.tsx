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
import { EditToolForm } from "./tools/forms/EditToolForm";
import { InventoryItemForm } from "./InventoryItemForm";
import { ToolDetails } from "./tools/ToolDetails";
import { useCombinedAssets, CombinedAsset } from "@/hooks/useCombinedAssets";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useToolHistory } from "@/hooks/tools/useToolHistory";
import { useToolIssues } from "@/hooks/useToolIssues";
import { supabase } from "@/integrations/supabase/client";

export const CombinedAssetsContainer = () => {
  const navigate = useNavigate();
  const { user, canEditTools, isAdmin } = useAuth();
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
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<CombinedAsset | null>(null);

  const { assets, loading, createAsset, updateAsset, refetch } = useCombinedAssets(showRemovedItems);
  
  // Tool history and issues for view dialog
  const { toolHistory, currentCheckout, fetchToolHistory } = useToolHistory();
  const { issues, fetchIssues } = useToolIssues(
    selectedAsset?.type === 'asset' ? selectedAsset.id : null
  );

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
    setSelectedAsset(asset);
    setShowViewDialog(true);
    // Fetch additional data for view dialog if it's an asset
    if (asset.type === 'asset') {
      fetchToolHistory(asset.id);
      fetchIssues();
    }
  };

  const handleEdit = (asset: CombinedAsset) => {
    setSelectedAsset(asset);
    setShowEditDialog(true);
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

  const handleEditSubmit = async (toolData: any) => {
    if (!selectedAsset) return;

    try {
      await updateAsset(selectedAsset.id, toolData, selectedAsset.type === 'asset');
      await refetch();
      setShowEditDialog(false);
      setSelectedAsset(null);
      toast({
        title: "Success",
        description: `${selectedAsset.type === 'asset' ? 'Asset' : 'Stock item'} updated successfully`,
      });
    } catch (error) {
      console.error('Error updating item:', error);
      toast({
        title: "Error",
        description: `Failed to update ${selectedAsset.type === 'asset' ? 'asset' : 'stock item'}`,
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
        canEdit={canEditTools}
        isAdmin={isAdmin}
        currentUserId={user?.id}
        currentUserEmail={user?.email}
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

      {/* Edit Tool Dialog */}
      {selectedAsset && selectedAsset.type === 'asset' && (
        <EditToolForm
          tool={selectedAsset as any}
          isOpen={showEditDialog}
          onClose={() => {
            setShowEditDialog(false);
            setSelectedAsset(null);
          }}
          onSubmit={handleEditSubmit}
        />
      )}

      {/* Edit Stock Item Dialog */}
      {selectedAsset && selectedAsset.type === 'stock' && showEditDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">Edit Stock Item</h2>
            <InventoryItemForm
              initialData={{
                name: selectedAsset.name || '',
                description: selectedAsset.description || '',
                current_quantity: selectedAsset.current_quantity || 0,
                minimum_quantity: selectedAsset.minimum_quantity || 0,
                unit: selectedAsset.unit || 'pieces',
                cost_per_unit: (selectedAsset.cost_per_unit || 0).toString(),
                cost_evidence_url: selectedAsset.cost_evidence_url || '',
                storage_vicinity: selectedAsset.storage_vicinity || '',
                storage_location: selectedAsset.storage_location || ''
              }}
              editingPart={selectedAsset as any}
              selectedImage={null}
              setSelectedImage={() => {}}
              onSubmit={(data, useMinimumQuantity) => {
                handleEditSubmit(data);
              }}
              onCancel={() => {
                setShowEditDialog(false);
                setSelectedAsset(null);
              }}
              isLoading={false}
              submitButtonText="Update Stock Item"
            />
          </div>
        </div>
      )}

      {/* View Asset Dialog */}
      {selectedAsset && selectedAsset.type === 'asset' && showViewDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto m-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Asset Details</h2>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowViewDialog(false);
                    setSelectedAsset(null);
                  }}
                >
                  Close
                </Button>
              </div>
              <ToolDetails
                tool={selectedAsset as any}
                toolHistory={toolHistory}
                currentCheckout={currentCheckout}
                issues={issues}
                onBack={() => {
                  setShowViewDialog(false);
                  setSelectedAsset(null);
                }}
                onResolveIssue={() => {}}
                onEditIssue={() => {}}
                onRefresh={() => {
                  if (selectedAsset) {
                    fetchToolHistory(selectedAsset.id);
                    fetchIssues();
                    refetch();
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* View Stock Item Dialog */}
      {selectedAsset && selectedAsset.type === 'stock' && showViewDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Stock Item Details</h2>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowViewDialog(false);
                    setSelectedAsset(null);
                  }}
                >
                  Close
                </Button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-medium">Basic Information</h3>
                    <div className="mt-2 space-y-2 text-sm">
                      <div><span className="font-medium">Name:</span> {selectedAsset.name}</div>
                      <div><span className="font-medium">Description:</span> {selectedAsset.description || 'N/A'}</div>
                      <div><span className="font-medium">Category:</span> {selectedAsset.category || 'N/A'}</div>
                      <div><span className="font-medium">Unit:</span> {selectedAsset.unit || 'pieces'}</div>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-medium">Inventory Information</h3>
                    <div className="mt-2 space-y-2 text-sm">
                      <div><span className="font-medium">Current Quantity:</span> {selectedAsset.current_quantity || 0}</div>
                      <div><span className="font-medium">Minimum Quantity:</span> {selectedAsset.minimum_quantity || 0}</div>
                      <div><span className="font-medium">Cost per Unit:</span> {selectedAsset.cost_per_unit ? `$${selectedAsset.cost_per_unit}` : 'N/A'}</div>
                      <div><span className="font-medium">Supplier:</span> {selectedAsset.supplier || 'N/A'}</div>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="font-medium">Storage Information</h3>
                  <div className="mt-2 space-y-2 text-sm">
                    <div><span className="font-medium">Storage Vicinity:</span> {selectedAsset.storage_vicinity || 'N/A'}</div>
                    <div><span className="font-medium">Storage Location:</span> {selectedAsset.storage_location || 'N/A'}</div>
                  </div>
                </div>
                {selectedAsset.image_url && (
                  <div>
                    <h3 className="font-medium">Image</h3>
                    <img 
                      src={selectedAsset.image_url} 
                      alt={selectedAsset.name}
                      className="mt-2 max-w-xs rounded-lg"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};