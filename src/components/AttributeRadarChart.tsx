import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { strategicAttributeLabels, AttributeAnalytics, CompanyAverage } from '@/hooks/useStrategicAttributes';

interface AttributeRadarChartProps {
  userAnalytics: AttributeAnalytics[];
  companyAverage: CompanyAverage;
  selectedUsers: string[];
}

const COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1',
  '#d084d0', '#87d068', '#ffb347', '#ff6b6b', '#4ecdc4'
];

export function AttributeRadarChart({ userAnalytics, companyAverage, selectedUsers }: AttributeRadarChartProps) {
  // Transform data for radar chart
  const chartData = Object.entries(strategicAttributeLabels).map(([key, label]) => {
    const dataPoint: any = {
      attribute: label,
      company: companyAverage.attributes[key as keyof typeof strategicAttributeLabels]
    };

    // Add selected users to the data point
    userAnalytics.forEach((user, index) => {
      if (selectedUsers.includes(user.userId)) {
        dataPoint[user.userName] = user.attributes[key as keyof typeof strategicAttributeLabels];
      }
    });

    return dataPoint;
  });

  // Get keys for rendering (company + selected users)
  const dataKeys = ['company', ...userAnalytics
    .filter(user => selectedUsers.includes(user.userId))
    .map(user => user.userName)
  ];

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
                  name={key === 'company' ? 'Company Average' : key}
                  dataKey={key}
                  stroke={COLORS[index % COLORS.length]}
                  fill={COLORS[index % COLORS.length]}
                  fillOpacity={key === 'company' ? 0.1 : 0.2}
                  strokeWidth={key === 'company' ? 3 : 2}
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
          <p>Company average shown as baseline for comparison</p>
        </div>
      </CardContent>
    </Card>
  );
}