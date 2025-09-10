import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Info } from 'lucide-react';
import { EnhancedAttributeAnalytics } from '@/hooks/useEnhancedStrategicAttributes';
import { useOrganizationValues } from '@/hooks/useOrganizationValues';
import { useState, useEffect, useMemo } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend } from 'recharts';

// High contrast color palette for white backgrounds
const USER_COLORS = [
  'hsl(220, 90%, 45%)', // Deep blue
  'hsl(145, 85%, 35%)', // Deep green
  'hsl(345, 90%, 45%)', // Deep red
  'hsl(35, 95%, 40%)',  // Deep orange
  'hsl(270, 85%, 50%)', // Deep purple
  'hsl(190, 90%, 40%)', // Deep teal
  'hsl(300, 80%, 45%)', // Deep magenta
  'hsl(60, 85%, 35%)',  // Deep yellow-green
  'hsl(15, 90%, 45%)',  // Deep red-orange
  'hsl(250, 85%, 55%)', // Deep indigo
];

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

  // Process data for radar chart - create individual data for each user
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
    // Each data point will include values for all selected users
    const data = orgValues.map(orgValue => {
      const attributeKey = mapOrgValueToAttributeKey(orgValue);
      
      const dataPoint: any = {
        attribute: orgValue,
        fullMark: 4
      };

      // Add each user's score as a separate property
      selectedAnalytics.forEach(user => {
        const score = user.attributes[attributeKey as keyof typeof user.attributes];
        const userScore = score !== undefined && score !== null ? score : 2; // Default to middle value
        dataPoint[user.userName] = Math.round(userScore * 100) / 100; // Round to 2 decimal places
        console.log(`User ${user.userName} - ${attributeKey}: ${userScore}`);
      });

      return dataPoint;
    });
    
    console.log('Final radar data:', data);
    console.log('=== End Radar Chart Debug ===');
    
    return data;
  }, [orgValues, actionAnalytics, selectedUsers]);

  // Get user data for individual radar lines
  const userData = useMemo(() => {
    return actionAnalytics
      .filter(user => selectedUsers.includes(user.userId))
      .map((user, index) => ({
        name: user.userName,
        color: USER_COLORS[index % USER_COLORS.length],
        dataKey: user.userName
      }));
  }, [actionAnalytics, selectedUsers]);

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
          Individual analysis of {userData.length} user{userData.length !== 1 ? 's' : ''}: {userData.map(u => u.name).join(', ')}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
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
                {/* Render a radar line for each user */}
                {userData.map((user, index) => (
                  <Radar
                    key={user.name}
                    name={user.name}
                    dataKey={user.dataKey}
                    stroke={user.color}
                    fill={user.color}
                    fillOpacity={0.1}
                    strokeWidth={2}
                  />
                ))}
                <Legend />
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