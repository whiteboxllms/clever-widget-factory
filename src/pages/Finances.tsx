import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMaxwellRecordHighlight } from '@/contexts/MaxwellRecordHighlightContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Plus, Loader2, ArrowUpDown, X } from 'lucide-react';
import { useFinancialRecords } from '@/hooks/useFinancialRecords';

const TIME_FRAMES = [
  { value: '7', label: 'Last 7 Days' },
  { value: '30', label: 'Last 30 Days' },
  { value: '90', label: 'Last 90 Days' },
  { value: '365', label: 'Last Year' },
  { value: 'all', label: 'All Time' },
] as const;

const PAYMENT_METHODS = ['Cash', 'SCash', 'GCash', 'Wise'] as const;

type SortField = 'transaction_date' | 'description' | 'amount';
type SortDir = 'asc' | 'desc';

export default function Finances() {
  const navigate = useNavigate();
  const location = useLocation();
  const { maxwellRecordIds, clearMaxwellRecordIds, isFilterActive, setIsFilterActive } = useMaxwellRecordHighlight();
  const [timeFrame, setTimeFrame] = useState('30');
  const [descSearch, setDescSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('All');
  const [creatorFilter, setCreatorFilter] = useState('All');
  const [sortField, setSortField] = useState<SortField>('transaction_date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const { startDate, endDate } = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    if (timeFrame === 'all') return { startDate: undefined, endDate: today };
    const d = new Date();
    d.setDate(d.getDate() - parseInt(timeFrame));
    return { startDate: d.toISOString().split('T')[0], endDate: today };
  }, [timeFrame]);

  const { data: financialData, isLoading } = useFinancialRecords(
    { ...(startDate ? { start_date: startDate } : {}), end_date: endDate }
  );

  const creatorNames = useMemo(() => {
    if (!financialData?.records) return ['All'];
    const names = new Set(financialData.records.map(r => r.created_by_name || 'Unknown'));
    return ['All', ...Array.from(names).sort()];
  }, [financialData?.records]);

  const firstHighlightRef = useRef<HTMLTableRowElement>(null);
  const prevRecordIdsRef = useRef<string[]>([]);

  const maxwellRecordIdSet = useMemo(() => new Set(maxwellRecordIds), [maxwellRecordIds]);

  const matchCount = useMemo(() => {
    if (!financialData?.records || maxwellRecordIds.length === 0) return 0;
    return financialData.records.filter(r => maxwellRecordIdSet.has(r.id)).length;
  }, [financialData?.records, maxwellRecordIds, maxwellRecordIdSet]);

  useEffect(() => {
    if (
      maxwellRecordIds.length > 0 &&
      prevRecordIdsRef.current.length === 0 &&
      firstHighlightRef.current
    ) {
      firstHighlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    prevRecordIdsRef.current = maxwellRecordIds;
  }, [maxwellRecordIds]);

  useEffect(() => {
    return () => {
      clearMaxwellRecordIds();
    };
  }, []);

  const filteredAndSorted = useMemo(() => {
    if (!financialData?.records) return [];
    let records = [...financialData.records];

    // Filter by description search
    if (descSearch.trim()) {
      const q = descSearch.toLowerCase();
      records = records.filter(r => (r.description || '').toLowerCase().includes(q));
    }

    // Filter by payment method
    if (methodFilter !== 'All') {
      records = records.filter(r => r.payment_method === methodFilter);
    }

    // Filter by creator
    if (creatorFilter !== 'All') {
      records = records.filter(r => (r.created_by_name || 'Unknown') === creatorFilter);
    }

    // Maxwell filter
    if (isFilterActive && maxwellRecordIds.length > 0) {
      records = records.filter(r => maxwellRecordIdSet.has(r.id));
    }

    // Sort
    records.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'transaction_date':
          cmp = new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime();
          break;
        case 'description':
          cmp = (a.description || '').localeCompare(b.description || '');
          break;
        case 'amount':
          cmp = a.amount - b.amount;
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return records;
  }, [financialData?.records, descSearch, methodFilter, creatorFilter, sortField, sortDir, isFilterActive, maxwellRecordIds, maxwellRecordIdSet]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'transaction_date' ? 'desc' : 'asc');
    }
  };

  const hasFilters = descSearch || methodFilter !== 'All' || creatorFilter !== 'All';

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Finances</h1>
        </div>
        <Button onClick={() => navigate('/financial-records/new')}>
          <Plus className="h-4 w-4 mr-1" />
          Record Transaction
        </Button>
      </div>

      {/* Running Balance */}
      <Card className="mb-4">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Petty Cash Balance</p>
          {isLoading ? (
            <div className="flex items-center gap-2 mt-1">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">Loading...</span>
            </div>
          ) : (
            <p className={`text-3xl font-bold ${(financialData?.running_balance ?? 0) < 0 ? 'text-red-600' : 'text-green-600'}`}>
              ₱{(financialData?.running_balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Transactions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">Transactions</CardTitle>
            {!isLoading && (
              <span className="text-sm text-muted-foreground">
                {filteredAndSorted.length}{hasFilters ? ` of ${financialData?.records?.length || 0}` : ''} records
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={() => { setDescSearch(''); setMethodFilter('All'); setCreatorFilter('All'); }}>
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
            <Select value={timeFrame} onValueChange={setTimeFrame}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_FRAMES.map((tf) => (
                  <SelectItem key={tf.value} value={tf.value}>{tf.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {maxwellRecordIds.length > 0 && matchCount > 0 && (
            <div className="flex items-center justify-between px-4 py-2 mb-2 rounded-lg bg-orange-100 border border-orange-300 dark:bg-orange-900/30 dark:border-orange-700">
              <span className="text-sm text-orange-700 dark:text-orange-300">
                Showing {matchCount} records from Maxwell
              </span>
              <Button variant="ghost" size="icon" onClick={clearMaxwellRecordIds}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : financialData?.records && financialData.records.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">
                    <button className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort('transaction_date')}>
                      Date
                      <ArrowUpDown className={`h-3 w-3 ${sortField === 'transaction_date' ? 'text-foreground' : 'text-muted-foreground/50'}`} />
                    </button>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center gap-2">
                      <button className="flex items-center gap-1 shrink-0 hover:text-foreground" onClick={() => toggleSort('description')}>
                        Description
                        <ArrowUpDown className={`h-3 w-3 ${sortField === 'description' ? 'text-foreground' : 'text-muted-foreground/50'}`} />
                      </button>
                      <Input
                        placeholder="Search..."
                        value={descSearch}
                        onChange={(e) => setDescSearch(e.target.value)}
                        className="h-8 text-sm flex-1"
                      />
                    </div>
                  </TableHead>
                  <TableHead className="w-[100px] text-right">
                    <button className="flex items-center gap-1 ml-auto hover:text-foreground whitespace-nowrap" onClick={() => toggleSort('amount')}>
                      Amount (₱)
                      <ArrowUpDown className={`h-3 w-3 ${sortField === 'amount' ? 'text-foreground' : 'text-muted-foreground/50'}`} />
                    </button>
                  </TableHead>
                  <TableHead className="w-[100px] text-right whitespace-nowrap">
                    Balance (₱)
                  </TableHead>
                  <TableHead className="w-[120px]">
                    <Select value={methodFilter} onValueChange={setMethodFilter}>
                      <SelectTrigger className="h-6 text-xs border-0 shadow-none px-1">
                        <SelectValue>{methodFilter === 'All' ? 'Method' : methodFilter}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All">All Methods</SelectItem>
                        {PAYMENT_METHODS.map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableHead>
                  <TableHead className="w-[120px]">
                    <Select value={creatorFilter} onValueChange={setCreatorFilter}>
                      <SelectTrigger className="h-6 text-xs border-0 shadow-none px-1">
                        <SelectValue>{creatorFilter === 'All' ? 'Created By' : creatorFilter}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All">All People</SelectItem>
                        {creatorNames.filter(n => n !== 'All').map((name) => (
                          <SelectItem key={name} value={name}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  let firstHighlightAssigned = false;
                  return filteredAndSorted.map((record) => {
                    const isHighlighted = maxwellRecordIdSet.has(record.id);
                    const isFirstHighlight = isHighlighted && !firstHighlightAssigned;
                    if (isFirstHighlight) firstHighlightAssigned = true;

                    return (
                      <TableRow
                        key={record.id}
                        ref={isFirstHighlight ? firstHighlightRef : undefined}
                        className={cn(
                          "cursor-pointer",
                          isHighlighted && "bg-orange-100 hover:bg-orange-200 dark:bg-orange-900/30 dark:hover:bg-orange-900/50"
                        )}
                        onClick={() => navigate(`/financial-records/${record.id}`)}
                      >
                        <TableCell className="text-xs">
                          {new Date(record.transaction_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </TableCell>
                        <TableCell className="truncate max-w-[200px]">{record.description}</TableCell>
                        <TableCell className={`text-right font-medium whitespace-nowrap ${record.amount < 0 ? 'text-green-600' : ''}`}>
                          {record.amount < 0 ? '+' : '-'}{Math.abs(record.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                          {record.balance_after != null ? record.balance_after.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                        </TableCell>
                        <TableCell className="text-xs">
                          {record.payment_method}
                        </TableCell>
                        <TableCell className="text-xs">
                          {record.created_by_name || 'Unknown'}
                        </TableCell>
                      </TableRow>
                    );
                  });
                })()}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No transactions found</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
