import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Search, User, Undo2 } from 'lucide-react';
import { supabase } from '@/lib/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from "@/hooks/useCognitoAuth";
import { useOrganizationId } from '@/hooks/useOrganizationId';
import { ToolCheckoutDialog } from '@/components/ToolCheckoutDialog';
import { ToolCheckInDialog } from '@/components/ToolCheckInDialog';
import { Tables } from '@/integrations/supabase/types';
import { format } from 'date-fns';

interface Part {
  id: string;
  name: string;
  description: string;
  current_quantity: number;
  unit: string;
  category: string;
  image_url: string;
}

type Tool = Tables<'tools'>;

interface SelectedResource {
  id: string;
  name: string;
  quantity?: number;
  unit?: string;
  type: 'part' | 'tool';
  status: 'planned' | 'used' | 'returned';
  usedAt?: string;
  usedBy?: string;
}

interface ResourceSelectorProps {
  selectedResources: SelectedResource[];
  onResourcesChange: (resources: SelectedResource[]) => void;
  assignedTasks?: string[];
  missionId?: string;
  assignedUsers?: Array<{ user_id: string; full_name: string }>;
}

export function ResourceSelector({ selectedResources, onResourcesChange, assignedTasks = [], missionId, assignedUsers = [] }: ResourceSelectorProps) {
  const organizationId = useOrganizationId();
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
  const [selectedCheckInTool, setSelectedCheckInTool] = useState<Tool | null>(null);
  const [showCheckInDialog, setShowCheckInDialog] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

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
    if (!missionId) return;

    // Fetch tools checked out by team members (assigned users)
    if (assignedUsers.length === 0) return;

    const userIds = assignedUsers.map(u => u.user_id);

    const { data, error } = await supabase
      .from('checkouts')
      .select(`
        id,
        user_name,
        checkout_date,
        is_returned,
        tool_id,
        tools!inner (
          id,
          name,
          status
        )
      `)
      .in('user_id', userIds)
      .eq('is_returned', false);

    if (error) {
      console.error('Error fetching team tools:', error);
      return;
    }

    const toolsWithUsers = data?.map(checkout => ({
      ...(checkout.tools || {}),
      checkout_id: checkout.id,
      checked_out_to: checkout.user_name,
      checkout_date: checkout.checkout_date,
      mission_linked: true
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
        status: 'planned',
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

  const markResourceAsUsed = (resource: SelectedResource) => {
    if (!user?.id) {
      throw new Error('User must be authenticated to mark resources as used');
    }
    
    const updated = selectedResources.map(r =>
      r.id === resource.id 
        ? { 
            ...r, 
            status: 'used' as const, 
            usedAt: new Date().toISOString(),
            usedBy: user.id
          }
        : r
    );
    onResourcesChange(updated);
  };

  const revertResourceUsage = (resource: SelectedResource) => {
    const updated = selectedResources.map(r =>
      r.id === resource.id 
        ? { 
            ...r, 
            status: 'planned' as const, 
            usedAt: undefined,
            usedBy: undefined
          }
        : r
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

  const handleCheckIn = (tool: Tool) => {
    setSelectedCheckInTool(tool);
    setShowCheckInDialog(true);
  };

  const handleCheckInSuccess = () => {
    setShowCheckInDialog(false);
    setSelectedCheckInTool(null);
    // Refresh tools and checkout info to get updated status
    fetchTools();
    fetchToolCheckouts();
  };

  const handleInventoryUsage = async (resource: SelectedResource) => {
    if (!missionId || !user) {
      toast({
        title: "Error",
        description: "Mission ID and user authentication required",
        variant: "destructive",
      });
      return;
    }

    try {
      // Note: inventory_usage table doesn't exist - usage is tracked in parts_history below

      // Get current quantity first, then update
      const { data: partData, error: fetchError } = await supabase
        .from('parts')
        .select('current_quantity')
        .eq('id', resource.id)
        .single();

      if (fetchError) throw fetchError;

      const newQuantity = (partData?.current_quantity || 0) - (resource.quantity || 1);
      
      // Update part quantity in inventory
      const { error: updateError } = await supabase
        .from('parts')
        .update({
          current_quantity: Math.max(0, newQuantity) // Ensure quantity doesn't go negative
        })
        .eq('id', resource.id);

      if (updateError) throw updateError;

      // Create a history record for the quantity change
      if (!user?.id) {
        throw new Error('User must be authenticated to use inventory resources');
      }
      
      const { error: historyError } = await supabase
        .from('parts_history')
        .insert({
          part_id: resource.id,
          change_type: 'quantity_remove',
          old_quantity: partData?.current_quantity || 0,
          new_quantity: Math.max(0, newQuantity),
          quantity_change: -(resource.quantity || 1),
          changed_by: user.id,
          change_reason: `Used for mission - ${resource.quantity || 1} ${resource.unit || 'pieces'} of ${resource.name}`,
        });

      if (historyError) {
        console.error('Error creating history record:', historyError);
        // Don't throw error here as the main operation succeeded
      }

      toast({
        title: "Inventory used successfully",
        description: `${resource.quantity || 1} ${resource.unit || 'pieces'} of ${resource.name} recorded as used`,
      });

      // Mark resource as used instead of removing it
      markResourceAsUsed(resource);
      
      // Refresh parts data to show updated quantities
      fetchParts();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to record inventory usage",
        variant: "destructive",
      });
    }
  };

  // Separate resources by status
  const plannedResources = selectedResources.filter(r => r.status === 'planned');
  const usedResources = selectedResources.filter(r => r.status === 'used');

  const getResourceStatusBadge = (resource: SelectedResource) => {
    switch (resource.status) {
      case 'planned':
        return <Badge variant="outline" className="text-blue-600 border-blue-600">Planned</Badge>;
      case 'used':
        return <Badge variant="secondary" className="bg-gray-100 text-gray-600">Used</Badge>;
      case 'returned':
        return <Badge variant="outline" className="text-green-600 border-green-600">Returned</Badge>;
      default:
        return null;
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
            Add Stock
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

      {/* Resource Summary */}
      {selectedResources.length > 0 && (
        <div className="grid grid-cols-3 gap-4 p-3 bg-muted/30 rounded-lg">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{plannedResources.length}</div>
            <div className="text-sm text-muted-foreground">Planned</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600">{usedResources.length}</div>
            <div className="text-sm text-muted-foreground">Used</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{selectedResources.filter(r => r.status === 'returned').length}</div>
            <div className="text-sm text-muted-foreground">Returned</div>
          </div>
        </div>
      )}

      {/* Planned Resources */}
      {plannedResources.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-blue-600">Planned Resources</h4>
          {plannedResources.map((resource) => (
            <Card key={`${resource.id}-planned`} className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex flex-col space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{resource.name}</span>
                    {resource.type === 'part' && resource.quantity && resource.unit && (
                      <Badge variant="secondary">
                        {resource.quantity} {resource.unit}
                      </Badge>
                    )}
                    {getResourceStatusBadge(resource)}
                  </div>
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
                      } else if (resource.type === 'part') {
                        handleInventoryUsage(resource);
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

      {/* Used Resources */}
      {usedResources.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-gray-600">Used Resources</h4>
          {usedResources.map((resource) => (
            <Card key={`${resource.id}-used`} className="p-3 bg-gray-50 border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex flex-col space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-700">{resource.name}</span>
                    {resource.type === 'part' && resource.quantity && resource.unit && (
                      <Badge variant="secondary" className="bg-gray-200">
                        {resource.quantity} {resource.unit}
                      </Badge>
                    )}
                    {getResourceStatusBadge(resource)}
                  </div>
                  {resource.usedAt && (
                    <div className="text-sm text-gray-500">
                      Used on {format(new Date(resource.usedAt), 'PPp')} by {resource.usedBy}
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => revertResourceUsage(resource)}
                    className="text-blue-600 border-blue-600 hover:bg-blue-50"
                  >
                    <Undo2 className="h-4 w-4 mr-1" />
                    Revert
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
                  <Badge variant={tool.condition === 'no_problems_observed' ? 'default' : 'destructive'}>
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
                            Status: {tool.status}
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
        missionId={missionId}
      />

      <ToolCheckInDialog
        tool={selectedCheckInTool}
        open={showCheckInDialog}
        onOpenChange={setShowCheckInDialog}
        onSuccess={handleCheckInSuccess}
      />
    </div>
  );
}
