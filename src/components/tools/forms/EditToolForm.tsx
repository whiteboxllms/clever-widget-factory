import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, X } from "lucide-react";
import { Tool } from "@/hooks/tools/useToolsData";
import { useImageUpload } from "@/hooks/useImageUpload";
import { useToast } from "@/hooks/use-toast";
import { useParentStructures } from "@/hooks/tools/useParentStructures";
import { TOOL_CATEGORY_OPTIONS } from "@/lib/constants";

interface EditToolFormProps {
  tool: Tool | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (toolId: string, updates: any) => Promise<void>;
}

export const EditToolForm = ({ tool, isOpen, onClose, onSubmit }: EditToolFormProps) => {
  const [editData, setEditData] = useState({
    name: tool?.name || "",
    description: tool?.description || "",
    category: tool?.category || "",
    status: tool?.status || "available",
    parent_structure_id: tool?.parent_structure_id || "",
    storage_location: tool?.storage_location || "",
    serial_number: tool?.serial_number || "",
    image_file: null as File | null,
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { uploadImages, isUploading } = useImageUpload();
  const { parentStructures } = useParentStructures();

  // Update form data when tool changes
  useEffect(() => {
    if (tool) {
      setEditData({
        name: tool.name || "",
        description: tool.description || "",
        category: tool.category || "",
        status: tool.status || "available",
        parent_structure_id: tool.parent_structure_id || "",
        storage_location: tool.storage_location || "",
        serial_number: tool.serial_number || "",
        image_file: null,
      });
      setImagePreview(null);
    }
  }, [tool]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditData(prev => ({ ...prev, image_file: file }));
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tool) return;
    
    setIsSubmitting(true);
    try {
      let imageUrl = tool.image_url;
      if (editData.image_file) {
        const result = await uploadImages(editData.image_file, {
          bucket: 'tool-images',
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

      const updateData = {
        name: editData.name,
        description: editData.description || null,
        category: editData.category || null,
        status: editData.status,
        parent_structure_id: editData.parent_structure_id || null,
        storage_location: editData.storage_location || null,
        serial_number: editData.serial_number || null,
        image_url: imageUrl
      };

      await onSubmit(tool.id, updateData);
      onClose();

      toast({
        title: "Success",
        description: "Tool updated successfully"
      });
    } catch (error) {
      console.error('Error updating tool:', error);
      toast({
        title: "Error",
        description: "Failed to update tool",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!tool) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Tool: {tool.name}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="edit-name">Tool Name *</Label>
            <Input
              id="edit-name"
              value={editData.name}
              onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          <div>
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={editData.description}
              onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-category">Category</Label>
              <Select
                value={editData.category}
                onValueChange={(value) => setEditData(prev => ({ ...prev, category: value }))}
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
              <Label htmlFor="edit-serial">Serial Number</Label>
              <Input
                id="edit-serial"
                value={editData.serial_number}
                onChange={(e) => setEditData(prev => ({ ...prev, serial_number: e.target.value }))}
              />
            </div>
          </div>

          {/* Legacy Storage Vicinity - Read Only for Reference */}
          {tool.legacy_storage_vicinity && (
            <div>
              <Label>Legacy Location (Reference)</Label>
              <Input
                value={tool.legacy_storage_vicinity}
                disabled
                className="bg-muted text-muted-foreground"
              />
            </div>
          )}

          {/* Parent Structure Dropdown */}
          <div>
            <Label htmlFor="edit-parent-structure">Parent Structure</Label>
            <Select
              value={editData.parent_structure_id}
              onValueChange={(value) => setEditData(prev => ({ ...prev, parent_structure_id: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select parent structure (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {parentStructures.map((structure) => (
                  <SelectItem key={structure.id} value={structure.id}>
                    {structure.name} ({structure.category})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="edit-storage-location">Specific Storage Location</Label>
            <Input
              id="edit-storage-location"
              value={editData.storage_location}
              onChange={(e) => setEditData(prev => ({ ...prev, storage_location: e.target.value }))}
              placeholder="e.g., Shelf A2, Drawer 3"
            />
          </div>

          <div>
            <Label htmlFor="edit-status">Status</Label>
            <Select
              value={editData.status}
              onValueChange={(value) => setEditData(prev => ({ ...prev, status: value }))}
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
                id="edit-image-upload"
              />
              <label
                htmlFor="edit-image-upload"
                className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Upload className="h-4 w-4 mr-2" />
                Choose Image
              </label>
            </div>
            
            {(imagePreview || tool?.image_url) && (
              <div className="mt-4 relative">
                <img
                  src={imagePreview || tool?.image_url}
                  alt="Tool preview"
                  className="w-32 h-32 object-cover rounded-md border"
                />
                {imagePreview && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                    onClick={() => {
                      setImagePreview(null);
                      setEditData(prev => ({ ...prev, image_file: null }));
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !editData.name.trim()}>
              {isSubmitting ? "Updating..." : "Update Tool"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};