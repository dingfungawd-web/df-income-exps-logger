import { useState, useEffect, useMemo } from 'react';
import { format, parseISO, startOfDay, startOfMonth, startOfYear, endOfDay, endOfMonth, endOfYear, eachDayOfInterval, isWithinInterval, subDays, subMonths, subYears, differenceInCalendarDays, min as minDate } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { Loader2, TrendingUp, TrendingDown, Wallet, CalendarIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { type RevenueRecord, type ExpenseRecord, CURRENCY_SYMBOLS } from '@/types/record';
import { fetchRecords, fetchExpenses } from '@/lib/googleSheets';
import { useToast } from '@/hooks/use-toast';
import type { DateRange } from 'react-day-picker';

type TimeRange = 'day' | 'month' | 'year';

const CHART_COLORS = {
  revenue: 'hsl(152, 60%, 40%)',
  expense: 'hsl(0, 72%, 51%)',
  net: 'hsl(220, 60%, 30%)',
};

const PIE_COLORS = [
  'hsl(220, 60%, 30%)',
  'hsl(38, 90%, 55%)',
  'hsl(152, 60%, 40%)',
  'hsl(0, 72%, 51%)',
  'hsl(280, 60%, 50%)',
  'hsl(180, 60%, 40%)',
  'hsl(320, 60%, 50%)',
  'hsl(60, 70%, 45%)',
];

const AdminDashboard = () => {
  const { toast } = useToast();
  const [revenues, setRevenues] = useState<RevenueRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [periodCount, setPeriodCount] = useState(6);
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [useCustomRange, setUseCustomRange] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [revData, expData] = await Promise.all([fetchRecords(), fetchExpenses()]);
        setRevenues(revData);
        setExpenses(expData.filter(e => (e.currency || 'HKD') === 'HKD'));
      } catch {
        toast({ title: '載入圖表資料失敗', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Generate time buckets
  const chartData = useMemo(() => {
    const now = new Date();
    let buckets: { start: Date; end: Date; label: string }[] = [];

    if (timeRange === 'day') {
      if (useCustomRange && customDateRange?.from && customDateRange?.to) {
        const days = eachDayOfInterval({ start: customDateRange.from, end: customDateRange.to });
        days.forEach(d => {
          buckets.push({ start: startOfDay(d), end: endOfDay(d), label: format(d, 'MM/dd') });
        });
      } else {
        for (let i = periodCount - 1; i >= 0; i--) {
          const d = subDays(now, i);
          buckets.push({ start: startOfDay(d), end: endOfDay(d), label: format(d, 'MM/dd') });
        }
      }
    } else if (timeRange === 'month') {
      for (let i = periodCount - 1; i >= 0; i--) {
        const d = subMonths(now, i);
        buckets.push({ start: startOfMonth(d), end: endOfMonth(d), label: format(d, 'yyyy/MM') });
      }
    } else {
      // year - periodCount 999 means all
      const allYears = [...revenues, ...expenses].map(r => {
        try { return parseISO(r.date).getFullYear(); } catch { return null; }
      }).filter((y): y is number => y !== null);
      const minYear = allYears.length > 0 ? Math.min(...allYears) : now.getFullYear();
      const yearCount = periodCount === 999 ? (now.getFullYear() - minYear + 1) : periodCount;
      for (let i = yearCount - 1; i >= 0; i--) {
        const d = subYears(now, i);
        buckets.push({ start: startOfYear(d), end: endOfYear(d), label: format(d, 'yyyy') });
      }
    }

    return buckets.map(({ start, end, label }) => {
      const revInRange = revenues.filter(r => {
        try {
          const d = parseISO(r.date);
          return isWithinInterval(d, { start, end });
        } catch { return false; }
      });
      const expInRange = expenses.filter(e => {
        try {
          const d = parseISO(e.date);
          return isWithinInterval(d, { start, end });
        } catch { return false; }
      });
      const totalRevenue = revInRange.reduce((s, r) => s + Number(r.amount), 0);
      const totalExpense = expInRange.reduce((s, e) => s + Number(e.amount), 0);
      return {
        label,
        收入: totalRevenue,
        支出: totalExpense,
        淨額: totalRevenue - totalExpense,
      };
    });
  }, [revenues, expenses, timeRange, periodCount]);

  // Summary stats
  const summary = useMemo(() => {
    const totalRevenue = chartData.reduce((s, d) => s + d.收入, 0);
    const totalExpense = chartData.reduce((s, d) => s + d.支出, 0);
    return {
      totalRevenue,
      totalExpense,
      net: totalRevenue - totalExpense,
    };
  }, [chartData]);

  // Category breakdown for expenses
  const expenseByCat = useMemo(() => {
    const now = new Date();
    let start: Date, end: Date;
    if (timeRange === 'day') {
      start = startOfDay(subDays(now, periodCount - 1));
      end = endOfDay(now);
    } else if (timeRange === 'week') {
      start = startOfWeek(subWeeks(now, periodCount - 1), { weekStartsOn: 1 });
      end = endOfWeek(now, { weekStartsOn: 1 });
    } else if (timeRange === 'month') {
      start = startOfMonth(subMonths(now, periodCount - 1));
      end = endOfMonth(now);
    } else {
      start = startOfYear(subYears(now, periodCount - 1));
      end = endOfYear(now);
    }

    const filtered = expenses.filter(e => {
      try {
        const d = parseISO(e.date);
        return isWithinInterval(d, { start, end });
      } catch { return false; }
    });

    const catMap: Record<string, number> = {};
    filtered.forEach(e => {
      catMap[e.category] = (catMap[e.category] || 0) + Number(e.amount);
    });

    return Object.entries(catMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [expenses, timeRange, periodCount]);

  // Payment method breakdown for revenue
  const revenueByPayment = useMemo(() => {
    const now = new Date();
    let start: Date, end: Date;
    if (timeRange === 'day') {
      start = startOfDay(subDays(now, periodCount - 1));
      end = endOfDay(now);
    } else if (timeRange === 'week') {
      start = startOfWeek(subWeeks(now, periodCount - 1), { weekStartsOn: 1 });
      end = endOfWeek(now, { weekStartsOn: 1 });
    } else if (timeRange === 'month') {
      start = startOfMonth(subMonths(now, periodCount - 1));
      end = endOfMonth(now);
    } else {
      start = startOfYear(subYears(now, periodCount - 1));
      end = endOfYear(now);
    }

    const filtered = revenues.filter(r => {
      try {
        const d = parseISO(r.date);
        return isWithinInterval(d, { start, end });
      } catch { return false; }
    });

    const payMap: Record<string, number> = {};
    filtered.forEach(r => {
      payMap[r.paymentMethod] = (payMap[r.paymentMethod] || 0) + Number(r.amount);
    });

    return Object.entries(payMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [revenues, timeRange, periodCount]);

  const formatCurrency = (v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border bg-card p-3 shadow-lg">
        <p className="text-sm font-semibold text-card-foreground mb-1.5">{label}</p>
        {payload.map((p: any, i: number) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
            <span className="text-muted-foreground">{p.name}:</span>
            <span className="font-semibold tabular-nums text-card-foreground">{formatCurrency(p.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  const PieTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const item = payload[0];
    const pct = item.payload?.percent != null ? (item.payload.percent * 100).toFixed(1) : '';
    return (
      <div className="rounded-lg border bg-card p-3 shadow-lg">
        <p className="text-sm font-semibold text-card-foreground">{item.name}</p>
        <p className="text-xs text-muted-foreground mt-1">{formatCurrency(item.value)}{pct ? ` (${pct}%)` : ''}</p>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">載入圖表資料中...</span>
      </div>
    );
  }

  const timeRangeLabels: Record<TimeRange, string> = {
    day: '日',
    week: '周',
    month: '月',
    year: '年',
  };

  const periodOptions: Record<TimeRange, { value: string; label: string }[]> = {
    day: [
      { value: '1', label: '最近1天' },
      { value: '7', label: '最近7天' },
      { value: '14', label: '最近14天' },
      { value: '30', label: '最近30天' },
    ],
    week: [
      { value: '4', label: '最近4周' },
      { value: '8', label: '最近8周' },
      { value: '12', label: '最近12周' },
    ],
    month: [
      { value: '3', label: '最近3個月' },
      { value: '6', label: '最近6個月' },
      { value: '12', label: '最近12個月' },
    ],
    year: [
      { value: '2', label: '最近2年' },
      { value: '3', label: '最近3年' },
      { value: '5', label: '最近5年' },
    ],
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex rounded-lg border bg-card overflow-hidden">
          {(['day', 'week', 'month', 'year'] as TimeRange[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTimeRange(t);
                setPeriodCount(Number(periodOptions[t][1]?.value || periodOptions[t][0].value));
              }}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                timeRange === t
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {timeRangeLabels[t]}
            </button>
          ))}
        </div>
        <Select value={String(periodCount)} onValueChange={(v) => setPeriodCount(Number(v))}>
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {periodOptions[timeRange].map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="overflow-hidden">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-success" />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">總收入</span>
            </div>
            <p className="text-sm font-bold tabular-nums text-foreground">{formatCurrency(summary.totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingDown className="h-3.5 w-3.5 text-destructive" />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">總支出</span>
            </div>
            <p className="text-sm font-bold tabular-nums text-foreground">{formatCurrency(summary.totalExpense)}</p>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Wallet className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">淨額</span>
            </div>
            <p className={`text-sm font-bold tabular-nums ${summary.net >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatCurrency(summary.net)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bar Chart - Revenue vs Expense */}
      <Card>
        <CardHeader className="pb-2 px-4">
          <CardTitle className="text-sm">收入 vs 支出</CardTitle>
          <CardDescription className="text-[11px]">按{timeRangeLabels[timeRange]}顯示收入與支出對比</CardDescription>
        </CardHeader>
        <CardContent className="px-2 pb-3">
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 88%)" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(220, 10%, 50%)" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(220, 10%, 50%)" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="收入" fill={CHART_COLORS.revenue} radius={[3, 3, 0, 0]} />
                <Bar dataKey="支出" fill={CHART_COLORS.expense} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Line Chart - Net */}
      <Card>
        <CardHeader className="pb-2 px-4">
          <CardTitle className="text-sm">淨額趨勢</CardTitle>
          <CardDescription className="text-[11px]">收入減去支出的淨額走勢</CardDescription>
        </CardHeader>
        <CardContent className="px-2 pb-3">
          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 88%)" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(220, 10%, 50%)" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(220, 10%, 50%)" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="淨額" stroke={CHART_COLORS.net} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Pie Charts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Expense by Category */}
        <Card>
          <CardHeader className="pb-2 px-4">
            <CardTitle className="text-sm">支出分佈</CardTitle>
            <CardDescription className="text-[11px]">按類別分佈</CardDescription>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            {expenseByCat.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-8">暫無資料</p>
            ) : (
              <>
                <div className="h-[180px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseByCat}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {expenseByCat.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 px-2 mt-1">
                  {(() => {
                    const total = expenseByCat.reduce((s, c) => s + c.value, 0);
                    return expenseByCat.slice(0, 6).map((c, i) => (
                      <div key={c.name} className="flex items-center gap-1 text-[10px]">
                        <div className="h-2 w-2 rounded-sm shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-muted-foreground">{c.name}</span>
                        <span className="font-medium text-foreground">{total > 0 ? ((c.value / total) * 100).toFixed(1) : 0}%</span>
                      </div>
                    ));
                  })()}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Revenue by Payment */}
        <Card>
          <CardHeader className="pb-2 px-4">
            <CardTitle className="text-sm">收款方式分佈</CardTitle>
            <CardDescription className="text-[11px]">按收款方式分佈</CardDescription>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            {revenueByPayment.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-8">暫無資料</p>
            ) : (
              <>
                <div className="h-[180px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={revenueByPayment}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {revenueByPayment.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 px-2 mt-1">
                  {(() => {
                    const total = revenueByPayment.reduce((s, c) => s + c.value, 0);
                    return revenueByPayment.map((c, i) => (
                      <div key={c.name} className="flex items-center gap-1 text-[10px]">
                        <div className="h-2 w-2 rounded-sm shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-muted-foreground">{c.name}</span>
                        <span className="font-medium text-foreground">{total > 0 ? ((c.value / total) * 100).toFixed(1) : 0}%</span>
                      </div>
                    ));
                  })()}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
