import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Clock } from "lucide-react";

interface ToolStatusBadgeProps {
  status: string;
  className?: string;
}

const getStatusVariant = (status: string) => {
  if (status === 'unavailable' || status === 'unable_to_find') return 'destructive';
  if (status === 'checked_out') return 'secondary';
  return 'default';
};

const getStatusLabel = (status: string) => {
  if (status === 'unavailable') return 'Unavailable';
  if (status === 'unable_to_find') return 'Unable to Find';
  if (status === 'checked_out') return 'Checked Out';
  return 'Available';
};

const getStatusIcon = (status: string) => {
  if (status === 'unable_to_find' || status === 'unavailable') return AlertTriangle;
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