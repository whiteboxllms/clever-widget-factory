import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Clock } from "lucide-react";

interface ToolStatusBadgeProps {
  status: string;
  className?: string;
}

const getStatusVariant = (status: string) => {
  if (status === 'unavailable' || status === 'removed') return 'destructive';
  if (status === 'checked_out') return 'secondary';
  if (status === 'needs_attention') return 'destructive';
  if (status === 'under_repair') return 'secondary';
  return 'default';
};

const getStatusLabel = (status: string) => {
  if (status === 'unavailable') return 'Unavailable';
  if (status === 'removed') return 'Removed';
  if (status === 'checked_out') return 'Checked Out';
  if (status === 'needs_attention') return 'Needs Attention';
  if (status === 'under_repair') return 'Under Repair';
  return 'Available';
};

const getStatusIcon = (status: string) => {
  if (status === 'removed' || status === 'unavailable' || status === 'needs_attention') return AlertTriangle;
  if (status === 'checked_out' || status === 'under_repair') return Clock;
  return CheckCircle;
};

export const ToolStatusBadge = ({ status, className }: ToolStatusBadgeProps) => {
  const StatusIcon = getStatusIcon(status);
  
  return (
    <Badge variant={getStatusVariant(status)} className={className}>
      <StatusIcon className="h-3 w-3 mr-1" />
      {getStatusLabel(status)}
    </Badge>
  );
};