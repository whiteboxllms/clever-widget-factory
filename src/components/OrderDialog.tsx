import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CalendarIcon, Info } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface PendingOrder {
  id: string;
  quantity_ordered: number;
  quantity_received: number;
  supplier_name?: string;
  order_details?: string;
  notes?: string;
  expected_delivery_date?: string;
  estimated_cost?: number;
  status: string;
}

interface OrderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  partId: string;
  partName: string;
  onOrderCreated: () => void;
  editingOrder?: PendingOrder;
}

export function OrderDialog({ 
  isOpen, 
  onClose, 
  partId, 
  partName, 
  onOrderCreated,
  editingOrder
}: OrderDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    quantity: "",
    estimatedCost: "",
    orderDetails: "",
    urls: "",
    expectedDeliveryDate: undefined as Date | undefined,
  });

  // Pre-populate form when editing
  useEffect(() => {
    if (editingOrder) {
      setFormData({
        quantity: editingOrder.quantity_ordered.toString(),
        estimatedCost: editingOrder.estimated_cost?.toString() || "",
        orderDetails: editingOrder.order_details || "",
        urls: editingOrder.notes || "",
        expectedDeliveryDate: editingOrder.expected_delivery_date ? new Date(editingOrder.expected_delivery_date) : undefined,
      });
    } else {
      // Reset form when not editing
      setFormData({
        quantity: "",
        estimatedCost: "",
        orderDetails: "",
        urls: "",
        expectedDeliveryDate: undefined,
      });
    }
  }, [editingOrder]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
      toast({
        title: "Please enter a valid quantity",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const orderData = {
        quantity_ordered: parseFloat(formData.quantity),
        estimated_cost: formData.estimatedCost ? parseFloat(formData.estimatedCost) : null,
        order_details: formData.orderDetails || null,
        notes: formData.urls || null,
        expected_delivery_date: formData.expectedDeliveryDate?.toISOString().split('T')[0] || null,
      };

      if (editingOrder) {
        // Update existing order
        const { error } = await supabase
          .from('parts_orders')
          .update(orderData)
          .eq('id', editingOrder.id);

        if (error) throw error;

        toast({
          title: `Order updated for ${partName}`,
        });
      } else {
        // Create new order
        const { error } = await supabase
          .from('parts_orders')
          .insert([{
            ...orderData,
            part_id: partId,
            ordered_by: user.id,
            status: 'pending'
          }]);

        if (error) throw error;

        toast({
          title: `Order created for ${partName}`,
        });
      }

      onOrderCreated();
      onClose();
    } catch (error) {
      console.error('Error creating order:', error);
      toast({
        title: "Failed to create order",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{editingOrder ? 'Edit Order for' : 'Create Order for'} {partName}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quantity">Ordered *</Label>
            <Input
              id="quantity"
              type="number"
              min="0.01"
              step="0.01"
              value={formData.quantity}
              onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
              placeholder="Enter quantity"
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="estimatedCost">Product Cost</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Product price only - do not include shipping costs</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Input
              id="estimatedCost"
              type="number"
              min="0"
              step="0.01"
              value={formData.estimatedCost}
              onChange={(e) => setFormData(prev => ({ ...prev, estimatedCost: e.target.value }))}
              placeholder="Enter product cost"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="urls">URLs (optional)</Label>
            <Textarea
              id="urls"
              value={formData.urls}
              onChange={(e) => setFormData(prev => ({ ...prev, urls: e.target.value }))}
              placeholder="Product or supplier URLs (one per line)"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Expected Delivery Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.expectedDeliveryDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.expectedDeliveryDate ? (
                    format(formData.expectedDeliveryDate, "PPP")
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.expectedDeliveryDate}
                  onSelect={(date) => setFormData(prev => ({ ...prev, expectedDeliveryDate: date }))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="orderDetails">Order Details</Label>
            <Textarea
              id="orderDetails"
              value={formData.orderDetails}
              onChange={(e) => setFormData(prev => ({ ...prev, orderDetails: e.target.value }))}
              placeholder="Details about what to look for, specifications, etc."
              rows={3}
            />
          </div>


          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading 
                ? (editingOrder ? "Updating Order..." : "Creating Order...") 
                : (editingOrder ? "Update Order" : "Create Order")
              }
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}