import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { apiService, getApiData } from '@/lib/apiService';
import { Info } from 'lucide-react';

interface ActionUpdatesChartProps {
  startDate: string;
  endDate: string;
  selectedUsers: string[]; // filter by userIds (updater or assignee)
}

interface RawUpdateRow {
  created_date: string; // YYYY-MM-DD (local day)
  updated_by: string;
}

const USER_COLORS = [
  'hsl(220, 90%, 45%)',
  'hsl(145, 85%, 35%)',
  'hsl(345, 90%, 45%)',
  'hsl(35, 95%, 40%)',
  'hsl(270, 85%, 50%)',
  'hsl(190, 90%, 40%)',
  'hsl(300, 80%, 45%)',
  'hsl(60, 85%, 35%)',
  'hsl(15, 90%, 45%)',
  'hsl(250, 85%, 55%)',
];

export function ActionUpdatesChart({ startDate, endDate, selectedUsers }: ActionUpdatesChartProps) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<RawUpdateRow[]>([]);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});

  // Format a Date (in local timezone) to YYYY-MM-DD
  const formatLocalYMD = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Convert a YYYY-MM-DD (interpreted as local) to ISO string at local start/end of day
  const toLocalDayRangeISO = (startYmd: string, endYmd: string) => {
    const start = new Date(`${startYmd}T00:00:00`); // local midnight
    const end = new Date(`${endYmd}T23:59:59.999`); // local end of day
    return { startISO: start.toISOString(), endISO: end.toISOString() };
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!startDate || !endDate) return;
      setLoading(true);
      try {
        console.log('🟡 ActionUpdatesChart fetching data:', { startDate, endDate, selectedUsers });
        const { startISO, endISO } = toLocalDayRangeISO(startDate, endDate);
        
        // Try to fetch with start_date and end_date params
        const params = new URLSearchParams();
        params.append('start_date', startISO);
        params.append('end_date', endISO);
        if (selectedUsers && selectedUsers.length > 0) {
          params.append('user_ids', selectedUsers.join(','));
        }
        
        console.log('🟡 Fetching with URL:', `/analytics/action_updates?${params.toString()}`);
        const response = await apiService.get(`/analytics/action_updates?${params.toString()}`);
        console.log('🟡 Raw response:', response);
        let data = getApiData(response) || [];
        
        console.log('🟡 Total updates fetched:', data.length);
        console.log('🟡 Sample update:', data[0]);
        const mapped: RawUpdateRow[] = data.map((r: any) => ({
          created_date: formatLocalYMD(new Date(r.created_at)),
          updated_by: r.updated_by as string,
        }));
        setRows(mapped);
        console.log('🟡 Mapped rows:', mapped.length);

        // Build name map from org members
        const uniqueIds = Array.from(new Set(mapped.map(r => r.updated_by)));
        if (uniqueIds.length > 0) {
          const membersResponse = await apiService.get('/organization_members');
          const members = getApiData(membersResponse) || [];
          const nm: Record<string, string> = {};
          members.forEach((m: any) => {
            if (m?.user_id && uniqueIds.includes(m.user_id)) {
              nm[m.user_id] = String(m.full_name || 'Unknown User').trim();
            }
          });
          setNameMap(nm);
        } else {
          setNameMap({});
        }
      } catch (e) {
        console.error('Failed to fetch action updates', e);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [startDate, endDate, selectedUsers]);

  const chartData = useMemo(() => {
    // Group by date, then count per user
    const byDate: Record<string, Record<string, number>> = {};
    rows.forEach(r => {
      if (!byDate[r.created_date]) byDate[r.created_date] = {};
      const label = (nameMap[r.updated_by] || 'Unknown User').trim();
      byDate[r.created_date][label] = (byDate[r.created_date][label] || 0) + 1;
    });
    // Convert to recharts array with stable user keys
    const dates = Object.keys(byDate).sort();
    const users = Array.from(new Set(rows.map(r => (nameMap[r.updated_by] || 'Unknown User').trim())));
    return dates.map(date => {
      const entry: any = { date };
      users.forEach(u => { entry[u] = byDate[date][u] || 0; });
      return entry;
    });
  }, [rows, nameMap]);

  const usersInSeries = useMemo(() => Array.from(new Set(rows.map(r => (nameMap[r.updated_by] || 'Unknown User').trim()))), [rows, nameMap]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Action Updates</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="p-8 text-center">
            <Info className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <div className="text-sm text-muted-foreground">Loading action updates…</div>
          </div>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                {usersInSeries.map((u, idx) => (
                  <Bar key={u} dataKey={u} stackId="updates" fill={USER_COLORS[idx % USER_COLORS.length]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ActionUpdatesChart;


