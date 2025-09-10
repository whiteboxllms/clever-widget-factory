import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { CombinedAssetFilters } from "./CombinedAssetFilters";
import { CombinedAssetGrid } from "./CombinedAssetGrid";
import { CombinedAssetDialog } from "./CombinedAssetDialog";
import { ToolCheckoutDialog } from "./ToolCheckoutDialog";
import { ToolCheckInDialog } from "./ToolCheckInDialog";
import { IssueReportDialog } from "./IssueReportDialog";
import { EditToolForm } from "./tools/forms/EditToolForm";
import { InventoryItemForm } from "./InventoryItemForm";
import { OrderDialog } from "./OrderDialog";
import { ReceivingDialog } from "./ReceivingDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToolDetails } from "./tools/ToolDetails";
import { StockDetails } from "./StockDetails";
import { SearchPrompt } from "./SearchPrompt";
import { useCombinedAssets } from "@/hooks/useCombinedAssets";
import { useDebounce } from "@/hooks/useDebounce";
import { useAuth } from "@/hooks/useAuth";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { useToast } from "@/hooks/use-toast";
import { useToolHistory } from "@/hooks/tools/useToolHistory";
import { useToolIssues } from "@/hooks/useToolIssues";
import { useInventoryIssues } from "@/hooks/useGenericIssues";
import { supabase } from "@/integrations/supabase/client";
import type { CombinedAsset } from "@/hooks/useCombinedAssets";

