import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';

interface ProactiveVsReactiveData {
  name: string;
  proactive: number;
  reactive: number;
  totalActions: number;
  proactiveCount: number;
  reactiveCount: number;
}

interface ProactiveVsReactiveChartProps {
  data: ProactiveVsReactiveData[];
  isLoading?: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-medium">{label}</p>
        <div className="space-y-1 text-sm">
          <p className="text-green-600">
            Proactive: {data.proactiveCount} ({data.proactive.toFixed(1)}%)
          </p>
          <p className="text-red-600">
            Reactive: {data.reactiveCount} ({data.reactive.toFixed(1)}%)
          </p>
          <p className="font-medium">Total Actions: {data.totalActions}</p>
        </div>
      </div>
    );
  }
  return null;
};

const CustomLabel = ({ value, viewBox }: any) => {
  if (value < 15) return null; // Don't show label if segment is too small
  
  const { x, y, width, height } = viewBox;
  const cx = x + width / 2;
  const cy = y + height / 2;
  
  return (
    <text 
      x={cx} 
      y={cy} 
      fill="white" 
      textAnchor="middle" 
      dominantBaseline="middle"
      fontSize={14}
      fontWeight="bold"
    >
      {`${value.toFixed(0)}%`}
    </text>
  );
};

export function ProactiveVsReactiveChart({ data, isLoading }: ProactiveVsReactiveChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Driving Improvements vs Responding to Problems</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Driving Improvements vs Responding to Problems</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <p className="text-lg font-medium mb-2">No Actions Data</p>
              <p>No actions found for the selected period.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalData = data[0];
  const getStatusMessage = (reactivePercent: number) => {
    if (reactivePercent > 70) return { text: "Primarily Reactive", color: "text-red-600" };
    if (reactivePercent < 30) return { text: "Primarily Proactive", color: "text-green-600" };
    return { text: "Balanced Approach", color: "text-blue-600" };
  };

  const status = getStatusMessage(totalData.reactive);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Driving Improvements vs Responding to Problems</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Company-wide balance between proactive work and reactive issue resolution
            </p>
          </div>
          <div className="text-right">
            <p className={`text-sm font-medium ${status.color}`}>{status.text}</p>
            <p className="text-xs text-muted-foreground">{totalData.totalActions} total actions</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 12 }}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                domain={[0, 100]}
                tick={{ fontSize: 12 }}
                label={{ 
                  value: 'Percentage (%)', 
                  angle: -90, 
                  position: 'insideLeft' 
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              
              {/* Proactive (green) bar - shown first so it appears at the top */}
              <Bar 
                dataKey="proactive" 
                stackId="actions" 
                fill="hsl(var(--chart-2))"
                stroke="hsl(var(--chart-2))"
                strokeWidth={1}
              >
                <LabelList content={<CustomLabel />} />
              </Bar>
              
              {/* Reactive (red) bar - shown second so it appears at the bottom */}
              <Bar 
                dataKey="reactive" 
                stackId="actions" 
                fill="hsl(var(--destructive))"
                stroke="hsl(var(--destructive))"
                strokeWidth={1}
              >
                <LabelList content={<CustomLabel />} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Legend */}
        <div className="flex justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span className="text-sm">Proactive (Driving Improvements)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span className="text-sm">Reactive (Responding to Problems)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}