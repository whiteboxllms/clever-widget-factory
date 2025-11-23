import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Search, Plus, X, Wrench } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useCognitoAuth";
import { useToolsData } from "@/hooks/tools/useToolsData";

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
}

export function AssetSelector({ selectedAssets: _unused, onAssetsChange: _unused2, actionId, organizationId, isInImplementationMode }: AssetSelectorProps) {
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

  // Initialize selectedAssets from checkouts when actionId changes
  useEffect(() => {
    if (actionId) {
      fetchCurrentCheckouts();
    }
  }, [actionId]);



  const fetchCurrentCheckouts = async () => {
    if (!actionId) return;
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/checkouts?action_id=${actionId}&is_returned=false`);
      if (!response.ok) return;
      
      const result = await response.json();
      const checkouts = result.data || [];
      const serials = checkouts.map((c: any) => c.tool_serial_number).filter(Boolean);
      setSelectedAssets(serials);
    } catch (error) {
      console.error('Error fetching checkouts:', error);
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

  const filteredAssets = assets.filter(asset =>
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

    if (actionId && user) {
      try {
        // Check if action is in progress (has plan_commitment)
        let actionInProgress = false;
        if (actionId) {
          try {
            const actionResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/actions?id=${actionId}`);
            if (actionResponse.ok) {
              const actionResult = await actionResponse.json();
              const actionData = Array.isArray(actionResult.data) ? actionResult.data[0] : actionResult.data;
              actionInProgress = actionData?.plan_commitment === true;
            }
          } catch (error) {
            console.warn('Could not fetch action status, defaulting to planned checkout:', error);
          }
        }

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
            const memberResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/organization_members?cognito_user_id=${user.id}`);
            if (memberResponse.ok) {
              const memberResult = await memberResponse.json();
              const member = Array.isArray(memberResult?.data) ? memberResult.data[0] : memberResult?.data;
              if (member?.full_name) {
                userFullName = member.full_name;
              }
            }
          }
        } catch (error) {
          console.warn('Could not resolve user full name:', error);
        }

        // Create checkout - active if action is in progress, planned otherwise
        const checkoutPayload: any = {
          tool_id: asset.id,
          user_id: user.id,
          user_name: userFullName,
          action_id: actionId,
          organization_id: organizationId,
          is_returned: false
        };

        // If action is in progress, set checkout_date to activate immediately
        if (actionInProgress) {
          checkoutPayload.checkout_date = new Date().toISOString();
        }
        // Otherwise, checkout_date will be NULL (planned checkout)

        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/checkouts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(checkoutPayload)
        });
        if (!response.ok) {
          const error = await response.json();
          if (error.error?.includes('duplicate key')) {
            toast({ title: "Already Added", description: "This asset is already attached to this action" });
            return;
          }
          throw new Error('Failed to create checkout');
        }
      } catch (error) {
        console.error('Error creating checkout:', error);
        toast({ title: "Error", description: "Failed to add asset", variant: "destructive" });
        return;
      }
    }

    setSelectedAssets([...selectedAssets, asset.serial_number]);
    setShowSearch(false);
    setSearchTerm("");
  };

  const removeAsset = async (serialNumber: string) => {
    if (actionId && user) {
      try {
        // Fetch the checkout
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/checkouts?action_id=${actionId}&is_returned=false`);
        if (response.ok) {
          const result = await response.json();
          const checkout = result.data?.find((c: any) => c.tool_serial_number === serialNumber);
          
          if (checkout) {
            // Check if this is an active checkout (has checkout_date)
            const isActiveCheckout = checkout.checkout_date != null;
            
            if (isActiveCheckout) {
              // For active checkouts, create a checkin record and mark as returned
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
                  const memberResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/organization_members?cognito_user_id=${user.id}`);
                  if (memberResponse.ok) {
                    const memberResult = await memberResponse.json();
                    const member = Array.isArray(memberResult?.data) ? memberResult.data[0] : memberResult?.data;
                    if (member?.full_name) {
                      userFullName = member.full_name;
                    }
                  }
                }
              } catch (error) {
                console.warn('Could not resolve user full name:', error);
              }

              // Create checkin record
              const checkinResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/checkins`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  checkout_id: checkout.id,
                  tool_id: checkout.tool_id,
                  user_name: userFullName,
                  problems_reported: '',
                  notes: 'Tool removed from action',
                  sop_best_practices: '',
                  what_did_you_do: '',
                  checkin_reason: 'Tool removed from in-progress action',
                  after_image_urls: [],
                  organization_id: organizationId
                })
              });

              if (!checkinResponse.ok) {
                throw new Error('Failed to create checkin record');
              }

              // Mark checkout as returned
              const updateResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/checkouts/${checkout.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_returned: true })
              });

              if (!updateResponse.ok) {
                throw new Error('Failed to mark checkout as returned');
              }

              // Update tool status to available
              const toolResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/tools/${checkout.tool_id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'available' })
              });

              if (!toolResponse.ok) {
                throw new Error('Failed to update tool status');
              }
            } else {
              // For planned checkouts, just delete the checkout record
              await fetch(`${import.meta.env.VITE_API_BASE_URL}/checkouts/${checkout.id}`, {
                method: 'DELETE'
              });
            }
          }
        }
      } catch (error) {
        console.error('Error removing checkout:', error);
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