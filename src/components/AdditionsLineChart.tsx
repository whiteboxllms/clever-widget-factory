import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface AdditionsTrendData {
  date: string;
  user: string;
  count: number;
}

interface AdditionsLineChartProps {
  data: AdditionsTrendData[];
}

export function AdditionsLineChart({ data }: AdditionsLineChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-muted-foreground">
        No additions data available for the last 14 days
      </div>
    );
  }

  // Transform data for the chart - group by date and sum counts per user
  const processedData = data.reduce((acc: Record<string, any>, item) => {
    const { date, user, count } = item;
    
    if (!acc[date]) {
      acc[date] = { date };
    }
    
    acc[date][user] = (acc[date][user] || 0) + count;
    
    return acc;
  }, {});

  const chartData = Object.values(processedData).sort((a: any, b: any) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Get unique users for line colors
  const users = Array.from(new Set(data.map(item => item.user)));
  
  const COLORS = [
    "hsl(var(--primary))",
    "hsl(var(--mission-research))",
    "hsl(var(--mission-maintenance))",
    "hsl(var(--mission-education))",
    "hsl(var(--mission-construction))",
    "hsl(var(--mission-custom))",
    "hsl(var(--accent))",
    "hsl(var(--secondary))",
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-md">
          <p className="font-medium text-foreground mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.dataKey}: {entry.value} addition{entry.value !== 1 ? 's' : ''}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-96">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 20,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="date" 
            stroke="hsl(var(--foreground))"
            fontSize={12}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis stroke="hsl(var(--foreground))" fontSize={12} />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ 
              fontSize: "12px",
              color: "hsl(var(--foreground))"
            }}
          />
          {users.map((user, index) => (
            <Line
              key={user}
              type="monotone"
              dataKey={user}
              stroke={COLORS[index % COLORS.length]}
              strokeWidth={2}
              dot={{ r: 4 }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}