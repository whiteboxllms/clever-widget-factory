import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Cell = {
  personId: string;
  personName: string;
  dayKey: string; // YYYY-MM-DD
  name: string; // MM/DD
  actionPercent: number; // 0-100
  totalDistinct: number;
  actionCount: number;
  directCount: number;
  sizeQuantity: number; // sum abs(quantity_change)
};

interface Props {
  data: Cell[];
  isLoading?: boolean;
  days: string[]; // ordered dayKeys to render columns consistently
  onCellClick?: (cell: Cell) => void;
}

function colorForPercent(p: number): string {
  // 0 -> red, 50 -> amber, 100 -> green
  if (p <= 50) {
    // interpolate red -> amber
    const t = p / 50;
    // red hsl(0, 84%, 60%) to amber ~ hsl(38, 92%, 50%)
    const h = 0 + (38 - 0) * t;
    const s = 84 + (92 - 84) * t;
    const l = 60 + (50 - 60) * t;
    return `hsl(${h}, ${s}%, ${l}%)`;
  } else {
    // amber -> green hsl(142, 76%, 36%)
    const t = (p - 50) / 50;
    const h = 38 + (142 - 38) * t;
    const s = 92 + (76 - 92) * t;
    const l = 50 + (36 - 50) * t;
    return `hsl(${h}, ${s}%, ${l}%)`;
  }
}

export default function InventoryUsageHeatmap({ data, isLoading, days, onCellClick }: Props) {
  const byPerson = useMemo(() => {
    const map = new Map<string, { name: string; cells: Map<string, Cell> }>();
    data.forEach(c => {
      if (!map.has(c.personId)) map.set(c.personId, { name: c.personName, cells: new Map() });
      map.get(c.personId)!.cells.set(c.dayKey, c);
    });
    // stable order by name
    return Array.from(map.entries()).sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [data]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Inventory Usage Heatmap</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Inventory Usage Heatmap</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Color = % via actions, size = quantity removed</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto">
          <table className="min-w-full border-separate" style={{ borderSpacing: 4 }}>
            <thead className="sticky top-0 bg-white z-10">
              <tr>
                <th className="text-left text-xs text-muted-foreground px-2 py-1 w-48">Person</th>
                {days.map(d => (
                  <th key={d} className="text-xs text-muted-foreground px-1 py-1 whitespace-nowrap">{new Date(d).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byPerson.map(([personId, row]) => (
                <tr key={personId}>
                  <td className="text-sm px-2 py-1 whitespace-nowrap">{row.name}</td>
                  {days.map(dayKey => {
                    const c = row.cells.get(dayKey);
                    if (!c) {
                      return (
                        <td key={dayKey} className="px-1 py-1">
                          <div className="w-5 h-5 rounded-sm bg-gray-100"></div>
                        </td>
                      );
                    }
                    const color = colorForPercent(c.actionPercent);
                    // Size scale: sqrt to 8..22 px
                    const radius = Math.max(8, Math.min(22, Math.sqrt(c.sizeQuantity) * 4));
                    return (
                      <td key={dayKey} className="px-1 py-1">
                        <div
                          className="rounded-sm flex items-center justify-center cursor-pointer"
                          style={{ backgroundColor: color, width: 28, height: 28 }}
                          title={`${row.name} • ${c.name}\n${c.actionPercent.toFixed(0)}% via actions • ${c.totalDistinct} distinct items\nQty removed: ${c.sizeQuantity}`}
                          onClick={() => onCellClick && onCellClick(c)}
                        >
                          <div className="bg-white/80 rounded-full" style={{ width: radius, height: radius }}></div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}


