import React, { useState } from "react";
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
import { AlertTriangle, Upload } from "lucide-react";
import { useGenericIssues } from "@/hooks/useGenericIssues";
import { useImageUpload } from "@/hooks/useImageUpload";
import { createOrderIssue, getOrderIssueTypeLabel } from "@/types/issues";
import { CreateIssueDialog } from "./CreateIssueDialog";

interface OrderIssueReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  order: {
    id: string;
    part_id: string;
    quantity_ordered: number;
    supplier_name?: string;
  } | null;
  part: {
    id: string;
    name: string;
    unit: string;
  } | null;
  onIssueReported: () => void;
}

const ORDER_ISSUE_TYPES = [
  'wrong_item',
  'wrong_brand_spec', 
  'short_shipment',
  'damaged_goods',
  'over_shipped',
  'other'
] as const;

export function OrderIssueReportDialog({
  isOpen,
  onClose,
  order,
  part,
  onIssueReported
}: OrderIssueReportDialogProps) {
  const [issueType, setIssueType] = useState<string>('');
  const [actualQuantity, setActualQuantity] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [useGenericDialog, setUseGenericDialog] = useState(true);

  const { createIssue } = useGenericIssues();
  const { uploadImages, isUploading } = useImageUpload();
  const [selectedImages, setSelectedImages] = useState<File[]>([]);

  if (!order || !part) return null;

  // Use the generic dialog by default
  if (useGenericDialog) {
    return (
      <CreateIssueDialog
        open={isOpen}
        onOpenChange={onClose}
        contextType="order"
        contextId={order.id}
        onSuccess={onIssueReported}
      />
    );
  }

  const isQuantityRelated = ['short_shipment', 'over_shipped'].includes(issueType);

  const handleSubmit = async () => {
    if (!issueType.trim()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Upload images if any
      let photoUrls: string[] = [];
      if (selectedImages.length > 0) {
        const uploadResults = await uploadImages(selectedImages, { bucket: 'checkin-photos' as const });
        photoUrls = Array.isArray(uploadResults) 
          ? uploadResults.map(result => result.url)
          : [uploadResults.url];
      }

      // Auto-generate description if not provided
      let finalDescription = description.trim();
      if (!finalDescription) {
        finalDescription = `${getOrderIssueTypeLabel(issueType)} - ${part.name}`;
        
        if (isQuantityRelated && actualQuantity !== '') {
          finalDescription += ` (Expected: ${order.quantity_ordered}, Actual: ${actualQuantity})`;
        }
      }

      // Create the order issue
      const issueData = createOrderIssue(
        order.id,
        finalDescription,
        {
          expected_quantity: order.quantity_ordered,
          actual_quantity_received: typeof actualQuantity === 'number' ? actualQuantity : 0,
          supplier_name: order.supplier_name,
          order_number: order.id
        }
      );

      // Set the specific issue type
      issueData.issue_type = issueType as any;
      issueData.report_photo_urls = photoUrls;

      // Add notes to description if provided
      if (notes.trim()) {
        issueData.description += `\n\nNotes: ${notes.trim()}`;
      }

      await createIssue(issueData);

      // Reset form
      setIssueType('');
      setActualQuantity('');
      setDescription('');
      setNotes('');
      setSelectedImages([]);
      
      onIssueReported();
      onClose();

    } catch (error) {
      console.error('Error reporting order issue:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = issueType.trim() !== '';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Report Order Issue
          </DialogTitle>
          <DialogDescription>
            Report a problem with this order: <strong>{part.name}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="issue-type" className="text-sm font-medium">
              Issue Type *
            </Label>
            <Select value={issueType} onValueChange={setIssueType}>
              <SelectTrigger>
                <SelectValue placeholder="Select issue type" />
              </SelectTrigger>
              <SelectContent>
                {ORDER_ISSUE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {getOrderIssueTypeLabel(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isQuantityRelated && (
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
                <span className="text-sm text-muted-foreground">{part.unit}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Expected: {order.quantity_ordered} {part.unit}
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="description" className="text-sm font-medium">
              Description (Optional)
            </Label>
            <Textarea
              id="description"
              placeholder="Describe the issue in detail..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground mt-1">
              If left blank, a description will be auto-generated.
            </p>
          </div>

          <div>
            <Label htmlFor="notes" className="text-sm font-medium">
              Additional Notes (Optional)
            </Label>
            <Textarea
              id="notes"
              placeholder="Any additional context or notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div>
            <Label className="text-sm font-medium">
              Photos (Optional)
            </Label>
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('issue-photos')?.click()}
                disabled={isUploading}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                {isUploading ? 'Uploading...' : 'Add Photos'}
              </Button>
              <input
                id="issue-photos"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) {
                    setSelectedImages(Array.from(e.target.files));
                  }
                }}
              />
              
              {selectedImages.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {selectedImages.map((file, index) => (
                    <div key={index} className="relative">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`Selected ${index + 1}`}
                        className="w-full h-16 object-cover rounded border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0"
                        onClick={() => {
                          setSelectedImages(prev => prev.filter((_, i) => i !== index));
                        }}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!isFormValid || isSubmitting}
            className="bg-orange-600 text-white hover:bg-orange-700"
          >
            {isSubmitting ? "Reporting..." : "Report Issue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}