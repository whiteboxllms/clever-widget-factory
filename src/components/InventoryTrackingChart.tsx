import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface InventoryTrackingData {
  name: string;
  actionAttached: number;
  direct: number;
  totalDistinctItems: number;
  actionCount: number;
  directCount: number;
  dayKey: string;
}

interface InventoryTrackingChartProps {
  data: InventoryTrackingData[];
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
            Action-Attached: {data.actionCount} ({data.actionAttached.toFixed(1)}%)
          </p>
          <p className="text-red-600">
            Direct: {data.directCount} ({data.direct.toFixed(1)}%)
          </p>
          <p className="font-medium">Total Distinct Items: {data.totalDistinctItems}</p>
        </div>
      </div>
    );
  }
  return null;
};

export default function InventoryTrackingChart({ data, isLoading }: InventoryTrackingChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Inventory Tracking</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Inventory Tracking</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <p className="text-lg font-medium mb-2">No Inventory Reductions</p>
              <p>No reductions found for the selected period.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalDistinctAcrossDays = data.reduce((sum, day) => sum + day.totalDistinctItems, 0);
  const totalActionAcrossDays = data.reduce((sum, day) => sum + day.actionCount, 0);
  const totalDirectAcrossDays = data.reduce((sum, day) => sum + day.directCount, 0);
  const overallActionPercent = totalDistinctAcrossDays > 0 ? (totalActionAcrossDays / totalDistinctAcrossDays) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Inventory Tracking</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Percent of distinct items used via actions vs direct stock changes
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{totalDistinctAcrossDays} total distinct item changes</p>
            <p className="text-xs text-muted-foreground">{overallActionPercent.toFixed(1)}% via actions overall</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4">
          <div className="flex-1 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 20, right: 50, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 10 }}
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={40}
                />
                <YAxis 
                  yAxisId="left"
                  domain={[0, 100]}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => `${value}%`}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => value.toString()}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  yAxisId="left"
                  dataKey="direct" 
                  stackId="items" 
                  fill="hsl(0, 84%, 60%)"
                  stroke="hsl(0, 84%, 60%)"
                  strokeWidth={1}
                />
                <Bar 
                  yAxisId="left"
                  dataKey="actionAttached" 
                  stackId="items" 
                  fill="hsl(142, 76%, 36%)"
                  stroke="hsl(142, 76%, 36%)"
                  strokeWidth={1}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="totalDistinctItems"
                  stroke="hsl(220, 91%, 54%)"
                  strokeWidth={3}
                  dot={{ fill: 'hsl(220, 91%, 54%)', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: 'hsl(220, 91%, 54%)' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col justify-start pt-8 gap-4 min-w-48">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(142, 76%, 36%)' }}></div>
              <span className="text-sm">Action-Attached (%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(0, 84%, 60%)' }}></div>
              <span className="text-sm">Direct (%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 rounded" style={{ backgroundColor: 'hsl(220, 91%, 54%)' }}></div>
              <span className="text-sm">Total Distinct Items</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


