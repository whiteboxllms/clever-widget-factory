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



  useEffect(() => {
    fetchSelectedAssetDetails();
  }, [selectedAssets, assets]);

  // Initialize selectedAssets from required_tools when actionId or formData changes
  useEffect(() => {
    fetchCurrentCheckouts();
  }, [actionId, formData?.required_tools, assets]);



  const fetchCurrentCheckouts = async () => {
    // If no actionId but we have formData, use formData.required_tools
    if (!actionId && formData?.required_tools) {
      const toolIds = Array.isArray(formData.required_tools) ? formData.required_tools : [];
      const serials = toolIds
        .map((toolId: string) => {
          const tool = assets.find(a => a.id === toolId);
          return tool?.serial_number;
        })
        .filter(Boolean) as string[];
      setSelectedAssets(serials);
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
        setSelectedAssets(serials);
      }
    } catch (error) {
      console.error('Error fetching action tools:', error);
    }
  };

  const fetchSelectedAssetDetails = async () => {
    if (selectedAssets.length === 0) {
      setSelectedAssetDetails([]);
      return;
    }
    const details = selectedAssets
      .map(serialNumber => assets.find(asset => asset.serial_number === serialNumber))
      .filter((asset): asset is Asset => asset !== undefined);
    setSelectedAssetDetails(details);
  };

  // Deduplicate assets by id to prevent duplicates from multiple checkouts
  const uniqueAssets = Array.from(
    new Map(assets.map(asset => [asset.id, asset])).values()
  );
  
  const filteredAssets = uniqueAssets.filter(asset =>
    asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (asset.serial_number && asset.serial_number.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const addAsset = async (asset: Asset) => {
    if (!asset.serial_number) {
      toast({
        title: "Cannot Add Tool",
        description: "Only tools with serial numbers can be added to actions.",
        variant: "destructive"
      });
      return;
    }

    if (selectedAssets.includes(asset.serial_number)) return;

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
          let userFullName = 'Unknown User';
          try {
            const userMetadata = (user as any)?.user_metadata;
            if (userMetadata?.full_name) {
              userFullName = userMetadata.full_name;
            } else if ((user as any)?.name) {
              userFullName = (user as any).name;
            } else {
              // Try to fetch from organization_members
              const memberResult = await apiService.get('/organization_members');
              const member = Array.isArray(memberResult?.data) ? memberResult.data.find((m: any) => m.cognito_user_id === user.id) : memberResult?.data;
              if (member?.full_name) {
                userFullName = member.full_name;
              }
            }
          } catch (error) {
            console.warn('Could not resolve user full name:', error);
          }

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

    setSelectedAssets([...selectedAssets, asset.serial_number]);
    setShowSearch(false);
    setSearchTerm("");
  };

  const removeAsset = async (serialNumber: string) => {
    // First, find the asset by serial number to get its tool_id
    const asset = assets.find(a => a.serial_number === serialNumber);
    if (!asset) {
      console.error('Asset not found for serial number:', serialNumber);
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
          let userFullName = 'Unknown User';
          const userMetadata = (user as any)?.user_metadata;
          if (userMetadata?.full_name) {
            userFullName = userMetadata.full_name;
          } else if ((user as any)?.name) {
            userFullName = (user as any).name;
          } else {
            // Only fetch from API if not available in user object
            try {
              const memberResult = await apiService.get('/organization_members');
              const member = Array.isArray(memberResult?.data) 
                ? memberResult.data.find((m: any) => m.cognito_user_id === user.id) 
                : memberResult?.data;
              if (member?.full_name) {
                userFullName = member.full_name;
              }
            } catch (error) {
              console.warn('Could not resolve user full name:', error);
            }
          }
          
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
    setSelectedAssets(selectedAssets.filter(serial => serial !== serialNumber));
  };

  return (
    <div className="space-y-3">
      {/* Add Asset Button */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowSearch(true)}
          className="flex-1"
        >
          <Search className="w-4 h-4 mr-2" />
          Search Assets
        </Button>
      </div>

      {/* Selected Assets */}
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
                onClick={() => removeAsset(asset.serial_number!)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Search Interface */}
      {showSearch && (
        <Card className="p-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Search Assets</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowSearch(false);
                  setSearchTerm("");
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
               <Input
                placeholder="Search assets by name or serial number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {loading ? (
              <div className="text-center py-4">Loading assets...</div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2">
                {filteredAssets.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    {searchTerm ? 'No assets found matching your search' : 'No assets available'}
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
        </Card>
      )}
    </div>
  );
}