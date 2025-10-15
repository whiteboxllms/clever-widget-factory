import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { Info } from 'lucide-react';

interface IssuesCreatedChartProps {
  startDate: string;
  endDate: string;
  selectedUsers: string[]; // optional filter by reporter/resolver userIds
}

interface RawIssueRow {
  created_date: string; // YYYY-MM-DD
  reported_by: string;
}

interface RawResolvedRow {
  resolved_date: string; // YYYY-MM-DD
  resolved_by: string;
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

const RESOLVED_COLORS = [
  'hsl(220, 60%, 70%)', // Lighter blue
  'hsl(145, 60%, 60%)', // Lighter green
  'hsl(345, 60%, 70%)', // Lighter red
  'hsl(35, 70%, 65%)',  // Lighter orange
  'hsl(270, 60%, 75%)', // Lighter purple
  'hsl(190, 60%, 65%)', // Lighter teal
  'hsl(300, 60%, 70%)', // Lighter magenta
  'hsl(60, 60%, 60%)',  // Lighter yellow-green
  'hsl(15, 60%, 70%)',  // Lighter red-orange
  'hsl(250, 60%, 75%)', // Lighter indigo
];

export function IssuesCreatedChart({ startDate, endDate, selectedUsers }: IssuesCreatedChartProps) {
  const [loading, setLoading] = useState(false);
  const [createdRows, setCreatedRows] = useState<RawIssueRow[]>([]);
  const [resolvedRows, setResolvedRows] = useState<RawResolvedRow[]>([]);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchData = async () => {
      if (!startDate || !endDate) return;
      setLoading(true);
      try {
        // Pull created issues in range; RLS scopes to org
        let q = supabase
          .from('issues')
          .select('created_at, reported_by')
          .gte('created_at', `${startDate}T00:00:00Z`)
          .lte('created_at', `${endDate}T23:59:59Z`);
        if (selectedUsers && selectedUsers.length > 0) {
          q = q.in('reported_by', selectedUsers);
        }
        const { data, error } = await q;
        if (error) throw error;

        console.log('Issues created raw data:', data);
        console.log('Date range:', startDate, 'to', endDate);

        const mapped: RawIssueRow[] = (data || [])
          .filter((r: any) => r.reported_by)
          .map((r: any) => ({
            created_date: String(r.created_at).slice(0, 10),
            reported_by: r.reported_by as string,
          }));
        
        console.log('Mapped issues created:', mapped);
        setCreatedRows(mapped);

        // Fetch resolved issues
        let resolvedQuery = supabase
          .from('issues')
          .select('resolved_at, resolved_by')
          .eq('status', 'resolved')
          .gte('resolved_at', `${startDate}T00:00:00Z`)
          .lte('resolved_at', `${endDate}T23:59:59Z`);
        // Note: Not filtering by resolved_by since it's often NULL
        const { data: resolvedData, error: resolvedError } = await resolvedQuery;
        if (resolvedError) throw resolvedError;

        console.log('Resolved issues raw data:', resolvedData);
        
        const resolvedMapped: RawResolvedRow[] = (resolvedData || [])
          .filter((r: any) => r.resolved_at) // Filter by resolved_at instead of resolved_by
          .map((r: any) => ({
            resolved_date: String(r.resolved_at).slice(0, 10),
            resolved_by: r.resolved_by || 'Unknown Resolver', // Use fallback if resolved_by is null
          }));
        
        console.log('Mapped issues resolved:', resolvedMapped);
        setResolvedRows(resolvedMapped);

        // Build name map from org members (both created and resolved)
        const uniqueIds = Array.from(new Set([
          ...mapped.map(r => r.reported_by),
          ...resolvedMapped.map(r => r.resolved_by).filter(id => id !== 'Unknown Resolver')
        ]));
        console.log('Unique reporter IDs:', uniqueIds);
        if (uniqueIds.length > 0) {
          const { data: members } = await supabase
            .from('organization_members')
            .select('user_id, full_name')
            .in('user_id', uniqueIds);
          const nm: Record<string, string> = {};
          (members || []).forEach((m: any) => { if (m?.user_id) nm[m.user_id] = String(m.full_name || 'Unknown User').trim(); });
          // Add fallback for Unknown Resolver
          nm['Unknown Resolver'] = 'Unknown Resolver';
          console.log('Name map:', nm);
          setNameMap(nm);
        } else {
          setNameMap({ 'Unknown Resolver': 'Unknown Resolver' });
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to fetch resolved issues', e);
        setCreatedRows([]);
        setResolvedRows([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [startDate, endDate, selectedUsers]);

  const chartData = useMemo(() => {
    console.log('Building chart data from created rows:', createdRows);
    console.log('Building chart data from resolved rows:', resolvedRows);
    console.log('Name map:', nameMap);
    
    // Group counts by date and user
    const byDate: Record<string, Record<string, { created: number; resolved: number }>> = {};
    
    // Process created issues (positive)
    createdRows.forEach(r => {
      if (!byDate[r.created_date]) byDate[r.created_date] = {};
      const label = (nameMap[r.reported_by] || 'Unknown User').trim();
      if (!byDate[r.created_date][label]) byDate[r.created_date][label] = { created: 0, resolved: 0 };
      byDate[r.created_date][label].created += 1;
    });
    
    // Process resolved issues (negative)
    resolvedRows.forEach(r => {
      if (!byDate[r.resolved_date]) byDate[r.resolved_date] = {};
      const label = (nameMap[r.resolved_by] || 'Unknown User').trim();
      if (!byDate[r.resolved_date][label]) byDate[r.resolved_date][label] = { created: 0, resolved: 0 };
      byDate[r.resolved_date][label].resolved += 1;
    });
    
    const dates = Object.keys(byDate).sort();
    const allUsers = Array.from(new Set([
      ...createdRows.map(r => (nameMap[r.reported_by] || 'Unknown User').trim()),
      ...resolvedRows.map(r => (nameMap[r.resolved_by] || 'Unknown User').trim())
    ]));
    
    const result = dates.map(date => {
      const entry: any = { date };
      allUsers.forEach(u => { 
        const data = byDate[date][u] || { created: 0, resolved: 0 };
        entry[`${u} (Created)`] = data.created;
        entry[`${u} (Resolved)`] = -data.resolved; // Negative for resolved
      });
      return entry;
    });
    
    console.log('Final chart data:', result);
    return result;
  }, [createdRows, resolvedRows, nameMap]);

  const usersInSeries = useMemo(() => {
    const allUsers = Array.from(new Set([
      ...createdRows.map(r => (nameMap[r.reported_by] || 'Unknown User').trim()),
      ...resolvedRows.map(r => (nameMap[r.resolved_by] || 'Unknown User').trim())
    ]));
    return allUsers.flatMap(user => {
      const userIndex = allUsers.indexOf(user);
      return [
        { name: `${user} (Created)`, color: USER_COLORS[userIndex % USER_COLORS.length] },
        { name: `${user} (Resolved)`, color: RESOLVED_COLORS[userIndex % RESOLVED_COLORS.length] }
      ];
    });
  }, [createdRows, resolvedRows, nameMap]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Issues Created vs Resolved</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="p-8 text-center">
            <Info className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <div className="text-sm text-muted-foreground">Loading issues data…</div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="p-8 text-center">
            <Info className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <div className="text-sm text-muted-foreground">No issues in this date range</div>
            <div className="text-xs text-muted-foreground mt-2">
              Created: {createdRows.length}, Resolved: {resolvedRows.length}
            </div>
          </div>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                {usersInSeries.map((series, idx) => (
                  <Bar 
                    key={series.name} 
                    dataKey={series.name} 
                    stackId="issues" 
                    fill={series.color}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default IssuesCreatedChart;


