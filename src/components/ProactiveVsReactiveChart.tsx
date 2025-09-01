import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';

interface ProactiveVsReactiveData {
  name: string;
  proactive: number;
  reactive: number;
  totalActions: number;
  proactiveCount: number;
  reactiveCount: number;
  dayKey: string;
}

interface ActionItem {
  id: string;
  title: string;
  status: string;
  linked_issue_id: string | null;
  assignee?: {
    full_name: string;
  } | null;
}

interface ProactiveVsReactiveChartProps {
  data: ProactiveVsReactiveData[];
  isLoading?: boolean;
  onDayClick?: (dayKey: string) => Promise<ActionItem[]>;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-medium">{label}</p>
        <div className="space-y-1 text-sm">
          <p className="text-green-600">
            Gawa Agad: {data.proactiveCount} ({data.proactive.toFixed(1)}%)
          </p>
          <p className="text-red-600">
            Bahala Na: {data.reactiveCount} ({data.reactive.toFixed(1)}%)
          </p>
          <p className="font-medium">Total Actions: {data.totalActions}</p>
        </div>
      </div>
    );
  }
  return null;
};

const CustomLabel = ({ value, viewBox }: any) => {
  if (value < 10) return null; // Don't show label if segment is too small
  
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
      fontSize={12}
      fontWeight="bold"
    >
      {`${value.toFixed(0)}%`}
    </text>
  );
};

export function ProactiveVsReactiveChart({ data, isLoading, onDayClick }: ProactiveVsReactiveChartProps) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedDayActions, setSelectedDayActions] = useState<ActionItem[]>([]);
  const [loadingActions, setLoadingActions] = useState(false);

  const handleBarClick = async (data: any) => {
    if (!onDayClick || !data) return;
    
    console.log('Bar clicked:', data); // Debug log
    setSelectedDay(data.dayKey);
    setLoadingActions(true);
    
    try {
      const actions = await onDayClick(data.dayKey);
      setSelectedDayActions(actions);
    } catch (error) {
      console.error('Error fetching day actions:', error);
      setSelectedDayActions([]);
    } finally {
      setLoadingActions(false);
    }
  };
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gawa Agad vs. Bahala Na</CardTitle>
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
          <CardTitle>Gawa Agad vs. Bahala Na</CardTitle>
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

  // Calculate overall stats for the header
  const totalActionsAcrossWeeks = data.reduce((sum, day) => sum + day.totalActions, 0);
  const totalProactiveAcrossWeeks = data.reduce((sum, day) => sum + day.proactiveCount, 0);
  const totalReactiveAcrossWeeks = data.reduce((sum, day) => sum + day.reactiveCount, 0);
  const overallReactivePercent = totalActionsAcrossWeeks > 0 ? (totalReactiveAcrossWeeks / totalActionsAcrossWeeks) * 100 : 0;

  const getStatusMessage = (reactivePercent: number) => {
    if (reactivePercent > 70) return { text: "Primarily Bahala Na", color: "text-red-600" };
    if (reactivePercent < 30) return { text: "Primarily Gawa Agad", color: "text-green-600" };
    return { text: "", color: "" };
  };

  const status = getStatusMessage(overallReactivePercent);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Gawa Agad vs. Bahala Na</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Daily breakdown of immediate action vs reactive response
            </p>
          </div>
          <div className="text-right">
            {status.text && <p className={`text-sm font-medium ${status.color}`}>{status.text}</p>}
            <p className="text-xs text-muted-foreground">{totalActionsAcrossWeeks} total actions</p>
            <p className="text-xs text-muted-foreground">{overallReactivePercent.toFixed(1)}% bahala na overall</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4">
          {/* Chart */}
          <div className="flex-1 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 10 }}
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis 
                  domain={[0, 100]}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip content={<CustomTooltip />} />
                
                {/* Reactive (red) bar - shown first so it appears at the bottom */}
                <Bar 
                  dataKey="reactive" 
                  stackId="actions" 
                  fill="hsl(0, 84%, 60%)"
                  stroke="hsl(0, 84%, 60%)"
                  strokeWidth={1}
                  onClick={handleBarClick}
                  style={{ cursor: onDayClick ? 'pointer' : 'default' }}
                />
                
                {/* Proactive (green) bar - shown second so it appears at the top */}
                <Bar 
                  dataKey="proactive" 
                  stackId="actions" 
                  fill="hsl(142, 76%, 36%)"
                  stroke="hsl(142, 76%, 36%)"
                  strokeWidth={1}
                  onClick={handleBarClick}
                  style={{ cursor: onDayClick ? 'pointer' : 'default' }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          {/* Legend - positioned to be level with the chart */}
          <div className="flex flex-col justify-start pt-8 gap-4 min-w-48">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: "hsl(142, 76%, 36%)" }}></div>
              <span className="text-sm">Gawa Agad</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: "hsl(0, 84%, 60%)" }}></div>
              <span className="text-sm">Bahala Na</span>
            </div>
          </div>
        </div>

        {/* Selected Day Actions */}
        {selectedDay && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-3">
              Actions for {data.find(d => d.dayKey === selectedDay)?.name}
              {loadingActions && <span className="ml-2 text-muted-foreground">(Loading...)</span>}
            </h4>
            
            {loadingActions ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : selectedDayActions.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {selectedDayActions.map((action) => (
                  <div key={action.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                    <div className="flex-1">
                      <div className="font-medium">{action.title}</div>
                      <div className="text-muted-foreground text-xs">
                        {action.assignee?.full_name || 'Unassigned'} • {action.status}
                      </div>
                    </div>
                    <div className="ml-2">
                      {action.linked_issue_id ? (
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">
                          Bahala Na
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                          Gawa Agad
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm py-4">No actions found for this day.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}