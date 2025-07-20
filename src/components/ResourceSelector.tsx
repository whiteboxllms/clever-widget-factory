import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Part {
  id: string;
  name: string;
  description: string;
  current_quantity: number;
  unit: string;
  category: string;
  image_url: string;
}

interface SelectedResource {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

interface ResourceSelectorProps {
  selectedResources: SelectedResource[];
  onResourcesChange: (resources: SelectedResource[]) => void;
}

export function ResourceSelector({ selectedResources, onResourcesChange }: ResourceSelectorProps) {
  const [parts, setParts] = useState<Part[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (showSearch) {
      fetchParts();
    }
  }, [showSearch]);

  const fetchParts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('parts')
        .select('*')
        .order('name');

      if (error) throw error;
      setParts(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch inventory",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredParts = parts.filter(part =>
    part.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (part.description && part.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (part.category && part.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const addResource = (part: Part, quantity: number) => {
    const existingIndex = selectedResources.findIndex(r => r.id === part.id);
    
    if (existingIndex >= 0) {
      // Update existing resource
      const updated = [...selectedResources];
      updated[existingIndex].quantity += quantity;
      onResourcesChange(updated);
    } else {
      // Add new resource
      const newResource: SelectedResource = {
        id: part.id,
        name: part.name,
        quantity,
        unit: part.unit,
      };
      onResourcesChange([...selectedResources, newResource]);
    }
    
    setShowSearch(false);
    setSearchTerm('');
  };

  const removeResource = (id: string) => {
    onResourcesChange(selectedResources.filter(r => r.id !== id));
  };

  const updateResourceQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeResource(id);
      return;
    }
    
    const updated = selectedResources.map(r =>
      r.id === id ? { ...r, quantity } : r
    );
    onResourcesChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Resources Required</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowSearch(!showSearch)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add from Inventory
        </Button>
      </div>

      {/* Selected Resources */}
      {selectedResources.length > 0 && (
        <div className="space-y-2">
          {selectedResources.map((resource) => (
            <Card key={resource.id} className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="font-medium">{resource.name}</span>
                  <Badge variant="secondary">
                    {resource.quantity} {resource.unit}
                  </Badge>
                </div>
                <div className="flex items-center space-x-2">
                  <Input
                    type="number"
                    min="1"
                    value={resource.quantity}
                    onChange={(e) => updateResourceQuantity(resource.id, parseInt(e.target.value) || 0)}
                    className="w-20"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeResource(resource.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Search Interface */}
      {showSearch && (
        <Card className="p-4">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search inventory..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {loading ? (
              <div className="text-center py-4">Loading inventory...</div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2">
                {filteredParts.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    No inventory items found
                  </div>
                ) : (
                  filteredParts.map((part) => (
                    <div
                      key={part.id}
                      className="flex items-center justify-between p-2 border rounded hover:bg-muted/50"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{part.name}</div>
                        {part.description && (
                          <div className="text-sm text-muted-foreground">
                            {part.description}
                          </div>
                        )}
                        <div className="text-sm text-muted-foreground">
                          Available: {part.current_quantity} {part.unit}
                          {part.category && ` • ${part.category}`}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="number"
                          min="1"
                          max={part.current_quantity}
                          defaultValue="1"
                          className="w-20"
                          id={`quantity-${part.id}`}
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            const quantityInput = document.getElementById(`quantity-${part.id}`) as HTMLInputElement;
                            const quantity = parseInt(quantityInput.value) || 1;
                            if (quantity <= part.current_quantity) {
                              addResource(part, quantity);
                            } else {
                              toast({
                                title: "Invalid quantity",
                                description: `Only ${part.current_quantity} ${part.unit} available`,
                                variant: "destructive",
                              });
                            }
                          }}
                        >
                          Add
                        </Button>
                      </div>
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