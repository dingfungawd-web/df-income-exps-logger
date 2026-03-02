import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { Pencil, Loader2, Search, Filter, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { type ExpenseRecord, DEPARTMENTS, EXPENSE_CATEGORIES, CURRENCY_SYMBOLS } from '@/types/record';
import { fetchExpenses } from '@/lib/googleSheets';
import { useStaff } from '@/contexts/StaffContext';
import { useToast } from '@/hooks/use-toast';

interface ExpenseRecordsTableProps {
  onEdit: (record: ExpenseRecord) => void;
  refreshKey: number;
}

const ExpenseRecordsTable = ({ onEdit, refreshKey }: ExpenseRecordsTableProps) => {
  const { staffName, isAdmin } = useStaff();
  const { toast } = useToast();
  const [records, setRecords] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const loadRecords = async () => {
    setLoading(true);
    try {
      const data = await fetchExpenses();
      setRecords(data);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : '無法讀取支出記錄', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRecords(); }, [refreshKey]);

  const filtered = records.filter((r) => {
    if (!isAdmin && r.staff !== staffName) return false;

    // 14-day limit for non-admin
    if (!isAdmin) {
      try {
        const recordDate = parseISO(r.date);
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
        fourteenDaysAgo.setHours(0, 0, 0, 0);
        if (recordDate < fourteenDaysAgo) return false;
      } catch { return false; }
    }

    if (filterDept !== 'all' && r.department !== filterDept) return false;
    if (filterCategory !== 'all' && r.category !== filterCategory) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return r.date.includes(term) || r.department.includes(term) || r.amount.toString().includes(term) || r.category.includes(term) || r.staff.includes(term);
    }
    return true;
  });

  const totalAmount = filtered.reduce((sum, r) => sum + r.amount, 0);
  const unclaimedAmount = filtered.filter(r => !r.claimed).reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="搜尋記錄..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 h-10" />
        </div>
        <Select value={filterDept} onValueChange={setFilterDept}>
          <SelectTrigger className="w-full sm:w-36 h-10"><Filter className="mr-2 h-3.5 w-3.5" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有部門</SelectItem>
            {DEPARTMENTS.map((d) => (<SelectItem key={d} value={d}>{d}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-full sm:w-36 h-10"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有類別</SelectItem>
            {EXPENSE_CATEGORIES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between px-1 flex-wrap gap-2">
        <span className="text-sm text-muted-foreground">共 {filtered.length} 筆</span>
        <div className="flex gap-4 text-sm flex-wrap">
          <span className="font-semibold text-foreground">HKD總計: ${filtered.filter(r => r.currency !== 'RMB').reduce((s, r) => s + r.amount, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          <span className="font-semibold text-foreground">RMB總計: ¥{filtered.filter(r => r.currency === 'RMB').reduce((s, r) => s + r.amount, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          <span className="text-warning font-medium">未Claim(HKD): ${filtered.filter(r => !r.claimed && r.currency !== 'RMB').reduce((s, r) => s + r.amount, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          <span className="text-warning font-medium">未Claim(RMB): ¥{filtered.filter(r => !r.claimed && r.currency === 'RMB').reduce((s, r) => s + r.amount, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">載入中...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">暫無支出記錄</p>
          <p className="text-sm mt-1">新增支出後將會在此顯示</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">日期</TableHead>
                {isAdmin && <TableHead className="font-semibold">同事</TableHead>}
                <TableHead className="font-semibold">部門</TableHead>
                <TableHead className="font-semibold">類別</TableHead>
                <TableHead className="font-semibold text-right">金額</TableHead>
                <TableHead className="font-semibold">幣種</TableHead>
                <TableHead className="font-semibold">狀態</TableHead>
                <TableHead className="font-semibold w-12">修改記錄</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((record) => (
                <TableRow key={record.id} className="group hover:bg-muted/30 transition-colors">
                  <TableCell className="font-medium">
                    {(() => { try { return format(parseISO(record.date), 'yyyy/MM/dd'); } catch { return record.date; } })()}
                  </TableCell>
                  {isAdmin && <TableCell>{record.staff}</TableCell>}
                  <TableCell><Badge variant="secondary" className="font-normal">{record.department}</Badge></TableCell>
                  <TableCell><Badge variant="outline">{record.category}</Badge></TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-sm">
                    ${record.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    {record.claimed ? (
                      <Badge className="bg-success/15 text-success border-success/20" variant="outline">
                        <CheckCircle2 className="h-3 w-3 mr-1" />已Claim
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-warning/15 text-warning-foreground border-warning/20">待Claim</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {!record.claimed && (
                      <Button variant="ghost" size="icon" onClick={() => onEdit(record)} className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default ExpenseRecordsTable;
