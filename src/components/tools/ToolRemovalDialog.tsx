import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tool } from "@/hooks/tools/useToolsData";

interface ToolRemovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tool: Tool | null;
  onConfirm: (reason: string, notes: string) => void;
  isLoading?: boolean;
}

const REMOVAL_REASONS = [
  { value: "lost", label: "Lost" },
  { value: "damaged", label: "Damaged beyond repair" },
  { value: "gifted", label: "Gifted" },
  { value: "disposed", label: "Disposed" },
  { value: "other", label: "Other" },
];

export const ToolRemovalDialog = ({
  open,
  onOpenChange,
  tool,
  onConfirm,
  isLoading = false,
}: ToolRemovalDialogProps) => {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const handleConfirm = () => {
    if (reason) {
      onConfirm(reason, notes);
      // Reset form
      setReason("");
      setNotes("");
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset form when closing
      setReason("");
      setNotes("");
    }
    onOpenChange(newOpen);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove Tool from Inventory</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to remove "{tool?.name}" from the inventory? This will mark the tool as "Removed" and it will no longer appear in the regular tool list.
            {tool?.serial_number && (
              <span className="block mt-1 text-sm">
                Serial Number: {tool.serial_number}
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for removal *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {REMOVAL_REASONS.map((reasonOption) => (
                  <SelectItem key={reasonOption.value} value={reasonOption.value}>
                    {reasonOption.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional details about the removal..."
              rows={3}
            />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!reason || isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? "Removing..." : "Remove Tool"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};