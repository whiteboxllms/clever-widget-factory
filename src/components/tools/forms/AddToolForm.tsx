import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { TOOL_CATEGORY_OPTIONS } from "@/lib/constants";
import { LocationFieldsGroup } from "@/components/shared/LocationFieldsGroup";
import { FileAttachmentManager } from "@/components/shared/FileAttachmentManager";
import { useParentStructures } from "@/hooks/tools/useParentStructures";

interface NewToolForm {
  name: string;
  description: string;
  category: string;
  status: string;
  parent_structure_id: string;
  storage_location: string;
  serial_number: string;
  attachments: string[];
}

interface AddToolFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (toolData: any) => Promise<any>;
  initialName?: string;
}

export const AddToolForm = ({ isOpen, onClose, onSubmit, initialName = "" }: AddToolFormProps) => {
  const [newTool, setNewTool] = useState<NewToolForm>({
    name: initialName,
    description: "",
    category: "",
    status: "available",
    parent_structure_id: "none",
    storage_location: "",
    serial_number: "",
    attachments: [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const { toast } = useToast();
  const { parentStructures, loading: isLoadingParentStructures } = useParentStructures();
  

  useEffect(() => {
    if (initialName) {
      setNewTool(prev => ({ ...prev, name: initialName }));
    }
  }, [initialName]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Convert attachments array to image_url for database compatibility
      const imageUrl = newTool.attachments.length > 0 ? newTool.attachments[0] : null;

      const toolData = {
        name: newTool.name,
        description: newTool.description || null,
        category: newTool.category || null,
        status: newTool.status,
        parent_structure_id: newTool.parent_structure_id === "none" ? null : newTool.parent_structure_id,
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
        parent_structure_id: "none",
        storage_location: "",
        serial_number: "",
        attachments: [],
      });
      onClose();

      toast({
        title: "Success",
        description: "Asset added successfully"
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
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open && (isUploadingFiles || isSubmitting)) return;
      onClose();
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Asset</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Asset Name *</Label>
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

          {/* Location Fields */}
          <LocationFieldsGroup
            areaValue={newTool.parent_structure_id}
            specificLocation={newTool.storage_location}
            onAreaChange={(value) => setNewTool(prev => ({ ...prev, parent_structure_id: value }))}
            onSpecificLocationChange={(value) => setNewTool(prev => ({ ...prev, storage_location: value }))}
            areaFieldLabel="Area"
            specificLocationPlaceholder="e.g., Shelf A2, Drawer 3"
            isLoadingAreas={isLoadingParentStructures}
            parentStructures={parentStructures}
          />

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
                <SelectItem value="in_use">In Use</SelectItem>
                <SelectItem value="unavailable">Unavailable</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <FileAttachmentManager
            attachments={newTool.attachments}
            onAttachmentsChange={(attachments) => setNewTool(prev => ({ ...prev, attachments }))}
            bucket="tool-images"
            label="Asset Image"
            disabled={isSubmitting}
            maxFiles={1}
            onUploadStateChange={setIsUploadingFiles}
          />

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || !newTool.name.trim()}
            >
              {isSubmitting ? "Adding..." : "Add Asset"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};