import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, AlertTriangle, Info, CheckCircle } from "lucide-react";

interface InventoryMetricCardProps {
  title: string;
  value: number;
  description: string;
  variant: "default" | "warning" | "info" | "success";
  change?: number;
  changeLabel?: string;
  onClick?: () => void;
}

export function InventoryMetricCard({ title, value, description, variant, change, changeLabel, onClick }: InventoryMetricCardProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case "warning":
        return {
          icon: AlertTriangle,
          badgeVariant: "destructive" as const,
          iconColor: "text-destructive"
        };
      case "info":
        return {
          icon: Info,
          badgeVariant: "secondary" as const,
          iconColor: "text-muted-foreground"
        };
      case "success":
        return {
          icon: CheckCircle,
          badgeVariant: "default" as const,
          iconColor: "text-primary"
        };
      default:
        return {
          icon: TrendingUp,
          badgeVariant: "outline" as const,
          iconColor: "text-foreground"
        };
    }
  };

  const { icon: Icon, badgeVariant, iconColor } = getVariantStyles();

  return (
    <Card 
      className={`hover:shadow-md transition-shadow ${onClick ? 'cursor-pointer hover:bg-accent' : ''}`}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground mb-1">
          {value.toLocaleString()}
        </div>
        <div className="flex items-center justify-between">
          <Badge variant={badgeVariant} className="text-xs">
            {description}
          </Badge>
          {change !== undefined && changeLabel && (
            <div className="text-xs text-muted-foreground">
              {change > 0 ? `+${change}` : change} {changeLabel}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}