export const CombinedAssetsContainer = () => {
  const navigate = useNavigate();
  const { user, canEditTools, isAdmin } = useAuth();
  const { toast } = useToast();
  const organizationId = useOrganizationId();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [showMyCheckedOut, setShowMyCheckedOut] = useState(false);
  const [showWithIssues, setShowWithIssues] = useState(false);
  const [showLowStock, setShowLowStock] = useState(false);
  const [showOnlyAssets, setShowOnlyAssets] = useState(false);
  const [showOnlyStock, setShowOnlyStock] = useState(false);
  const [showRemovedItems, setShowRemovedItems] = useState(false);
  
  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showCheckoutDialog, setShowCheckoutDialog] = useState(false);
  const [showCheckinDialog, setShowCheckinDialog] = useState(false);
  const [showIssueDialog, setShowIssueDialog] = useState(false);
  const [showRemovalDialog, setShowRemovalDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showQuantityDialog, setShowQuantityDialog] = useState(false);
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [showReceivingDialog, setShowReceivingDialog] = useState(false);
  
  // Selected asset states
  const [selectedAsset, setSelectedAsset] = useState<CombinedAsset | null>(null);
  const [selectedAssetForDetails, setSelectedAssetForDetails] = useState<CombinedAsset | null>(null);
  const [quantityChangeDetails, setQuantityChangeDetails] = useState<{
    type: 'add' | 'remove';
    quantity: number;
    reason: string;
  }>({ type: 'add', quantity: 0, reason: '' });
  
  // Pending orders state
  const [pendingOrders, setPendingOrders] = useState<Record<string, any[]>>({});

  // Use the search-first assets hook
  const { 
    assets, 
    loading, 
    hasSearched, 
    totalCount, 
    searchAssets, 
    resetSearch, 
    createAsset, 
    updateAsset, 
    refetch 
  } = useCombinedAssets(showRemovedItems, debouncedSearchTerm);

  // Tool history and issues hooks
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

  // Only search when we have at least 3 characters
  useEffect(() => {
    if (debouncedSearchTerm.length >= 3) {
      searchAssets(debouncedSearchTerm);
    } else if (hasSearched && debouncedSearchTerm.length === 0) {
      resetSearch();
    }
  }, [debouncedSearchTerm, searchAssets, resetSearch, hasSearched, showRemovedItems]);

  // Apply client-side filters to assets
  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
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

      return true;
    });
  }, [assets, showOnlyAssets, showOnlyStock, showMyCheckedOut, showWithIssues, showLowStock, user?.id, hasSearched, debouncedSearchTerm]);

  const handleCreateAsset = async (assetData: any, isAsset: boolean) => {
    const result = await createAsset(assetData, isAsset);
    if (result) {
      await refetch();
    }
    return result;
  };

  const handleView = (asset: CombinedAsset) => {
    setSelectedAsset(asset);
    setSelectedAssetForDetails(asset);
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

  const handleQuantityChange = (asset: CombinedAsset, type: 'add' | 'remove') => {
    setSelectedAsset(asset);
    setQuantityChangeDetails({ type, quantity: 0, reason: '' });
    setShowQuantityDialog(true);
  };

  const handleOrder = (asset: CombinedAsset) => {
    setSelectedAsset(asset);
    setShowOrderDialog(true);
  };

  const updateQuantity = async (type: 'add' | 'remove', quantity: number, reason: string) => {
    if (!selectedAsset || selectedAsset.type !== 'stock') return false;

    try {
      const currentQuantity = selectedAsset.current_quantity || 0;
      const change = type === 'add' ? quantity : -quantity;
      const newQuantity = Math.max(0, currentQuantity + change);

      // Update the part quantity
      const { error } = await supabase
        .from('parts')
        .update({ current_quantity: newQuantity })
        .eq('id', selectedAsset.id);

      if (error) throw error;

      // Log the change in parts_history
      const { error: historyError } = await supabase
        .from('parts_history')
        .insert({
          part_id: selectedAsset.id,
          old_quantity: currentQuantity,
          new_quantity: newQuantity,
          quantity_change: change,
          change_type: type === 'add' ? 'manual_add' : 'manual_remove',
          change_reason: reason,
          changed_by: user?.id,
          organization_id: organizationId
        });

      if (historyError) throw historyError;

      toast({
        title: "Success",
        description: `Quantity ${type === 'add' ? 'added' : 'removed'} successfully`,
      });

      await refetch();
      return true;
    } catch (error) {
      console.error('Error updating quantity:', error);
      toast({
        title: "Error",
        description: "Failed to update quantity",
        variant: "destructive"
      });
      return false;
    }
  };

  const handleConfirmRemoval = async (assetId: string, reason: string) => {
    if (!selectedAsset) return false;

    try {
      if (selectedAsset.type === 'asset') {
        const { error } = await supabase
          .from('tools')
          .update({ 
            status: 'removed',
            notes: reason 
          })
          .eq('id', assetId);

        if (error) throw error;
      } else {
        // For stock items, we might handle removal differently
        const { error } = await supabase
          .from('parts')
          .update({ 
            current_quantity: 0,
            description: `${selectedAsset.description || ''} [REMOVED: ${reason}]`.trim()
          })
          .eq('id', assetId);

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Item removed successfully",
      });

      await refetch();
      return true;
    } catch (error) {
      console.error('Error removing asset:', error);
      toast({
        title: "Error",
        description: "Failed to remove item",
        variant: "destructive"
      });
      return false;
    }
  };

  const handleEditSubmit = async (assetId: string, updates: any) => {
    const result = await updateAsset(assetId, updates, true);
    if (result) {
      await refetch();
    }
    return result;
  };

  const handleStockEditSubmit = async (partId: string, updates: any) => {
    const result = await updateAsset(partId, updates, false);
    if (result) {
      await refetch();
    }
    return result;
  };

  if (loading && hasSearched) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show detailed view if an asset is selected
  if (selectedAssetForDetails && showViewDialog) {
    // Simple back navigation for now
    return (
      <div className="container mx-auto px-4 py-6">
        <Button onClick={() => setShowViewDialog(false)} className="mb-4">
          ← Back to Search
        </Button>
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">{selectedAssetForDetails.name}</h2>
          <p className="text-muted-foreground">
            {selectedAssetForDetails.type === 'asset' ? 'Asset' : 'Stock Item'} Details
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Main Content */}
      <div className="flex-1 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Combined Assets</h1>
            <p className="text-muted-foreground">
              {debouncedSearchTerm.length > 0 && debouncedSearchTerm.length < 3 
                ? "Enter at least 3 characters to search"
                : hasSearched 
                ? `Found ${filteredAssets.length} item${filteredAssets.length !== 1 ? 's' : ''}`
                : "Enter at least 3 characters to search for tools and inventory items"
              }
            </p>
          </div>
          
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </Button>
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
        />

        {/* Results */}
        {debouncedSearchTerm.length > 0 && debouncedSearchTerm.length < 3 ? (
          <div className="text-center py-12">
            <div className="text-muted-foreground">
              <p className="text-lg mb-2">Enter at least 3 characters to search</p>
              <p className="text-sm">This helps reduce server load and provides better performance</p>
            </div>
          </div>
        ) : loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Searching...</p>
          </div>
        ) : !hasSearched ? (
          <div className="text-center py-12">
            <div className="text-muted-foreground">
              <p className="text-lg mb-2">Ready to search</p>
              <p className="text-sm">Enter at least 3 characters in the search box above</p>
            </div>
          </div>
        ) : (
          <CombinedAssetGrid
            assets={filteredAssets}
            onView={handleView}
            onEdit={handleEdit}
            onRemove={handleRemove}
            onCheckout={handleCheckout}
            onCheckin={handleCheckin}
            onManageIssues={handleManageIssues}
            canEdit={canEditTools}
            isAdmin={isAdmin}
            currentUserId={user?.id}
            pendingOrders={pendingOrders}
          />
        )}
      </div>

      {/* Basic Dialogs */}
      <ToolCheckoutDialog
        open={showCheckoutDialog}
        onOpenChange={setShowCheckoutDialog}
        tool={selectedAsset?.type === 'asset' ? selectedAsset as any : null}
        onSuccess={() => refetch()}
      />

      <ToolCheckInDialog
        open={showCheckinDialog}
        onOpenChange={setShowCheckinDialog}
        tool={selectedAsset?.type === 'asset' ? selectedAsset as any : null}
        onSuccess={() => refetch()}
      />

      {/* Quantity Management Dialog */}
      <Dialog open={showQuantityDialog} onOpenChange={setShowQuantityDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {quantityChangeDetails.type === 'add' ? 'Add' : 'Remove'} Quantity
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="quantity">Quantity to {quantityChangeDetails.type}</Label>
              <Input
                id="quantity"
                type="number"
                min="0"
                value={quantityChangeDetails.quantity}
                onChange={(e) => setQuantityChangeDetails(prev => ({ 
                  ...prev, 
                  quantity: parseInt(e.target.value) || 0 
                }))}
              />
            </div>
            <div>
              <Label htmlFor="reason">Reason</Label>
              <Input
                id="reason"
                value={quantityChangeDetails.reason}
                onChange={(e) => setQuantityChangeDetails(prev => ({ 
                  ...prev, 
                  reason: e.target.value 
                }))}
                placeholder="Enter reason for quantity change"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowQuantityDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  const success = await updateQuantity(
                    quantityChangeDetails.type,
                    quantityChangeDetails.quantity,
                    quantityChangeDetails.reason
                  );
                  if (success) {
                    setShowQuantityDialog(false);
                    setQuantityChangeDetails({ type: 'add', quantity: 0, reason: '' });
                  }
                }}
                disabled={quantityChangeDetails.quantity <= 0 || !quantityChangeDetails.reason.trim()}
              >
                Confirm
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};