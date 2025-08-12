import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useDocumentationQuality } from "@/hooks/useDocumentationQuality";
import { Skeleton } from "@/components/ui/skeleton";

export function DocumentationQualityChart() {
  const { data, isLoading, error } = useDocumentationQuality();

  if (error) {
    return (
      <div className="p-6">
        <p className="text-destructive text-sm">Failed to load documentation quality data</p>
      </div>
    );
  }

  if (isLoading) {
    return <Skeleton className="h-80" />;
  }

  if (!data || data.userScores.length === 0) {
    return (
      <div className="flex items-center justify-center h-80 text-muted-foreground">
        <p>No inventory activities in the last 7 days</p>
      </div>
    );
  }

  // Transform data for the chart
  const chartData = data.userScores.map(user => ({
    user: user.userName,
    Created: user.created.count > 0 ? Math.round(user.created.score * 100) : null,
    Modified: user.modified.count > 0 ? Math.round(user.modified.score * 100) : null,
    Used: user.used.count > 0 ? Math.round(user.used.score * 100) : null,
    // Include counts for tooltip
    createdCount: user.created.count,
    modifiedCount: user.modified.count,
    usedCount: user.used.count
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: entry.color }}
              />
              <span>{entry.dataKey}:</span>
              <span className="font-medium">{entry.value}%</span>
              <span className="text-muted-foreground">
                ({data[`${entry.dataKey.toLowerCase()}Count`]} edits)
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis 
          dataKey="user" 
          className="text-xs" 
          angle={-45}
          textAnchor="end"
          height={80}
          interval={0}
        />
        <YAxis 
          className="text-xs"
          domain={[0, 100]}
          label={{ value: 'Documentation Quality (%)', angle: -90, position: 'insideLeft' }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Bar 
          dataKey="Created" 
          fill="hsl(var(--primary))" 
          name="Created"
          radius={[2, 2, 0, 0]}
        />
        <Bar 
          dataKey="Modified" 
          fill="hsl(var(--secondary))" 
          name="Modified"
          radius={[2, 2, 0, 0]}
        />
        <Bar 
          dataKey="Used" 
          fill="hsl(var(--accent))" 
          name="Used"
          radius={[2, 2, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}