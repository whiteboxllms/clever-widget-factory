import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, X, Wrench } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useToolsData } from "@/hooks/tools/useToolsData";

interface Asset {
  id: string;
  name: string;
  status?: string;
  legacy_storage_vicinity?: string;
  serial_number?: string;
  storage_location?: string;
  image_url?: string;
}

interface AssetSelectorProps {
  formData: any;
  setFormData: (data: any) => void;
  onAssetClick?: (assetId: string) => void;
}

export function AssetSelector({ formData, setFormData, onAssetClick }: AssetSelectorProps) {
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [selectedAssetDetails, setSelectedAssetDetails] = useState<Asset[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const { toast } = useToast();
  const { tools: assets, loading, activeCheckouts } = useToolsData();
  useEffect(() => {
    fetchSelectedAssetDetails();
  }, [selectedAssets, assets.length]); // Use assets.length instead of assets array

  // Log all available tools when component loads (for debugging) - only once
  useEffect(() => {
    // Assets loaded
  }, [assets.length, loading]);

  // Initialize from formData.required_tools
  useEffect(() => {
    if (loading || assets.length === 0 || !formData?.required_tools) return;
    
    const toolIds = Array.isArray(formData.required_tools) ? formData.required_tools : [];
    const identifiers = toolIds
      .map((toolId: string) => {
        const tool = assets.find(a => a.id === toolId);
        return tool?.serial_number || tool?.id;
      })
      .filter(Boolean) as string[];
    
    const currentStr = JSON.stringify([...selectedAssets].sort());
    const newStr = JSON.stringify([...identifiers].sort());
    
    if (currentStr !== newStr) {
      setSelectedAssets(identifiers);
    }
  }, [formData?.required_tools, assets.length, loading]);

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
    }
  }, [searchTerm, uniqueAssets.length, filteredAssets.length]);

  const addAsset = (asset: Asset) => {
    const currentRequiredTools = Array.isArray(formData.required_tools) 
      ? formData.required_tools 
      : [];
    
    if (currentRequiredTools.includes(asset.id)) {
      toast({ 
        title: "Tool Already Added", 
        description: "This tool is already in the list",
        variant: "default"
      });
      return;
    }

    const identifier = asset.serial_number || asset.id;
    setSelectedAssets([...selectedAssets, identifier]);
    setFormData({
      ...formData,
      required_tools: [...currentRequiredTools, asset.id]
    });
    setShowSearch(false);
    setSearchTerm("");
  };

  const removeAsset = (serialNumberOrId: string) => {
    const asset = assets.find(a => a.serial_number === serialNumberOrId || a.id === serialNumberOrId);
    if (!asset) return;

    const currentRequiredTools = Array.isArray(formData.required_tools) 
      ? formData.required_tools 
      : [];
    const updatedRequiredTools = currentRequiredTools.filter((toolId: string) => toolId !== asset.id);
    
    setFormData({
      ...formData,
      required_tools: updatedRequiredTools
    });
    
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
              <div 
                className="flex items-center gap-3 flex-1 cursor-pointer hover:bg-muted/50 rounded -m-2 p-2"
                onClick={() => onAssetClick?.(asset.id)}
              >
                {asset.image_url && (
                  <img 
                    src={asset.image_url} 
                    alt={asset.name}
                    className="w-12 h-12 object-cover rounded"
                  />
                )}
                {!asset.image_url && <Wrench className="w-4 h-4 text-muted-foreground" />}
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
                onClick={(e) => {
                  e.stopPropagation();
                  removeAsset(asset.serial_number || asset.id);
                }}
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