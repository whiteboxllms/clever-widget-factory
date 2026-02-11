import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { apiService, getApiData } from '@/lib/apiService';
import { Info } from 'lucide-react';
import { useOrganizationMembers } from '@/hooks/useOrganizationMembers';

interface ObservationsChartProps {
  startDate: string;
  endDate: string;
  selectedUsers: string[]; // filter by userIds (captured_by)
}

interface RawObservationRow {
  created_date: string; // YYYY-MM-DD (local day)
  captured_by: string;
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

export function ObservationsChart({ startDate, endDate, selectedUsers }: ObservationsChartProps) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<RawObservationRow[]>([]);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  const { members: organizationMembers } = useOrganizationMembers();

  const organizationNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    organizationMembers.forEach(member => {
      if (member.user_id) {
        map[member.user_id] = String(member.full_name || 'Unknown User').trim();
      }
    });
    return map;
  }, [organizationMembers]);

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
        const { startISO, endISO } = toLocalDayRangeISO(startDate, endDate);
        
        const params = new URLSearchParams();
        params.append('start_date', startISO);
        params.append('end_date', endISO);
        if (selectedUsers && selectedUsers.length > 0) {
          params.append('user_ids', selectedUsers.join(','));
        }
        
        const response = await apiService.get(`/analytics/observations?${params.toString()}`);
        const data = getApiData(response) || [];
        
        const mapped: RawObservationRow[] = (Array.isArray(data) ? data : []).map((r: any) => ({
          created_date: formatLocalYMD(new Date(r.created_at)),
          captured_by: r.captured_by as string,
        }));
        setRows(mapped);

        // Build name map from org members
        const uniqueIds = Array.from(new Set(mapped.map(r => r.captured_by)));
        if (uniqueIds.length > 0) {
          const nm: Record<string, string> = {};
          uniqueIds.forEach(id => {
            nm[id] = organizationNameMap[id] || 'Unknown User';
          });
          setNameMap(nm);
        } else {
          setNameMap({});
        }
      } catch (e) {
        console.error('Failed to fetch asset observations', e);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [startDate, endDate, selectedUsers, organizationNameMap]);

  const chartData = useMemo(() => {
    // Group by date, then count per user
    const byDate: Record<string, Record<string, number>> = {};
    rows.forEach(r => {
      if (!byDate[r.created_date]) byDate[r.created_date] = {};
      const label = (nameMap[r.captured_by] || 'Unknown User').trim();
      byDate[r.created_date][label] = (byDate[r.created_date][label] || 0) + 1;
    });
    // Convert to recharts array with stable user keys
    const dates = Object.keys(byDate).sort();
    const users = Array.from(new Set(rows.map(r => (nameMap[r.captured_by] || 'Unknown User').trim())));
    return dates.map(date => {
      const entry: any = { date };
      users.forEach(u => { entry[u] = byDate[date][u] || 0; });
      return entry;
    });
  }, [rows, nameMap]);

  const usersInSeries = useMemo(() => Array.from(new Set(rows.map(r => (nameMap[r.captured_by] || 'Unknown User').trim()))), [rows, nameMap]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Asset Observations</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="p-8 text-center">
            <Info className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <div className="text-sm text-muted-foreground">Loading asset observations…</div>
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
                  <Bar key={u} dataKey={u} stackId="observations" fill={USER_COLORS[idx % USER_COLORS.length]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ObservationsChart;
