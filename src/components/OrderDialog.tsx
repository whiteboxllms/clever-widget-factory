import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface OrderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  partId: string;
  partName: string;
  suppliers: Array<{ id: string; name: string }>;
  onOrderCreated: () => void;
}

export function OrderDialog({ 
  isOpen, 
  onClose, 
  partId, 
  partName, 
  suppliers, 
  onOrderCreated 
}: OrderDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    quantity: "",
    supplierName: "",
    supplierId: "",
    estimatedCost: "",
    orderDetails: "",
    notes: "",
    expectedDeliveryDate: undefined as Date | undefined,
  });

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
        part_id: partId,
        quantity_ordered: parseFloat(formData.quantity),
        supplier_name: formData.supplierName || null,
        supplier_id: formData.supplierId || null,
        estimated_cost: formData.estimatedCost ? parseFloat(formData.estimatedCost) : null,
        order_details: formData.orderDetails || null,
        notes: formData.notes || null,
        expected_delivery_date: formData.expectedDeliveryDate?.toISOString().split('T')[0] || null,
        ordered_by: user.id,
        status: 'pending'
      };

      const { error } = await supabase
        .from('parts_orders')
        .insert([orderData]);

      if (error) throw error;

      toast({
        title: `Order created for ${partName}`,
      });
      onOrderCreated();
      onClose();
      
      // Reset form
      setFormData({
        quantity: "",
        supplierName: "",
        supplierId: "",
        estimatedCost: "",
        orderDetails: "",
        notes: "",
        expectedDeliveryDate: undefined,
      });
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

  const handleSupplierChange = (supplierId: string) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    setFormData(prev => ({
      ...prev,
      supplierId,
      supplierName: supplier?.name || ""
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Order {partName}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity to Order *</Label>
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
            <Label htmlFor="supplier">Supplier</Label>
            <Select value={formData.supplierId} onValueChange={handleSupplierChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select supplier (optional)" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="supplierName">Supplier Name (if not in list)</Label>
            <Input
              id="supplierName"
              value={formData.supplierName}
              onChange={(e) => setFormData(prev => ({ ...prev, supplierName: e.target.value }))}
              placeholder="Enter supplier name"
              disabled={!!formData.supplierId}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="estimatedCost">Estimated Cost</Label>
            <Input
              id="estimatedCost"
              type="number"
              min="0"
              step="0.01"
              value={formData.estimatedCost}
              onChange={(e) => setFormData(prev => ({ ...prev, estimatedCost: e.target.value }))}
              placeholder="Enter estimated cost"
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

          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Any additional notes or comments"
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating Order..." : "Create Order"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}