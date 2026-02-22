import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Info } from 'lucide-react';
import { EnhancedAttributeAnalytics } from '@/hooks/useEnhancedStrategicAttributes';
import { useOrganizationValues } from '@/hooks/useOrganizationValues';
import { useState, useEffect, useMemo } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend } from 'recharts';
import type { OrganizationMemberSummary } from '@/types/organization';

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
  organizationMembers?: OrganizationMemberSummary[];
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
  
  return mapping[orgValue] || convertToAttributeKey(orgValue);
};

type RadarSeriesPoint = Record<string, number | string>;

export function AttributeRadarChart({ actionAnalytics, issueAnalytics, selectedUsers, organizationMembers = [] }: AttributeRadarChartProps) {
  const [orgValues, setOrgValues] = useState<string[]>([]);
  const [showImpact, setShowImpact] = useState(false);
  const { getOrganizationValues } = useOrganizationValues();

  // Build a deterministic label map from userId -> trimmed display name using provided org members
  const labelMap = useMemo(() => {
    const map = new Map<string, string>();
    const selectedSet = new Set(selectedUsers);

    organizationMembers
      .filter(member => member.is_active !== false && member.user_id && selectedSet.has(member.user_id))
      .forEach(member => {
        map.set(member.user_id, String(member.full_name || 'Unknown User').trim());
      });

    // Fallback to names provided within analytics data if member lookup missing
    actionAnalytics.forEach(user => {
      if (!map.has(user.userId) && selectedSet.has(user.userId)) {
        map.set(user.userId, (user.userName || 'Unknown User').trim());
      }
    });

    return map;
  }, [actionAnalytics, organizationMembers, selectedUsers]);

  // Load organization values
  useEffect(() => {
    const loadOrgValues = async () => {
      const values = await getOrganizationValues();
      setOrgValues(values);
    };
    loadOrgValues();
  }, [getOrganizationValues]);

  // Process data for radar chart - create individual data for each user or impact data
  const radarData = useMemo(() => {
    if (!orgValues.length || !actionAnalytics.length) {
      return [];
    }

    // Filter analytics for selected users
    const selectedAnalytics = actionAnalytics.filter(user => selectedUsers.includes(user.userId));

    if (!selectedAnalytics.length) {
      return [];
    }

    if (showImpact) {
      // Avg(Score) × Actions mode: individual aggregate for each user
      const data = orgValues.map(orgValue => {
        const attributeKey = mapOrgValueToAttributeKey(orgValue);
        
        const dataPoint: RadarSeriesPoint = {
          attribute: orgValue
        };

        // Calculate individual impact for each user
        selectedAnalytics.forEach(user => {
          const userScore = user.attributes[attributeKey as keyof typeof user.attributes];
          const score = userScore !== undefined && userScore !== null ? userScore : 2;
          const totalActions = user.totalActions || 0;
          const impactValue = score * totalActions;
          const label = (labelMap.get(user.userId) || 'Unknown User').trim();
          dataPoint[label] = Math.round(impactValue * 100) / 100;
        });

        return dataPoint;
      });

      // Calculate dynamic fullMark based on maximum impact value across all user series
      const allImpactValues = data.flatMap(point => {
        return Object.entries(point)
          .filter(([key]) => key !== 'attribute' && key !== 'fullMark')
          .map(([, value]) => (typeof value === 'number' ? value : 0));
      });
      const maxImpact = Math.max(...allImpactValues, 1); // Ensure minimum of 1
      const dynamicFullMark = Math.ceil(maxImpact * 1.1); // Add 10% padding

      // Add fullMark to each data point
      data.forEach(point => {
        point.fullMark = dynamicFullMark;
      });
      
      return data;
    } else {
      // Individual mode: separate data for each user
      const data = orgValues.map(orgValue => {
        const attributeKey = mapOrgValueToAttributeKey(orgValue);
        
        const dataPoint: RadarSeriesPoint = {
          attribute: orgValue,
          fullMark: 4
        };

        // Add each user's score as a separate property
        selectedAnalytics.forEach(user => {
          const score = user.attributes[attributeKey as keyof typeof user.attributes];
          const userScore = score !== undefined && score !== null ? score : 2; // Default to middle value
          const label = (labelMap.get(user.userId) || 'Unknown User').trim();
          dataPoint[label] = Math.round(userScore * 100) / 100; // Round to 2 decimal places
        });

        return dataPoint;
      });
      
      return data;
    }
  }, [orgValues, actionAnalytics, selectedUsers, showImpact, labelMap]);

  // Get user data for individual radar lines
  const userData = useMemo(() => {
    return actionAnalytics
      .filter(user => selectedUsers.includes(user.userId))
      .map((user, index) => {
        const label = (labelMap.get(user.userId) || 'Unknown User').trim();
        return {
          name: label,
          color: USER_COLORS[index % USER_COLORS.length],
          dataKey: label
        };
      });
  }, [actionAnalytics, selectedUsers, labelMap]);

  // Get user names for legend
  const selectedUserNames = useMemo(() => {
    return actionAnalytics
      .filter(user => selectedUsers.includes(user.userId))
      .map(user => (labelMap.get(user.userId) || 'Unknown User').trim());
  }, [actionAnalytics, selectedUsers, labelMap]);

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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Strategic Attributes Radar Chart</CardTitle>
            <div className="text-sm text-muted-foreground">
              {showImpact 
                ? `Avg(Score) × Actions for ${userData.length} user${userData.length !== 1 ? 's' : ''}`
                : `Based on scored actions and issues for ${userData.length} user${userData.length !== 1 ? 's' : ''}`
              }
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Label htmlFor="impact-mode" className="text-sm">Include Counts</Label>
            <Switch
              id="impact-mode"
              checked={showImpact}
              onCheckedChange={setShowImpact}
            />
          </div>
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
                  domain={[0, 'dataMax']} 
                  tick={{ fontSize: 10 }}
                  tickCount={5}
                />
                 {/* Render radar based on mode */}
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
            <p>
              {showImpact 
                ? 'Scale: Avg(Score) × Actions (per user)'
                : 'Scale: 0 (Needs Improvement) - 4 (Excellent)'
              }
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}