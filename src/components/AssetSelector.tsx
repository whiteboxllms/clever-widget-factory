import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Search, Plus, X, Wrench } from "lucide-react";
// Supabase removed - using API calls
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
      // Simplified - no tools API available
      setAssets([]);
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
    // Simplified - no checkout functionality in current implementation
    return;
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

    if (!selectedAssets.includes(asset.serial_number)) {
      const newAssets = [...selectedAssets, asset.serial_number];
      onAssetsChange(newAssets);
      setShowSearch(false);
      setSearchTerm("");
    }
  };

  const removeAsset = async (serialNumber: string) => {
    onAssetsChange(selectedAssets.filter(serial => serial !== serialNumber));
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