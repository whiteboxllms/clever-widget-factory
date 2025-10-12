import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Search, Plus, X, Wrench, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Asset {
  id: string;
  name: string;
  type: 'asset' | 'stock';
  status?: string;
  serial_number?: string;
  current_quantity?: number;
  unit?: string;
  storage_location?: string;
  legacy_storage_vicinity?: string;
  category?: string;
}

interface SelectedAsset {
  id: string;
  name: string;
  type: 'asset' | 'stock';
  quantity?: number;
}

interface CombinedAssetSelectorProps {
  selectedAssets: SelectedAsset[];
  onAssetsChange: (assets: SelectedAsset[]) => void;
}

export function CombinedAssetSelector({ selectedAssets, onAssetsChange }: CombinedAssetSelectorProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      // Fetch both tools (assets) and parts (stock) in parallel
      const [toolsResponse, partsResponse] = await Promise.all([
        supabase
          .from('tools')
          .select('id, name, status, legacy_storage_vicinity, serial_number, storage_location, category')
          .neq('status', 'removed')
          .order('name'),
        supabase
          .from('parts')
          .select('id, name, category, unit, current_quantity, storage_location, legacy_storage_vicinity')
          .gt('current_quantity', 0)
          .order('name')
      ]);

      if (toolsResponse.error) throw toolsResponse.error;
      if (partsResponse.error) throw partsResponse.error;

      // Combine and format data
      const combinedAssets: Asset[] = [
        ...(toolsResponse.data || []).map(tool => ({
          ...tool,
          type: 'asset' as const
        })),
        ...(partsResponse.data || []).map(part => ({
          ...part,
          type: 'stock' as const
        }))
      ];

      setAssets(combinedAssets);
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

  const filteredAssets = assets.filter(asset =>
    asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (asset.serial_number && asset.serial_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (asset.category && asset.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const addAsset = (asset: Asset) => {
    const isAlreadySelected = selectedAssets.some(selected => selected.id === asset.id);
    
    if (!isAlreadySelected) {
      const newAsset: SelectedAsset = {
        id: asset.id,
        name: asset.name,
        type: asset.type,
        quantity: asset.type === 'stock' ? 0.1 : undefined
      };
      onAssetsChange([...selectedAssets, newAsset]);
      setShowSearch(false);
      setSearchTerm("");
    }
  };

  const removeAsset = (assetId: string) => {
    onAssetsChange(selectedAssets.filter(asset => asset.id !== assetId));
  };

  const updateQuantity = (assetId: string, quantity: number) => {
    if (quantity <= 0) {
      removeAsset(assetId);
      return;
    }
    
    onAssetsChange(selectedAssets.map(asset => 
      asset.id === assetId 
        ? { ...asset, quantity }
        : asset
    ));
  };

  const handleQuantityChange = (assetId: string, value: string) => {
    // Update local input state immediately for responsive editing
    setInputValues(prev => ({ ...prev, [assetId]: value }));
    
    // Parse and update the actual quantity if valid
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0) {
      updateQuantity(assetId, numValue);
    }
  };

  const handleQuantityBlur = (assetId: string, value: string) => {
    // On blur, ensure we have a valid value
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= 0) {
      updateQuantity(assetId, 0.1);
      setInputValues(prev => ({ ...prev, [assetId]: '0.1' }));
    } else {
      setInputValues(prev => ({ ...prev, [assetId]: value }));
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
          Search Assets & Stock
        </Button>
      </div>

      {/* Selected Assets */}
      {selectedAssets.length > 0 && (
        <div className="space-y-2">
          {selectedAssets.map((asset) => (
            <div key={asset.id} className="flex items-center gap-2 p-2 border rounded-lg">
              {asset.type === 'asset' ? (
                <Wrench className="w-4 h-4 text-blue-600" />
              ) : (
                <Package className="w-4 h-4 text-green-600" />
              )}
              
              <Badge variant={asset.type === 'asset' ? 'default' : 'secondary'} className="text-xs">
                {asset.type === 'asset' ? 'Asset' : 'Stock'}
              </Badge>
              
              <span className="flex-1 font-medium">{asset.name}</span>
              
              <div className="flex items-center gap-2">
                {asset.type === 'stock' && (
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={inputValues[asset.id] ?? (asset.quantity || 0.1).toString()}
                    onChange={(e) => handleQuantityChange(asset.id, e.target.value)}
                    onBlur={(e) => handleQuantityBlur(asset.id, e.target.value)}
                    className="w-20"
                    placeholder="0.1"
                    inputMode="decimal"
                  />
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeAsset(asset.id)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search Interface */}
      {showSearch && (
        <Card className="p-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Search Assets & Stock</h4>
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
                placeholder="Search by name, serial number, or category..."
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
                  filteredAssets.map((asset) => {
                    const isSelected = selectedAssets.some(selected => selected.id === asset.id);
                    
                    return (
                      <div
                        key={asset.id}
                        className={`flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer ${
                          isSelected ? 'bg-muted/50 opacity-50' : ''
                        }`}
                        onClick={() => !isSelected && addAsset(asset)}
                      >
                        <div className="flex items-center gap-3">
                          {asset.type === 'asset' ? (
                            <Wrench className="w-5 h-5 text-blue-600" />
                          ) : (
                            <Package className="w-5 h-5 text-green-600" />
                          )}
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{asset.name}</p>
                              <Badge variant={asset.type === 'asset' ? 'default' : 'secondary'} className="text-xs">
                                {asset.type === 'asset' ? 'Asset' : 'Stock'}
                              </Badge>
                            </div>
                            
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              {asset.serial_number && (
                                <span>SN: {asset.serial_number}</span>
                              )}
                              {asset.current_quantity !== undefined && (
                                <span>{asset.current_quantity} {asset.unit || 'units'} available</span>
                              )}
                              {asset.category && (
                                <Badge variant="outline" className="text-xs">
                                  {asset.category}
                                </Badge>
                              )}
                            </div>
                            
                            {(asset.legacy_storage_vicinity || asset.storage_location) && (
                              <div className="text-sm text-muted-foreground">
                                {asset.legacy_storage_vicinity && <span>{asset.legacy_storage_vicinity}</span>}
                                {asset.storage_location && <span>• {asset.storage_location}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {!isSelected && (
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
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}