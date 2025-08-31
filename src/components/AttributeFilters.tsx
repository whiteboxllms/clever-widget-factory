import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { CalendarDays, Users, Filter } from 'lucide-react';
import { AttributeAnalytics } from '@/hooks/useStrategicAttributes';

interface AttributeFiltersProps {
  userAnalytics: AttributeAnalytics[];
  selectedUsers: string[];
  onSelectedUsersChange: (userIds: string[]) => void;
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onApplyFilters: () => void;
}

export function AttributeFilters({
  userAnalytics,
  selectedUsers,
  onSelectedUsersChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onApplyFilters
}: AttributeFiltersProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredUsers = userAnalytics.filter(user =>
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
    onSelectedUsersChange(filteredUsers.map(user => user.userId));
  };

  const clearAllUsers = () => {
    onSelectedUsersChange([]);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Filters
        </CardTitle>
      </CardHeader>
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
    </Card>
  );
}