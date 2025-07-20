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

interface Tool {
  id: string;
  name: string;
  description: string;
  status: string;
  condition: string;
  category: string;
  image_url: string;
  intended_storage_location: string;
}

interface SelectedResource {
  id: string;
  name: string;
  quantity?: number;
  unit?: string;
  type: 'part' | 'tool';
}

interface ResourceSelectorProps {
  selectedResources: SelectedResource[];
  onResourcesChange: (resources: SelectedResource[]) => void;
}

export function ResourceSelector({ selectedResources, onResourcesChange }: ResourceSelectorProps) {
  const [parts, setParts] = useState<Part[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchType, setSearchType] = useState<'parts' | 'tools'>('parts');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (showSearch) {
      if (searchType === 'parts') {
        fetchParts();
      } else {
        fetchTools();
      }
    }
  }, [showSearch, searchType]);

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

  const fetchTools = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tools')
        .select('*')
        .eq('status', 'available')
        .order('name');

      if (error) throw error;
      setTools(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch tools",
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

  const filteredTools = tools.filter(tool =>
    tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (tool.description && tool.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (tool.category && tool.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const addResource = (item: Part | Tool, quantity?: number) => {
    const existingIndex = selectedResources.findIndex(r => r.id === item.id);
    
    if (existingIndex >= 0) {
      // Update existing resource (only for parts)
      if ('current_quantity' in item && quantity) {
        const updated = [...selectedResources];
        updated[existingIndex].quantity = (updated[existingIndex].quantity || 0) + quantity;
        onResourcesChange(updated);
      }
    } else {
      // Add new resource
      const newResource: SelectedResource = {
        id: item.id,
        name: item.name,
        type: 'current_quantity' in item ? 'part' : 'tool',
        ...(quantity && { quantity, unit: (item as Part).unit }),
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
        <div className="flex space-x-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchType('parts');
              setShowSearch(!showSearch);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Inventory
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchType('tools');
              setShowSearch(!showSearch);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Tool
          </Button>
        </div>
      </div>

      {/* Selected Resources */}
      {selectedResources.length > 0 && (
        <div className="space-y-2">
          {selectedResources.map((resource) => (
            <Card key={resource.id} className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="font-medium">{resource.name}</span>
                  {resource.type === 'part' && resource.quantity && resource.unit && (
                    <Badge variant="secondary">
                      {resource.quantity} {resource.unit}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    {resource.type === 'part' ? 'Available' : 'Available for Checkout'}
                  </Badge>
                </div>
                <div className="flex items-center space-x-2">
                  {resource.type === 'part' && (
                    <Input
                      type="number"
                      min="1"
                      value={resource.quantity || 1}
                      onChange={(e) => updateResourceQuantity(resource.id, parseInt(e.target.value) || 0)}
                      className="w-20"
                    />
                  )}
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                  >
                    {resource.type === 'part' ? 'Use' : 'Checkout'}
                  </Button>
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
                placeholder={`Search ${searchType === 'parts' ? 'inventory' : 'tools'}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {loading ? (
              <div className="text-center py-4">Loading {searchType}...</div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2">
                {searchType === 'parts' ? (
                  filteredParts.length === 0 ? (
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
                  )
                ) : (
                  filteredTools.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      No available tools found
                    </div>
                  ) : (
                    filteredTools.map((tool) => (
                      <div
                        key={tool.id}
                        className="flex items-center justify-between p-2 border rounded hover:bg-muted/50"
                      >
                        <div className="flex-1">
                          <div className="font-medium">{tool.name}</div>
                          {tool.description && (
                            <div className="text-sm text-muted-foreground">
                              {tool.description}
                            </div>
                          )}
                          <div className="text-sm text-muted-foreground">
                            Status: {tool.status} • Condition: {tool.condition}
                            {tool.category && ` • ${tool.category}`}
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => addResource(tool)}
                        >
                          Add
                        </Button>
                      </div>
                    ))
                  )
                )}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}