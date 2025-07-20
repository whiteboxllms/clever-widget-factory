import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Search, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ToolCheckoutDialog } from '@/components/ToolCheckoutDialog';

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
  assignedTasks?: string[];
  missionId?: string;
  assignedUsers?: Array<{ user_id: string; full_name: string }>;
}

export function ResourceSelector({ selectedResources, onResourcesChange, assignedTasks = [], missionId, assignedUsers = [] }: ResourceSelectorProps) {
  const [parts, setParts] = useState<Part[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [teamTools, setTeamTools] = useState<any[]>([]);
  const [toolCheckouts, setToolCheckouts] = useState<Record<string, { user_name: string; checkout_date: string }>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchType, setSearchType] = useState<'parts' | 'tools'>('parts');
  const [loading, setLoading] = useState(false);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [showCheckoutDialog, setShowCheckoutDialog] = useState(false);
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

  // Fetch tools on component mount to get status information for selected resources
  useEffect(() => {
    fetchTools();
    fetchToolCheckouts();
  }, []);

  useEffect(() => {
    if (missionId && assignedUsers.length > 0) {
      fetchTeamTools();
    }
  }, [missionId, assignedUsers]);

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
      // Fetch all tools to ensure we have data for selected resources
      const { data, error } = await supabase
        .from('tools')
        .select('*')
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

  const fetchTeamTools = async () => {
    if (!assignedUsers.length) return;

    const userIds = assignedUsers.map(user => user.user_id);
    
    const { data, error } = await supabase
      .from('checkouts')
      .select(`
        *,
        tools (
          id,
          name,
          status,
          condition
        )
      `)
      .eq('is_returned', false)
      .in('user_id', userIds);

    if (error) {
      console.error('Error fetching team tools:', error);
      return;
    }

    const toolsWithUsers = data?.map(checkout => ({
      ...checkout.tools,
      checkout_id: checkout.id,
      checked_out_to: checkout.user_name,
      checkout_date: checkout.checkout_date
    })) || [];

    setTeamTools(toolsWithUsers);
  };

  const fetchToolCheckouts = async () => {
    try {
      const { data, error } = await supabase
        .from('checkouts')
        .select('tool_id, user_name, checkout_date')
        .eq('is_returned', false);

      if (error) throw error;

      const checkoutMap: Record<string, { user_name: string; checkout_date: string }> = {};
      data?.forEach(checkout => {
        if (checkout.tool_id) {
          checkoutMap[checkout.tool_id] = {
            user_name: checkout.user_name,
            checkout_date: checkout.checkout_date
          };
        }
      });
      
      setToolCheckouts(checkoutMap);
    } catch (error) {
      console.error('Error fetching tool checkouts:', error);
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

  const handleToolCheckout = (tool: Tool) => {
    setSelectedTool(tool);
    setShowCheckoutDialog(true);
  };

  const handleCheckoutSuccess = () => {
    setShowCheckoutDialog(false);
    setSelectedTool(null);
    // Refresh tools and checkout info to get updated status
    fetchTools();
    fetchToolCheckouts();
    toast({
      title: "Tool checked out successfully",
      description: `${selectedTool?.name} has been checked out`,
    });
  };

  const handleCheckIn = async (tool: Tool) => {
    try {
      // Update tool status back to available
      const { error: updateError } = await supabase
        .from('tools')
        .update({ status: 'available' })
        .eq('id', tool.id);

      if (updateError) throw updateError;

      // Update the most recent checkout to mark it as returned
      const { error: checkoutError } = await supabase
        .from('checkouts')
        .update({ is_returned: true })
        .eq('tool_id', tool.id)
        .eq('is_returned', false);

      if (checkoutError) throw checkoutError;

      // Refresh tools and checkout info to get updated status
      fetchTools();
      fetchToolCheckouts();
      
      toast({
        title: "Tool checked in successfully",
        description: `${tool.name} has been checked in`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to check in tool",
        variant: "destructive",
      });
    }
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
                <div className="flex flex-col space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{resource.name}</span>
                    {resource.type === 'part' && resource.quantity && resource.unit && (
                      <Badge variant="secondary">
                        {resource.quantity} {resource.unit}
                      </Badge>
                    )}
                    <Badge variant="outline" className={resource.type === 'part' ? 'text-green-600 border-green-600' : 
                      tools.find(t => t.id === resource.id)?.status === 'checked_out' ? 'text-orange-600 border-orange-600' : 'text-green-600 border-green-600'}>
                      {resource.type === 'part' ? 'Available' : 
                       tools.find(t => t.id === resource.id)?.status === 'checked_out' ? 'Checked Out' : 'Available for Checkout'}
                    </Badge>
                  </div>
                  {resource.type === 'tool' && tools.find(t => t.id === resource.id)?.status === 'checked_out' && toolCheckouts[resource.id] && (
                    <div className="text-sm text-muted-foreground">
                      Checked out to: {toolCheckouts[resource.id].user_name}
                    </div>
                  )}
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
                    onClick={() => {
                      if (resource.type === 'tool') {
                        const tool = tools.find(t => t.id === resource.id);
                        if (tool) {
                          if (tool.status === 'checked_out') {
                            handleCheckIn(tool);
                          } else {
                            handleToolCheckout(tool);
                          }
                        }
                      }
                    }}
                  >
                    {resource.type === 'part' ? 'Use' : 
                     tools.find(t => t.id === resource.id)?.status === 'checked_out' ? 'Check In' : 'Checkout'}
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

      {/* Tools Available to Mission Team */}
      {teamTools.length > 0 && (
        <div className="space-y-4">
          <h4 className="font-medium text-muted-foreground flex items-center gap-2">
            <User className="h-4 w-4" />
            Tools Available to Mission Team
          </h4>
          <div className="space-y-2">
            {teamTools.map((tool) => (
              <div key={tool.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                <div className="flex-1">
                  <p className="font-medium">{tool.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Checked out to {tool.checked_out_to}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={tool.condition === 'good' ? 'default' : 'destructive'}>
                    {tool.condition}
                  </Badge>
                  <Badge variant="secondary">Available for mission</Badge>
                </div>
              </div>
            ))}
          </div>
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
                  filteredTools.filter(tool => tool.status === 'available').length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      No available tools found
                    </div>
                  ) : (
                    filteredTools
                      .filter(tool => tool.status === 'available')
                      .map((tool) => (
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

      <ToolCheckoutDialog
        tool={selectedTool}
        open={showCheckoutDialog}
        onOpenChange={setShowCheckoutDialog}
        onSuccess={handleCheckoutSuccess}
        assignedTasks={assignedTasks}
      />
    </div>
  );
}