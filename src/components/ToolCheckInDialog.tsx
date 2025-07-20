import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

type Tool = Tables<'tools'>;

type CheckoutWithTool = {
  id: string;
  tool_id: string;
  user_name: string;
  checkout_date: string;
  tools: Tool;
};

type CheckInForm = {
  condition_after: string;
  tool_issues: string;
  notes: string;
  returned_to_correct_location: boolean;
  sop_deviation: string;
  hours_used: string;
};

interface ToolCheckInDialogProps {
  tool: Tool | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ToolCheckInDialog({ tool, open, onOpenChange, onSuccess }: ToolCheckInDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkout, setCheckout] = useState<CheckoutWithTool | null>(null);
  const [form, setForm] = useState<CheckInForm>({
    condition_after: '',
    tool_issues: '',
    notes: '',
    returned_to_correct_location: true,
    sop_deviation: '',
    hours_used: ''
  });

  useEffect(() => {
    if (tool && open) {
      fetchCheckout();
      // Reset form
      setForm({
        condition_after: '',
        tool_issues: '',
        notes: '',
        returned_to_correct_location: true,
        sop_deviation: '',
        hours_used: ''
      });
    }
  }, [tool, open]);

  const fetchCheckout = async () => {
    if (!tool) return;

    try {
      const { data, error } = await supabase
        .from('checkouts')
        .select(`
          *,
          tools(*)
        `)
        .eq('tool_id', tool.id)
        .eq('is_returned', false)
        .single();

      if (error) throw error;
      setCheckout(data);
    } catch (error) {
      console.error('Error fetching checkout:', error);
      toast({
        title: "Error",
        description: "Failed to load checkout information",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkout || !tool) return;

    setIsSubmitting(true);
    try {
      // Create checkin record
      const checkinData: any = {
        checkout_id: checkout.id,
        tool_id: checkout.tool_id,
        user_name: checkout.user_name,
        condition_after: form.condition_after as any,
        problems_reported: form.tool_issues || null,
        location_found: tool.intended_storage_location,
        notes: form.notes || null,
        returned_to_correct_location: form.returned_to_correct_location,
      };

      // Add hours used if tool has motor and hours were provided
      if (tool.has_motor && form.hours_used) {
        checkinData.hours_used = parseFloat(form.hours_used);
      }

      const { error: checkinError } = await supabase
        .from('checkins')
        .insert(checkinData);

      if (checkinError) throw checkinError;

      // Update checkout as returned
      const { error: updateError } = await supabase
        .from('checkouts')
        .update({ is_returned: true })
        .eq('id', checkout.id);

      if (updateError) throw updateError;

      // Update tool status
      const { error: toolError } = await supabase
        .from('tools')
        .update({ status: 'available' })
        .eq('id', tool.id);

      if (toolError) throw toolError;

      toast({
        title: "Tool checked in successfully",
        description: `${tool.name} has been checked in`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error checking in tool:', error);
      toast({
        title: "Error",
        description: "Failed to check in tool",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!tool) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Check In Tool: {tool.name}</DialogTitle>
        </DialogHeader>

        {checkout && (
          <div className="mb-4 p-3 bg-muted rounded-lg">
            <p className="text-sm"><strong>Checked out to:</strong> {checkout.user_name}</p>
            <p className="text-sm"><strong>Checkout date:</strong> {new Date(checkout.checkout_date).toLocaleDateString()}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Tool Condition After Use */}
          <div className="space-y-2">
            <Label>Tool condition after use *</Label>
            <RadioGroup
              value={form.condition_after}
              onValueChange={(value) => setForm({ ...form, condition_after: value })}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="excellent" id="excellent" />
                <Label htmlFor="excellent">Excellent</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="good" id="good" />
                <Label htmlFor="good">Good</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="fair" id="fair" />
                <Label htmlFor="fair">Fair</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="poor" id="poor" />
                <Label htmlFor="poor">Poor</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="broken" id="broken" />
                <Label htmlFor="broken">Broken</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Hours Used (only if tool has motor) */}
          {tool.has_motor && (
            <div className="space-y-2">
              <Label htmlFor="hours_used">Hours used (optional)</Label>
              <Input
                id="hours_used"
                type="number"
                step="0.1"
                min="0"
                value={form.hours_used}
                onChange={(e) => setForm({ ...form, hours_used: e.target.value })}
                placeholder="0.0"
              />
            </div>
          )}

          {/* Tool Issues */}
          <div className="space-y-2">
            <Label htmlFor="tool_issues">Any issues or problems with the tool? (optional)</Label>
            <Textarea
              id="tool_issues"
              value={form.tool_issues}
              onChange={(e) => setForm({ ...form, tool_issues: e.target.value })}
              placeholder="Describe any issues, damage, or problems encountered..."
              rows={3}
            />
          </div>

          {/* Returned to Correct Location */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="returned_to_correct_location"
              checked={form.returned_to_correct_location}
              onCheckedChange={(checked) => 
                setForm({ ...form, returned_to_correct_location: checked as boolean })
              }
            />
            <Label htmlFor="returned_to_correct_location">
              Tool returned to correct storage location
            </Label>
          </div>

          {/* General Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Additional notes (optional)</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Any additional comments or observations..."
              rows={2}
            />
          </div>

          <div className="flex justify-end space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || !form.condition_after}
            >
              {isSubmitting ? "Checking In..." : "Check In Tool"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}