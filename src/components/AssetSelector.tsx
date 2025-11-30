import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Search, Plus, X, Wrench } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useCognitoAuth";
import { useToolsData } from "@/hooks/tools/useToolsData";
import { apiService } from '@/lib/apiService';
import { useOrganizationMembers } from '@/hooks/useOrganizationMembers';

interface Asset {
  id: string;
  name: string;
  status?: string;
  legacy_storage_vicinity?: string;
  serial_number?: string;
  storage_location?: string;
}

interface AssetSelectorProps {
  selectedAssets: string[]; // Now stores serial numbers
  onAssetsChange: (assets: string[]) => void;
  actionId?: string;
  organizationId?: string;
  isInImplementationMode?: boolean;
  formData?: any; // Form data for new actions (before saving)
  setFormData?: (data: any) => void; // Setter for form data
}

export function AssetSelector({ selectedAssets: _unused, onAssetsChange: _unused2, actionId, organizationId, isInImplementationMode, formData, setFormData }: AssetSelectorProps) {
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [selectedAssetDetails, setSelectedAssetDetails] = useState<Asset[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { tools: assets, loading, activeCheckouts } = useToolsData();
  const { members: organizationMembers = [] } = useOrganizationMembers();

  const preferName = (value?: string | null) => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed.includes('@')) return null;
    return trimmed;
  };

  const resolveUserFullName = () => {
    if (!user) return 'Unknown User';
    const metadataName = preferName((user as any)?.user_metadata?.full_name);
    if (metadataName) return metadataName;
    const cognitoName = preferName((user as any)?.name);
    if (cognitoName) return cognitoName;
    const member = organizationMembers.find(
      (m) => m.cognito_user_id === user.id || m.user_id === user.id
    );
    const memberName = preferName(member?.full_name);
    if (memberName) return memberName;
    return user.email || (user as any)?.username || 'Unknown User';
  };



  useEffect(() => {
    fetchSelectedAssetDetails();
  }, [selectedAssets, assets.length]); // Use assets.length instead of assets array

  // Log all available tools when component loads (for debugging) - only once
  useEffect(() => {
    if (assets.length > 0 && !loading) {
      console.log('[AssetSelector] Available tools:', {
        total: assets.length,
        toolNames: assets.map(a => a.name).sort(),
        toolsWithBranch: assets.filter(a => a.name.toLowerCase().includes('branch')).map(a => ({
          name: a.name,
          id: a.id,
          serial: a.serial_number,
          category: a.category
        }))
      });
    }
  }, [assets.length, loading]); // Only log when length changes, not on every render

  // Initialize selectedAssets from required_tools when actionId or formData changes
  // Wait for assets to be loaded before trying to map tool IDs to serial numbers
  useEffect(() => {
    if (loading || assets.length === 0) {
      return; // Wait for assets to load
    }
    fetchCurrentCheckouts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionId, formData?.required_tools, assets.length, loading]); // Use assets.length and disable exhaustive deps for fetchCurrentCheckouts



  const fetchCurrentCheckouts = async () => {
    // If no actionId but we have formData, use formData.required_tools
    if (!actionId && formData?.required_tools) {
      const toolIds = Array.isArray(formData.required_tools) ? formData.required_tools : [];
      
      // Map tool IDs to identifiers first
      const identifiers = toolIds
        .map((toolId: string) => {
          const tool = assets.find(a => a.id === toolId);
          if (!tool) {
            console.warn('[AssetSelector] Tool not found in assets:', toolId);
            return null;
          }
          if (!tool.serial_number) {
            // Use tool ID as fallback for tools without serial numbers
            return tool.id;
          }
          return tool.serial_number;
        })
        .filter(Boolean) as string[];
      
      // Check if we already have these assets selected to prevent infinite loop
      // Compare the mapped identifiers, not the raw toolIds
      const currentIdentifiersString = JSON.stringify([...selectedAssets].sort());
      const newIdentifiersString = JSON.stringify([...identifiers].sort());
      
      // Only update if the identifiers have actually changed
      if (currentIdentifiersString === newIdentifiersString && selectedAssets.length > 0) {
        return; // Already set, don't update again
      }
      
      console.log('[AssetSelector] Auto-selecting tools from formData:', { toolIds, identifiers, assetsCount: assets.length });
      
      if (identifiers.length > 0) {
        setSelectedAssets(identifiers);
      }
      return;
    }
    
    if (!actionId) return;
    
    try {
      // Get action to read required_tools (like required_stock)
      const actionResult = await apiService.get(`/actions?id=${actionId}`);
      const actionData = Array.isArray(actionResult.data) ? actionResult.data[0] : actionResult.data;
      
      if (actionData?.required_tools && Array.isArray(actionData.required_tools)) {
        // Map tool IDs to serial numbers
        const toolIds = actionData.required_tools;
        const serials = toolIds
          .map((toolId: string) => {
            const tool = assets.find(a => a.id === toolId);
            return tool?.serial_number;
          })
          .filter(Boolean) as string[];
        
        // Only update if different to prevent infinite loop
        const currentSerialsString = JSON.stringify(selectedAssets.sort());
        const newSerialsString = JSON.stringify(serials.sort());
        if (currentSerialsString !== newSerialsString) {
          setSelectedAssets(serials);
        }
      }
    } catch (error) {
      console.error('Error fetching action tools:', error);
    }
  };

  const fetchSelectedAssetDetails = () => {
    if (selectedAssets.length === 0) {
      setSelectedAssetDetails([]);
      return;
    }
    // Try to find by serial_number first, then by ID (for tools without serial numbers)
    const details = selectedAssets
      .map(identifier => {
        // First try to find by serial_number
        let asset = assets.find(a => a.serial_number === identifier);
        // If not found, try to find by ID (for tools without serial numbers)
        if (!asset) {
          asset = assets.find(a => a.id === identifier);
        }
        return asset;
      })
      .filter((asset): asset is Asset => asset !== undefined);
    setSelectedAssetDetails(details);
  };

  // Deduplicate assets by id to prevent duplicates from multiple checkouts
  const uniqueAssets = Array.from(
    new Map(assets.map(asset => [asset.id, asset])).values()
  );
  
  // Filter assets by search term - search name, serial number, category, and description
  // Also handle word boundaries and partial matches better
  const filteredAssets = uniqueAssets.filter(asset => {
    if (!searchTerm) return true; // Show all when no search term
    
    const searchLower = searchTerm.toLowerCase().trim();
    const assetName = (asset.name || '').toLowerCase();
    const assetSerial = (asset.serial_number || '').toLowerCase();
    const assetCategory = (asset.category || '').toLowerCase();
    const assetDescription = (asset.description || '').toLowerCase();
    
    // Check if search term appears anywhere in name, serial, category, or description
    return (
      assetName.includes(searchLower) ||
      assetSerial.includes(searchLower) ||
      assetCategory.includes(searchLower) ||
      assetDescription.includes(searchLower)
    );
  });
  
  // Debug logging to help diagnose search issues
  useEffect(() => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchingTools = uniqueAssets.filter(asset => {
        const nameMatch = asset.name.toLowerCase().includes(searchLower);
        const serialMatch = asset.serial_number && asset.serial_number.toLowerCase().includes(searchLower);
        const categoryMatch = asset.category && asset.category.toLowerCase().includes(searchLower);
        const descMatch = asset.description && asset.description.toLowerCase().includes(searchLower);
        return nameMatch || serialMatch || categoryMatch || descMatch;
      });
      
      console.log('[AssetSelector] Search Debug:', {
        searchTerm,
        searchLower,
        totalAssets: uniqueAssets.length,
        filteredCount: filteredAssets.length,
        matchingCount: matchingTools.length,
        sampleNames: uniqueAssets.slice(0, 10).map(a => ({
          name: a.name,
          category: a.category,
          serial: a.serial_number,
          nameIncludes: a.name.toLowerCase().includes(searchLower),
          categoryIncludes: a.category?.toLowerCase().includes(searchLower)
        })),
        matchingTools: matchingTools.slice(0, 5).map(a => a.name)
      });
    }
  }, [searchTerm, uniqueAssets.length, filteredAssets.length]);

  const addAsset = async (asset: Asset) => {
    // Note: We allow tools without serial numbers, but they may not work with checkout system
    // The serial_number is preferred but not strictly required for actions
    if (!asset.serial_number) {
      console.warn('[AssetSelector] Tool has no serial_number:', asset.name, asset.id);
      // Continue anyway - we'll use the tool ID as fallback
    }

    // Check if already selected (by serial number or by ID if no serial number)
    const isAlreadySelected = asset.serial_number 
      ? selectedAssets.includes(asset.serial_number)
      : selectedAssetDetails.some(a => a.id === asset.id);
    if (isAlreadySelected) return;

    // If no actionId yet (creating new action), store in formData
    if (!actionId && formData && setFormData) {
      const currentRequiredTools = Array.isArray(formData.required_tools) 
        ? formData.required_tools 
        : [];
      
      // Check if tool is already in the list
      if (currentRequiredTools.includes(asset.id)) {
        toast({ 
          title: "Tool Already Added", 
          description: "This tool is already associated with this action",
          variant: "default"
        });
        return;
      }

      // Add tool ID to required_tools array in formData
      setFormData({
        ...formData,
        required_tools: [...currentRequiredTools, asset.id]
      });
    } else if (actionId && user) {
      try {
        // Get current action to update required_tools field (like required_stock)
        const actionResult = await apiService.get(`/actions?id=${actionId}`);
        const actionData = Array.isArray(actionResult.data) ? actionResult.data[0] : actionResult.data;
        
        if (!actionData) {
          toast({ 
            title: "Error", 
            description: "Action not found",
            variant: "destructive"
          });
          return;
        }

        // Get current required_tools array or initialize empty array
        const currentRequiredTools = Array.isArray(actionData.required_tools) 
          ? actionData.required_tools 
          : [];
        
        // Check if tool is already in the list
        if (currentRequiredTools.includes(asset.id)) {
          toast({ 
            title: "Tool Already Added", 
            description: "This tool is already associated with this action",
            variant: "default"
          });
          return;
        }

        // Add tool ID to required_tools array (like stock in required_stock)
        const updatedRequiredTools = [...currentRequiredTools, asset.id];
        
        // Update action with new required_tools array
        await apiService.put(`/actions/${actionId}`, {
          required_tools: updatedRequiredTools
        });

        // Only create checkout if action is in progress (plan_commitment = true)
        if (actionData.plan_commitment === true) {
          // Resolve user full name
          const userFullName = resolveUserFullName();

          // Create active checkout since action is in progress
          try {
            await apiService.post('/checkouts', {
              tool_id: asset.id,
              user_id: user.id,
              user_name: userFullName,
              action_id: actionId,
              is_returned: false,
              checkout_date: new Date().toISOString()
            });
            // Update tool status to checked_out
            await apiService.put(`/tools/${asset.id}`, { status: 'checked_out' });
          } catch (error: any) {
            // Handle duplicate key constraint violation
            if (error.message?.includes('duplicate key') || 
                error.message?.includes('idx_unique_active_checkout_per_tool') ||
                (error.error && error.error.includes('active checkout'))) {
              // Don't show error - tool is already checked out, which is fine
              console.log('Tool already has active checkout, skipping checkout creation');
            } else {
              console.error('Error creating checkout:', error);
            }
          }
        }
        // If action is not in progress, we just store in required_tools (no checkout yet)
        // Checkout will be created when action starts (plan_commitment becomes true)

      } catch (error) {
        console.error('Error adding asset to action:', error);
        toast({ 
          title: "Error", 
          description: "Failed to add asset to action",
          variant: "destructive"
        });
        return;
      }
    }

    // Use serial_number if available, otherwise use tool ID as fallback
    const identifier = asset.serial_number || asset.id;
    setSelectedAssets([...selectedAssets, identifier]);
    setShowSearch(false);
    setSearchTerm("");
  };

  const removeAsset = async (serialNumberOrId: string) => {
    // First, find the asset by serial number or ID
    let asset = assets.find(a => a.serial_number === serialNumberOrId);
    if (!asset) {
      // Try finding by ID (for tools without serial numbers)
      asset = assets.find(a => a.id === serialNumberOrId);
    }
    if (!asset) {
      console.error('Asset not found for identifier:', serialNumberOrId);
      toast({
        title: "Error",
        description: "Could not find asset to remove",
        variant: "destructive"
      });
      return;
    }

    // If no actionId yet (creating new action), update formData
    if (!actionId && formData && setFormData) {
      const currentRequiredTools = Array.isArray(formData.required_tools) 
        ? formData.required_tools 
        : [];
      const updatedRequiredTools = currentRequiredTools.filter((toolId: string) => toolId !== asset.id);
      
      setFormData({
        ...formData,
        required_tools: updatedRequiredTools
      });
    } else if (actionId && user) {
      try {
        // Get current tool IDs from selectedAssetDetails (no need to fetch action)
        const currentToolIds = selectedAssetDetails
          .map(a => a.id)
          .filter((id): id is string => id !== undefined && id !== asset.id);
        
        // Run PUT and checkout check in parallel for better performance
        const [checkoutResult] = await Promise.all([
          apiService.get(`/checkouts?action_id=${actionId}&is_returned=false`).catch(() => ({ data: [] })),
          apiService.put(`/actions/${actionId}`, {
            required_tools: currentToolIds
          })
        ]);
        
        const checkout = checkoutResult.data?.find((c: any) => c.tool_id === asset.id);
        
        if (checkout) {
          // Check if this is an active checkout (has checkout_date)
          const isActiveCheckout = checkout.checkout_date != null;
          
          // Resolve user full name (try from user object first, avoid API call if possible)
          const userFullName = resolveUserFullName();
          
          if (isActiveCheckout) {
            // For active checkouts, batch operations in parallel where possible
            await Promise.all([
              apiService.post('/checkins', {
                checkout_id: checkout.id,
                tool_id: checkout.tool_id,
                user_name: userFullName,
                problems_reported: '',
                notes: 'Tool removed from action',
                sop_best_practices: '',
                what_did_you_do: '',
                checkin_reason: 'Tool removed from in-progress action',
                after_image_urls: [],
              }),
              apiService.put(`/checkouts/${checkout.id}`, { is_returned: true }),
              apiService.put(`/tools/${checkout.tool_id}`, { status: 'available' })
            ]);
          } else {
            // For planned checkouts, just delete the checkout record
            await apiService.delete(`/checkouts/${checkout.id}`);
          }
        }
      } catch (error) {
        console.error('Error removing asset from action:', error);
        toast({
          title: "Error",
          description: "Failed to remove asset from action",
          variant: "destructive"
        });
        return;
      }
    }
    // Remove by serial number or ID
    const identifier = asset.serial_number || asset.id;
    setSelectedAssets(selectedAssets.filter(id => id !== identifier));
  };

  return (
    <div className="space-y-3">
      {/* Selected Assets - Show first */}
      {selectedAssetDetails.length > 0 && (
        <div className="space-y-2">
          {selectedAssetDetails.map((asset, index) => (
            <div key={index} className="flex items-center justify-between p-2 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">{asset.name}</p>
                  {asset.serial_number && (
                    <p className="text-sm text-muted-foreground">Serial: {asset.serial_number}</p>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-auto p-1"
                onClick={() => removeAsset(asset.serial_number || asset.id)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add Asset Button or Search Input - Show below selected assets */}
      {!showSearch ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowSearch(true)}
          className="flex-1"
        >
          <Search className="w-4 h-4 mr-2" />
          Add Asset
        </Button>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search assets by name, serial number, or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-10"
            autoFocus
          />
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
            onClick={() => {
              setShowSearch(false);
              setSearchTerm("");
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Search Results - Show inline when searching */}
      {showSearch && (
        <div className="space-y-2">
          {loading ? (
            <div className="text-center py-4">Loading assets...</div>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-2">
              {filteredAssets.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  {searchTerm ? 'No assets found matching your search' : 'Start typing to search...'}
                </div>
              ) : (
                filteredAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => addAsset(asset)}
                  >
                    <div className="flex-1">
                      <p className="font-medium">
                        {asset.name}
                        {asset.serial_number && (
                          <span className="text-xs text-muted-foreground ml-2">
                            {asset.serial_number}
                          </span>
                        )}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {asset.legacy_storage_vicinity && (
                          <span>{asset.legacy_storage_vicinity}</span>
                        )}
                        {asset.storage_location && (
                          <span>• {asset.storage_location}</span>
                        )}
                        {activeCheckouts[asset.id] && (
                          <span>• Checked out to {activeCheckouts[asset.id].user_name}</span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        addAsset(asset);
                      }}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}