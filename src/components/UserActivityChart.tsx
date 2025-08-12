import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useState, useMemo } from "react";
import { Card } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { Button } from "./ui/button";
import { ActivityDetailsDialog } from "./ActivityDetailsDialog";

interface UserActivityData {
  date: string;
  created: number;
  modified: number;
  used: number;
}

interface UserActivityByPerson {
  date: string;
  user: string;
  created: number;
  modified: number;
  used: number;
}

interface DetailedActivityRecord {
  id: string;
  date: string;
  user: string;
  userName: string;
  type: 'created' | 'modified' | 'used';
  partName: string;
  partDescription?: string;
  changeReason?: string;
  usageDescription?: string;
  quantityUsed?: number;
  missionTitle?: string;
  taskTitle?: string;
  timestamp: string;
}

interface UserActivityChartProps {
  data: UserActivityData[];
  userActivityByPerson: UserActivityByPerson[];
  allUsers: string[];
  detailedActivity: DetailedActivityRecord[];
}

export function UserActivityChart({ data, userActivityByPerson, allUsers, detailedActivity }: UserActivityChartProps) {
  const [selectedUsers, setSelectedUsers] = useState<string[]>(allUsers);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const filteredData = useMemo(() => {
    // Aggregate data for selected users only
    const filtered: Record<string, { created: number; modified: number; used: number }> = {};
    
    // Initialize dates
    data.forEach(item => {
      filtered[item.date] = { created: 0, modified: 0, used: 0 };
    });

    // Add selected user activity
    userActivityByPerson
      .filter(item => selectedUsers.includes(item.user))
      .forEach(item => {
        if (filtered[item.date]) {
          filtered[item.date].created += item.created;
          filtered[item.date].modified += item.modified;
          filtered[item.date].used += item.used;
        }
      });

    return Object.entries(filtered).map(([date, activity]) => ({
      date,
      ...activity
    }));
  }, [data, userActivityByPerson, selectedUsers]);

  const handleUserToggle = (user: string, checked: boolean) => {
    if (checked) {
      setSelectedUsers(prev => [...prev, user]);
    } else {
      setSelectedUsers(prev => prev.filter(u => u !== user));
    }
  };

  const handleSelectAll = () => {
    setSelectedUsers(allUsers);
  };

  const handleDeselectAll = () => {
    setSelectedUsers([]);
  };

  const handleBarClick = (data: any) => {
    if (data && data.activeLabel) {
      setSelectedDate(data.activeLabel);
      setDialogOpen(true);
    }
  };

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        No user activity data available
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const total = payload.reduce((sum: number, entry: any) => sum + entry.value, 0);
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-md">
          <p className="font-medium text-foreground mb-2">{label}</p>
          <p className="text-sm text-muted-foreground mb-1">Total: {total}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium">Filter Users</h3>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
            >
              Select All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeselectAll}
            >
              Clear All
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-32 overflow-y-auto">
          {allUsers.map((user) => (
            <div key={user} className="flex items-center space-x-2">
              <Checkbox
                id={`user-${user}`}
                checked={selectedUsers.includes(user)}
                onCheckedChange={(checked) => handleUserToggle(user, checked as boolean)}
              />
              <label
                htmlFor={`user-${user}`}
                className="text-sm truncate"
                title={user}
              >
                {user}
              </label>
            </div>
          ))}
        </div>
      </Card>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={filteredData}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 60,
            }}
            onClick={handleBarClick}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="date" 
              stroke="hsl(var(--foreground))"
              fontSize={12}
              tick={{ fontSize: 11 }}
            />
            <YAxis stroke="hsl(var(--foreground))" fontSize={12} />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ 
                paddingTop: "10px",
                fontSize: "12px",
                color: "hsl(var(--foreground))"
              }}
            />
            <Bar 
              dataKey="created" 
              stackId="activity"
              fill="hsl(var(--mission-education))" 
              name="Created"
            />
            <Bar 
              dataKey="modified" 
              stackId="activity"
              fill="hsl(var(--mission-construction))" 
              name="Modified"
            />
            <Bar 
              dataKey="used" 
              stackId="activity"
              fill="hsl(var(--mission-research))" 
              name="Used"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ActivityDetailsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        selectedDate={selectedDate}
        detailedActivity={detailedActivity}
        selectedUsers={selectedUsers}
      />
    </div>
  );
}