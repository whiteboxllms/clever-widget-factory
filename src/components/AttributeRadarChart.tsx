import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { strategicAttributeLabels } from '@/hooks/useStrategicAttributes';
import { EnhancedAttributeAnalytics } from '@/hooks/useEnhancedStrategicAttributes';

interface AttributeRadarChartProps {
  actionAnalytics: EnhancedAttributeAnalytics[];
  issueAnalytics: EnhancedAttributeAnalytics[];
  selectedUsers: string[];
}

const COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1',
  '#d084d0', '#87d068', '#ffb347', '#ff6b6b', '#4ecdc4'
];

export function AttributeRadarChart({ actionAnalytics, issueAnalytics, selectedUsers }: AttributeRadarChartProps) {
  // Transform data for radar chart
  const chartData = Object.entries(strategicAttributeLabels).map(([key, label]) => {
    const dataPoint: any = {
      attribute: label
    };

    // Add selected users' action scores
    actionAnalytics.forEach((user) => {
      if (selectedUsers.includes(user.userId)) {
        dataPoint[`${user.userName} (Actions)`] = user.attributes[key as keyof typeof strategicAttributeLabels];
      }
    });

    // Add selected users' issue scores
    issueAnalytics.forEach((user) => {
      if (selectedUsers.includes(user.userId)) {
        dataPoint[`${user.userName} (Issues)`] = user.attributes[key as keyof typeof strategicAttributeLabels];
      }
    });

    return dataPoint;
  });

  // Get keys for rendering (actions + issues for selected users)
  const actionKeys = actionAnalytics
    .filter(user => selectedUsers.includes(user.userId))
    .map(user => `${user.userName} (Actions)`);
  
  const issueKeys = issueAnalytics
    .filter(user => selectedUsers.includes(user.userId))
    .map(user => `${user.userName} (Issues)`);
  
  const dataKeys = [...actionKeys, ...issueKeys];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Strategic Attributes Radar Chart</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[500px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={chartData} margin={{ top: 20, right: 80, bottom: 20, left: 80 }}>
              <PolarGrid />
              <PolarAngleAxis 
                dataKey="attribute" 
                tick={{ fontSize: 12 }}
                className="text-xs"
              />
              <PolarRadiusAxis 
                angle={90} 
                domain={[0, 4]} 
                tick={{ fontSize: 10 }}
                tickCount={5}
              />
              {dataKeys.map((key, index) => (
                <Radar
                  key={key}
                  name={key}
                  dataKey={key}
                  stroke={COLORS[index % COLORS.length]}
                  fill={COLORS[index % COLORS.length]}
                  fillOpacity={key.includes('(Actions)') ? 0.3 : 0.1}
                  strokeWidth={key.includes('(Actions)') ? 3 : 2}
                />
              ))}
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="line"
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 text-sm text-muted-foreground">
          <p>Scale: 0-4 where 4 represents highest proficiency</p>
          <p>Actions vs Issues comparison for selected users</p>
        </div>
      </CardContent>
    </Card>
  );
}