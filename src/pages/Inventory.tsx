import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
import { Search, Plus, Edit, Trash2, Package, AlertTriangle, TrendingDown, TrendingUp, Upload, UserPlus, Check, ChevronsUpDown, History, ArrowLeft, Info, BarChart3, ShoppingCart, X, Minus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { InventoryHistoryDialog } from '@/components/InventoryHistoryDialog';
import { OrderDialog } from '@/components/OrderDialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { compressImage, formatFileSize } from '@/lib/imageUtils';
import { Checkbox } from '@/components/ui/checkbox';
import { compressImageDetailed } from '@/lib/enhancedImageUtils';
import { useEnhancedToast } from '@/hooks/useEnhancedToast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { InventoryItemForm } from '@/components/InventoryItemForm';
import { ReceivingDialog } from '@/components/ReceivingDialog';
import { useParentStructures } from '@/hooks/tools/useParentStructures';

// Supplier interface removed - supplier tracking moved to stock additions

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
  legacy_storage_vicinity: string | null;
  storage_vicinity: string | null;
  storage_location: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  // Allow other properties from database
  [key: string]: any;
}

interface PendingOrder {
  id: string;
  part_id: string;
  quantity_ordered: number;
  quantity_received: number;
  supplier_name?: string;
  order_details?: string;
  notes?: string;
  expected_delivery_date?: string;
  estimated_cost?: number;
  status: string;
  supplier_contact_info?: any;
}



