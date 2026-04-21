import { useState, useEffect, useMemo } from 'react';
import { format, parseISO, startOfDay, startOfMonth, startOfYear, endOfDay, endOfMonth, endOfYear, eachDayOfInterval, isWithinInterval, subDays, subMonths, subYears, differenceInCalendarDays, min as minDate } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { Loader2, TrendingUp, TrendingDown, Wallet, CalendarIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, PieChart, Pie, Cell, ComposedChart } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { type RevenueRecord, type ExpenseRecord, CURRENCY_SYMBOLS, ADMIN_DEPARTMENTS, EXPENSE_CATEGORIES } from '@/types/record';
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
  const [hkdExpenses, setHkdExpenses] = useState<ExpenseRecord[]>([]);
  const [rmbExpenses, setRmbExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [periodCount, setPeriodCount] = useState(6);
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number>(0.92); // default fallback CNY→HKD
  const [pieMode, setPieMode] = useState<'expense' | 'payment'>('expense');
  const [breakdownMode, setBreakdownMode] = useState<'department' | 'category'>('department');
  const [breakdownDeptFilter, setBreakdownDeptFilter] = useState<string>('all');
  const [breakdownCategoryFilter, setBreakdownCategoryFilter] = useState<string>('all');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [revData, expData, rate] = await Promise.all([
          fetchRecords(),
          fetchExpenses(),
          fetch('https://open.er-api.com/v6/latest/CNY')
            .then(r => r.json())
            .then(d => d?.rates?.HKD ?? 0.92)
            .catch(() => 0.92),
        ]);
        setRevenues(revData);
        setHkdExpenses(expData.filter(e => (e.currency || 'HKD') === 'HKD'));
        setRmbExpenses(expData.filter(e => e.currency === 'RMB'));
        setExchangeRate(rate);
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
      const allYears = [...revenues, ...hkdExpenses, ...rmbExpenses].map(r => {
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
      const filterByDate = <T extends { date: string }>(arr: T[]) =>
        arr.filter(r => { try { return isWithinInterval(parseISO(r.date), { start, end }); } catch { return false; } });

      const revInRange = filterByDate(revenues);
      const hkdInRange = filterByDate(hkdExpenses);
      const rmbInRange = filterByDate(rmbExpenses);

      const totalRevenue = revInRange.reduce((s, r) => s + Number(r.amount), 0);
      const totalHkdExp = hkdInRange.reduce((s, e) => s + Number(e.amount), 0);
      const totalRmbExp = rmbInRange.reduce((s, e) => s + Number(e.amount), 0);
      const rmbAsHkd = Math.round(totalRmbExp * exchangeRate);
      const totalExpense = totalHkdExp + rmbAsHkd;

      return {
        label,
        收入: totalRevenue,
        支出: totalExpense,
        '支出(HKD)': totalHkdExp,
        '支出(RMB→HKD)': rmbAsHkd,
        淨額: totalRevenue - totalExpense,
      };
    });
  }, [revenues, hkdExpenses, rmbExpenses, exchangeRate, timeRange, periodCount, useCustomRange, customDateRange]);

  // Summary stats
  const summary = useMemo(() => {
    const totalRevenue = chartData.reduce((s, d) => s + d.收入, 0);
    const totalExpense = chartData.reduce((s, d) => s + d.支出, 0);
    const totalHkdExp = chartData.reduce((s, d) => s + d['支出(HKD)'], 0);
    const totalRmbExpConverted = chartData.reduce((s, d) => s + d['支出(RMB→HKD)'], 0);
    return {
      totalRevenue,
      totalExpense,
      totalHkdExp,
      totalRmbExpConverted,
      net: totalRevenue - totalExpense,
    };
  }, [chartData]);

  // Helper to get date range for pie charts
  const getDateRange = () => {
    const now = new Date();
    if (timeRange === 'day') {
      if (useCustomRange && customDateRange?.from && customDateRange?.to) {
        return { start: startOfDay(customDateRange.from), end: endOfDay(customDateRange.to) };
      }
      return { start: startOfDay(subDays(now, periodCount - 1)), end: endOfDay(now) };
    } else if (timeRange === 'month') {
      return { start: startOfMonth(subMonths(now, periodCount - 1)), end: endOfMonth(now) };
    } else {
      if (periodCount === 999) {
        return { start: new Date(1970, 0, 1), end: endOfYear(now) };
      }
      return { start: startOfYear(subYears(now, periodCount - 1)), end: endOfYear(now) };
    }
  };

  // Category breakdown for expenses (HKD + RMB converted)
  const expenseByCat = useMemo(() => {
    const { start, end } = getDateRange();
    const allExpenses = [
      ...hkdExpenses.map(e => ({ ...e, hkdAmount: Number(e.amount) })),
      ...rmbExpenses.map(e => ({ ...e, hkdAmount: Math.round(Number(e.amount) * exchangeRate) })),
    ];
    const filtered = allExpenses.filter(e => {
      try {
        const d = parseISO(e.date);
        return isWithinInterval(d, { start, end });
      } catch { return false; }
    });

    const catMap: Record<string, number> = {};
    filtered.forEach(e => {
      catMap[e.category] = (catMap[e.category] || 0) + e.hkdAmount;
    });

    return Object.entries(catMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [hkdExpenses, rmbExpenses, exchangeRate, timeRange, periodCount, useCustomRange, customDateRange]);

  // Payment method breakdown for revenue
  const revenueByPayment = useMemo(() => {
    const { start, end } = getDateRange();
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
  }, [revenues, timeRange, periodCount, useCustomRange, customDateRange]);

  // Breakdown by Department or Category (expenses, HKD-equivalent)
  const expenseBreakdown = useMemo(() => {
    const { start, end } = getDateRange();
    const all = [
      ...hkdExpenses.map(e => ({ ...e, hkdAmount: Number(e.amount) })),
      ...rmbExpenses.map(e => ({ ...e, hkdAmount: Math.round(Number(e.amount) * exchangeRate) })),
    ];
    const filtered = all.filter(e => {
      try { return isWithinInterval(parseISO(e.date), { start, end }); } catch { return false; }
    }).filter(e => {
      if (breakdownDeptFilter !== 'all' && (e.department || '其他') !== breakdownDeptFilter) return false;
      if (breakdownCategoryFilter !== 'all' && (e.category || '其他') !== breakdownCategoryFilter) return false;
      return true;
    });
    const map: Record<string, number> = {};
    filtered.forEach(e => {
      const key = breakdownMode === 'department' ? (e.department || '其他') : (e.category || '其他');
      map[key] = (map[key] || 0) + e.hkdAmount;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [hkdExpenses, rmbExpenses, exchangeRate, timeRange, periodCount, useCustomRange, customDateRange, breakdownMode, breakdownDeptFilter, breakdownCategoryFilter]);

  const breakdownTotal = useMemo(
    () => expenseBreakdown.reduce((s, x) => s + x.value, 0),
    [expenseBreakdown]
  );

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
    month: '月',
    year: '年',
  };

  const periodOptions: Record<TimeRange, { value: string; label: string }[]> = {
    day: [
      { value: '1', label: '最近1天' },
      { value: '7', label: '最近7天' },
      { value: '14', label: '最近14天' },
      { value: 'custom', label: '自訂日期' },
    ],
    month: [
      { value: '1', label: '最近1個月' },
      { value: '2', label: '最近2個月' },
      { value: '3', label: '最近3個月' },
      { value: '6', label: '最近6個月' },
    ],
    year: [
      { value: '1', label: '最近1年' },
      { value: '999', label: '全選' },
    ],
  };

  const handlePeriodChange = (v: string) => {
    if (v === 'custom') {
      setUseCustomRange(true);
    } else {
      setUseCustomRange(false);
      setPeriodCount(Number(v));
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="flex rounded-lg border bg-card overflow-hidden">
          {(['day', 'month', 'year'] as TimeRange[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTimeRange(t);
                setUseCustomRange(false);
                setPeriodCount(Number(periodOptions[t][0].value));
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
        <Select
          value={useCustomRange ? 'custom' : String(periodCount)}
          onValueChange={handlePeriodChange}
        >
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {periodOptions[timeRange].map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date range picker for day mode */}
        {timeRange === 'day' && useCustomRange && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn(
                "h-8 text-xs gap-1.5",
                !customDateRange?.from && "text-muted-foreground"
              )}>
                <CalendarIcon className="h-3.5 w-3.5" />
                {customDateRange?.from ? (
                  customDateRange.to ? (
                    `${format(customDateRange.from, 'MM/dd')} - ${format(customDateRange.to, 'MM/dd')}`
                  ) : format(customDateRange.from, 'MM/dd')
                ) : '選擇日期範圍'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={customDateRange}
                onSelect={setCustomDateRange}
                numberOfMonths={2}
                disabled={(date) => date > new Date()}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Exchange Rate Badge */}
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <span>💱 匯率: ¥1 = ${exchangeRate.toFixed(4)} HKD</span>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">總支出 (HKD)</span>
            </div>
            <p className="text-sm font-bold tabular-nums text-foreground">{formatCurrency(summary.totalHkdExp)}</p>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border-destructive/30">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingDown className="h-3.5 w-3.5 text-destructive" />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">總支出 (RMB→HKD)</span>
            </div>
            <p className="text-sm font-bold tabular-nums text-destructive">{formatCurrency(summary.totalRmbExpConverted)}</p>
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

      {/* Combined: Revenue vs Expense (bars) + Net (line) */}
      <Card>
        <CardHeader className="pb-2 px-4">
          <CardTitle className="text-sm">收支與淨額走勢</CardTitle>
          <CardDescription className="text-[11px]">按{timeRangeLabels[timeRange]}顯示收入、支出對比及淨額趨勢</CardDescription>
        </CardHeader>
        <CardContent className="px-1 sm:px-2 pb-3">
          <div className="h-[280px] sm:h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 88%)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10 }}
                  stroke="hsl(220, 10%, 50%)"
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  stroke="hsl(220, 10%, 50%)"
                  width={45}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                <Bar dataKey="收入" fill={CHART_COLORS.revenue} radius={[3, 3, 0, 0]} maxBarSize={28} />
                <Bar dataKey="支出" fill={CHART_COLORS.expense} radius={[3, 3, 0, 0]} maxBarSize={28} />
                <Line type="monotone" dataKey="淨額" stroke={CHART_COLORS.net} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Combined Pie: Expense / Payment toggle */}
      <Card>
        <CardHeader className="pb-2 px-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-sm">{pieMode === 'expense' ? '支出分佈' : '收款方式分佈'}</CardTitle>
              <CardDescription className="text-[11px]">
                {pieMode === 'expense' ? '按支出類別分佈' : '按收款方式分佈'}
              </CardDescription>
            </div>
            <div className="flex rounded-lg border bg-card overflow-hidden">
              {([['expense', '支出'], ['payment', '收款']] as const).map(([k, lbl]) => (
                <button
                  key={k}
                  onClick={() => setPieMode(k)}
                  className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    pieMode === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-2 pb-3">
          {(() => {
            const data = pieMode === 'expense' ? expenseByCat : revenueByPayment;
            if (data.length === 0) {
              return <p className="text-center text-xs text-muted-foreground py-8">暫無資料</p>;
            }
            const total = data.reduce((s, c) => s + c.value, 0);
            return (
              <>
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2} dataKey="value">
                        {data.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-2 gap-y-1.5 px-2 mt-2">
                  {data.slice(0, 8).map((c, i) => (
                    <div key={c.name} className="flex items-center gap-1.5 text-[11px] min-w-0">
                      <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-muted-foreground truncate flex-1">{c.name}</span>
                      <span className="font-semibold text-foreground tabular-nums shrink-0">{total > 0 ? ((c.value / total) * 100).toFixed(1) : 0}%</span>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </CardContent>
      </Card>

      {/* Expense Breakdown by Department / Category */}
      <Card>
        <CardHeader className="pb-2 px-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-sm">支出明細</CardTitle>
              <CardDescription className="text-[11px]">
                按{breakdownMode === 'department' ? '部門' : '支出類別'}顯示金額（已折算 HKD）
              </CardDescription>
            </div>
            <div className="flex rounded-lg border bg-card overflow-hidden">
              {([['department', '部門'], ['category', '類別']] as const).map(([k, lbl]) => (
                <button
                  key={k}
                  onClick={() => setBreakdownMode(k)}
                  className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    breakdownMode === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Select value={breakdownDeptFilter} onValueChange={setBreakdownDeptFilter}>
              <SelectTrigger className="h-8 w-auto min-w-[120px] text-xs">
                <SelectValue placeholder="部門" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有部門</SelectItem>
                {ADMIN_DEPARTMENTS.map(d => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={breakdownCategoryFilter} onValueChange={setBreakdownCategoryFilter}>
              <SelectTrigger className="h-8 w-auto min-w-[120px] text-xs">
                <SelectValue placeholder="類別" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有類別</SelectItem>
                {EXPENSE_CATEGORIES.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(breakdownDeptFilter !== 'all' || breakdownCategoryFilter !== 'all') && (
              <button
                onClick={() => { setBreakdownDeptFilter('all'); setBreakdownCategoryFilter('all'); }}
                className="text-[11px] text-muted-foreground hover:text-foreground underline"
              >
                重設
              </button>
            )}
            <span className="ml-auto text-xs font-semibold text-foreground tabular-nums">
              總計：{formatCurrency(breakdownTotal)}
            </span>
          </div>
        </CardHeader>
        <CardContent className="px-2 pb-3">
          {expenseBreakdown.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-8">暫無資料</p>
          ) : (
            <div className="w-full" style={{ height: Math.max(200, expenseBreakdown.length * 32 + 40) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={expenseBreakdown}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 88%)" />
                  <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(220, 10%, 50%)" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(220, 10%, 50%)" width={90} />
                  <Tooltip content={<PieTooltip />} />
                  <Bar dataKey="value" radius={[0, 3, 3, 0]} label={{ position: 'right', fontSize: 10, fill: 'hsl(220, 10%, 30%)', formatter: (v: number) => formatCurrency(v) }}>
                    {expenseBreakdown.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
