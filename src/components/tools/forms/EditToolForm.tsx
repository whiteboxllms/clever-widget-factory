import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, X } from "lucide-react";
import { Tool } from "@/hooks/tools/useToolsData";

interface EditToolFormProps {
  tool: Tool | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (toolId: string, updates: any) => Promise<void>;
  storageVicinities: Array<{ id: string; name: string }>;
}

export const EditToolForm = ({ tool, isOpen, onClose, onSubmit, storageVicinities }: EditToolFormProps) => {
  const [editData, setEditData] = useState({
    name: tool?.name || "",
    description: tool?.description || "",
    category: tool?.category || "",
    storage_vicinity: tool?.storage_vicinity || "",
    storage_location: tool?.storage_location || "",
    serial_number: tool?.serial_number || "",
    known_issues: tool?.known_issues || "",
    stargazer_sop: tool?.stargazer_sop || "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update form data when tool changes
  useEffect(() => {
    if (tool) {
      setEditData({
        name: tool.name || "",
        description: tool.description || "",
        category: tool.category || "",
        storage_vicinity: tool.storage_vicinity || "",
        storage_location: tool.storage_location || "",
        serial_number: tool.serial_number || "",
        known_issues: tool.known_issues || "",
        stargazer_sop: tool.stargazer_sop || "",
      });
    }
  }, [tool]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tool) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit(tool.id, editData);
      onClose();
    } catch (error) {
      console.error('Error updating tool:', error);
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
              <Input
                id="edit-category"
                value={editData.category}
                onChange={(e) => setEditData(prev => ({ ...prev, category: e.target.value }))}
              />
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

          <div>
            <Label htmlFor="edit-storage-vicinity">Storage Vicinity *</Label>
            <Select
              value={editData.storage_vicinity}
              onValueChange={(value) => setEditData(prev => ({ ...prev, storage_vicinity: value }))}
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
            <Label htmlFor="edit-storage-location">Specific Storage Location</Label>
            <Input
              id="edit-storage-location"
              value={editData.storage_location}
              onChange={(e) => setEditData(prev => ({ ...prev, storage_location: e.target.value }))}
              placeholder="e.g., Shelf A2, Drawer 3"
            />
          </div>

          <div>
            <Label htmlFor="edit-known-issues">Known Issues</Label>
            <Textarea
              id="edit-known-issues"
              value={editData.known_issues}
              onChange={(e) => setEditData(prev => ({ ...prev, known_issues: e.target.value }))}
              rows={3}
              placeholder="Describe any known issues with this tool"
            />
          </div>

          <div>
            <Label htmlFor="edit-stargazer-sop">Stargazer SOP</Label>
            <Textarea
              id="edit-stargazer-sop"
              value={editData.stargazer_sop}
              onChange={(e) => setEditData(prev => ({ ...prev, stargazer_sop: e.target.value }))}
              rows={4}
              placeholder="Standard Operating Procedures for this tool"
            />
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