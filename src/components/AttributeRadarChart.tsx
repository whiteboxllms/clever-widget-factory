import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Info } from 'lucide-react';
import { EnhancedAttributeAnalytics } from '@/hooks/useEnhancedStrategicAttributes';
import { useOrganizationValues } from '@/hooks/useOrganizationValues';
import { useState, useEffect, useMemo } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend } from 'recharts';

interface AttributeRadarChartProps {
  actionAnalytics: EnhancedAttributeAnalytics[];
  issueAnalytics: EnhancedAttributeAnalytics[];
  selectedUsers: string[];
}

// Function to convert display names to attribute keys
const convertToAttributeKey = (displayName: string): string => {
  return displayName.toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_');
};

// Function to map organization values to strategic attribute keys
// This mapping must match exactly with mapScoredAttributeToStrategic in useEnhancedStrategicAttributes
const mapOrgValueToAttributeKey = (orgValue: string): string => {
  const mapping: Record<string, string> = {
    'Quality': 'quality',
    'Efficiency': 'efficiency',
    'Safety Focus': 'safety_focus',
    'Teamwork and Transparent Communication': 'teamwork',
    'Root Cause Problem Solving': 'root_cause_problem_solving',
    'Proactive Documentation': 'proactive_documentation',
    'Asset Stewardship': 'asset_stewardship',
    'Financial Impact': 'financial_impact',
    'Energy & Morale Impact': 'energy_morale_impact',
    'Growth Mindset': 'growth_mindset'
  };
  
  // Debug logging
  console.log('Mapping organization value:', orgValue, 'to attribute key:', mapping[orgValue]);
  
  return mapping[orgValue] || convertToAttributeKey(orgValue);
};

export function AttributeRadarChart({ actionAnalytics, issueAnalytics, selectedUsers }: AttributeRadarChartProps) {
  const [orgValues, setOrgValues] = useState<string[]>([]);
  const { getOrganizationValues } = useOrganizationValues();

  // Load organization values
  useEffect(() => {
    const loadOrgValues = async () => {
      const values = await getOrganizationValues();
      setOrgValues(values);
    };
    loadOrgValues();
  }, [getOrganizationValues]);

  // Process data for radar chart
  const radarData = useMemo(() => {
    console.log('=== Radar Chart Debug ===');
    console.log('Organization values:', orgValues);
    console.log('Action analytics:', actionAnalytics);
    console.log('Selected users:', selectedUsers);
    
    if (!orgValues.length || !actionAnalytics.length) {
      console.log('Missing org values or action analytics');
      return [];
    }

    // Filter analytics for selected users
    const selectedAnalytics = actionAnalytics.filter(user => 
      selectedUsers.includes(user.userId)
    );
    
    console.log('Selected analytics:', selectedAnalytics);

    if (!selectedAnalytics.length) {
      console.log('No selected analytics found');
      return [];
    }

    // Create radar chart data points for each organization value
    const data = orgValues.map(orgValue => {
      const attributeKey = mapOrgValueToAttributeKey(orgValue);
      
      // Calculate average score for this attribute across selected users
      const scores = selectedAnalytics
        .map(user => {
          const score = user.attributes[attributeKey as keyof typeof user.attributes];
          console.log(`User ${user.userName} - ${attributeKey}: ${score}`);
          return score;
        })
        .filter(score => score !== undefined && score !== null);
      
      const avgScore = scores.length > 0 
        ? scores.reduce((sum, score) => sum + score, 0) / scores.length 
        : 2; // Default to middle value

      console.log(`${orgValue} (${attributeKey}): scores=[${scores}], avg=${avgScore}`);

      return {
        attribute: orgValue,
        value: Math.round(avgScore * 100) / 100, // Round to 2 decimal places
        fullMark: 4
      };
    });
    
    console.log('Final radar data:', data);
    console.log('=== End Radar Chart Debug ===');
    
    return data;
  }, [orgValues, actionAnalytics, selectedUsers]);

  // Get user names for legend
  const selectedUserNames = useMemo(() => {
    return actionAnalytics
      .filter(user => selectedUsers.includes(user.userId))
      .map(user => user.userName);
  }, [actionAnalytics, selectedUsers]);

  if (!orgValues.length) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Strategic Attributes Radar Chart</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-8 text-center">
            <Info className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">Loading Organization Values</h3>
            <p className="text-muted-foreground">Please wait while we load your organization's strategic attributes...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!selectedUsers.length) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Strategic Attributes Radar Chart</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-8 text-center">
            <Info className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">No Users Selected</h3>
            <p className="text-muted-foreground">Select users from the filters to view their strategic attributes comparison.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Strategic Attributes Radar Chart</CardTitle>
        <div className="text-sm text-muted-foreground">
          Comparing {selectedUserNames.length} user{selectedUserNames.length !== 1 ? 's' : ''}: {selectedUserNames.join(', ')}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Organization Values Display */}
          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-blue-900 dark:text-blue-100 mb-2">Organization Strategic Attributes</p>
                <div className="flex flex-wrap gap-2">
                  {orgValues.map((value) => (
                    <span 
                      key={value}
                      className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded-full text-sm font-medium"
                    >
                      {value}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Radar Chart */}
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
                <PolarGrid />
                <PolarAngleAxis 
                  dataKey="attribute" 
                  tick={{ fontSize: 12 }}
                  className="text-sm"
                />
                <PolarRadiusAxis 
                  angle={90} 
                  domain={[0, 4]} 
                  tick={{ fontSize: 10 }}
                  tickCount={5}
                />
                <Radar 
                  name="Average Score" 
                  dataKey="value" 
                  stroke="hsl(var(--primary))" 
                  fill="hsl(var(--primary))" 
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Scale Legend */}
          <div className="text-center text-sm text-muted-foreground">
            <p>Scale: 0 (Needs Improvement) - 4 (Excellent)</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}