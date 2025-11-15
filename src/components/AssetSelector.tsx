import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Search, Plus, X, Wrench } from "lucide-react";
import { supabase } from '@/lib/client';
import { useToast } from "@/hooks/use-toast";
// Planned checkout logic removed in favor of immediate checkout upon selection
import { useAuth } from "@/hooks/useCognitoAuth";

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

export function AssetSelector({ selectedAssets, onAssetsChange, actionId, organizationId, isInImplementationMode }: AssetSelectorProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAssetDetails, setSelectedAssetDetails] = useState<Asset[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkoutInfoByToolId, setCheckoutInfoByToolId] = useState<Record<string, { user_name: string; checkout_date: string | null }>>({});
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchAssets();
  }, []);

  useEffect(() => {
    fetchSelectedAssetDetails();
  }, [selectedAssets, assets]);

  // Initialize selectedAssets from checkouts when actionId changes
  useEffect(() => {
    if (actionId) {
      fetchCurrentCheckouts();
    }
  }, [actionId]);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tools')
        .select('id, name, status, legacy_storage_vicinity, serial_number, storage_location')
        .neq('status', 'removed')
        .order('name');

      if (error) throw error;
      setAssets(data || []);

      // Fetch current active checkouts to show who has a tool
      const { data: co, error: coErr } = await supabase
        .from('checkouts')
        .select('tool_id, user_name, checkout_date')
        .eq('is_returned', false);
      if (!coErr && co) {
        const map: Record<string, { user_name: string; checkout_date: string | null }> = {};
        co.forEach((row: any) => {
          if (row.tool_id) map[row.tool_id] = { user_name: row.user_name, checkout_date: row.checkout_date };
        });
        setCheckoutInfoByToolId(map);
      }
    } catch (error) {
      console.error('Error fetching assets:', error);
      toast({
        title: "Error",
        description: "Failed to fetch assets",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentCheckouts = async () => {
    if (!actionId) return;

    try {
      const { data: checkoutData, error } = await supabase
        .from('checkouts')
        .select(`
          tool_id,
          tools!inner(
            serial_number
          )
        `)
        .eq('action_id', actionId)
        .eq('is_returned', false);

      if (error) throw error;

      const serialNumbers = checkoutData?.map(c => c.tools.serial_number).filter(Boolean) || [];
      onAssetsChange(serialNumbers);
    } catch (error) {
      console.error('Error fetching current checkouts:', error);
    }
  };

  const fetchSelectedAssetDetails = async () => {
    // If there is no action yet, show local buffered selections from available assets
    if (!actionId) {
      if (selectedAssets.length === 0) {
        setSelectedAssetDetails([]);
        return;
      }
      const localDetails = selectedAssets
        .map(serialNumber => assets.find(asset => asset.serial_number === serialNumber))
        .filter((asset): asset is Asset => asset !== undefined);
      setSelectedAssetDetails(localDetails);
      return;
    }

    if (selectedAssets.length === 0) {
      setSelectedAssetDetails([]);
      return;
    }

    // Fetch selected assets from checkouts for this action
    try {
      const { data: checkoutData, error } = await supabase
        .from('checkouts')
        .select(`
          tool_id,
          tools!inner(
            id,
            name,
            status,
            legacy_storage_vicinity,
            serial_number,
            storage_location
          )
        `)
        .eq('action_id', actionId)
        .eq('is_returned', false)
        .in('tool_id', selectedAssets.map(serial => 
          assets.find(a => a.serial_number === serial)?.id
        ).filter(Boolean));

      if (error) throw error;

      const details = checkoutData?.map(c => c.tools) || [];
      setSelectedAssetDetails(details);
    } catch (error) {
      console.error('Error fetching selected asset details:', error);
      // Fallback to local lookup
      const details = selectedAssets
        .map(serialNumber => assets.find(asset => asset.serial_number === serialNumber))
        .filter((asset): asset is Asset => asset !== undefined);
      setSelectedAssetDetails(details);
    }
  };

  const filteredAssets = assets.filter(asset =>
    asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (asset.serial_number && asset.serial_number.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const addAsset = async (asset: Asset) => {
    // Only add tools that have serial numbers
    if (!asset.serial_number) {
      toast({
        title: "Cannot Add Tool",
        description: "Only tools with serial numbers can be added to actions.",
        variant: "destructive"
      });
      return;
    }

    if (!selectedAssets.includes(asset.serial_number)) {
      const newAssets = [...selectedAssets, asset.serial_number];
      onAssetsChange(newAssets);
      setShowSearch(false);
      setSearchTerm("");

      // Immediately check out when assigned (for existing actions)
      if (actionId && organizationId && user) {
        try {
          // Get action details (for intended usage)
          const { data: action, error: actionError } = await supabase
            .from('actions')
            .select('id, title, policy')
            .eq('id', actionId)
            .single();

          if (actionError) throw actionError;

          // If tool is already checked out, warn but allow additional checkout (per request)
          if (asset.status && asset.status !== 'available') {
            const co = checkoutInfoByToolId[asset.id];
            toast({
              title: "Tool is already checked out",
              description: co?.user_name ? `Currently checked out to ${co.user_name}. Proceeding with your checkout.` : `Proceeding with your checkout.`,
            });
          }

          // Create actual checkout
          const { error: coErr } = await supabase
            .from('checkouts')
            .insert({
              tool_id: asset.id,
              user_id: user.id,
              user_name: user.user_metadata?.full_name || 'Unknown User',
              intended_usage: action?.title || null,
              notes: null,
              checkout_date: new Date().toISOString(),
              is_returned: false,
              action_id: actionId,
              organization_id: organizationId
            } as any);
          if (coErr) throw coErr;

          // Update tool status to checked_out for visibility
          await supabase.from('tools').
            update({ status: 'checked_out' }).
            eq('id', asset.id);

          toast({
            title: "Tool Checked Out",
            description: `${asset.name} (${asset.serial_number}) has been checked out for this action.`,
          });

          // Refresh the current checkouts to update the display
          await fetchCurrentCheckouts();
          await fetchAssets();
        } catch (error) {
          console.error('Failed to create planned checkout:', error);
          toast({
            title: "Checkout Failed",
            description: "Tool was added but checkout failed. Please try again.",
            variant: "destructive"
          });
        }
      }
    }
  };

  const removeAsset = async (serialNumber: string) => {
    // Remove from local state
    onAssetsChange(selectedAssets.filter(serial => serial !== serialNumber));
    
    // On removal: perform a check-in if actionId exists
    if (actionId && organizationId && user) {
      try {
        const asset = assets.find(a => a.serial_number === serialNumber);
        if (asset) {
          // Find the active checkout for this action/tool
          const { data: existing, error: findErr } = await supabase
            .from('checkouts')
            .select('id, checkout_date')
            .eq('action_id', actionId)
            .eq('tool_id', asset.id)
            .eq('is_returned', false)
            .order('checkout_date', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (findErr) throw findErr;

          if (existing) {
            // Get action policy for notes
            const { data: action, error: actionError } = await supabase
              .from('actions')
              .select('id, policy')
              .eq('id', actionId)
              .single();
            if (actionError) throw actionError;

            // Create checkin record (mirror of auto-checkin utility)
            await supabase
              .from('checkins')
              .insert({
                checkout_id: existing.id,
                tool_id: asset.id,
                user_name: user.user_metadata?.full_name || 'Unknown User',
                problems_reported: '',
                notes: '',
                sop_best_practices: '',
                what_did_you_do: '',
                checkin_reason: 'Removed from action',
                after_image_urls: [],
                organization_id: organizationId
              } as any);

            // Mark checkout returned
            await supabase
              .from('checkouts')
              .update({ is_returned: true })
              .eq('id', existing.id);

            // Update tool status
            await supabase
              .from('tools')
              .update({ status: 'available' })
              .eq('id', asset.id);
          }

          toast({
            title: "Tool Checked In",
            description: `${asset.name} (${asset.serial_number}) has been checked in and removed from this action.`,
          });

          await fetchCurrentCheckouts();
          await fetchAssets();
        }
      } catch (error) {
        console.error('Failed to remove checkout:', error);
        toast({
          title: "Removal Failed",
          description: "Tool was removed from the list but check-in may have failed. Please refresh the page.",
          variant: "destructive"
        });
      }
    }
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
                    {asset.status && asset.status !== 'available' && (
                      <span>• Checked out{checkoutInfoByToolId[asset.id]?.user_name ? ` to ${checkoutInfoByToolId[asset.id].user_name}` : ''}</span>
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