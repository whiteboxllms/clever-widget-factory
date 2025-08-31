import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Search, Plus, X, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface StockItem {
  id: string;
  name: string;
  category?: string;
  unit?: string;
  current_quantity: number;
}

interface SelectedStockItem {
  part_id: string;
  quantity: number;
  part_name: string;
}

interface StockSelectorProps {
  selectedStock: SelectedStockItem[];
  onStockChange: (stock: SelectedStockItem[]) => void;
}

export function StockSelector({ selectedStock, onStockChange }: StockSelectorProps) {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchStockItems();
  }, []);

  const fetchStockItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('parts')
        .select('id, name, category, unit, current_quantity')
        .gt('current_quantity', 0)
        .order('name');

      if (error) throw error;
      setStockItems(data || []);
    } catch (error) {
      console.error('Error fetching stock items:', error);
      toast({
        title: "Error",
        description: "Failed to fetch stock items",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredStock = stockItems.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.category && item.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const addStockItem = (item: StockItem) => {
    const isAlreadySelected = selectedStock.some(selected => selected.part_id === item.id);
    
    if (!isAlreadySelected) {
      const newStockItem: SelectedStockItem = {
        part_id: item.id,
        quantity: 1,
        part_name: item.name
      };
      onStockChange([...selectedStock, newStockItem]);
      setShowSearch(false);
      setSearchTerm("");
    }
  };

  const removeStockItem = (partId: string) => {
    onStockChange(selectedStock.filter(item => item.part_id !== partId));
  };

  const updateQuantity = (partId: string, quantity: number) => {
    if (quantity <= 0) {
      removeStockItem(partId);
      return;
    }
    
    onStockChange(selectedStock.map(item => 
      item.part_id === partId 
        ? { ...item, quantity }
        : item
    ));
  };

  return (
    <div className="space-y-3">
      {/* Add Stock Button */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowSearch(true)}
          className="flex-1"
        >
          <Search className="w-4 h-4 mr-2" />
          Search Stock
        </Button>
      </div>

      {/* Selected Stock */}
      {selectedStock.length > 0 && (
        <div className="space-y-2">
          {selectedStock.map((stockItem) => (
            <div key={stockItem.part_id} className="flex items-center gap-2 p-2 border rounded-lg">
              <Package className="w-4 h-4 text-muted-foreground" />
              <span className="flex-1 font-medium">{stockItem.part_name}</span>
              
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={stockItem.quantity}
                  onChange={(e) => updateQuantity(stockItem.part_id, parseFloat(e.target.value) || 0.01)}
                  className="w-20"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeStockItem(stockItem.part_id)}
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
              <h4 className="font-medium">Search Stock Items</h4>
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
                placeholder="Search stock by name or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {loading ? (
              <div className="text-center py-4">Loading stock items...</div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2">
                {filteredStock.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    {searchTerm ? 'No stock items found matching your search' : 'No stock items available'}
                  </div>
                ) : (
                  filteredStock.map((item) => {
                    const isSelected = selectedStock.some(selected => selected.part_id === item.id);
                    
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer ${
                          isSelected ? 'bg-muted/50 opacity-50' : ''
                        }`}
                        onClick={() => !isSelected && addStockItem(item)}
                      >
                        <div className="flex-1">
                          <p className="font-medium">{item.name}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {item.category && (
                              <Badge variant="outline" className="text-xs">
                                {item.category}
                              </Badge>
                            )}
                            <span>{item.current_quantity} {item.unit || 'units'} available</span>
                          </div>
                        </div>
                        {!isSelected && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              addStockItem(item);
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