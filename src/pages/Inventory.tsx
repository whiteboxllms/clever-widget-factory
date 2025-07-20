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
import { Search, Plus, Edit, Trash2, Package, AlertTriangle, TrendingDown, TrendingUp, Wrench, ExternalLink, Upload, UserPlus, Check, ChevronsUpDown, ChevronDown, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { InventoryHistoryDialog } from '@/components/InventoryHistoryDialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { compressImage, formatFileSize } from '@/lib/imageUtils';
import { compressImageDetailed } from '@/lib/enhancedImageUtils';
import { useEnhancedToast } from '@/hooks/useEnhancedToast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';

interface Supplier {
  id: string;
  name: string;
  contact_info: any;
  quality_rating: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Part {
  id: string;
  name: string;
  description: string | null;
  current_quantity: number;
  minimum_quantity: number | null;
  cost_per_unit: number | null;
  unit: string | null;
  supplier: string | null;
  supplier_id: string | null;
  intended_storage_location: string;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

interface Tool {
  id: string;
  name: string;
  category: string | null;
  status: 'available' | 'checked_out' | 'unavailable' | 'unable_to_find';
  condition: 'good' | 'functional_but_not_efficient' | 'not_functional';
  intended_storage_location: string;
}

interface ToolSummary {
  name: string;
  category: string | null;
  total_count: number;
  available_count: number;
  checked_out_count: number;
  unavailable_count: number;
  unable_to_find_count: number;
  location: string;
}

export default function Inventory() {
  const [parts, setParts] = useState<Part[]>([]);
  const [filteredParts, setFilteredParts] = useState<Part[]>([]);
  const [toolSummaries, setToolSummaries] = useState<ToolSummary[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showLowInventoryOnly, setShowLowInventoryOnly] = useState(false);
  
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [showQuantityDialog, setShowQuantityDialog] = useState(false);
  const [quantityPart, setQuantityPart] = useState<Part | null>(null);
  const [quantityOperation, setQuantityOperation] = useState<'add' | 'remove'>('add');
  const { toast } = useToast();
  const enhancedToast = useEnhancedToast();
  const navigate = useNavigate();

  const [newPart, setNewPart] = useState({
    name: '',
    description: '',
    current_quantity: 0,
    minimum_quantity: 0,
    cost_per_unit: '',
    unit: 'pieces',
    supplier_id: '',
    intended_storage_location: ''
  });

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [editSelectedImage, setEditSelectedImage] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showAddSupplierDialog, setShowAddSupplierDialog] = useState(false);
  const [newSupplier, setNewSupplier] = useState('');
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [editSupplierOpen, setEditSupplierOpen] = useState(false);
  const [toolsSummaryExpanded, setToolsSummaryExpanded] = useState(false);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());

  const [quantityChange, setQuantityChange] = useState({
    amount: '',
    reason: ''
  });

  useEffect(() => {
    fetchParts();
    fetchToolSummaries();
    fetchSuppliers();
  }, []);

  useEffect(() => {
    filterParts();
  }, [parts, searchTerm, showLowInventoryOnly]);

  const fetchParts = async () => {
    try {
      const { data, error } = await supabase
        .from('parts')
        .select(`
          *,
          suppliers (
            id,
            name
          )
        `)
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

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      toast({
        title: "Error",
        description: "Failed to fetch suppliers",
        variant: "destructive",
      });
    }
  };

  const fetchToolSummaries = async () => {
    try {
      const { data, error } = await supabase
        .from('tools')
        .select('id, name, category, status, intended_storage_location')
        .order('name');

      if (error) throw error;

      // Group tools by name and aggregate counts
      const toolGroups = (data || []).reduce((acc: { [key: string]: ToolSummary }, tool) => {
        const key = tool.name;
        if (!acc[key]) {
          acc[key] = {
            name: tool.name,
            category: tool.category,
            total_count: 0,
            available_count: 0,
            checked_out_count: 0,
            unavailable_count: 0,
            unable_to_find_count: 0,
            location: tool.intended_storage_location,
          };
        }
        
        acc[key].total_count++;
        if (tool.status === 'available') acc[key].available_count++;
        else if (tool.status === 'checked_out') acc[key].checked_out_count++;
        else if (tool.status === 'unavailable') acc[key].unavailable_count++;
        else if (tool.status === 'unable_to_find') acc[key].unable_to_find_count++;
        
        return acc;
      }, {});

      setToolSummaries(Object.values(toolGroups));
    } catch (error) {
      console.error('Error fetching tool summaries:', error);
      toast({
        title: "Error",
        description: "Failed to fetch tool summaries",
        variant: "destructive",
      });
    }
  };

  const filterParts = () => {
    let filtered = parts;

    if (searchTerm) {
      filtered = filtered.filter(part => {
        const supplierName = part.supplier_id 
          ? suppliers.find(s => s.id === part.supplier_id)?.name 
          : part.supplier; // fallback to old supplier field
        
        return part.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          part.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          supplierName?.toLowerCase().includes(searchTerm.toLowerCase());
      });
    }

    if (showLowInventoryOnly) {
      filtered = filtered.filter(part => {
        const minQty = part.minimum_quantity || 0;
        return part.current_quantity <= minQty;
      });
    }

    setFilteredParts(filtered);
  };

  const uploadImage = async (file: File, partId?: string) => {
    // Enhanced compression with detailed tracking
    const compressionToast = enhancedToast.showCompressionStart(file.name, file.size);

    try {
      const compressionResult = await compressImageDetailed(
        file,
        {},
        enhancedToast.showCompressionProgress
      );
      
      enhancedToast.dismiss(compressionToast.id);
      const compressionCompleteToast = enhancedToast.showCompressionComplete(compressionResult);
      
      const compressedFile = compressionResult.file;

      const fileExt = compressedFile.name.split('.').pop();
      const fileName = `${partId || Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `parts/${fileName}`;

      // Enhanced upload tracking
      enhancedToast.dismiss(compressionCompleteToast.id);
      const uploadToast = enhancedToast.showUploadStart(fileName, compressedFile.size);

      const { error: uploadError } = await supabase.storage
        .from('tool-images')
        .upload(filePath, compressedFile);

      if (uploadError) throw uploadError;

      enhancedToast.dismiss(uploadToast.id);
      
      const { data: { publicUrl } } = supabase.storage
        .from('tool-images')
        .getPublicUrl(filePath);

      enhancedToast.showUploadSuccess(fileName, publicUrl);
      return publicUrl;
      
    } catch (error) {
      enhancedToast.showUploadError(error.message, file.name);
      throw error;
    }
  };

  const addPart = async () => {
    try {
      setUploadingImage(true);
      
      let imageUrl = null;
      if (selectedImage) {
        imageUrl = await uploadImage(selectedImage);
      }

      const { data, error } = await supabase
        .from('parts')
        .insert([{
          ...newPart,
          cost_per_unit: newPart.cost_per_unit ? parseFloat(newPart.cost_per_unit) : null,
          image_url: imageUrl
        }])
        .select()
        .single();

      if (error) throw error;

      // Log the creation to history
      const { error: historyError } = await supabase
        .from('parts_history')
        .insert([{
          part_id: data.id,
          change_type: 'create',
          old_quantity: null,
          new_quantity: newPart.current_quantity,
          quantity_change: null,
          changed_by: 'System User', // TODO: Replace with actual user when authentication is implemented
          change_reason: 'Item created'
        }]);

      if (historyError) {
        console.error('Error logging history:', historyError);
        // Don't fail the operation if history logging fails
      }

      toast({
        title: "Success",
        description: "Inventory item added successfully",
      });

      setNewPart({
        name: '',
        description: '',
        current_quantity: 0,
        minimum_quantity: 0,
        cost_per_unit: '',
        unit: 'pieces',
        supplier_id: '',
        intended_storage_location: ''
      });
      setSelectedImage(null);
      setShowAddDialog(false);
      fetchParts();
    } catch (error) {
      console.error('Error adding part:', error);
      toast({
        title: "Error",
        description: "Failed to add part",
        variant: "destructive",
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const updatePart = async () => {
    if (!editingPart) return;

    try {
      setUploadingImage(true);
      
      let imageUrl = editingPart.image_url;
      if (editSelectedImage) {
        imageUrl = await uploadImage(editSelectedImage, editingPart.id);
      }

        const { error } = await supabase
        .from('parts')
        .update({
          name: editingPart.name,
          description: editingPart.description,
          current_quantity: editingPart.current_quantity,
          minimum_quantity: editingPart.minimum_quantity,
          cost_per_unit: editingPart.cost_per_unit,
          unit: editingPart.unit,
          supplier_id: editingPart.supplier_id,
          intended_storage_location: editingPart.intended_storage_location,
          image_url: imageUrl
        })
        .eq('id', editingPart.id);

      if (error) throw error;

      // Log the update to history
      const { error: historyError } = await supabase
        .from('parts_history')
        .insert([{
          part_id: editingPart.id,
          change_type: 'update',
          old_quantity: null,
          new_quantity: null,
          quantity_change: null,
          changed_by: 'System User', // TODO: Replace with actual user when authentication is implemented
          change_reason: 'Item details updated'
        }]);

      if (historyError) {
        console.error('Error logging history:', historyError);
        // Don't fail the operation if history logging fails
      }

      toast({
        title: "Success",
        description: "Part updated successfully",
      });

      setShowEditDialog(false);
      setEditingPart(null);
      setEditSelectedImage(null);
      fetchParts();
    } catch (error) {
      console.error('Error updating part:', error);
      toast({
        title: "Error",
        description: "Failed to update part",
        variant: "destructive",
      });
    } finally {
      setUploadingImage(false);
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
      // Update the part quantity
      const { error } = await supabase
        .from('parts')
        .update({ current_quantity: newQuantity })
        .eq('id', quantityPart.id);

      if (error) throw error;

      // Log the change to history
      const { error: historyError } = await supabase
        .from('parts_history')
        .insert([{
          part_id: quantityPart.id,
          change_type: quantityOperation === 'add' ? 'quantity_add' : 'quantity_remove',
          old_quantity: quantityPart.current_quantity,
          new_quantity: newQuantity,
          quantity_change: quantityOperation === 'add' ? amount : -amount,
          changed_by: 'System User', // TODO: Replace with actual user when authentication is implemented
          change_reason: quantityChange.reason || null
        }]);

      if (historyError) {
        console.error('Error logging history:', historyError);
        // Don't fail the operation if history logging fails
      }

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
    if (!status || status === 'good') return null;

    const variants = {
      low: { variant: 'destructive', icon: AlertTriangle, text: 'Low Stock' },
      medium: { variant: 'default', icon: TrendingDown, text: 'Running Low' }
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

  const addSupplier = async () => {
    if (!newSupplier.trim()) return;

    try {
      const { data, error } = await supabase
        .from('suppliers')
        .insert([{ name: newSupplier.trim() }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: "Supplier added successfully",
      });

      setNewSupplier('');
      setShowAddSupplierDialog(false);
      await fetchSuppliers();
      
      // Auto-select the new supplier
      setNewPart({...newPart, supplier_id: data.id});
    } catch (error) {
      console.error('Error adding supplier:', error);
      toast({
        title: "Error",
        description: "Failed to add supplier",
        variant: "destructive",
      });
    }
  };

  const toggleDescription = (partId: string) => {
    const newExpanded = new Set(expandedDescriptions);
    if (newExpanded.has(partId)) {
      newExpanded.delete(partId);
    } else {
      newExpanded.add(partId);
    }
    setExpandedDescriptions(newExpanded);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading inventory...</p>
          </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground">Manage Inventory</h1>
            <p className="text-muted-foreground mt-2">Manage inventory items and view tool summaries</p>
          </div>
          
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New Inventory Item</DialogTitle>
                <DialogDescription>
                  Add a new inventory item to your system
                </DialogDescription>
              </DialogHeader>
              
              <ScrollArea className="max-h-[70vh]">
                <div className="grid grid-cols-2 gap-4 pr-4">
                  <div className="col-span-2">
                    <Label htmlFor="name">Item Name *</Label>
                    <Input
                      id="name"
                      value={newPart.name}
                      onChange={(e) => setNewPart({...newPart, name: e.target.value})}
                      placeholder="Enter item name"
                    />
                  </div>

                  <div className="col-span-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={newPart.description}
                      onChange={(e) => setNewPart({...newPart, description: e.target.value})}
                      placeholder="Enter item description"
                    />
                  </div>

                  <div className="col-span-2">
                    <Label htmlFor="image">Picture</Label>
                    <div className="flex items-center gap-4">
                      <Input
                        id="image"
                        type="file"
                        accept="image/*"
                        onChange={(e) => setSelectedImage(e.target.files?.[0] || null)}
                        className="flex-1"
                      />
                      <Upload className="h-4 w-4 text-muted-foreground" />
                    </div>
                    {selectedImage && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Selected: {selectedImage.name}
                      </p>
                    )}
                  </div>

                  <div className="col-span-2">
                    <div className="flex items-center justify-between mb-2">
                      <Label>Supplier</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAddSupplierDialog(true)}
                        className="flex items-center gap-1"
                      >
                        <UserPlus className="h-3 w-3" />
                        Add Supplier
                      </Button>
                    </div>
                    <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={supplierOpen}
                          className="w-full justify-between"
                        >
                          {newPart.supplier_id
                            ? suppliers.find((supplier) => supplier.id === newPart.supplier_id)?.name
                            : "Select supplier..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0">
                        <Command>
                          <CommandInput placeholder="Search supplier..." />
                          <CommandList>
                            <CommandEmpty>No supplier found.</CommandEmpty>
                            <CommandGroup>
                              {suppliers.map((supplier) => (
                                <CommandItem
                                  key={supplier.id}
                                  value={supplier.name}
                                  onSelect={(currentValue) => {
                                    const selectedSupplier = suppliers.find(s => s.name.toLowerCase() === currentValue.toLowerCase());
                                    setNewPart({...newPart, supplier_id: selectedSupplier?.id || ''});
                                    setSupplierOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      newPart.supplier_id === supplier.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {supplier.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
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
                      onChange={(e) => setNewPart({...newPart, minimum_quantity: e.target.value === '' ? 0 : parseInt(e.target.value)})}
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
              </ScrollArea>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={addPart} disabled={!newPart.name || !newPart.intended_storage_location || uploadingImage}>
                  {uploadingImage ? 'Uploading...' : 'Add Item'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Add Supplier Dialog */}
          <Dialog open={showAddSupplierDialog} onOpenChange={setShowAddSupplierDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Supplier</DialogTitle>
                <DialogDescription>
                  Add a new supplier option to the system
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="newSupplier">Supplier Name</Label>
                  <Input
                    id="newSupplier"
                    value={newSupplier}
                    onChange={(e) => setNewSupplier(e.target.value)}
                    placeholder="Enter supplier name"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowAddSupplierDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={addSupplier}
                  disabled={!newSupplier.trim()}
                >
                  Add Supplier
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Tools Summary Section */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <div 
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => setToolsSummaryExpanded(!toolsSummaryExpanded)}
            >
              <ChevronDown 
                className={`h-5 w-5 transition-transform ${toolsSummaryExpanded ? 'rotate-180' : ''}`} 
              />
              <h2 className="text-2xl font-bold text-foreground">Tools Summary</h2>
            </div>
            <Button 
              variant="outline" 
              onClick={() => navigate('/tools')}
              className="flex items-center gap-2"
            >
              <Wrench className="h-4 w-4" />
              Manage Tools
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
          
          {toolsSummaryExpanded && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {toolSummaries.map((tool) => (
                <Card key={tool.name} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{tool.name}</CardTitle>
                        <CardDescription className="mt-1">
                          {tool.category || 'Uncategorized'}
                        </CardDescription>
                      </div>
                      <Badge variant="secondary" className="ml-2">
                        {tool.total_count} total
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Available:</span>
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          {tool.available_count}
                        </Badge>
                      </div>
                      
                      {tool.checked_out_count > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Checked out:</span>
                          <Badge variant="destructive">
                            {tool.checked_out_count}
                          </Badge>
                        </div>
                      )}
                      
                      {tool.unavailable_count > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Unavailable:</span>
                          <Badge variant="secondary">
                            {tool.unavailable_count}
                          </Badge>
                        </div>
                      )}
                      
                      {tool.unable_to_find_count > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Unable to find:</span>
                          <Badge variant="destructive">
                            {tool.unable_to_find_count}
                          </Badge>
                        </div>
                      )}
                      
                      <div className="flex justify-between text-sm pt-2 border-t">
                        <span className="text-muted-foreground">Location:</span>
                        <span className="text-right font-medium">{tool.location}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Consumables Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-4">Inventory Items</h2>
          
          {/* Search and Filters */}
          <div className="mb-6 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search inventory by name, description, or supplier..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="low-inventory-filter"
                checked={showLowInventoryOnly}
                onCheckedChange={setShowLowInventoryOnly}
              />
              <Label htmlFor="low-inventory-filter" className="text-sm font-medium">
                Show Low Inventory Only
              </Label>
            </div>
          </div>

          {/* Consumables Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredParts.map((part) => (
            <Card key={part.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{part.name}</CardTitle>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <InventoryHistoryDialog partId={part.id} partName={part.name}>
                      <Button variant="ghost" size="sm">
                        <History className="h-4 w-4" />
                      </Button>
                    </InventoryHistoryDialog>
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
                          <AlertDialogTitle>Delete Consumable</AlertDialogTitle>
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
                <CardDescription 
                  className="mt-3 text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => toggleDescription(part.id)}
                >
                  {expandedDescriptions.has(part.id) 
                    ? (part.description || 'No description available')
                    : (part.description && part.description.length > 100 
                        ? `${part.description.substring(0, 100)}...` 
                        : (part.description || 'No description available')
                      )
                  }
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-3">
                  {part.image_url && (
                    <div className="w-full h-32 rounded-md overflow-hidden bg-muted">
                      <img
                        src={part.image_url}
                        alt={part.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Current Quantity:</span>
                    <span className="text-lg font-bold">{part.current_quantity} {part.unit}</span>
                  </div>
                  
                  {part.minimum_quantity != null && part.minimum_quantity > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Minimum:</span>
                      <span className="text-sm">{part.minimum_quantity} {part.unit}</span>
                    </div>
                  )}

                  {getStockBadge(part)}


                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Location:</span>
                    <span className="text-right">{part.intended_storage_location}</span>
                  </div>

                  {part.cost_per_unit && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Cost per unit:</span>
                      <span>₱{part.cost_per_unit.toFixed(2)}</span>
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
              <h3 className="text-lg font-medium text-muted-foreground mb-2">No consumables found</h3>
              <p className="text-muted-foreground">
                {searchTerm 
                  ? 'Try adjusting your search criteria'
                  : 'Add your first inventory item to get started'
                }
              </p>
            </div>
          )}
        </div>

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Inventory Item</DialogTitle>
              <DialogDescription>
                Update inventory item information
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="max-h-[70vh]">
              {editingPart && (
                <div className="grid grid-cols-2 gap-4 pr-4">
                  <div className="col-span-2">
                    <Label htmlFor="edit-name">Item Name *</Label>
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

                  <div className="col-span-2">
                    <Label htmlFor="edit-image">Picture</Label>
                    <div className="space-y-2">
                      {editingPart.image_url && (
                        <div className="w-32 h-32 rounded-md overflow-hidden bg-muted">
                          <img
                            src={editingPart.image_url}
                            alt={editingPart.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="flex items-center gap-4">
                        <Input
                          id="edit-image"
                          type="file"
                          accept="image/*"
                          onChange={(e) => setEditSelectedImage(e.target.files?.[0] || null)}
                          className="flex-1"
                        />
                        <Upload className="h-4 w-4 text-muted-foreground" />
                      </div>
                      {editSelectedImage && (
                        <p className="text-sm text-muted-foreground">
                          New image selected: {editSelectedImage.name}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="col-span-2">
                    <div className="flex items-center justify-between mb-2">
                      <Label>Supplier</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAddSupplierDialog(true)}
                        className="flex items-center gap-1"
                      >
                        <UserPlus className="h-3 w-3" />
                        Add Supplier
                      </Button>
                    </div>
                    <Popover open={editSupplierOpen} onOpenChange={setEditSupplierOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={editSupplierOpen}
                          className="w-full justify-between"
                        >
                          {editingPart.supplier_id
                            ? suppliers.find((supplier) => supplier.id === editingPart.supplier_id)?.name
                            : editingPart.supplier || "Select supplier..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0">
                        <Command>
                          <CommandInput placeholder="Search supplier..." />
                          <CommandList>
                            <CommandEmpty>No supplier found.</CommandEmpty>
                            <CommandGroup>
                              {suppliers.map((supplier) => (
                                <CommandItem
                                  key={supplier.id}
                                  value={supplier.name}
                                  onSelect={(currentValue) => {
                                    const selectedSupplier = suppliers.find(s => s.name.toLowerCase() === currentValue.toLowerCase());
                                    setEditingPart({...editingPart, supplier_id: selectedSupplier?.id || null});
                                    setEditSupplierOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      editingPart.supplier_id === supplier.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {supplier.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <Label htmlFor="edit-minimum">Minimum Quantity</Label>
                    <Input
                      id="edit-minimum"
                      type="number"
                      min="0"
                      value={editingPart.minimum_quantity || ''}
                      onChange={(e) => setEditingPart({...editingPart, minimum_quantity: e.target.value === '' ? null : parseInt(e.target.value)})}
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit-current">Current Quantity *</Label>
                    <Input
                      id="edit-current"
                      type="number"
                      min="0"
                      value={editingPart.current_quantity || ''}
                      onChange={(e) => setEditingPart({...editingPart, current_quantity: parseInt(e.target.value) || 0})}
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
            </ScrollArea>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button onClick={updatePart} disabled={uploadingImage}>
                {uploadingImage ? 'Uploading...' : 'Update Inventory Item'}
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
