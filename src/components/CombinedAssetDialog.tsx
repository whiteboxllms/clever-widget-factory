import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Upload, X, Wrench, Package, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useImageUpload } from "@/hooks/useImageUpload";
import { useToast } from "@/hooks/use-toast";
import { TOOL_CATEGORY_OPTIONS } from "@/lib/constants";
import { LocationFieldsGroup } from "@/components/shared/LocationFieldsGroup";
import { useParentStructures } from "@/hooks/tools/useParentStructures";

interface CombinedAssetForm {
  name: string;
  description: string;
  category: string;
  serial_number: string;
  current_quantity: number;
  minimum_quantity: number;
  cost_per_unit: string;
  unit: string;
  status: string;
  parent_structure_id: string;
  storage_location: string;
  image_file: File | null;
}

interface CombinedAssetDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (assetData: any, isAsset: boolean) => Promise<any>;
  initialName?: string;
}

export const CombinedAssetDialog = ({ isOpen, onClose, onSubmit, initialName = "" }: CombinedAssetDialogProps) => {
  const [formData, setFormData] = useState<CombinedAssetForm>({
    name: initialName,
    description: "",
    category: "",
    serial_number: "",
    current_quantity: 0,
    minimum_quantity: 0,
    cost_per_unit: "",
    unit: "pieces",
    status: "available",
    parent_structure_id: "none",
    storage_location: "",
    image_file: null,
  });
  
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [useMinimumQuantity, setUseMinimumQuantity] = useState(false);
  const { toast } = useToast();
  const { uploadImages, isUploading } = useImageUpload();
  const { parentStructures, loading: isLoadingParentStructures } = useParentStructures();

  // Determine if this is an asset based on serial number
  const isAsset = formData.serial_number.trim().length > 0;

  useEffect(() => {
    if (initialName) {
      setFormData(prev => ({ ...prev, name: initialName }));
    }
  }, [initialName]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({ ...prev, image_file: file }));
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const updateFormData = (field: keyof CombinedAssetForm, value: any) => {
    console.log(`Updating field ${field} with value:`, value);
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    console.log('Form submission - formData.parent_structure_id:', formData.parent_structure_id);
    console.log('Form submission - full formData:', formData);

    try {
      let imageUrl = null;
      if (formData.image_file) {
        const bucket = isAsset ? 'tool-images' : 'part-images';
        const result = await uploadImages(formData.image_file, {
          bucket,
          maxSizeMB: 0.5,
          maxWidthOrHeight: 1920,
          generateFileName: (file) => `${Date.now()}-${file.name}`
        });
        
        if (Array.isArray(result)) {
          imageUrl = result[0].url;
        } else {
          imageUrl = result.url;
        }
      }

      if (isAsset) {
        // Create asset (tool)
        const toolData = {
          name: formData.name,
          description: formData.description || null,
          category: formData.category || null,
          status: formData.status,
          parent_structure_id: formData.parent_structure_id === "none" ? null : formData.parent_structure_id,
          storage_location: formData.storage_location || null,
          legacy_storage_vicinity: "General",
          serial_number: formData.serial_number || null,
          image_url: imageUrl
        };
        await onSubmit(toolData, true);
      } else {
        // Create stock (part)
        const partData = {
          name: formData.name,
          description: formData.description || null,
          category: formData.category || null,
          current_quantity: formData.current_quantity,
          minimum_quantity: useMinimumQuantity ? formData.minimum_quantity : null,
          cost_per_unit: formData.cost_per_unit ? parseFloat(formData.cost_per_unit) : null,
          unit: formData.unit,
          storage_vicinity: formData.parent_structure_id === "none" ? null : formData.parent_structure_id,
          storage_location: formData.storage_location || null,
          legacy_storage_vicinity: "General",
          image_url: imageUrl
        };
        console.log('Part data being submitted:', partData);
        await onSubmit(partData, false);
      }

      // Reset form
      setFormData({
        name: "",
        description: "",
        category: "",
        serial_number: "",
        current_quantity: 0,
        minimum_quantity: 0,
        cost_per_unit: "",
        unit: "pieces",
        status: "available",
        parent_structure_id: "none",
        storage_location: "",
        image_file: null,
      });
      setImagePreview(null);
      setUseMinimumQuantity(false);
      onClose();

      toast({
        title: "Success",
        description: `${isAsset ? 'Asset' : 'Stock item'} added successfully`
      });
    } catch (error) {
      console.error('Error adding item:', error);
      toast({
        title: "Error",
        description: `Failed to add ${isAsset ? 'asset' : 'stock item'}`,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isAsset ? (
              <>
                <Wrench className="w-5 h-5 text-blue-600" />
                Add New Asset
                <Badge variant="default" className="text-xs">Trackable Item</Badge>
              </>
            ) : (
              <>
                <Package className="w-5 h-5 text-green-600" />
                Add New Stock Item
                <Badge variant="secondary" className="text-xs">Consumable</Badge>
              </>
            )}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {isAsset 
              ? "Items with serial numbers become trackable assets" 
              : "Items without serial numbers become consumable stock"
            }
          </p>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="name">Item Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => updateFormData('name', e.target.value)}
                required
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => updateFormData('description', e.target.value)}
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="serial">Serial Number</Label>
              <Input
                id="serial"
                value={formData.serial_number}
                onChange={(e) => updateFormData('serial_number', e.target.value)}
                placeholder="Leave empty for stock items"
              />
            </div>

            {/* Category field - disabled when no serial number */}
            <div>
              <Label htmlFor="category" className={!isAsset ? "text-muted-foreground" : ""}>Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => updateFormData('category', value)}
                disabled={!isAsset}
              >
                <SelectTrigger className={!isAsset ? "text-muted-foreground" : ""}>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {TOOL_CATEGORY_OPTIONS.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quantity fields - show for all but disable for assets */}
            <div>
              <Label htmlFor="current_quantity" className={isAsset ? "text-muted-foreground" : ""}>Current Quantity *</Label>
              <Input
                id="current_quantity"
                type="number"
                step="1"
                min="0"
                value={formData.current_quantity}
                onChange={(e) => updateFormData('current_quantity', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                disabled={isAsset}
                className={isAsset ? "text-muted-foreground" : ""}
              />
            </div>
            
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <Checkbox 
                  id="use-minimum-quantity"
                  checked={useMinimumQuantity}
                  onCheckedChange={(checked) => setUseMinimumQuantity(checked === true)}
                  disabled={isAsset}
                />
                <Label htmlFor="use-minimum-quantity" className={`text-sm font-medium ${isAsset ? "text-muted-foreground" : ""}`}>
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
                  disabled={isAsset}
                />
              )}
            </div>

            <div>
              <Label htmlFor="unit" className={isAsset ? "text-muted-foreground" : ""}>Unit</Label>
              <Select 
                value={formData.unit} 
                onValueChange={(value) => updateFormData('unit', value)}
                disabled={isAsset}
              >
                <SelectTrigger className={isAsset ? "text-muted-foreground" : ""}>
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
                <Label htmlFor="cost_per_unit" className={isAsset ? "text-muted-foreground" : ""}>Cost per unit (php)</Label>
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
                disabled={isAsset}
                className={isAsset ? "text-muted-foreground" : ""}
              />
            </div>


            {/* Status field - only show for assets */}
            {isAsset && (
              <div className="col-span-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => updateFormData('status', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="unavailable">Unavailable</SelectItem>
                    <SelectItem value="unable_to_find">Unable to Find</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Location Fields */}
            <div className="col-span-2">
              <LocationFieldsGroup
                areaValue={formData.parent_structure_id}
                specificLocation={formData.storage_location}
                onAreaChange={(value) => updateFormData('parent_structure_id', value)}
                onSpecificLocationChange={(value) => updateFormData('storage_location', value)}
                areaDataSource="parent_structures"
                areaFieldLabel="Area"
                specificLocationPlaceholder="e.g., Shelf A2, Drawer 3"
                isLoadingAreas={isLoadingParentStructures}
                parentStructures={parentStructures}
                areaRequired={!isAsset} // Required for stock items
              />
            </div>

            {/* Image Upload */}
            <div className="col-span-2">
              <Label>Item Image</Label>
              <div className="mt-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                  id="image-upload"
                />
                <label
                  htmlFor="image-upload"
                  className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Choose Image
                </label>
              </div>
              
              {imagePreview && (
                <div className="mt-4 relative">
                  <img
                    src={imagePreview}
                    alt="Item preview"
                    className="w-32 h-32 object-cover rounded-md border"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                    onClick={() => {
                      setImagePreview(null);
                      updateFormData('image_file', null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || isUploading || !formData.name.trim()}
            >
              {isSubmitting ? "Adding..." : `Add ${isAsset ? 'Asset' : 'Stock Item'}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};