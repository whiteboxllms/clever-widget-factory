import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, X } from "lucide-react";
import { imageService } from "@/services/imageService";
import { useToast } from "@/hooks/use-toast";
import { TOOL_CATEGORY_OPTIONS } from "@/lib/constants";

interface NewToolForm {
  name: string;
  description: string;
  category: string;
  status: string;
  storage_vicinity: string;
  storage_location: string;
  serial_number: string;
  image_file: File | null;
}

interface AddToolFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (toolData: any) => Promise<void>;
  storageVicinities: Array<{ id: string; name: string }>;
}

export const AddToolForm = ({ isOpen, onClose, onSubmit, storageVicinities }: AddToolFormProps) => {
  const [newTool, setNewTool] = useState<NewToolForm>({
    name: "",
    description: "",
    category: "",
    status: "available",
    storage_vicinity: "",
    storage_location: "",
    serial_number: "",
    image_file: null
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewTool(prev => ({ ...prev, image_file: file }));
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let imageUrl = null;
      if (newTool.image_file) {
        imageUrl = await imageService.uploadImage(newTool.image_file);
      }

      const toolData = {
        name: newTool.name,
        description: newTool.description || null,
        category: newTool.category || null,
        status: newTool.status,
        storage_vicinity: newTool.storage_vicinity,
        storage_location: newTool.storage_location || null,
        serial_number: newTool.serial_number || null,
        image_url: imageUrl
      };

      await onSubmit(toolData);

      // Reset form
      setNewTool({
        name: "",
        description: "",
        category: "",
        status: "available",
        storage_vicinity: "",
        storage_location: "",
        serial_number: "",
        image_file: null
      });
      setImagePreview(null);
      onClose();

      toast({
        title: "Success",
        description: "Tool added successfully"
      });
    } catch (error) {
      console.error('Error adding tool:', error);
      toast({
        title: "Error",
        description: "Failed to add tool",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Tool</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Tool Name *</Label>
            <Input
              id="name"
              value={newTool.name}
              onChange={(e) => setNewTool(prev => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={newTool.description}
              onChange={(e) => setNewTool(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category">Category</Label>
              <Select
                value={newTool.category}
                onValueChange={(value) => setNewTool(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
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

            <div>
              <Label htmlFor="serial">Serial Number</Label>
              <Input
                id="serial"
                value={newTool.serial_number}
                onChange={(e) => setNewTool(prev => ({ ...prev, serial_number: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="storage-vicinity">Storage Vicinity *</Label>
            <Select
              value={newTool.storage_vicinity}
              onValueChange={(value) => setNewTool(prev => ({ ...prev, storage_vicinity: value }))}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select storage vicinity" />
              </SelectTrigger>
              <SelectContent>
                {storageVicinities.map((vicinity) => (
                  <SelectItem key={vicinity.id} value={vicinity.name}>
                    {vicinity.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="storage-location">Specific Storage Location</Label>
            <Input
              id="storage-location"
              value={newTool.storage_location}
              onChange={(e) => setNewTool(prev => ({ ...prev, storage_location: e.target.value }))}
              placeholder="e.g., Shelf A2, Drawer 3"
            />
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              value={newTool.status}
              onValueChange={(value) => setNewTool(prev => ({ ...prev, status: value }))}
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

          <div>
            <Label>Tool Image</Label>
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
                  alt="Preview"
                  className="w-32 h-32 object-cover rounded-md border"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                  onClick={() => {
                    setImagePreview(null);
                    setNewTool(prev => ({ ...prev, image_file: null }));
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !newTool.name.trim()}>
              {isSubmitting ? "Adding..." : "Add Tool"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};