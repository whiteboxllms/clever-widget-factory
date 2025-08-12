import { FileText, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDocumentationQuality } from "@/hooks/useDocumentationQuality";
import { Skeleton } from "@/components/ui/skeleton";

export function DocumentationQualityCard() {
  const { data, isLoading, error } = useDocumentationQuality();

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-destructive text-sm">Failed to load documentation quality data</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Documentation Quality</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-16 mb-2" />
          <Skeleton className="h-4 w-32" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.totalEdits === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Documentation Quality</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">-</div>
          <p className="text-xs text-muted-foreground">No edits in last 7 days</p>
        </CardContent>
      </Card>
    );
  }

  const percentage = Math.round(data.averageScore * 100);
  
  // Determine trend if we have multiple data points
  let trend = null;
  if (data.trend.length >= 2) {
    const recentScore = data.trend[data.trend.length - 1].score;
    const previousScore = data.trend[data.trend.length - 2].score;
    trend = recentScore > previousScore ? 'up' : recentScore < previousScore ? 'down' : 'stable';
  }

  const getVariantClass = () => {
    if (percentage >= 80) return "text-green-600";
    if (percentage >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Documentation Quality</CardTitle>
        <FileText className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${getVariantClass()}`}>
          {percentage}%
          {trend === 'up' && <TrendingUp className="inline h-4 w-4 ml-1 text-green-600" />}
          {trend === 'down' && <TrendingDown className="inline h-4 w-4 ml-1 text-red-600" />}
        </div>
        <p className="text-xs text-muted-foreground">
          {data.totalEdits} edits in last 7 days
        </p>
      </CardContent>
    </Card>
  );
}