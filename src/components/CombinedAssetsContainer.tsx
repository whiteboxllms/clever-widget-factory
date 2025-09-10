import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CombinedAssetFilters } from "./CombinedAssetFilters";
import { CombinedAssetGrid } from "./CombinedAssetGrid";
import { CombinedAssetDialog } from "./CombinedAssetDialog";
import { ToolCheckoutDialog } from "./ToolCheckoutDialog";
import { ToolCheckInDialog } from "./ToolCheckInDialog";
import { IssueReportDialog } from "./IssueReportDialog";
import { CreateIssueDialog } from "./CreateIssueDialog";
import { ToolRemovalDialog } from "./tools/ToolRemovalDialog";
import { EditToolForm } from "./tools/forms/EditToolForm";
import { InventoryItemForm } from "./InventoryItemForm";
import { ToolDetails } from "./tools/ToolDetails";
import { StockDetails } from "./StockDetails";
import { OrderDialog } from "./OrderDialog";
import { ReceivingDialog } from "./ReceivingDialog";
import { useCombinedAssets, CombinedAsset } from "@/hooks/useCombinedAssets";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useToolHistory } from "@/hooks/tools/useToolHistory";
import { useToolIssues } from "@/hooks/useToolIssues";
import { useInventoryIssues } from "@/hooks/useGenericIssues";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { supabase } from "@/integrations/supabase/client";

