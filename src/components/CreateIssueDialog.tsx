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

const TOOL_ISSUE_TYPES = [
  { value: 'safety', label: 'Safety' },
  { value: 'efficiency', label: 'Efficiency' },
  { value: 'cosmetic', label: 'Cosmetic' },
  { value: 'preventative_maintenance', label: 'Preventative Maintenance' },
  { value: 'functionality', label: 'Functionality' },
  { value: 'lifespan', label: 'Lifespan' },
];

const ORDER_ISSUE_TYPES = [
  { value: 'wrong_item', label: 'Wrong Item' },
  { value: 'wrong_brand_spec', label: 'Wrong Brand/Spec' },
  { value: 'short_shipment', label: 'Short Shipment' },
  { value: 'damaged_goods', label: 'Damaged Goods' },
  { value: 'over_shipped', label: 'Over-shipped' },
  { value: 'other', label: 'Other' },
];

const INVENTORY_ISSUE_TYPES = [
  { value: 'missing', label: 'Missing Stock' },
  { value: 'damaged', label: 'Damaged Stock' },
  { value: 'expired', label: 'Expired' },
  { value: 'quality', label: 'Quality Issue' },
  { value: 'location', label: 'Wrong Location' },
  { value: 'other', label: 'Other' },
];

const FACILITY_ISSUE_TYPES = [
  { value: 'safety', label: 'Safety Hazard' },
  { value: 'maintenance', label: 'Maintenance Needed' },
  { value: 'equipment', label: 'Equipment Issue' },
  { value: 'environmental', label: 'Environmental' },
  { value: 'access', label: 'Access Issue' },
  { value: 'other', label: 'Other' },
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
  const [issueType, setIssueType] = useState('');
  const [description, setDescription] = useState('');
  const [damageAssessment, setDamageAssessment] = useState('');
  const [actualQuantity, setActualQuantity] = useState<number | ''>('');
  const [damageDuringUse, setDamageDuringUse] = useState(false);
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
              .select('id, name, serial_number')
              .eq('status', 'available')
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

  // Set initial context ID if provided
  useEffect(() => {
    if (initialContextId) {
      setContextId(initialContextId);
    }
  }, [initialContextId]);

  const getIssueTypes = () => {
    switch (contextType) {
      case 'tool':
        return TOOL_ISSUE_TYPES;
      case 'order':
        return ORDER_ISSUE_TYPES;
      case 'inventory':
        return INVENTORY_ISSUE_TYPES;
      case 'facility':
        return FACILITY_ISSUE_TYPES;
      default:
        return [];
    }
  };

  const isQuantityRelated = contextType === 'order' && ['short_shipment', 'over_shipped'].includes(issueType);
  const showDamageAssessment = contextType === 'tool' && issueType === 'efficiency';

  const handleSubmit = async () => {
    if (!contextType || !contextId || !issueType || !description.trim()) {
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
        issue_type: issueType,
        status: 'active',
        workflow_status: 'reported',
        report_photo_urls: photoUrls,
      };

      // Add context-specific fields
      if (contextType === 'tool') {
        if (damageAssessment) {
          issueData.damage_assessment = damageAssessment;
        }
        if (damageDuringUse) {
          issueData.is_misuse = true;
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
    setIssueType('');
    setDescription('');
    setDamageAssessment('');
    setActualQuantity('');
    setDamageDuringUse(false);
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

  const isFormValid = contextType && contextId && issueType && description.trim();

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
                setIssueType('');
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
              <Select value={contextId} onValueChange={handleEntitySelect}>
                <SelectTrigger>
                  <SelectValue placeholder={`Select ${contextType}`} />
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

          {/* Issue Type */}
          <div>
            <Label htmlFor="issue-type" className="text-sm font-medium">
              Issue Type *
            </Label>
            <Select value={issueType} onValueChange={setIssueType}>
              <SelectTrigger>
                <SelectValue placeholder="Select issue type" />
              </SelectTrigger>
              <SelectContent>
                {getIssueTypes().map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quantity fields for order issues */}
          {isQuantityRelated && selectedEntity && (
            <div>
              <Label htmlFor="actual-quantity" className="text-sm font-medium">
                Actual Quantity Received
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
              {/* Damage During Use Switch */}
              <Card className="bg-muted/50">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="damageDuringUse" className="text-sm font-medium">
                      Did the issue start while you were using it?
                    </Label>
                    <Switch
                      id="damageDuringUse"
                      checked={damageDuringUse}
                      onCheckedChange={setDamageDuringUse}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Damage Assessment for efficiency issues */}
              {showDamageAssessment && (
                <div>
                  <Label htmlFor="damage-assessment" className="text-sm font-medium">
                    Damage Assessment
                  </Label>
                  <Textarea
                    id="damage-assessment"
                    placeholder="Describe the damage and its impact..."
                    value={damageAssessment}
                    onChange={(e) => setDamageAssessment(e.target.value)}
                    rows={2}
                  />
                </div>
              )}
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