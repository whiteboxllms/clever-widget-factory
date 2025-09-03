import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Search, Plus, X, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Asset {
  id: string;
  name: string;
  category?: string;
  status?: string;
  storage_vicinity?: string;
  serial_number?: string;
}

interface AssetSelectorProps {
  selectedAssets: string[];
  onAssetsChange: (assets: string[]) => void;
}

export function AssetSelector({ selectedAssets, onAssetsChange }: AssetSelectorProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tools')
        .select('id, name, category, status, storage_vicinity, serial_number')
        .neq('status', 'removed')
        .order('name');

      if (error) throw error;
      setAssets(data || []);
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
    (asset.category && asset.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const addAsset = (asset: Asset) => {
    if (!selectedAssets.includes(asset.name)) {
      onAssetsChange([...selectedAssets, asset.name]);
      setShowSearch(false);
      setSearchTerm("");
    }
  };

  const removeAsset = (assetName: string) => {
    onAssetsChange(selectedAssets.filter(name => name !== assetName));
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
      {selectedAssets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedAssets.map((assetName, index) => (
            <Badge key={index} variant="secondary" className="flex items-center gap-1">
              <Wrench className="w-3 h-3" />
              {assetName}
              <Button
                size="sm"
                variant="ghost"
                className="h-auto p-0 ml-1"
                onClick={() => removeAsset(assetName)}
              >
                <X className="w-3 h-3" />
              </Button>
            </Badge>
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
                placeholder="Search assets by name or category..."
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
                        <p className="font-medium">{asset.name}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {asset.category && (
                            <Badge variant="outline" className="text-xs">
                              {asset.category}
                            </Badge>
                          )}
                          {asset.serial_number && (
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                              SN: {asset.serial_number}
                            </Badge>
                          )}
                          {asset.storage_vicinity && (
                            <span>{asset.storage_vicinity}</span>
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