import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Upload, UserPlus, Check, ChevronsUpDown, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  storage_vicinity: string;
  storage_location: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

interface FormData {
  name: string;
  description: string;
  current_quantity: number;
  minimum_quantity: number;
  cost_per_unit: string;
  unit: string;
  supplier_id: string;
  storage_vicinity: string;
  storage_location: string;
}

interface InventoryItemFormProps {
  initialData?: Partial<FormData>;
  selectedImage: File | null;
  setSelectedImage: (file: File | null) => void;
  suppliers: Supplier[];
  isLoading: boolean;
  onSubmit: (data: FormData, useMinimumQuantity: boolean) => void;
  onCancel: () => void;
  onAddSupplier: () => void;
  submitButtonText: string;
  editingPart?: Part | null;
}

export function InventoryItemForm({
  initialData,
  selectedImage,
  setSelectedImage,
  suppliers,
  isLoading,
  onSubmit,
  onCancel,
  onAddSupplier,
  submitButtonText,
  editingPart
}: InventoryItemFormProps) {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    current_quantity: 0,
    minimum_quantity: 0,
    cost_per_unit: '',
    unit: 'pieces',
    supplier_id: '',
    storage_vicinity: '',
    storage_location: '',
    ...initialData
  });

  const [useMinimumQuantity, setUseMinimumQuantity] = useState(false);
  const [supplierOpen, setSupplierOpen] = useState(false);

  // Initialize form data when editing
  useEffect(() => {
    if (editingPart) {
      setFormData({
        name: editingPart.name,
        description: editingPart.description || '',
        current_quantity: editingPart.current_quantity,
        minimum_quantity: editingPart.minimum_quantity || 0,
        cost_per_unit: editingPart.cost_per_unit?.toString() || '',
        unit: editingPart.unit || 'pieces',
        supplier_id: editingPart.supplier_id || '',
        storage_vicinity: editingPart.storage_vicinity,
        storage_location: editingPart.storage_location || ''
      });
      setUseMinimumQuantity(editingPart.minimum_quantity !== null && editingPart.minimum_quantity > 0);
    }
  }, [editingPart]);

  const handleSubmit = () => {
    onSubmit(formData, useMinimumQuantity);
  };

  const updateFormData = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <ScrollArea className="max-h-[70vh]">
      <div className="grid grid-cols-2 gap-4 pr-4">
        <div className="col-span-2">
          <Label htmlFor="name">Item Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => updateFormData('name', e.target.value)}
            placeholder="Enter item name"
          />
        </div>

        <div className="col-span-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => updateFormData('description', e.target.value)}
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
              onClick={onAddSupplier}
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
                {formData.supplier_id
                  ? suppliers.find((supplier) => supplier.id === formData.supplier_id)?.name
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
                          updateFormData('supplier_id', selectedSupplier?.id || '');
                          setSupplierOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            formData.supplier_id === supplier.id ? "opacity-100" : "opacity-0"
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

        <div className="col-span-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="current_quantity">Current Quantity *</Label>
          <Input
            id="current_quantity"
            type="number"
            step="1"
            min="0"
            value={formData.current_quantity === 0 ? '' : formData.current_quantity}
            onChange={(e) => updateFormData('current_quantity', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
          />
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="use-minimum-quantity"
                  checked={useMinimumQuantity}
                  onCheckedChange={(checked) => setUseMinimumQuantity(checked === true)}
                />
                <Label htmlFor="use-minimum-quantity" className="text-sm font-medium">
                  Set Minimum Quantity
                </Label>
              </div>
              
              {useMinimumQuantity && (
                <Input
                  id="minimum_quantity"
                  type="number"
                  step="1"
                  min="0"
                  value={formData.minimum_quantity}
                  onChange={(e) => updateFormData('minimum_quantity', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                />
              )}
            </div>
          </div>
        </div>

        <div>
          <Label htmlFor="unit">Unit</Label>
          <Select value={formData.unit} onValueChange={(value) => updateFormData('unit', value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pieces">Pieces</SelectItem>
              <SelectItem value="kg">Kilograms</SelectItem>
              <SelectItem value="meters">Meters</SelectItem>
              <SelectItem value="liters">Liters</SelectItem>
              <SelectItem value="grams">Grams</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <Label htmlFor="cost_per_unit">Cost per unit (php)</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Exclude shipping costs in calculation</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Input
            id="cost_per_unit"
            type="number"
            step="0.01"
            min="0"
            value={formData.cost_per_unit}
            onChange={(e) => updateFormData('cost_per_unit', e.target.value)}
            placeholder="0.00"
          />
        </div>

        <div>
          <Label htmlFor="storage_vicinity">Storage Vicinity *</Label>
          <Input
            id="storage_vicinity"
            value={formData.storage_vicinity}
            onChange={(e) => updateFormData('storage_vicinity', e.target.value)}
            placeholder="e.g., Workshop A, Storage Room"
          />
        </div>

        <div>
          <Label htmlFor="storage_location">Storage Location</Label>
          <Input
            id="storage_location"
            value={formData.storage_location}
            onChange={(e) => updateFormData('storage_location', e.target.value)}
            placeholder="e.g., Shelf 3, Bin B2"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit} 
          disabled={!formData.name || !formData.storage_vicinity || isLoading}
        >
          {isLoading ? 'Processing...' : submitButtonText}
        </Button>
      </div>
    </ScrollArea>
  );
}