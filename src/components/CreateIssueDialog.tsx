import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Upload, X, ImagePlus } from "lucide-react";
import { useGenericIssues } from "@/hooks/useGenericIssues";
import { useImageUpload } from "@/hooks/useImageUpload";
import { ContextType, getOrderIssueTypeLabel } from "@/types/issues";
import { supabase } from "@/integrations/supabase/client";

interface CreateIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contextType?: ContextType;
  contextId?: string;
  onSuccess?: () => void;
}

const CONTEXT_TYPES: { value: ContextType; label: string }[] = [
  { value: 'tool', label: 'Tool' },
  { value: 'order', label: 'Order' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'facility', label: 'Facility' },
];


export function CreateIssueDialog({
  open,
  onOpenChange,
  contextType: initialContextType,
  contextId: initialContextId,
  onSuccess
}: CreateIssueDialogProps) {
  const [contextType, setContextType] = useState<ContextType>(initialContextType || 'tool');
  const [contextId, setContextId] = useState(initialContextId || '');
  const [description, setDescription] = useState('');
  const [damageAssessment, setDamageAssessment] = useState('');
  const [actualQuantity, setActualQuantity] = useState<number | ''>('');
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Entity selection data
  const [tools, setTools] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [parts, setParts] = useState<any[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<any>(null);

  const { createIssue } = useGenericIssues();
  const { uploadImages, isUploading } = useImageUpload();

  // Load entities based on context type
  useEffect(() => {
    if (!open) return;

    const loadEntities = async () => {
      try {
        switch (contextType) {
          case 'tool':
            const { data: toolsData } = await supabase
              .from('tools')
              .select('id, name, serial_number, status')
              .neq('status', 'removed')
              .order('name');
            setTools(toolsData || []);
            break;
          
          case 'order':
            const { data: ordersData } = await supabase
              .from('parts_orders')
              .select(`
                id, 
                order_details,
                supplier_name,
                quantity_ordered,
                parts (name, unit)
              `)
              .eq('status', 'pending')
              .order('ordered_at', { ascending: false });
            setOrders(ordersData || []);
            break;
          
          case 'inventory':
            const { data: partsData } = await supabase
              .from('parts')
              .select('id, name, unit, storage_vicinity')
              .order('name');
            setParts(partsData || []);
            break;
        }
      } catch (error) {
        console.error('Error loading entities:', error);
      }
    };

    loadEntities();
  }, [contextType, open]);

  // Set initial context ID and selected entity if provided
  useEffect(() => {
    if (initialContextId) {
      setContextId(initialContextId);
      
      // Also set the selected entity based on the context type and ID
      const findAndSetEntity = () => {
        switch (contextType) {
          case 'tool':
            const tool = tools.find(t => t.id === initialContextId);
            if (tool) setSelectedEntity(tool);
            break;
          case 'order':
            const order = orders.find(o => o.id === initialContextId);
            if (order) setSelectedEntity(order);
            break;
          case 'inventory':
            const part = parts.find(p => p.id === initialContextId);
            if (part) setSelectedEntity(part);
            break;
        }
      };
      
      findAndSetEntity();
    }
  }, [initialContextId, contextType, tools, orders, parts]);

  const handleSubmit = async () => {
    if (!contextType || !contextId || !description.trim()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Upload images if any
      let photoUrls: string[] = [];
      if (selectedImages.length > 0) {
        const uploadResults = await uploadImages(selectedImages, { 
          bucket: 'tool-resolution-photos',
          generateFileName: (file, index) => `issue-${contextType}-${contextId}-${Date.now()}-${index || 1}-${file.name}`
        });
        photoUrls = Array.isArray(uploadResults) 
          ? uploadResults.map(result => result.url)
          : [uploadResults.url];
      }

      // Build issue data based on context type
      const issueData: any = {
        context_type: contextType,
        context_id: contextId,
        description,
        issue_type: 'general', // Default type, will be categorized by AI
        status: 'active',
        workflow_status: 'reported',
        report_photo_urls: photoUrls,
      };

      // Add context-specific fields
      if (contextType === 'tool') {
        if (damageAssessment) {
          issueData.damage_assessment = damageAssessment;
        }
      }

      if (contextType === 'order' && selectedEntity) {
        issueData.issue_metadata = {
          expected_quantity: selectedEntity.quantity_ordered,
          actual_quantity_received: typeof actualQuantity === 'number' ? actualQuantity : 0,
          supplier_name: selectedEntity.supplier_name,
          order_number: selectedEntity.id
        };
      }

      await createIssue(issueData);

      // Reset form
      resetForm();
      onSuccess?.();
      onOpenChange(false);

    } catch (error) {
      console.error('Error creating issue:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setContextType(initialContextType || 'tool');
    setContextId(initialContextId || '');
    setDescription('');
    setDamageAssessment('');
    setActualQuantity('');
    setSelectedImages([]);
    setSelectedEntity(null);
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSelectedImages(files);
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleEntitySelect = (entityId: string) => {
    setContextId(entityId);
    
    // Find and store the selected entity for additional data
    switch (contextType) {
      case 'tool':
        setSelectedEntity(tools.find(t => t.id === entityId));
        break;
      case 'order':
        setSelectedEntity(orders.find(o => o.id === entityId));
        break;
      case 'inventory':
        setSelectedEntity(parts.find(p => p.id === entityId));
        break;
    }
  };

  const isFormValid = contextType && contextId && description.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Create New Issue
          </DialogTitle>
          <DialogDescription>
            Report a new issue for any context
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Context Type Selection */}
          {!initialContextType && (
            <div>
              <Label htmlFor="context-type" className="text-sm font-medium">
                Issue Context *
              </Label>
              <Select value={contextType} onValueChange={(value: ContextType) => {
                setContextType(value);
                setContextId('');
                setSelectedEntity(null);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select context type" />
                </SelectTrigger>
                <SelectContent>
                  {CONTEXT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Entity Selection */}
          <div>
            <Label htmlFor="entity" className="text-sm font-medium">
              {contextType === 'tool' && 'Select Tool *'}
              {contextType === 'order' && 'Select Order *'}
              {contextType === 'inventory' && 'Select Part *'}
              {contextType === 'facility' && 'Facility Area/Location *'}
            </Label>
            
            {contextType === 'facility' ? (
              <Input
                placeholder="Enter facility area or location"
                value={contextId}
                onChange={(e) => setContextId(e.target.value)}
              />
            ) : (
              <Select value={contextId} onValueChange={handleEntitySelect} disabled={!!initialContextId}>
                <SelectTrigger>
                  <SelectValue 
                    placeholder={initialContextId ? (selectedEntity?.name || "Loading...") : `Select ${contextType}`} 
                  />
                </SelectTrigger>
                <SelectContent>
                  {contextType === 'tool' && tools.map((tool) => (
                    <SelectItem key={tool.id} value={tool.id}>
                      {tool.name} {tool.serial_number && `(${tool.serial_number})`}
                    </SelectItem>
                  ))}
                  {contextType === 'order' && orders.map((order) => (
                    <SelectItem key={order.id} value={order.id}>
                      {order.parts?.name} - {order.supplier_name} ({order.quantity_ordered} {order.parts?.unit})
                    </SelectItem>
                  ))}
                  {contextType === 'inventory' && parts.map((part) => (
                    <SelectItem key={part.id} value={part.id}>
                      {part.name} ({part.storage_vicinity})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>


          {/* Quantity fields for order issues - show for all order issues now */}
          {contextType === 'order' && selectedEntity && (
            <div>
              <Label htmlFor="actual-quantity" className="text-sm font-medium">
                Actual Quantity Received (if applicable)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="actual-quantity"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={actualQuantity}
                  onChange={(e) => setActualQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                />
                <span className="text-sm text-muted-foreground">{selectedEntity.parts?.unit}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Expected: {selectedEntity.quantity_ordered} {selectedEntity.parts?.unit}
              </p>
            </div>
          )}

          {/* Description */}
          <div>
            <Label htmlFor="description" className="text-sm font-medium">
              Description *
            </Label>
            <Textarea
              id="description"
              placeholder="Describe the issue in detail..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Tool-specific fields */}
          {contextType === 'tool' && (
            <>

              {/* Damage Assessment - show for all tool issues */}
              <div>
                <Label htmlFor="damage-assessment" className="text-sm font-medium">
                  Damage Assessment (if applicable)
                </Label>
                <Textarea
                  id="damage-assessment"
                  placeholder="Describe any damage and its impact..."
                  value={damageAssessment}
                  onChange={(e) => setDamageAssessment(e.target.value)}
                  rows={2}
                />
              </div>
            </>
          )}

          {/* Image Upload */}
          <div className="space-y-3">
            <Label>Photos</Label>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  className="hidden"
                  id="issue-photos"
                />
                <Label
                  htmlFor="issue-photos"
                  className="flex items-center gap-2 px-3 py-2 border border-input rounded-md cursor-pointer hover:bg-accent"
                >
                  <ImagePlus className="h-4 w-4" />
                  Select Images
                </Label>
                {selectedImages.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {selectedImages.length} image{selectedImages.length > 1 ? 's' : ''} selected
                  </span>
                )}
              </div>

              {/* Image Previews */}
              {selectedImages.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {selectedImages.map((file, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-20 object-cover rounded border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!isFormValid || isSubmitting || isUploading}
            className="bg-orange-600 text-white hover:bg-orange-700"
          >
            {isUploading ? "Uploading..." : isSubmitting ? "Creating..." : "Create Issue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}