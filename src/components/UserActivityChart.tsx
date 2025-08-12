import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface UserActivityData {
  user: string; // This will be the date string
  created: number;
  modified: number;
  used: number;
}

interface UserActivityChartProps {
  data: UserActivityData[];
}

export function UserActivityChart({ data }: UserActivityChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        No user activity data available
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const total = payload.reduce((sum: number, entry: any) => sum + entry.value, 0);
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-md">
          <p className="font-medium text-foreground mb-2">{label}</p>
          <p className="text-sm text-muted-foreground mb-1">Total: {total}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 60,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="user" 
            stroke="hsl(var(--foreground))"
            fontSize={12}
            tick={{ fontSize: 11 }}
          />
          <YAxis stroke="hsl(var(--foreground))" fontSize={12} />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ 
              paddingTop: "10px",
              fontSize: "12px",
              color: "hsl(var(--foreground))"
            }}
          />
          <Bar 
            dataKey="created" 
            stackId="activity"
            fill="hsl(var(--mission-education))" 
            name="Created"
          />
          <Bar 
            dataKey="modified" 
            stackId="activity"
            fill="hsl(var(--mission-construction))" 
            name="Modified"
          />
          <Bar 
            dataKey="used" 
            stackId="activity"
            fill="hsl(var(--mission-research))" 
            name="Used"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}