export const CombinedAssetsContainer = () => {
  const navigate = useNavigate();
  const { user, canEditTools, isAdmin } = useAuth();
  const { toast } = useToast();
  const organizationId = useOrganizationId();
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
  const [selectedAssetForDetails, setSelectedAssetForDetails] = useState<CombinedAsset | null>(null);
  
  // Stock dialog states
  const [showQuantityDialog, setShowQuantityDialog] = useState(false);
  const [quantityOperation, setQuantityOperation] = useState<'add' | 'remove'>('add');
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [showReceivingDialog, setShowReceivingDialog] = useState(false);
  const [pendingOrders, setPendingOrders] = useState<Record<string, any[]>>({});
  const [quantityChange, setQuantityChange] = useState({
    amount: '',
    reason: '',
    supplierName: '',
    supplierUrl: ''
  });

  const { assets, loading, createAsset, updateAsset, refetch } = useCombinedAssets(showRemovedItems);
  
  // Tool history and issues for view dialog
  const { toolHistory, currentCheckout, fetchToolHistory } = useToolHistory();
  const { issues: assetIssues, fetchIssues: fetchAssetIssues } = useToolIssues(
    selectedAssetForDetails?.type === 'asset' ? selectedAssetForDetails.id : null
  );
  const { issues: stockIssues, fetchIssues: fetchStockIssues } = useInventoryIssues(
    selectedAssetForDetails?.type === 'stock' ? selectedAssetForDetails.id : null
  );
  
  // Get appropriate issues based on selected asset type
  const issues = selectedAssetForDetails?.type === 'asset' ? assetIssues : stockIssues;

  // Fetch pending orders for stock items
  useEffect(() => {
    const fetchPendingOrders = async () => {
      try {
        const { data: orders, error } = await supabase
          .from('parts_orders')
          .select('*')
          .in('status', ['pending', 'partially_received'])
          .order('ordered_at', { ascending: false });

        if (error) throw error;

        // Group orders by part_id
        const ordersByPart: Record<string, any[]> = {};
        (orders || []).forEach(order => {
          if (!ordersByPart[order.part_id]) {
            ordersByPart[order.part_id] = [];
          }
          ordersByPart[order.part_id].push(order);
        });

        setPendingOrders(ordersByPart);
      } catch (error) {
        console.error('Error fetching pending orders:', error);
      }
    };

    fetchPendingOrders();
  }, []);

  // Filter assets based on current filters
  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
      // Search filter
      const matchesSearch = 
        asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (asset.serial_number && asset.serial_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (asset.description && asset.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (asset.storage_location && asset.storage_location.toLowerCase().includes(searchTerm.toLowerCase()));

      // Type filters
      if (showOnlyAssets && asset.type !== 'asset') return false;
      if (showOnlyStock && asset.type !== 'stock') return false;

      // My checked out filter
      if (showMyCheckedOut && (!asset.is_checked_out || asset.checked_out_user_id !== user?.id)) return false;

      // Issues filter
      if (showWithIssues && !asset.has_issues) return false;

      // Low stock filter
      if (showLowStock) {
        if (asset.type !== 'stock') return false;
        const isLowStock = asset.minimum_quantity !== null && 
                          asset.minimum_quantity > 0 && 
                          asset.current_quantity < asset.minimum_quantity;
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
      fetchAssetIssues();
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

  const handleManageIssues = (asset: CombinedAsset) => {
    setSelectedAsset(asset);
    setShowIssueDialog(true);
  };

  const handleShowAssetDetails = (asset: CombinedAsset) => {
    // This should behave like clicking on the asset card - go to detail view
    setSelectedAssetForDetails(asset);
    if (asset.type === 'asset') {
      fetchToolHistory(asset.id);
      fetchAssetIssues();
    } else {
      fetchStockIssues();
    }
  };

  const handleBackToAssets = () => {
    setSelectedAssetForDetails(null);
  };

  // Stock quantity handlers
  const handleAddQuantity = (asset: CombinedAsset) => {
    setSelectedAsset(asset);
    setQuantityOperation('add');
    setShowQuantityDialog(true);
  };

  const handleUseQuantity = (asset: CombinedAsset) => {
    setSelectedAsset(asset);
    setQuantityOperation('remove');
    setShowQuantityDialog(true);
  };

  const handleOrderStock = (asset: CombinedAsset) => {
    setSelectedAsset(asset);
    setShowOrderDialog(true);
  };

  const handleReceiveOrder = (asset: CombinedAsset) => {
    const orders = pendingOrders[asset.id];
    if (orders && orders.length > 0) {
      setSelectedAsset(asset);
      setShowReceivingDialog(true);
    }
  };

  // Quantity update handler for stock items
  const updateQuantity = async () => {
    if (!selectedAsset || !quantityChange.amount || !user) return;

    try {
      const change = parseFloat(quantityChange.amount);
      const currentQty = selectedAsset.current_quantity || 0;
      const newQuantity = quantityOperation === 'add' ? currentQty + change : currentQty - change;

      if (newQuantity < 0) {
        toast({
          title: "Error",
          description: "Quantity cannot be negative",
          variant: "destructive",
        });
        return;
      }

      // Update the parts table
      const { error } = await supabase
        .from('parts')
        .update({ current_quantity: newQuantity })
        .eq('id', selectedAsset.id);

      if (error) throw error;

      // Log the change to history
      try {
        const { error: historyError } = await supabase
          .from('parts_history')
          .insert([{
            part_id: selectedAsset.id,
            change_type: quantityOperation,
            old_quantity: currentQty,
            new_quantity: newQuantity,
            quantity_change: quantityOperation === 'add' ? change : -change,
            changed_by: user.id,
            change_reason: quantityChange.reason || `Quantity ${quantityOperation}ed`,
            supplier_name: quantityChange.supplierName || null,
            supplier_url: quantityChange.supplierUrl || null,
            organization_id: organizationId
          }]);

        if (historyError) {
          console.error('Error logging history:', historyError);
        }
      } catch (historyError) {
        console.error('History logging failed:', historyError);
      }

      toast({
        title: "Success",
        description: `Quantity ${quantityOperation === 'add' ? 'increased' : 'decreased'} successfully`,
      });

      setShowQuantityDialog(false);
      setSelectedAsset(null);
      setQuantityChange({ amount: '', reason: '', supplierName: '', supplierUrl: '' });
      refetch();
    } catch (error) {
      console.error('Error updating quantity:', error);
      toast({
        title: "Error",
        description: "Failed to update quantity",
        variant: "destructive",
      });
    }
  };

  const handleConfirmRemoval = async (reason: string, notes: string) => {
    if (!selectedAsset) return;

    try {
      const table = selectedAsset.type === 'asset' ? 'tools' : 'parts';
      
      if (selectedAsset.type === 'asset') {
        // For assets, set status to 'removed'
        const { error } = await supabase
          .from('tools')
          .update({ status: 'removed' })
          .eq('id', selectedAsset.id);

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

  const handleEditSubmit = async (toolId: string, toolData: any) => {
    if (!selectedAsset) return;

    try {
      await updateAsset(toolId, toolData, selectedAsset.type === 'asset');
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

  // Reuse the exact data conversion logic from the original Inventory page
  const handleStockEditSubmit = async (formData: any, useMinimumQuantity: boolean) => {
    if (!selectedAsset || selectedAsset.type !== 'stock') return;

    try {
      // Same data conversion as original Inventory page updatePart function
      const updateData = {
        name: formData.name,
        description: formData.description,
        current_quantity: formData.current_quantity,
        minimum_quantity: useMinimumQuantity ? formData.minimum_quantity : null,
        cost_per_unit: formData.cost_per_unit ? parseFloat(formData.cost_per_unit) : null,
        unit: formData.unit,
        storage_vicinity: formData.storage_vicinity,
        storage_location: formData.storage_location,
        image_url: formData.image_url
      };

      await updateAsset(selectedAsset.id, updateData, false);
      await refetch();
      setShowEditDialog(false);
      setSelectedAsset(null);
      toast({
        title: "Success",
        description: "Stock item updated successfully",
      });
    } catch (error) {
      console.error('Error updating stock item:', error);
      toast({
        title: "Error",
        description: "Failed to update stock item",
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

  // Show asset detail view if selectedAssetForDetails is set
  if (selectedAssetForDetails) {
    if (selectedAssetForDetails.type === 'asset') {
      return (
        <ToolDetails
          tool={selectedAssetForDetails as any}
          toolHistory={toolHistory}
          currentCheckout={null} // TODO: Add current checkout logic if needed
          issues={issues}
          onBack={handleBackToAssets}
          onResolveIssue={(issue) => {
            // Handle issue resolution
          }}
          onEditIssue={(issue) => {
            // Handle issue editing
          }}
          onRefresh={() => {
            fetchToolHistory(selectedAssetForDetails.id);
          }}
        />
      );
    } else if (selectedAssetForDetails.type === 'stock') {
      return (
        <StockDetails
          stock={selectedAssetForDetails as any}
          stockHistory={[]} // TODO: Add stock history hook
          issues={issues}
          onBack={handleBackToAssets}
          onResolveIssue={(issue) => {
            // Handle issue resolution
          }}
          onEditIssue={(issue) => {
            // Handle issue editing
          }}
          onRefresh={() => {
            // Refresh stock data
          }}
        />
      );
    }
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
            Add
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
            onView={handleShowAssetDetails}
            onEdit={handleEdit}
            onRemove={handleRemove}
            onCheckout={handleCheckout}
            onCheckin={handleCheckin}
            onReportIssue={handleManageIssues}
            onManageIssues={handleManageIssues}
            onAddQuantity={handleAddQuantity}
            onUseQuantity={handleUseQuantity}
            onOrderStock={handleOrderStock}
            onReceiveOrder={handleReceiveOrder}
        pendingOrders={pendingOrders}
      />

      {/* Add Asset Dialog */}
      <CombinedAssetDialog
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onSubmit={handleCreateAsset}
        initialName={searchTerm}
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

      {/* Unified Issue Dialog for both assets and stock */}
      {selectedAsset && (
        <IssueReportDialog
          open={showIssueDialog}
          onOpenChange={() => {
            setShowIssueDialog(false);
            setSelectedAsset(null);
          }}
          asset={selectedAsset}
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
      {selectedAsset && selectedAsset.type === 'stock' && (
        <Dialog open={showEditDialog} onOpenChange={(open) => {
          if (!open) {
            setShowEditDialog(false);
            setSelectedAsset(null);
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Stock Item</DialogTitle>
              <DialogDescription>
                Update the details for this stock item.
              </DialogDescription>
            </DialogHeader>
            <InventoryItemForm
              initialData={{
                name: selectedAsset.name || '',
                description: selectedAsset.description || '',
                current_quantity: selectedAsset.current_quantity || 0,
                minimum_quantity: selectedAsset.minimum_quantity || 0,
                unit: selectedAsset.unit || 'pieces',
                cost_per_unit: (selectedAsset.cost_per_unit || 0).toString(),
                storage_vicinity: selectedAsset.storage_vicinity || '',
                storage_location: selectedAsset.storage_location || ''
              }}
              editingPart={selectedAsset as any}
              selectedImage={null}
              setSelectedImage={() => {}}
              onSubmit={handleStockEditSubmit}
              onCancel={() => {
                setShowEditDialog(false);
                setSelectedAsset(null);
              }}
              isLoading={false}
              submitButtonText="Update Stock Item"
            />
          </DialogContent>
        </Dialog>
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
                    fetchAssetIssues();
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

      {/* Quantity Dialog */}
      <Dialog open={showQuantityDialog} onOpenChange={setShowQuantityDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {quantityOperation === 'add' ? 'Add Quantity' : 'Use/Remove Quantity'}
            </DialogTitle>
            <DialogDescription>
              {selectedAsset && (
                <>
                  {quantityOperation === 'add' ? 'Add to' : 'Remove from'} {selectedAsset.name}
                  <br />
                  Current quantity: {selectedAsset.current_quantity} {selectedAsset.unit || 'units'}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                value={quantityChange.amount}
                onChange={(e) => setQuantityChange(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="Enter amount"
                min="0"
                step="0.01"
              />
            </div>

            <div>
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                value={quantityChange.reason}
                onChange={(e) => setQuantityChange(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Reason for change"
              />
            </div>

            {quantityOperation === 'add' && (
              <>
                <div>
                  <Label htmlFor="supplierName">Supplier Name (Optional)</Label>
                  <Input
                    id="supplierName"
                    value={quantityChange.supplierName}
                    onChange={(e) => setQuantityChange(prev => ({ ...prev, supplierName: e.target.value }))}
                    placeholder="Supplier name"
                  />
                </div>

                <div>
                  <Label htmlFor="supplierUrl">Supplier URL (Optional)</Label>
                  <Input
                    id="supplierUrl"
                    value={quantityChange.supplierUrl}
                    onChange={(e) => setQuantityChange(prev => ({ ...prev, supplierUrl: e.target.value }))}
                    placeholder="https://example.com/product-page"
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowQuantityDialog(false)}>
              Cancel
            </Button>
            <Button onClick={updateQuantity} disabled={!quantityChange.amount}>
              {quantityOperation === 'add' ? 'Add to' : 'Remove from'} Stock
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Order Dialog */}
      {selectedAsset && selectedAsset.type === 'stock' && (
        <OrderDialog
          isOpen={showOrderDialog}
          onClose={() => {
            setShowOrderDialog(false);
            setSelectedAsset(null);
          }}
          partId={selectedAsset.id}
          partName={selectedAsset.name}
          onOrderCreated={() => {
            // Refresh pending orders after creating an order
            refetch();
          }}
        />
      )}

      {/* Receiving Dialog */}
      {selectedAsset && selectedAsset.type === 'stock' && (
        <ReceivingDialog
          isOpen={showReceivingDialog}
          onClose={() => {
            setShowReceivingDialog(false);
            setSelectedAsset(null);
          }}
          order={pendingOrders[selectedAsset.id]?.[0] || null}
          part={selectedAsset as any}
          onSuccess={() => {
            refetch();
            setShowReceivingDialog(false);
            setSelectedAsset(null);
          }}
        />
      )}
    </div>
  );
};