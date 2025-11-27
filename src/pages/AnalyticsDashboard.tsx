import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, TrendingUp, Users, BarChart3 } from 'lucide-react';
import { AttributeRadarChart } from '@/components/AttributeRadarChart';
import { AttributeFilters } from '@/components/AttributeFilters';
import { apiService, getApiData } from '@/lib/apiService';
import { ScoredActionsList } from '@/components/ScoredActionsList';
import { ProactiveVsReactiveChart } from '@/components/ProactiveVsReactiveChart';
import InventoryTrackingChart from '@/components/InventoryTrackingChart';
import InventoryUsageHeatmap from '@/components/InventoryUsageHeatmap';
import ActionUpdatesChart from '@/components/ActionUpdatesChart';
// Removed IssuesCreatedChart
import { useEnhancedStrategicAttributes } from '@/hooks/useEnhancedStrategicAttributes';
import { useScoredActions } from '@/hooks/useScoredActions';
import { useInventoryTracking } from '@/hooks/useInventoryTracking';

export default function AnalyticsDashboard() {
  const navigate = useNavigate();
  const { getEnhancedAttributeAnalytics, getActionAnalytics, getIssueAnalytics, getProactiveVsReactiveData, getDayActions, fetchAllData, isLoading: attributesLoading } = useEnhancedStrategicAttributes();
  const { scoredActions, isLoading: isLoadingScoredActions, fetchScoredActions } = useScoredActions();
  const { getInventoryTrackingData, getInventoryUsageHeatmapData } = useInventoryTracking();
  
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [filtersCollapsed, setFiltersCollapsed] = useState<boolean>(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [proactiveVsReactiveData, setProactiveVsReactiveData] = useState<any[]>([]);
  const [isLoadingProactiveData, setIsLoadingProactiveData] = useState(false);
  const [inventoryTrackingData, setInventoryTrackingData] = useState<any[]>([]);
  const [isLoadingInventoryTracking, setIsLoadingInventoryTracking] = useState(false);
  const [heatmapData, setHeatmapData] = useState<any[]>([]);
  const [isLoadingHeatmap, setIsLoadingHeatmap] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [didAutoApply, setDidAutoApply] = useState(false);

  // Set default dates (last 2 weeks)
  useEffect(() => {
    const today = new Date();
    const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
    
    const todayString = today.toISOString().split('T')[0];
    const twoWeeksAgoString = twoWeeksAgo.toISOString().split('T')[0];
    
    console.log('Setting default dates:', { start: twoWeeksAgoString, end: todayString, todayDate: today });
    
    setEndDate(todayString);
    setStartDate(twoWeeksAgoString);
  }, []);

  // Process data for display - get ALL users for selection, not filtered by selectedUsers
  const [allUserAnalytics, setAllUserAnalytics] = useState<any[]>([]);
  const [selectedActionAnalytics, setSelectedActionAnalytics] = useState<any[]>([]);
  const [selectedIssueAnalytics, setSelectedIssueAnalytics] = useState<any[]>([]);
  const [totalOrgMembers, setTotalOrgMembers] = useState(0);

  // Debug logging to see what's happening with the data
  console.log('All user analytics:', allUserAnalytics);
  console.log('Selected action analytics:', selectedActionAnalytics);
  console.log('Selected users:', selectedUsers);
  console.log('Selected users count:', selectedUsers.length);
  console.log('All user analytics count:', allUserAnalytics.length);
  
  // Debug specific user details
  if (allUserAnalytics.length > 0) {
    console.log('User details:');
    allUserAnalytics.forEach((user, index) => {
      console.log(`${index + 1}. ${user.userName} (${user.userId}) - Role: ${user.userRole}`);
    });
  }

  // Load initial analytics data and auto-select only active members
  useEffect(() => {
    const loadInitialData = async () => {
      console.log('Starting to load analytics data...');
      
      // Fetch organization members count
      try {
        const response = await apiService.get('/organization_members');
        const members = getApiData(response) || [];
        const activeMembers = members.filter((m: any) => m.is_active !== false);
        setTotalOrgMembers(activeMembers.length);
      } catch (error) {
        console.error('Error fetching org members:', error);
      }
      
      const allAnalytics = await getActionAnalytics(); // Get all users for selection
      console.log('getActionAnalytics returned:', allAnalytics);
      setAllUserAnalytics(allAnalytics);

      // Auto-select all org members so the radar chart shows immediately
      if (allAnalytics.length > 0) {
        const allIds = allAnalytics.map(u => u.userId);
        console.log('Auto-selecting all user IDs:', allIds);
        setSelectedUsers(allIds);
        // Precompute selected action analytics immediately for first render
        const initialSelected = await getActionAnalytics(activeIds);
        console.log('Selected analytics:', initialSelected);
        setSelectedActionAnalytics(initialSelected);
      } else {
        console.log('No analytics data returned, checking if we need to fetch action scores...');
      }

      // Fetch initial scored actions for all users (no filter)
      console.log('Fetching scored actions...');
      await fetchScoredActions();
      console.log('Finished loading initial data');
    };
    
    loadInitialData();
  }, []); // Only run once on mount

  // Update selected user analytics when selection changes
  useEffect(() => {
    const updateSelectedAnalytics = async () => {
      if (selectedUsers.length > 0) {
        const actionAnalytics = await getActionAnalytics(selectedUsers); // Filter by org values for display
        setSelectedActionAnalytics(actionAnalytics);
      }
    };
    
    updateSelectedAnalytics();
  }, [selectedUsers]);

  // Auto-apply filters once when we have dates and an initial active selection
  useEffect(() => {
    const maybeAutoApply = async () => {
      if (!didAutoApply && startDate && endDate && selectedUsers.length > 0) {
        await handleApplyFilters();
        setDidAutoApply(true);
      }
    };
    maybeAutoApply();
  }, [startDate, endDate, selectedUsers, didAutoApply]);

  const handleApplyFilters = async () => {
    setIsLoadingProactiveData(true);
    setIsLoadingInventoryTracking(true);
    
    // Always fetch ALL data, not filtered by selectedUsers - we want all users available for selection
    await fetchAllData(undefined, startDate, endDate);
    await fetchScoredActions(selectedUsers, startDate, endDate);
    
    // Fetch issue analytics for selected users
    const issueAnalytics = await getIssueAnalytics(selectedUsers, startDate, endDate);
    setSelectedIssueAnalytics(issueAnalytics);
    
    // Fetch proactive vs reactive data
    const proactiveData = await getProactiveVsReactiveData(startDate, endDate);
    setProactiveVsReactiveData(proactiveData);
    // Fetch inventory tracking (distinct per item per day) filtered by selected users
    const [inventoryData, heatmap] = await Promise.all([
      getInventoryTrackingData(selectedUsers, startDate, endDate),
      getInventoryUsageHeatmapData(selectedUsers, startDate, endDate)
    ]);
    setInventoryTrackingData(inventoryData);
    setHeatmapData(heatmap);

    setIsLoadingProactiveData(false);
    setIsLoadingInventoryTracking(false);
    setIsLoadingHeatmap(false);
  };

  // Fetch issue analytics and proactive data when dates change
  useEffect(() => {
    const fetchData = async () => {
      if (selectedUsers.length > 0) {
        const issueAnalytics = await getIssueAnalytics(selectedUsers, startDate, endDate);
        setSelectedIssueAnalytics(issueAnalytics);
      }
      
      if (startDate && endDate) {
        setIsLoadingProactiveData(true);
        setIsLoadingInventoryTracking(true);
        const [proactiveData, inventoryData, heatmap] = await Promise.all([
          getProactiveVsReactiveData(startDate, endDate),
          getInventoryTrackingData(selectedUsers, startDate, endDate),
          getInventoryUsageHeatmapData(selectedUsers, startDate, endDate)
        ]);
        setProactiveVsReactiveData(proactiveData);
        setInventoryTrackingData(inventoryData);
        setHeatmapData(heatmap);
        setIsLoadingProactiveData(false);
        setIsLoadingInventoryTracking(false);
        setIsLoadingHeatmap(false);
      }
    };
    
    fetchData();
  }, [selectedUsers, startDate, endDate]);


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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Users</p>
                  <p className="text-2xl font-bold">{totalOrgMembers}</p>
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
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filters Sidebar */}
          <div className="lg:col-span-1">
            <AttributeFilters
              userAnalytics={allUserAnalytics}
              selectedUsers={selectedUsers}
              onSelectedUsersChange={setSelectedUsers}
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              onApplyFilters={handleApplyFilters}
              collapsed={filtersCollapsed}
              onToggleCollapsed={() => setFiltersCollapsed(!filtersCollapsed)}
            />
          </div>

          {/* Charts and Actions */}
          <div className="lg:col-span-3 space-y-6">
            {/* Radar Chart */}
            {selectedUsers.length > 0 ? (
              <AttributeRadarChart
                actionAnalytics={selectedActionAnalytics}
                issueAnalytics={selectedIssueAnalytics}
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

            {/* Scored Actions List (moved below radar chart) */}
            <ScoredActionsList 
              scoredActions={scoredActions}
              isLoading={isLoadingScoredActions}
            />

            {/* Proactive vs Reactive Chart */}
            <ProactiveVsReactiveChart 
              data={proactiveVsReactiveData}
              isLoading={isLoadingProactiveData}
              onDayClick={getDayActions}
            />

          {/* Inventory Tracking: toggle between stacked chart and heatmap */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Inventory Tracking View</div>
            <div className="flex items-center gap-2">
              <Button variant={showHeatmap ? 'outline' : 'default'} size="sm" onClick={() => setShowHeatmap(false)}>Chart</Button>
              <Button variant={showHeatmap ? 'default' : 'outline'} size="sm" onClick={() => setShowHeatmap(true)}>Heatmap</Button>
            </div>
          </div>
          {showHeatmap ? (
            <InventoryUsageHeatmap
              data={heatmapData}
              isLoading={isLoadingHeatmap}
              days={(function() {
                const days: string[] = [];
                if (startDate && endDate) {
                  const start = new Date(`${startDate}T00:00:00.000Z`);
                  const end = new Date(`${endDate}T00:00:00.000Z`);
                  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                    days.push(d.toISOString().slice(0,10));
                  }
                }
                return days;
              })()}
              onCellClick={(cell) => {
                // Future: open details panel. For now, navigate to Inventory with filters via URL.
                const params = new URLSearchParams({ date: cell.dayKey, users: cell.personId });
                navigate(`/inventory?${params.toString()}`);
              }}
            />
          ) : (
            <InventoryTrackingChart
              data={inventoryTrackingData}
              isLoading={isLoadingInventoryTracking}
            />
          )}

          {/* Action Updates (stacked bar) */}
          <ActionUpdatesChart
            startDate={startDate}
            endDate={endDate}
            selectedUsers={selectedUsers}
          />

          {/* Issues Created (stacked bar) - removed */}
          </div>
        </div>
      </div>
    </div>
  );
}