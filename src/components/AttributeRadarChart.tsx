import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Info } from 'lucide-react';
import { EnhancedAttributeAnalytics } from '@/hooks/useEnhancedStrategicAttributes';
import { useOrganizationValues } from '@/hooks/useOrganizationValues';
import { useState, useEffect } from 'react';

interface AttributeRadarChartProps {
  actionAnalytics: EnhancedAttributeAnalytics[];
  issueAnalytics: EnhancedAttributeAnalytics[];
  selectedUsers: string[];
}

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

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Organization Values Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Organization Values Display */}
          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-blue-900 dark:text-blue-100 mb-2">Current Organization Values</p>
                <div className="flex flex-wrap gap-2">
                  {orgValues.length > 0 ? (
                    orgValues.map((value) => (
                      <span 
                        key={value}
                        className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded-full text-sm font-medium"
                      >
                        {value}
                      </span>
                    ))
                  ) : (
                    <span className="text-blue-700 dark:text-blue-200">No custom values configured</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Analytics Note */}
          <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-amber-900 dark:text-amber-100 mb-1">Analytics Integration</p>
                <p className="text-amber-700 dark:text-amber-200">
                  The radar chart feature is being updated to work with your custom organization values. 
                  In the meantime, you can view your organization's values above and manage them in the Organization Settings.
                </p>
              </div>
            </div>
          </div>

          {/* Selected Users Info */}
          {selectedUsers.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Selected Users for Analysis:</h4>
              <div className="flex flex-wrap gap-2">
                {actionAnalytics
                  .filter(user => selectedUsers.includes(user.userId))
                  .map((user) => (
                    <span 
                      key={user.userId}
                      className="inline-block px-3 py-1 bg-muted text-muted-foreground rounded-full text-sm"
                    >
                      {user.userName}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}