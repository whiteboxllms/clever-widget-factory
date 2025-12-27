import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Clock } from "lucide-react";

interface ToolStatusBadgeProps {
  status: string;
  className?: string;
}

const getStatusVariant = (status: string) => {
  if (status === 'removed') return 'destructive';
  if (status === 'checked_out') return 'secondary';
  return 'default';
};

const getStatusLabel = (status: string) => {
  if (status === 'removed') return 'Removed';
  if (status === 'checked_out') return 'Checked Out';
  return 'Available';
};

const getStatusIcon = (status: string) => {
  if (status === 'removed') return AlertTriangle;
  if (status === 'checked_out') return Clock;
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