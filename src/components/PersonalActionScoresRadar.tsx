import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend } from 'recharts';
import { usePersonalActionScores } from '@/hooks/usePersonalActionScores';

interface PersonalActionScoresRadarProps {
  userId: string;
  userName?: string;
  startDate?: string;
  endDate?: string;
}

const attributeMapping: Record<string, string> = {
  'Asset Stewardship': 'Asset Stewardship',
  'Efficiency': 'Efficiency',
  'Energy & Morale Impact': 'Energy & Morale',
  'Financial Impact': 'Financial Impact',
  'Growth Mindset': 'Growth Mindset',
  'Proactive Documentation': 'Documentation',
  'Quality': 'Quality',
  'Root Cause Problem Solving': 'Problem Solving',
  'Safety Focus': 'Safety',
  'Teamwork and Transparent Communication': 'Teamwork'
};

export function PersonalActionScoresRadar({ 
  userId, 
  userName = 'Your',
  startDate,
  endDate 
}: PersonalActionScoresRadarProps) {
  const { aggregatedScores, isLoading, totalScores } = usePersonalActionScores(userId, startDate, endDate);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading scores...</p>
        </CardContent>
      </Card>
    );
  }

  if (totalScores === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{userName} Action Scores</CardTitle>
        </CardHeader>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">No action scores yet</p>
        </CardContent>
      </Card>
    );
  }

  const radarData = Object.entries(aggregatedScores).map(([attribute, data]) => ({
    attribute: attributeMapping[attribute] || attribute,
    score: Math.round(data.avgScore * 100) / 100,
    fullMark: 4
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{userName} Action Scores</CardTitle>
        <p className="text-xs text-muted-foreground">
          Based on {totalScores} scored action{totalScores !== 1 ? 's' : ''}
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="attribute" tick={{ fontSize: 11 }} />
              <PolarRadiusAxis angle={90} domain={[0, 4]} tick={{ fontSize: 10 }} />
              <Radar
                name="Score"
                dataKey="score"
                stroke="hsl(220, 90%, 45%)"
                fill="hsl(220, 90%, 45%)"
                fillOpacity={0.3}
                strokeWidth={2}
              />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="text-center text-xs text-muted-foreground mt-2">
          Scale: 0 (Needs Improvement) - 4 (Excellent)
        </div>
      </CardContent>
    </Card>
  );
}
