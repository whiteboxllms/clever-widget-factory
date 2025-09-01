import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { strategicAttributeLabels } from '@/hooks/useStrategicAttributes';
import { EnhancedAttributeAnalytics } from '@/hooks/useEnhancedStrategicAttributes';
import { useState } from 'react';

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
  const [showImpact, setShowImpact] = useState(false);

  // Transform data for radar chart
  const chartData = Object.entries(strategicAttributeLabels).map(([key, label]) => {
    const dataPoint: any = {
      attribute: label
    };

    // Add selected users' action scores
    actionAnalytics.forEach((user) => {
      if (selectedUsers.includes(user.userId)) {
        const attributeValue = user.attributes[key as keyof typeof strategicAttributeLabels] || 0;
        const actionCount = user.scoreCount?.[key as keyof typeof strategicAttributeLabels] || 0;
        dataPoint[`${user.userName} (Actions)`] = showImpact ? attributeValue * actionCount : attributeValue;
      }
    });

    // Add selected users' issue scores
    issueAnalytics.forEach((user) => {
      if (selectedUsers.includes(user.userId)) {
        const attributeValue = user.attributes[key as keyof typeof strategicAttributeLabels] || 0;
        const issueCount = user.scoreCount?.[key as keyof typeof strategicAttributeLabels] || 0;
        dataPoint[`${user.userName} (Issues)`] = showImpact ? attributeValue * issueCount : attributeValue;
      }
    });

    return dataPoint;
  });

  // Calculate dynamic domain for impact mode
  const maxValue = showImpact 
    ? Math.max(...chartData.flatMap(data => 
        dataKeys.map(key => data[key] || 0)
      ))
    : 4;

  const domain = showImpact ? [0, Math.ceil(maxValue * 1.1)] : [0, 4];

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
        <div className="flex items-center justify-between">
          <CardTitle>Strategic Attributes Radar Chart</CardTitle>
          <div className="flex items-center space-x-2">
            <Label htmlFor="impact-switch" className="text-sm font-medium">
              Impact
            </Label>
            <Switch
              id="impact-switch"
              checked={showImpact}
              onCheckedChange={setShowImpact}
            />
          </div>
        </div>
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
                domain={domain} 
                tick={{ fontSize: 10 }}
                tickCount={showImpact ? 6 : 5}
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
          <p>
            {showImpact 
              ? "Scale: Impact (Average Score × Number of Actions/Issues)" 
              : "Scale: 0-4 where 4 represents highest proficiency"
            }
          </p>
          <p>Actions vs Issues comparison for selected users</p>
        </div>
      </CardContent>
    </Card>
  );
}