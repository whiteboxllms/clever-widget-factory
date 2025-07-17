import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Search, Plus, Edit, Trash2, Package, AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react';

interface Part {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  current_quantity: number;
  minimum_quantity: number | null;
  cost_per_unit: number | null;
  unit: string | null;
  supplier: string | null;
  intended_storage_location: string;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export default function Parts() {
  const [parts, setParts] = useState<Part[]>([]);
  const [filteredParts, setFilteredParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [showQuantityDialog, setShowQuantityDialog] = useState(false);
  const [quantityPart, setQuantityPart] = useState<Part | null>(null);
  const [quantityOperation, setQuantityOperation] = useState<'add' | 'remove'>('add');
  const { toast } = useToast();

  const [newPart, setNewPart] = useState({
    name: '',
    description: '',
    category: '',
    current_quantity: 0,
    minimum_quantity: 0,
    cost_per_unit: '',
    unit: 'pieces',
    supplier: '',
    intended_storage_location: ''
  });

  const [quantityChange, setQuantityChange] = useState({
    amount: '',
    reason: ''
  });

  useEffect(() => {
    fetchParts();
  }, []);

  useEffect(() => {
    filterParts();
  }, [parts, searchTerm, selectedCategory]);

  const fetchParts = async () => {
    try {
      const { data, error } = await supabase
        .from('parts')
        .select('*')
        .order('name');

      if (error) throw error;
      setParts(data || []);
    } catch (error) {
      console.error('Error fetching parts:', error);
      toast({
        title: "Error",
        description: "Failed to fetch parts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterParts = () => {
    let filtered = parts;

    if (searchTerm) {
      filtered = filtered.filter(part =>
        part.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        part.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        part.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        part.supplier?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedCategory !== 'all') {
      if (selectedCategory === 'low-stock') {
        filtered = filtered.filter(part => 
          part.minimum_quantity && part.current_quantity <= part.minimum_quantity
        );
      } else {
        filtered = filtered.filter(part => part.category === selectedCategory);
      }
    }

    setFilteredParts(filtered);
  };

  const addPart = async () => {
    try {
      const { error } = await supabase
        .from('parts')
        .insert([{
          ...newPart,
          cost_per_unit: newPart.cost_per_unit ? parseFloat(newPart.cost_per_unit) : null
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Part added successfully",
      });

      setNewPart({
        name: '',
        description: '',
        category: '',
        current_quantity: 0,
        minimum_quantity: 0,
        cost_per_unit: '',
        unit: 'pieces',
        supplier: '',
        intended_storage_location: ''
      });
      setShowAddDialog(false);
      fetchParts();
    } catch (error) {
      console.error('Error adding part:', error);
      toast({
        title: "Error",
        description: "Failed to add part",
        variant: "destructive",
      });
    }
  };

  const updatePart = async () => {
    if (!editingPart) return;

    try {
      const { error } = await supabase
        .from('parts')
        .update({
          name: editingPart.name,
          description: editingPart.description,
          category: editingPart.category,
          minimum_quantity: editingPart.minimum_quantity,
          cost_per_unit: editingPart.cost_per_unit,
          unit: editingPart.unit,
          supplier: editingPart.supplier,
          intended_storage_location: editingPart.intended_storage_location
        })
        .eq('id', editingPart.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Part updated successfully",
      });

      setShowEditDialog(false);
      setEditingPart(null);
      fetchParts();
    } catch (error) {
      console.error('Error updating part:', error);
      toast({
        title: "Error",
        description: "Failed to update part",
        variant: "destructive",
      });
    }
  };

  const deletePart = async (partId: string) => {
    try {
      const { error } = await supabase
        .from('parts')
        .delete()
        .eq('id', partId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Part deleted successfully",
      });

      fetchParts();
    } catch (error) {
      console.error('Error deleting part:', error);
      toast({
        title: "Error",
        description: "Failed to delete part",
        variant: "destructive",
      });
    }
  };

  const updateQuantity = async () => {
    if (!quantityPart || !quantityChange.amount) return;

    const amount = parseInt(quantityChange.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid quantity",
        variant: "destructive",
      });
      return;
    }

    const newQuantity = quantityOperation === 'add' 
      ? quantityPart.current_quantity + amount
      : quantityPart.current_quantity - amount;

    if (newQuantity < 0) {
      toast({
        title: "Error",
        description: "Cannot have negative quantity",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('parts')
        .update({ current_quantity: newQuantity })
        .eq('id', quantityPart.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Quantity ${quantityOperation === 'add' ? 'increased' : 'decreased'} successfully`,
      });

      setShowQuantityDialog(false);
      setQuantityPart(null);
      setQuantityChange({ amount: '', reason: '' });
      fetchParts();
    } catch (error) {
      console.error('Error updating quantity:', error);
      toast({
        title: "Error",
        description: "Failed to update quantity",
        variant: "destructive",
      });
    }
  };

  const getStockStatus = (part: Part) => {
    if (!part.minimum_quantity) return null;
    if (part.current_quantity <= part.minimum_quantity) return 'low';
    if (part.current_quantity <= part.minimum_quantity * 1.5) return 'medium';
    return 'good';
  };

  const getStockBadge = (part: Part) => {
    const status = getStockStatus(part);
    if (!status) return null;

    const variants = {
      low: { variant: 'destructive', icon: AlertTriangle, text: 'Low Stock' },
      medium: { variant: 'default', icon: TrendingDown, text: 'Running Low' },
      good: { variant: 'default', icon: TrendingUp, text: 'Good Stock' }
    } as const;

    const config = variants[status];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant as any} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.text}
      </Badge>
    );
  };

  const categories = Array.from(new Set(parts.map(part => part.category).filter(Boolean))) as string[];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading parts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground">Parts & Consumables</h1>
            <p className="text-muted-foreground mt-2">Manage inventory and track quantities</p>
          </div>
          
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add New Part
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New Part</DialogTitle>
                <DialogDescription>
                  Add a new part or consumable to your inventory
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="name">Part Name *</Label>
                  <Input
                    id="name"
                    value={newPart.name}
                    onChange={(e) => setNewPart({...newPart, name: e.target.value})}
                    placeholder="Enter part name"
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newPart.description}
                    onChange={(e) => setNewPart({...newPart, description: e.target.value})}
                    placeholder="Enter part description"
                  />
                </div>

                <div>
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={newPart.category}
                    onChange={(e) => setNewPart({...newPart, category: e.target.value})}
                    placeholder="e.g., Fasteners, Hardware"
                  />
                </div>

                <div>
                  <Label htmlFor="supplier">Supplier</Label>
                  <Input
                    id="supplier"
                    value={newPart.supplier}
                    onChange={(e) => setNewPart({...newPart, supplier: e.target.value})}
                    placeholder="Enter supplier name"
                  />
                </div>

                <div>
                  <Label htmlFor="current_quantity">Current Quantity *</Label>
                  <Input
                    id="current_quantity"
                    type="number"
                    min="0"
                    value={newPart.current_quantity}
                    onChange={(e) => setNewPart({...newPart, current_quantity: parseInt(e.target.value) || 0})}
                  />
                </div>

                <div>
                  <Label htmlFor="minimum_quantity">Minimum Quantity</Label>
                  <Input
                    id="minimum_quantity"
                    type="number"
                    min="0"
                    value={newPart.minimum_quantity}
                    onChange={(e) => setNewPart({...newPart, minimum_quantity: parseInt(e.target.value) || 0})}
                  />
                </div>

                <div>
                  <Label htmlFor="unit">Unit</Label>
                  <Select value={newPart.unit} onValueChange={(value) => setNewPart({...newPart, unit: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pieces">Pieces</SelectItem>
                      <SelectItem value="kg">Kilograms</SelectItem>
                      <SelectItem value="lbs">Pounds</SelectItem>
                      <SelectItem value="meters">Meters</SelectItem>
                      <SelectItem value="feet">Feet</SelectItem>
                      <SelectItem value="liters">Liters</SelectItem>
                      <SelectItem value="gallons">Gallons</SelectItem>
                      <SelectItem value="boxes">Boxes</SelectItem>
                      <SelectItem value="rolls">Rolls</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="cost_per_unit">Cost per Unit</Label>
                  <Input
                    id="cost_per_unit"
                    type="number"
                    step="0.01"
                    min="0"
                    value={newPart.cost_per_unit}
                    onChange={(e) => setNewPart({...newPart, cost_per_unit: e.target.value})}
                    placeholder="0.00"
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="intended_storage_location">Storage Location *</Label>
                  <Input
                    id="intended_storage_location"
                    value={newPart.intended_storage_location}
                    onChange={(e) => setNewPart({...newPart, intended_storage_location: e.target.value})}
                    placeholder="Enter storage location"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={addPart} disabled={!newPart.name || !newPart.intended_storage_location}>
                  Add Part
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search parts by name, description, category, or supplier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="low-stock">Low Stock</SelectItem>
              {categories.map(category => (
                <SelectItem key={category} value={category}>{category}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Parts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredParts.map((part) => (
            <Card key={part.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{part.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {part.description || 'No description available'}
                    </CardDescription>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingPart(part);
                        setShowEditDialog(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Part</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{part.name}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deletePart(part.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Current Quantity:</span>
                    <span className="text-lg font-bold">{part.current_quantity} {part.unit}</span>
                  </div>
                  
                  {part.minimum_quantity && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Minimum:</span>
                      <span className="text-sm">{part.minimum_quantity} {part.unit}</span>
                    </div>
                  )}

                  {getStockBadge(part)}

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Category:</span>
                    <Badge variant="outline">{part.category || 'Uncategorized'}</Badge>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Location:</span>
                    <span className="text-right">{part.intended_storage_location}</span>
                  </div>

                  {part.cost_per_unit && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Cost per unit:</span>
                      <span>${part.cost_per_unit.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setQuantityPart(part);
                        setQuantityOperation('add');
                        setShowQuantityDialog(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setQuantityPart(part);
                        setQuantityOperation('remove');
                        setShowQuantityDialog(true);
                      }}
                    >
                      <Package className="h-4 w-4 mr-1" />
                      Use
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredParts.length === 0 && (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">No parts found</h3>
            <p className="text-muted-foreground">
              {searchTerm || selectedCategory !== 'all' 
                ? 'Try adjusting your search or filter criteria'
                : 'Add your first part to get started'
              }
            </p>
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Part</DialogTitle>
              <DialogDescription>
                Update part information
              </DialogDescription>
            </DialogHeader>
            
            {editingPart && (
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="edit-name">Part Name *</Label>
                  <Input
                    id="edit-name"
                    value={editingPart.name}
                    onChange={(e) => setEditingPart({...editingPart, name: e.target.value})}
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={editingPart.description || ''}
                    onChange={(e) => setEditingPart({...editingPart, description: e.target.value})}
                  />
                </div>

                <div>
                  <Label htmlFor="edit-category">Category</Label>
                  <Input
                    id="edit-category"
                    value={editingPart.category || ''}
                    onChange={(e) => setEditingPart({...editingPart, category: e.target.value})}
                  />
                </div>

                <div>
                  <Label htmlFor="edit-supplier">Supplier</Label>
                  <Input
                    id="edit-supplier"
                    value={editingPart.supplier || ''}
                    onChange={(e) => setEditingPart({...editingPart, supplier: e.target.value})}
                  />
                </div>

                <div>
                  <Label htmlFor="edit-minimum">Minimum Quantity</Label>
                  <Input
                    id="edit-minimum"
                    type="number"
                    min="0"
                    value={editingPart.minimum_quantity || ''}
                    onChange={(e) => setEditingPart({...editingPart, minimum_quantity: parseInt(e.target.value) || null})}
                  />
                </div>

                <div>
                  <Label htmlFor="edit-unit">Unit</Label>
                  <Select value={editingPart.unit || 'pieces'} onValueChange={(value) => setEditingPart({...editingPart, unit: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pieces">Pieces</SelectItem>
                      <SelectItem value="kg">Kilograms</SelectItem>
                      <SelectItem value="lbs">Pounds</SelectItem>
                      <SelectItem value="meters">Meters</SelectItem>
                      <SelectItem value="feet">Feet</SelectItem>
                      <SelectItem value="liters">Liters</SelectItem>
                      <SelectItem value="gallons">Gallons</SelectItem>
                      <SelectItem value="boxes">Boxes</SelectItem>
                      <SelectItem value="rolls">Rolls</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="edit-cost">Cost per Unit</Label>
                  <Input
                    id="edit-cost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingPart.cost_per_unit || ''}
                    onChange={(e) => setEditingPart({...editingPart, cost_per_unit: parseFloat(e.target.value) || null})}
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="edit-location">Storage Location *</Label>
                  <Input
                    id="edit-location"
                    value={editingPart.intended_storage_location}
                    onChange={(e) => setEditingPart({...editingPart, intended_storage_location: e.target.value})}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button onClick={updatePart}>
                Update Part
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Quantity Dialog */}
        <Dialog open={showQuantityDialog} onOpenChange={setShowQuantityDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {quantityOperation === 'add' ? 'Add Quantity' : 'Use/Remove Quantity'}
              </DialogTitle>
              <DialogDescription>
                {quantityPart && (
                  <>
                    {quantityOperation === 'add' 
                      ? `Add more ${quantityPart.name} to inventory`
                      : `Record usage of ${quantityPart.name}`
                    }
                    <br />
                    Current quantity: {quantityPart.current_quantity} {quantityPart.unit}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="quantity-amount">Quantity</Label>
                <Input
                  id="quantity-amount"
                  type="number"
                  min="1"
                  value={quantityChange.amount}
                  onChange={(e) => setQuantityChange({...quantityChange, amount: e.target.value})}
                  placeholder="Enter quantity"
                />
              </div>

              <div>
                <Label htmlFor="quantity-reason">Reason (optional)</Label>
                <Textarea
                  id="quantity-reason"
                  value={quantityChange.reason}
                  onChange={(e) => setQuantityChange({...quantityChange, reason: e.target.value})}
                  placeholder={quantityOperation === 'add' ? 'e.g., New purchase, returned items' : 'e.g., Used for project X, damaged items'}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowQuantityDialog(false)}>
                Cancel
              </Button>
              <Button onClick={updateQuantity} disabled={!quantityChange.amount}>
                {quantityOperation === 'add' ? 'Add to' : 'Remove from'} Inventory
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}