export default function Inventory() {
  const [parts, setParts] = useState<Part[]>([]);
  const [filteredParts, setFilteredParts] = useState<Part[]>([]);
  const [pendingOrders, setPendingOrders] = useState<Record<string, PendingOrder[]>>({});
  
  // Suppliers state removed - tracking moved to stock additions
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showLowInventoryOnly, setShowLowInventoryOnly] = useState(false);
  
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [showQuantityDialog, setShowQuantityDialog] = useState(false);
  const [quantityPart, setQuantityPart] = useState<Part | null>(null);
  const [quantityOperation, setQuantityOperation] = useState<'add' | 'remove'>('add');
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [orderingPart, setOrderingPart] = useState<Part | null>(null);
  const [showEditOrderDialog, setShowEditOrderDialog] = useState(false);
  const [editingOrder, setEditingOrder] = useState<PendingOrder | null>(null);
  const [editingOrderPart, setEditingOrderPart] = useState<Part | null>(null);
  const [showReceivingDialog, setShowReceivingDialog] = useState(false);
  const [receivingOrder, setReceivingOrder] = useState<PendingOrder | null>(null);
  const [receivingPart, setReceivingPart] = useState<Part | null>(null);
  const { toast } = useToast();
  const enhancedToast = useEnhancedToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { parentStructures } = useParentStructures();

  // Helper function to resolve storage vicinity display name
  const getStorageVicinityDisplayName = (part: Part) => {
    // First try to find the parent structure by ID
    if (part.storage_vicinity) {
      const parentStructure = parentStructures.find(p => p.id === part.storage_vicinity);
      if (parentStructure) {
        return parentStructure.name;
      }
    }
    
    // Fall back to legacy storage vicinity if no parent structure found
    return part.legacy_storage_vicinity || 'Unknown';
  };

  // Handle URL parameters for edit mode, return navigation, and low stock filter
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const editPartId = urlParams.get('edit');
    const showLowStock = urlParams.get('showLowStock');
    
    if (editPartId && parts.length > 0) {
      // Find and set the part for editing when edit parameter is present
      const partToEdit = parts.find(part => part.id === editPartId);
      if (partToEdit) {
        setEditingPart(partToEdit);
        setShowEditDialog(true);
        // Clear the URL parameter to avoid reopening on refresh
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('edit');
        window.history.replaceState({}, '', newUrl.toString());
      }
    }
    
    // Enable low stock filter if parameter is present
    if (showLowStock === 'true') {
      setShowLowInventoryOnly(true);
      // Clear the URL parameter to avoid staying enabled on refresh
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('showLowStock');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, [parts]);

  const handleReturnToActivityDetails = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const returnTo = urlParams.get('return');
    const date = urlParams.get('date');
    const users = urlParams.get('users');
    
    if (returnTo === 'activity-details' && date && users) {
      const params = new URLSearchParams({
        date,
        users
      });
      navigate(`/inventory/summary?${params.toString()}`);
    } else {
      // Default back navigation
      navigate('/inventory/summary');
    }
  };

  const [newPart, setNewPart] = useState({
    name: '',
    description: '',
    current_quantity: 0,
    minimum_quantity: 0,
    cost_per_unit: '',
    unit: 'pieces',
    // supplier_id removed - tracking moved to stock additions
    storage_vicinity: '',
    storage_location: ''
  });

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [editSelectedImage, setEditSelectedImage] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  // Supplier dialog states removed - tracking moved to stock additions
  
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());

  const [quantityChange, setQuantityChange] = useState({
    amount: '',
    reason: '',
    supplierName: '',
    supplierUrl: ''
  });

  useEffect(() => {
    fetchParts();
    // fetchSuppliers() removed - tracking moved to stock additions
    fetchPendingOrders();
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

  // fetchSuppliers function removed - tracking moved to stock additions

  const fetchPendingOrders = async () => {
    try {
      // First fetch orders
      const { data: orders, error: ordersError } = await supabase
        .from('parts_orders')
        .select('*')
        .in('status', ['pending', 'partially_received'])
        .order('ordered_at', { ascending: false });

      if (ordersError) throw ordersError;

      // Fetch supplier contact info for orders with supplier_id
      const ordersWithSupplierInfo = await Promise.all(
        (orders || []).map(async (order) => {
          if (order.supplier_id) {
            const { data: supplier } = await supabase
              .from('suppliers')
              .select('contact_info')
              .eq('id', order.supplier_id)
              .single();
            
            return {
              ...order,
              supplier_contact_info: supplier?.contact_info || null
            };
          }
          return order;
        })
      );

      // Group orders by part_id
      const ordersByPart: Record<string, PendingOrder[]> = {};
      ordersWithSupplierInfo.forEach(order => {
        if (!ordersByPart[order.part_id]) {
          ordersByPart[order.part_id] = [];
        }
        ordersByPart[order.part_id].push(order);
      });

      setPendingOrders(ordersByPart);
    } catch (error) {
      console.error('Error fetching pending orders:', error);
    }
  };


  const filterParts = () => {
    let filtered = parts;

    if (searchTerm) {
      filtered = filtered.filter(part => {
        return part.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          part.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          part.storage_location?.toLowerCase().includes(searchTerm.toLowerCase());
      });
    }

    if (showLowInventoryOnly) {
      filtered = filtered.filter(part => {
        // Only show items where minimum quantity is set (not null/0) AND current quantity is at or below minimum
        return part.minimum_quantity !== null && 
               part.minimum_quantity > 0 && 
               part.current_quantity <= part.minimum_quantity;
      });
      
      // Sort to show unordered items first when filtering for low stock
      filtered = filtered.sort((a, b) => {
        const aHasOrders = pendingOrders[a.id] && pendingOrders[a.id].length > 0;
        const bHasOrders = pendingOrders[b.id] && pendingOrders[b.id].length > 0;
        
        // If only one has orders, prioritize the one without orders
        if (aHasOrders && !bHasOrders) return 1;
        if (!aHasOrders && bHasOrders) return -1;
        
        // If both have same order status, sort by name
        return a.name.localeCompare(b.name);
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
      // Extract status code and detailed error information
      let statusCode: number | undefined;
      let errorMessage = 'Upload failed';
      
      if (error && typeof error === 'object') {
        if ('status' in error) {
          statusCode = error.status as number;
        }
        if ('message' in error) {
          errorMessage = error.message as string;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      enhancedToast.showUploadError(errorMessage, file.name, statusCode);
      throw error;
    }
  };

  const addPart = async (formData: any, useMinimumQuantity: boolean) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to add parts",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploadingImage(true);
      
      // Debug logging for form data validation
      console.log('Adding part with data:', {
        formData,
        useMinimumQuantity,
        hasImage: !!selectedImage,
        imageFile: selectedImage ? { name: selectedImage.name, size: selectedImage.size, type: selectedImage.type } : null
      });

      // Validate required fields before proceeding
      if (!formData.name?.trim()) {
        throw new Error('Part name is required');
      }
      if (!formData.storage_vicinity?.trim()) {
        throw new Error('Storage vicinity is required');
      }
      if (formData.current_quantity === undefined || formData.current_quantity < 0) {
        throw new Error('Valid current quantity is required');
      }

      let imageUrl = null;
      
      // Handle image upload phase separately for better error tracking
      if (selectedImage) {
        console.log('Starting image upload for:', selectedImage.name);
        try {
          imageUrl = await uploadImage(selectedImage);
          console.log('Image upload successful:', imageUrl);
        } catch (uploadError) {
          console.error('Image upload failed:', uploadError);
          throw new Error(`Image upload failed: ${uploadError.message || 'Unknown upload error'}`);
        }
      }

      // Prepare data for database insertion
      const partData = {
        ...formData,
        cost_per_unit: formData.cost_per_unit ? parseFloat(formData.cost_per_unit) : null,
        cost_evidence_url: formData.cost_evidence_url || null,
        minimum_quantity: useMinimumQuantity ? formData.minimum_quantity : null,
        image_url: imageUrl
      };

      console.log('Inserting part data to database:', partData);

      // Database insertion phase
      const { data, error } = await supabase
        .from('parts')
        .insert([partData])
        .select()
        .single();

      if (error) {
        console.error('Database insert error:', error);
        throw new Error(`Database error: ${error.message} (Code: ${error.code || 'unknown'})`);
      }

      console.log('Part inserted successfully:', data);

      // Log the creation to history
      try {
        // Get the current authenticated user ID from the session
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        
        if (!currentUser?.id) {
          console.error('No authenticated user found for history logging');
          throw new Error('User must be authenticated to create stock items');
        }
        
        console.log('Creating history entry with user ID:', currentUser.id);
        console.log('Current user object:', currentUser);
        
        const { error: historyError } = await supabase
          .from('parts_history')
          .insert([{
            part_id: data.id,
            change_type: 'create',
            old_quantity: null,
            new_quantity: formData.current_quantity,
            quantity_change: null,
            changed_by: currentUser.id,
            change_reason: 'Item created',
            order_id: null
          }]);

        if (historyError) {
          console.error('Error logging history:', historyError);
          // Don't fail the operation if history logging fails
        } else {
          console.log('History logged successfully for user:', currentUser.id);
        }
      } catch (historyError) {
        console.error('History logging failed:', historyError);
        // Continue with success flow even if history fails
      }

      toast({
        title: "Success",
        description: "Stock item added successfully",
      });

      setNewPart({
        name: '',
        description: '',
        current_quantity: 0,
        minimum_quantity: 0,
        cost_per_unit: '',
        unit: 'pieces',
        // supplier_id removed - tracking moved to stock additions
        storage_vicinity: '',
        storage_location: ''
      });
      setSelectedImage(null);
      setShowAddDialog(false);
      fetchParts();
      fetchPendingOrders();
    } catch (error) {
      console.error('Error adding part - Full error details:', error);
      
      // Enhanced error reporting with specific messages
      let errorMessage = 'Failed to add part';
      let errorDetails = '';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        errorDetails = error.stack || '';
      } else if (error && typeof error === 'object') {
        if ('message' in error) {
          errorMessage = error.message as string;
        }
        if ('details' in error) {
          errorDetails = error.details as string;
        }
        if ('hint' in error) {
          errorDetails += error.hint ? ` Hint: ${error.hint}` : '';
        }
      }

      console.error('Detailed error info:', {
        message: errorMessage,
        details: errorDetails,
        formData,
        hasImage: !!selectedImage,
        timestamp: new Date().toISOString()
      });

      toast({
        title: "Error Adding Part",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const updatePart = async (formData: any, useMinimumQuantity: boolean) => {
    if (!editingPart) return;

    try {
      setUploadingImage(true);
      
      let imageUrl = editingPart.image_url;
      if (editSelectedImage) {
        imageUrl = await uploadImage(editSelectedImage, editingPart.id);
      }

      const updateData = {
        name: formData.name,
        description: formData.description,
        current_quantity: formData.current_quantity,
        minimum_quantity: useMinimumQuantity ? formData.minimum_quantity : null,
        cost_per_unit: formData.cost_per_unit ? parseFloat(formData.cost_per_unit) : null,
        unit: formData.unit,
        // supplier_id removed - tracking moved to stock additions
        storage_vicinity: formData.storage_vicinity,
        storage_location: formData.storage_location,
        image_url: imageUrl
      };

      const { error } = await supabase
        .from('parts')
        .update(updateData)
        .eq('id', editingPart.id);

      if (error) throw error;

      // Log the update to history - including quantity changes
      try {
        // Get the current authenticated user ID from the session
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        
        if (!currentUser?.id) {
          console.error('No authenticated user found for history logging');
          throw new Error('User must be authenticated to update stock items');
        }
        
        // Check if quantity changed
        const oldQuantity = editingPart.current_quantity;
        const newQuantity = formData.current_quantity;
        const quantityChanged = oldQuantity !== newQuantity;
        
        let changeType = 'update';
        let changeReason = 'Item details updated';
        
        if (quantityChanged) {
          if (newQuantity > oldQuantity) {
            changeType = 'quantity_add';
            changeReason = `Manual stock addition (+${newQuantity - oldQuantity})`;
          } else if (newQuantity < oldQuantity) {
            changeType = 'quantity_remove';
            changeReason = `Manual stock reduction (-${oldQuantity - newQuantity})`;
          }
        }
        
        const { error: historyError } = await supabase
          .from('parts_history')
          .insert([{
            part_id: editingPart.id,
            change_type: changeType,
            old_quantity: quantityChanged ? oldQuantity : null,
            new_quantity: quantityChanged ? newQuantity : null,
            quantity_change: quantityChanged ? (newQuantity - oldQuantity) : null,
            changed_by: currentUser.id,
            change_reason: changeReason
          }]);

        if (historyError) {
          console.error('Error logging history:', historyError);
          // Don't fail the operation if history logging fails
        }
      } catch (historyError) {
        console.error('History logging failed:', historyError);
        // Continue with success flow even if history fails
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

    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to update quantities",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(quantityChange.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid positive number",
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

      // If adding quantity, try to fulfill pending orders automatically
      let fulfilledOrderId = null;
      if (quantityOperation === 'add' && pendingOrders[quantityPart.id]) {
        const partOrders = pendingOrders[quantityPart.id];
        let remainingQuantity = amount;

        for (const order of partOrders) {
          if (remainingQuantity <= 0) break;
          
          const neededQuantity = order.quantity_ordered - order.quantity_received;
          const fulfillmentQuantity = Math.min(remainingQuantity, neededQuantity);
          
          if (fulfillmentQuantity > 0) {
            const newReceivedQuantity = order.quantity_received + fulfillmentQuantity;
            const newStatus = newReceivedQuantity >= order.quantity_ordered ? 'completed' : 'partially_received';
            
            try {
              const { error: orderError } = await supabase
                .from('parts_orders')
                .update({
                  quantity_received: newReceivedQuantity,
                  status: newStatus
                })
                .eq('id', order.id);

              if (!orderError) {
                fulfilledOrderId = order.id;
                remainingQuantity -= fulfillmentQuantity;
              }
            } catch (orderError) {
              console.error('Error updating order:', orderError);
            }
          }
        }
      }

      // Log the change to history
      try {
        // Get the current authenticated user ID from the session
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        
        if (!currentUser?.id) {
          console.error('No authenticated user found for history logging');
          throw new Error('User must be authenticated to modify stock quantities');
        }
        
        const { error: historyError } = await supabase
          .from('parts_history')
          .insert([{
            part_id: quantityPart.id,
            change_type: quantityOperation === 'add' ? 'quantity_add' : 'quantity_remove',
            old_quantity: quantityPart.current_quantity,
            new_quantity: newQuantity,
            quantity_change: quantityOperation === 'add' ? amount : -amount,
            changed_by: currentUser.id,
            change_reason: quantityChange.reason || null,
            order_id: fulfilledOrderId,
            supplier_name: quantityOperation === 'add' ? (quantityChange.supplierName || null) : null,
            supplier_url: quantityOperation === 'add' ? (quantityChange.supplierUrl || null) : null
          }]);

        if (historyError) {
          console.error('Error logging history:', historyError);
          // Don't fail the operation if history logging fails
        }

        // If this is a quantity removal (usage), also log it to inventory_usage for activity tracking
        if (quantityOperation === 'remove') {
          try {
            const { error: usageError } = await supabase
              .from('inventory_usage')
              .insert([{
                mission_id: '00000000-0000-0000-0000-000000000000', // Use a special UUID for manual usage
                part_id: quantityPart.id,
                quantity_used: amount,
                used_by: currentUser.id,
                usage_description: quantityChange.reason || `Manual usage: ${amount} ${quantityPart.unit || 'pieces'} of ${quantityPart.name}`
              }]);

            if (usageError) {
              console.error('Error logging usage to inventory_usage:', usageError);
              // Don't fail the operation if usage logging fails
            }
          } catch (usageError) {
            console.error('Usage logging failed:', usageError);
            // Continue with success flow even if usage logging fails
          }
        }
      } catch (historyError) {
        console.error('History logging failed:', historyError);
        // Continue with success flow even if history fails
      }

      toast({
        title: "Success",
        description: `Quantity ${quantityOperation === 'add' ? 'increased' : 'decreased'} successfully${fulfilledOrderId ? ' and order fulfilled' : ''}`,
      });

      setShowQuantityDialog(false);
      setQuantityPart(null);
      setQuantityChange({ amount: '', reason: '', supplierName: '', supplierUrl: '' });
      fetchParts();
      fetchPendingOrders();
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

    const hasPendingOrders = pendingOrders[part.id] && pendingOrders[part.id].length > 0;
    
    const variants = {
      low: { 
        variant: hasPendingOrders ? 'outline' : 'destructive', 
        icon: AlertTriangle, 
        text: 'Low Stock',
        opacity: hasPendingOrders ? 'opacity-60' : ''
      },
      medium: { 
        variant: hasPendingOrders ? 'outline' : 'default', 
        icon: TrendingDown, 
        text: 'Running Low',
        opacity: hasPendingOrders ? 'opacity-60' : ''
      }
    } as const;

    const config = variants[status];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant as any} className={`flex items-center gap-1 ${config.opacity}`}>
        <Icon className="h-3 w-3" />
        {config.text}
      </Badge>
    );
  };

  // addSupplier function removed - tracking moved to stock additions

  const toggleDescription = (partId: string) => {
    const newExpanded = new Set(expandedDescriptions);
    if (newExpanded.has(partId)) {
      newExpanded.delete(partId);
    } else {
      newExpanded.add(partId);
    }
    setExpandedDescriptions(newExpanded);
  };

  const handleEditOrder = (order: PendingOrder, part: Part) => {
    setEditingOrder(order);
    setEditingOrderPart(part);
    setShowEditOrderDialog(true);
  };

  const handleReceiveOrder = (order: PendingOrder, part: Part) => {
    setReceivingOrder(order);
    setReceivingPart(part);
    setShowReceivingDialog(true);
  };

  const handleReceivingSuccess = () => {
    // Refresh both parts and pending orders data
    fetchParts();
    fetchPendingOrders();
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('parts_orders')
        .delete()
        .eq('id', orderId);

      if (error) throw error;

      // Immediately update local state to remove the deleted order
      setPendingOrders(prevOrders => {
        const newOrders = { ...prevOrders };
        for (const partId in newOrders) {
          newOrders[partId] = newOrders[partId].filter(order => order.id !== orderId);
          // Remove the array if it's empty
          if (newOrders[partId].length === 0) {
            delete newOrders[partId];
          }
        }
        return newOrders;
      });

      toast({
        title: "Success",
        description: "Order deleted successfully",
      });

      // Refresh data from server to ensure consistency
      await Promise.all([fetchPendingOrders(), fetchParts()]);
    } catch (error) {
      console.error('Error deleting order:', error);
      toast({
        title: "Error",
        description: "Failed to delete order",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading stock...</p>
          </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="flex items-center gap-4 p-4">
          <Button variant="ghost" size="sm" onClick={() => {
            const urlParams = new URLSearchParams(window.location.search);
            const returnTo = urlParams.get('return');
            
            if (returnTo === 'activity-details') {
              handleReturnToActivityDetails();
            } else {
              navigate('/');
            }
          }}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {(() => {
              const urlParams = new URLSearchParams(window.location.search);
              const returnTo = urlParams.get('return');
              return returnTo === 'activity-details' ? 'Back to Activity Details' : 'Back to Dashboard';
            })()}
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Manage Stock</h1>
            <p className="text-muted-foreground">Manage stock items</p>
          </div>
        </div>
      </header>

      <main className="p-6">
        <div className="max-w-7xl mx-auto">
          
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New Stock Item</DialogTitle>
                <DialogDescription>
                  Add a new stock item to your system
                </DialogDescription>
              </DialogHeader>
              
              <InventoryItemForm
                initialData={newPart}
                selectedImage={selectedImage}
                setSelectedImage={setSelectedImage}
                isLoading={uploadingImage}
                onSubmit={addPart}
                onCancel={() => setShowAddDialog(false)}
                submitButtonText="Add Item"
              />
            </DialogContent>
          </Dialog>

          {/* Add Supplier Dialog removed - supplier tracking moved to stock additions */}

        {/* Consumables Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className="text-2xl font-bold text-foreground">Stock Items</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/inventory/summary')}
              className="flex items-center gap-2 self-start sm:self-auto"
            >
              <BarChart3 className="h-4 w-4" />
              Summary
            </Button>
          </div>
          
          {/* Search and Filters */}
          <div className="mb-6 space-y-4">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search stock by name or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-10"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    type="button"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-1 hover:bg-muted"
                      >
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Search for item in stock and add to existing stock before adding as a new item</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Button 
                  onClick={() => {
                    setNewPart(prev => ({ ...prev, name: searchTerm }));
                    setShowAddDialog(true);
                  }}
                  disabled={!searchTerm}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Item
                </Button>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="low-stock-filter"
                checked={showLowInventoryOnly}
                onCheckedChange={setShowLowInventoryOnly}
              />
              <Label htmlFor="low-stock-filter" className="text-sm font-medium">
                Show low stock items
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
                          <AlertDialogTitle>Delete Stock Item</AlertDialogTitle>
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
                    <span className="text-right">
                      {getStorageVicinityDisplayName(part)}
                      {part.storage_location ? ` - ${part.storage_location}` : ''}
                    </span>
                  </div>

                  {part.cost_per_unit && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Cost per unit:</span>
                      <span>₱{part.cost_per_unit.toFixed(2)}</span>
                    </div>
                  )}

                   {/* Show pending orders info */}
                   {pendingOrders[part.id] && pendingOrders[part.id].length > 0 && (
                     <div className="bg-primary/10 border border-primary/20 p-3 rounded-md">
                       <div className="font-semibold text-primary flex items-center gap-2 mb-2">
                         <ShoppingCart className="h-4 w-4" />
                         Pending Orders
                       </div>
                        {pendingOrders[part.id].map(order => (
                          <div key={order.id} className="flex items-center justify-between text-sm text-foreground font-medium">
                            <div>
                              • {order.quantity_ordered - order.quantity_received} {part.unit} 
                              {order.supplier_name && ` from ${order.supplier_name}`}
                              {order.expected_delivery_date && ` (${new Date(order.expected_delivery_date).toLocaleDateString()})`}
                            </div>
                             <div className="flex gap-1 ml-2">
                               <Button
                                 variant="ghost"
                                 size="sm"
                                 className="h-6 w-6 p-0 hover:bg-green-500/20 hover:text-green-600"
                                 onClick={() => handleReceiveOrder(order, part)}
                                 title="Receive this order"
                               >
                                 <Package className="h-3 w-3" />
                               </Button>
                               <Button
                                 variant="ghost"
                                 size="sm"
                                 className="h-6 w-6 p-0 hover:bg-primary/20"
                                 onClick={() => handleEditOrder(order, part)}
                               >
                                 <Edit className="h-3 w-3" />
                               </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 hover:bg-destructive/20 hover:text-destructive"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Order</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete this order for {order.quantity_ordered} {part.unit} of {part.name}?
                                      This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteOrder(order.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        ))}
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
                         <Minus className="h-4 w-4 mr-1" />
                         Use
                       </Button>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-12 px-2"
                              onClick={() => {
                                setOrderingPart(part);
                                setShowOrderDialog(true);
                              }}
                            >
                              <ShoppingCart className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="flex items-center gap-2">
                            <Info className="w-4 h-4" />
                            <span>Document orders that have already been placed</span>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
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
                  : 'Add your first stock item to get started'
                }
              </p>
            </div>
          )}
        </div>

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Stock Item</DialogTitle>
              <DialogDescription>
                Update stock item information
              </DialogDescription>
            </DialogHeader>
            
            {editingPart && (
              <InventoryItemForm
                selectedImage={editSelectedImage}
                setSelectedImage={setEditSelectedImage}
                isLoading={uploadingImage}
                onSubmit={updatePart}
                onCancel={() => {
                  const urlParams = new URLSearchParams(window.location.search);
                  const returnTo = urlParams.get('return');
                  
                  if (returnTo === 'activity-details') {
                    handleReturnToActivityDetails();
                  } else {
                    setShowEditDialog(false);
                  }
                }}
                // onAddSupplier removed - supplier tracking moved to stock additions
                submitButtonText="Update Stock Item"
                editingPart={editingPart}
              />
            )}
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
                       ? `Add more ${quantityPart.name} to stock`
                       : `Record usage of ${quantityPart.name}`
                     }
                     <br />
                     Current quantity: {quantityPart.current_quantity} {quantityPart.unit}
                     
                     {/* Show pending orders when adding quantity */}
                     {quantityOperation === 'add' && pendingOrders[quantityPart.id] && pendingOrders[quantityPart.id].length > 0 && (
                       <div className="mt-2 p-2 bg-muted/50 rounded-md text-xs">
                         <div className="font-medium">Pending Orders:</div>
                         {pendingOrders[quantityPart.id].map(order => (
                           <div key={order.id} className="text-muted-foreground">
                             • {order.quantity_ordered - order.quantity_received} {quantityPart.unit}
                             {order.supplier_name && ` from ${order.supplier_name}`}
                             {order.order_details && ` - ${order.order_details}`}
                           </div>
                         ))}
                       </div>
                     )}
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
                  step="0.001"
                  min="0.001"
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

              {quantityOperation === 'add' && (
                <>
                  <div>
                    <Label htmlFor="supplier-name">Supplier Name (optional)</Label>
                    <Input
                      id="supplier-name"
                      value={quantityChange.supplierName}
                      onChange={(e) => setQuantityChange({...quantityChange, supplierName: e.target.value})}
                      placeholder="Enter supplier name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="supplier-url">Supplier URL (optional)</Label>
                    <Input
                      id="supplier-url"
                      value={quantityChange.supplierUrl}
                      onChange={(e) => setQuantityChange({...quantityChange, supplierUrl: e.target.value})}
                      placeholder="https://example.com/product-page"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowQuantityDialog(false)}>
                Cancel
              </Button>
              <Button onClick={updateQuantity} disabled={!quantityChange.amount}>
                {quantityOperation === 'add' ? 'Add to' : 'Remove from'} Stock
              </Button>
            </div>
          </DialogContent>
          </Dialog>

          {/* Order Dialog */}
          {orderingPart && (
            <OrderDialog
              isOpen={showOrderDialog}
              onClose={() => {
                setShowOrderDialog(false);
                setOrderingPart(null);
              }}
              partId={orderingPart.id}
              partName={orderingPart.name}
              onOrderCreated={() => {
                fetchPendingOrders();
              }}
            />
          )}

          {/* Edit Order Dialog */}
          {editingOrderPart && editingOrder && (
            <OrderDialog
              isOpen={showEditOrderDialog}
              onClose={() => {
                setShowEditOrderDialog(false);
                setEditingOrder(null);
                setEditingOrderPart(null);
              }}
              partId={editingOrderPart.id}
              partName={editingOrderPart.name}
              onOrderCreated={() => {
                fetchPendingOrders();
              }}
              editingOrder={editingOrder}
            />
          )}

          {/* Receiving Dialog */}
          <ReceivingDialog
            isOpen={showReceivingDialog}
            onClose={() => {
              setShowReceivingDialog(false);
              setReceivingOrder(null);
              setReceivingPart(null);
            }}
            order={receivingOrder}
            part={receivingPart}
            onSuccess={handleReceivingSuccess}
          />
        </div>
      </main>
    </div>
  );
}
