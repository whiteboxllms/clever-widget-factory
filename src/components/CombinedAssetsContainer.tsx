import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { apiService } from '@/lib/apiService';
import { useAssetMutations } from '@/hooks/useAssetMutations';
import { ArrowLeft, Plus, BarChart3 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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
import { useAuth } from "@/hooks/useCognitoAuth";
import { useToast } from "@/hooks/use-toast";
import { useToolHistory } from "@/hooks/tools/useToolHistory";
import { useToolIssues } from "@/hooks/useGenericIssues";
import { useInventoryIssues } from "@/hooks/useGenericIssues";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { useImageUpload } from "@/hooks/useImageUpload";
import { useOrganizationMembers } from "@/hooks/useOrganizationMembers";


export const CombinedAssetsContainer = () => {
  const navigate = useNavigate();
  const { user, canEditTools, isAdmin } = useAuth();
  const { toast } = useToast();
  const { updatePart, updateTool, createPartsHistory, deletePart } = useAssetMutations();
  const organizationId = useOrganizationId();
  const { uploadImages, isUploading } = useImageUpload();
  const [searchTerm, setSearchTerm] = useState("");
  const [showMyCheckedOut, setShowMyCheckedOut] = useState(false);
  const [showWithIssues, setShowWithIssues] = useState(false);
  const [showLowStock, setShowLowStock] = useState(false);
  const [showOnlyAssets, setShowOnlyAssets] = useState(false);
  const [showOnlyStock, setShowOnlyStock] = useState(false);
  const [showRemovedItems, setShowRemovedItems] = useState(false);
  const [searchDescriptions, setSearchDescriptions] = useState(false);
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

  // Image state for stock editing
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [stockAttachments, setStockAttachments] = useState<string[]>([]);

  const [page, setPage] = useState(0);
  const [limit] = useState(50);
  const searchRef = useRef(searchTerm);
  const debounceTimerRef = useRef<number | undefined>(undefined);
  const { assets, loading, createAsset, updateAsset, refetch, fetchAssets } = useCombinedAssets(showRemovedItems, {
    search: searchTerm,
    limit,
    page,
    searchDescriptions,
    showLowStock
  });
  const { members: organizationMembers } = useOrganizationMembers();
  const checkoutDisplayNameMap = useMemo(() => {
    const map = new Map<string, string>();
    organizationMembers.forEach(member => {
      if (member.user_id) {
        map.set(member.user_id, member.full_name);
      }
      if (member.id && !map.has(member.id)) {
        map.set(member.id, member.full_name);
      }
    });
    return map;
  }, [organizationMembers]);


  useEffect(() => {
    // Mark container mount once; avoid console.time duplicate label warnings on re-render
    performance.mark('container_mount');
  }, []);
  
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
        const result = await apiService.get('/parts_orders');

        // Ensure orders is an array
        const orders = Array.isArray(result) ? result : (result?.data || []);

        // Group orders by part_id
        const ordersByPart: Record<string, any[]> = {};
        orders.forEach(order => {
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

  // Consolidated effect to handle all filter changes and prevent race conditions
  useEffect(() => {
    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = window.setTimeout(() => {
      const term = searchTerm.trim();
      if (term !== searchRef.current) {
        searchRef.current = term;
      }
      // Reset to page 0 when filters change
      if (page !== 0) {
        setPage(0);
      }
      fetchAssets({
        search: searchRef.current,
        page: 0,
        limit,
        append: false,
        searchDescriptions,
        showLowStock
      });
    }, 250);
    return () => {
      if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    };
  }, [searchTerm, showRemovedItems, searchDescriptions, showLowStock]);

  // Filter assets based on current filters
  const filteredAssets = useMemo(() => {
    // Skip filtering during loading to prevent flicker
    if (loading && assets.length === 0) return [];
    
    if (showMyCheckedOut) {
      console.log('=== MY CHECKED OUT FILTER (Combined Assets) ===');
      console.log('User ID:', user?.id);
      console.log('Total assets:', assets.length);
      console.log('Assets (not stock):', assets.filter(a => a.type === 'asset').length);
      console.log('Checked out assets:', assets.filter(a => a.type === 'asset' && a.is_checked_out).map(a => ({
        name: a.name,
        is_checked_out: a.is_checked_out,
        checked_out_user_id: a.checked_out_user_id,
        matches: a.checked_out_user_id === user?.id
      })));
    }
    
    return assets.filter(asset => {
      // Type filters
      if (showOnlyAssets && asset.type !== 'asset') return false;
      if (showOnlyStock && asset.type !== 'stock') return false;

      // My checked out filter - only applies to assets
      if (showMyCheckedOut) {
        if (asset.type !== 'asset') return false;
        if (!asset.is_checked_out || asset.checked_out_user_id !== user?.id) return false;
      }

      // Issues filter
      if (showWithIssues && !asset.has_issues) return false;

      // Note: Search and low stock filters are handled in useCombinedAssets hook

      return true;
    });
  }, [assets, showOnlyAssets, showOnlyStock, showMyCheckedOut, showWithIssues, user?.id, loading]);

  const handleCreateAsset = async (assetData: any, isAsset: boolean) => {
    const result = await createAsset(assetData, isAsset);
    if (result) {
      await refetch();
    }
    return result;
  };

  const handleView = useCallback((asset: CombinedAsset) => {
    setSelectedAsset(asset);
    setShowViewDialog(true);
    // Fetch additional data for view dialog if it's an asset
    if (asset.type === 'asset') {
      fetchToolHistory(asset.id);
      fetchAssetIssues();
    }
  }, [fetchToolHistory, fetchAssetIssues]);

  const handleEdit = useCallback((asset: CombinedAsset) => {
    setSelectedAsset(asset);
    // Initialize attachments with existing image if available
    if (asset.type === 'stock' && asset.image_url) {
      setStockAttachments([asset.image_url]);
    } else {
      setStockAttachments([]);
    }
    setShowEditDialog(true);
  }, []);

  const handleRemove = useCallback((asset: CombinedAsset) => {
    setSelectedAsset(asset);
    setShowRemovalDialog(true);
  }, []);

  const handleCheckout = useCallback((asset: CombinedAsset) => {
    setSelectedAsset(asset);
    setShowCheckoutDialog(true);
  }, []);

  const handleCheckin = useCallback((asset: CombinedAsset) => {
    setSelectedAsset(asset);
    setShowCheckinDialog(true);
  }, []);

  const handleManageIssues = useCallback((asset: CombinedAsset) => {
    setSelectedAsset(asset);
    setShowIssueDialog(true);
  }, []);

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
  const handleAddQuantity = useCallback((asset: CombinedAsset) => {
    setSelectedAsset(asset);
    setQuantityOperation('add');
    setShowQuantityDialog(true);
  }, []);

  const handleUseQuantity = useCallback((asset: CombinedAsset) => {
    setSelectedAsset(asset);
    setQuantityOperation('remove');
    setShowQuantityDialog(true);
  }, []);

  const handleOrderStock = useCallback((asset: CombinedAsset) => {
    setSelectedAsset(asset);
    setShowOrderDialog(true);
  }, []);

  const handleReceiveOrder = useCallback((asset: CombinedAsset) => {
    const orders = pendingOrders[asset.id];
    if (orders && orders.length > 0) {
      setSelectedAsset(asset);
      setShowReceivingDialog(true);
    }
  }, [pendingOrders]);

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
      await updatePart.mutateAsync({ id: selectedAsset.id, data: { current_quantity: newQuantity } });

      // Log the change to history
      try {
        // Log the change to history via API
        await createPartsHistory.mutateAsync({
          part_id: selectedAsset.id,
          change_type: quantityOperation === 'add' ? 'quantity_add' : 'quantity_remove',
          old_quantity: currentQty,
          new_quantity: newQuantity,
          quantity_change: quantityOperation === 'add' ? change : -change,
          change_reason: quantityChange.reason || `Quantity ${quantityOperation}ed`,
          supplier_name: quantityChange.supplierName || null,
          supplier_url: quantityChange.supplierUrl || null
        });
        console.log('History entry created successfully');
      } catch (historyError) {
        console.error('History logging failed:', historyError);
      }

      // Note: inventory_usage table doesn't exist - usage is tracked in parts_history above

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
      if (selectedAsset.type === 'asset') {
        // For assets, set status to 'removed'
        await updateTool.mutateAsync({ id: selectedAsset.id, data: { status: 'removed' } });
      } else {
        // For stock items, delete the record like the inventory page
        await deletePart.mutateAsync(selectedAsset.id);
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
      // Convert attachments array to image_url for database compatibility
      const imageUrl = stockAttachments.length > 0 ? stockAttachments[0] : selectedAsset.image_url;

      // Same data conversion as original Inventory page updatePart function
      const updateData = {
        name: formData.name,
        description: formData.description,
        current_quantity: formData.current_quantity,
        minimum_quantity: useMinimumQuantity ? formData.minimum_quantity : null,
        cost_per_unit: formData.cost_per_unit ? parseFloat(formData.cost_per_unit) : null,
        unit: formData.unit,
        parent_structure_id: formData.parent_structure_id,
        storage_location: formData.storage_location,
        accountable_person_id: formData.accountable_person_id === "none" ? null : formData.accountable_person_id,
        image_url: imageUrl
      };

      await updateAsset(selectedAsset.id, updateData, false);
      await refetch();
      setShowEditDialog(false);
      setSelectedImage(null); // Reset image state
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

  // Do not early-return on loading; keep previous results visible and show a small indicator
  if (loading) {
    performance.mark('loading_ui_shown');
  }

  // Show asset detail view if selectedAssetForDetails is set
  if (selectedAssetForDetails) {
    if (selectedAssetForDetails.type === 'asset') {
      return (
        <ToolDetails
          tool={selectedAssetForDetails as any}
          toolHistory={toolHistory}
          currentCheckout={null} // TODO: Add current checkout logic if needed
          onBack={handleBackToAssets}
        />
      );
    } else if (selectedAssetForDetails.type === 'stock') {
      return (
        <StockDetails
          stock={selectedAssetForDetails as any}
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
      {(() => { performance.mark('container_first_paint'); return null; })()}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
            {loading && (
              <p className="text-xs text-muted-foreground">Loading…</p>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/inventory/summary')}
          className="flex items-center gap-2 self-start sm:self-auto"
        >
          <BarChart3 className="h-4 w-4" />
          Summary
        </Button>
      </div>

      {/* Filters */}
      <CombinedAssetFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        searchDescriptions={searchDescriptions}
        setSearchDescriptions={setSearchDescriptions}
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
        userNameMap={checkoutDisplayNameMap}
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
        // Infinite scroll props
        onLoadMore={() => {
          if (!loading) {
            const nextPage = page + 1;
            setPage(nextPage);
            fetchAssets({ page: nextPage, limit, search: searchRef.current, append: true, searchDescriptions, showLowStock });
          }
        }}
        hasMore={!loading && assets.length >= (page + 1) * limit}
        loading={loading}
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

      {/* Removal Dialogs */}
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

      {selectedAsset && selectedAsset.type === 'stock' && (
        <AlertDialog
          open={showRemovalDialog}
          onOpenChange={(open) => {
            if (!open) {
              setShowRemovalDialog(false);
              setSelectedAsset(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Stock Item</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{selectedAsset.name}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleConfirmRemoval('', '')}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Edit Tool Dialog */}
      {selectedAsset && selectedAsset.type === 'asset' && (
        <EditToolForm
          tool={selectedAsset as any}
          isOpen={showEditDialog}
          onClose={() => {
            setShowEditDialog(false);
            setSelectedAsset(null);
            setSelectedImage(null); // Reset image state when closing
          }}
          onSubmit={handleEditSubmit}
          isLeadership={isAdmin}
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
                parent_structure_id: selectedAsset.parent_structure_id || '',
                storage_location: selectedAsset.storage_location || '',
                accountable_person_id: selectedAsset.accountable_person_id || ''
              }}
              editingPart={selectedAsset as any}
              attachments={stockAttachments}
              onAttachmentsChange={setStockAttachments}
              onSubmit={handleStockEditSubmit}
              onCancel={() => {
                setShowEditDialog(false);
                setSelectedAsset(null);
                setStockAttachments([]); // Reset attachments when canceling
              }}
              isLoading={isUploading}
              submitButtonText="Update Stock Item"
              isLeadership={isAdmin}
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
                onBack={() => {
                  setShowViewDialog(false);
                  setSelectedAsset(null);
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