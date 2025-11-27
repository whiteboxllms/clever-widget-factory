import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { CalendarDays, Users, Filter, ChevronRight } from 'lucide-react';
import { AttributeAnalytics } from '@/hooks/useStrategicAttributes';
import { apiService, getApiData } from '@/lib/apiService';

interface AttributeFiltersProps {
  userAnalytics: AttributeAnalytics[];
  selectedUsers: string[];
  onSelectedUsersChange: (userIds: string[]) => void;
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onApplyFilters: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export function AttributeFilters({
  userAnalytics,
  selectedUsers,
  onSelectedUsersChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onApplyFilters,
  collapsed = false,
  onToggleCollapsed
}: AttributeFiltersProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Build a name map from organization_members to replace any 'Unknown User' entries
  const [nameMap, setNameMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadNames = async () => {
      const ids = Array.from(new Set(userAnalytics.map(u => u.userId)));
      if (ids.length === 0) {
        setNameMap({});
        return;
      }
      const map: Record<string, string> = {};
      try {
        const response = await apiService.get('/organization_members');
        const members = getApiData(response) || [];
        members
          .filter((m: any) => m.is_active !== false && ids.includes(m.user_id))
          .forEach((m: any) => {
            if (m?.user_id && m?.full_name) map[m.user_id] = String(m.full_name).trim();
          });
      } catch {
        // ignore fetch errors; we'll fall back to provided names
      }
      setNameMap(map);
    };
    loadNames();
  }, [userAnalytics]);

  const usersWithDisplayNames = useMemo(() => {
    // Only include users that resolved via active org membership
    return userAnalytics
      .filter(u => Boolean(nameMap[u.userId]))
      .map(u => ({
        ...u,
        userName: (nameMap[u.userId] || 'Unknown User').trim(),
      }));
  }, [userAnalytics, nameMap]);

  const filteredUsers = usersWithDisplayNames.filter(user =>
    user.userName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUserToggle = (userId: string) => {
    if (selectedUsers.includes(userId)) {
      onSelectedUsersChange(selectedUsers.filter(id => id !== userId));
    } else {
      onSelectedUsersChange([...selectedUsers, userId]);
    }
  };

  const selectAllUsers = () => {
    // Select all available users (not just the filtered subset)
    onSelectedUsersChange(usersWithDisplayNames.map(user => user.userId));
  };

  const clearAllUsers = () => {
    onSelectedUsersChange([]);
  };

  return (
    <Card className="w-full">
      <CardHeader onClick={onToggleCollapsed} className="cursor-pointer">
        <CardTitle className="flex items-center gap-2">
          <ChevronRight className={`h-4 w-4 transition-transform ${collapsed ? '' : 'rotate-90'}`} />
          Filters
        </CardTitle>
      </CardHeader>
      {!collapsed && (
      <CardContent className="space-y-6">
        {/* Date Filters */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <CalendarDays className="h-4 w-4" />
            Time Range
          </Label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="startDate" className="text-xs text-muted-foreground">
                Start Date
              </Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => onStartDateChange(e.target.value)}
                className="text-sm"
              />
            </div>
            <div>
              <Label htmlFor="endDate" className="text-xs text-muted-foreground">
                End Date
              </Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => onEndDateChange(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>
        </div>

        {/* User Selection */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Users className="h-4 w-4" />
            Select People ({selectedUsers.length} selected)
          </Label>
          
          <div className="space-y-2">
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="text-sm"
            />
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAllUsers}
                className="text-xs"
              >
                Select All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllUsers}
                className="text-xs"
              >
                Clear All
              </Button>
            </div>
          </div>

          <div className="max-h-40 overflow-y-auto space-y-2 border rounded-md p-2">
            {filteredUsers.map(user => (
              <div key={user.userId} className="flex items-center space-x-2">
                <Checkbox
                  id={user.userId}
                  checked={selectedUsers.includes(user.userId)}
                  onCheckedChange={() => handleUserToggle(user.userId)}
                />
                <Label
                  htmlFor={user.userId}
                  className="text-sm font-normal cursor-pointer flex-1"
                >
                  {user.userName}
                  <span className="text-xs text-muted-foreground ml-1">
                    ({user.userRole})
                  </span>
                </Label>
              </div>
            ))}
          </div>
        </div>

        <Button 
          onClick={onApplyFilters} 
          className="w-full"
          size="sm"
        >
          Apply Filters
        </Button>
      </CardContent>
      )}
    </Card>
  );
}