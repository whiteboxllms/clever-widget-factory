import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface CategoryData {
  category: string;
  count: number;
}

interface CategoryDistributionChartProps {
  data: CategoryData[];
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--accent))",
  "hsl(var(--muted))",
  "hsl(var(--mission-research))",
  "hsl(var(--mission-maintenance))",
  "hsl(var(--mission-education))",
  "hsl(var(--mission-construction))",
];

export function CategoryDistributionChart({ data }: CategoryDistributionChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        No category data available
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-md">
          <p className="font-medium text-foreground">{data.payload.category}</p>
          <p className="text-sm text-muted-foreground">
            {data.value} item{data.value !== 1 ? 's' : ''}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={80}
            fill="hsl(var(--primary))"
            dataKey="count"
            label={({ category, percent }) => 
              percent > 5 ? `${category} (${(percent * 100).toFixed(0)}%)` : ''
            }
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={COLORS[index % COLORS.length]} 
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ 
              paddingTop: "20px", 
              fontSize: "12px",
              color: "hsl(var(--foreground))"
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}