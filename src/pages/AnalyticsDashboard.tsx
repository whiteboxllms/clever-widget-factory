import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, TrendingUp, Users, BarChart3 } from 'lucide-react';
import { AttributeRadarChart } from '@/components/AttributeRadarChart';
import { AttributeFilters } from '@/components/AttributeFilters';
import { ScoredActionsList } from '@/components/ScoredActionsList';
import { useEnhancedStrategicAttributes } from '@/hooks/useEnhancedStrategicAttributes';
import { useScoredActions } from '@/hooks/useScoredActions';

export default function AnalyticsDashboard() {
  const navigate = useNavigate();
  const { getEnhancedAttributeAnalytics, getEnhancedCompanyAverage, fetchAllData, isLoading: attributesLoading } = useEnhancedStrategicAttributes();
  const { scoredActions, isLoading: isLoadingScoredActions, fetchScoredActions } = useScoredActions();
  
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Set default dates (last 30 days)
  useEffect(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
  }, []);

  // Process data for display
  const userAnalytics = getEnhancedAttributeAnalytics(selectedUsers);
  const companyAverage = getEnhancedCompanyAverage();

  // Auto-select first 3 users on initial load
  useEffect(() => {
    if (userAnalytics.length > 0 && selectedUsers.length === 0) {
      setSelectedUsers(userAnalytics.slice(0, 3).map(user => user.userId));
    }
  }, [userAnalytics]);

  const handleApplyFilters = async () => {
    await fetchAllData(selectedUsers, startDate, endDate);
    await fetchScoredActions(selectedUsers, startDate, endDate);
  };

  const selectedUserAnalytics = userAnalytics.filter(user => selectedUsers.includes(user.userId));

  if (attributesLoading || isLoadingScoredActions) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-7xl mx-auto space-y-6">
          <Card>
            <CardContent className="p-8">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-2">Loading analytics...</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/dashboard')}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Dashboard
                </Button>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-6 w-6" />
                    Strategic Attributes Analytics
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Analyze worker performance across 10 strategic attributes
                  </p>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Users</p>
                  <p className="text-2xl font-bold">{userAnalytics.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Selected for Analysis</p>
                  <p className="text-2xl font-bold">{selectedUsers.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-8 w-8 text-purple-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Company Avg (Quality)</p>
                  <p className="text-2xl font-bold">
                    {companyAverage.attributes.quality?.toFixed(1) || '0.0'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filters Sidebar */}
          <div className="lg:col-span-1">
            <AttributeFilters
              userAnalytics={userAnalytics}
              selectedUsers={selectedUsers}
              onSelectedUsersChange={setSelectedUsers}
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              onApplyFilters={handleApplyFilters}
            />
          </div>

          {/* Charts and Actions */}
          <div className="lg:col-span-3 space-y-6">
            {/* Radar Chart */}
            {selectedUsers.length > 0 ? (
              <AttributeRadarChart
                userAnalytics={selectedUserAnalytics}
                companyAverage={companyAverage}
                selectedUsers={selectedUsers}
              />
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="text-muted-foreground">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">No Users Selected</h3>
                    <p>Select users from the filters to view their strategic attributes comparison.</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Scored Actions List */}
            <ScoredActionsList 
              scoredActions={scoredActions}
              isLoading={isLoadingScoredActions}
            />
          </div>
        </div>
      </div>
    </div>
  );
}