import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { Pencil, Loader2, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { type RevenueRecord, DEPARTMENTS, PAYMENT_METHODS } from '@/types/record';
import { fetchRecords } from '@/lib/googleSheets';
import { useStaff } from '@/contexts/StaffContext';
import { useToast } from '@/hooks/use-toast';

interface RecordsTableProps {
  onEdit: (record: RevenueRecord) => void;
  refreshKey: number;
}

const paymentMethodColors: Record<string, string> = {
  '現金': 'bg-success/15 text-success border-success/20',
  '支票': 'bg-primary/10 text-primary border-primary/20',
  '轉數快': 'bg-accent/15 text-accent-foreground border-accent/20',
  '微信支付': 'bg-success/15 text-success border-success/20',
  '支付寶': 'bg-primary/10 text-primary border-primary/20',
  'PayMe': 'bg-destructive/10 text-destructive border-destructive/20',
};

const RecordsTable = ({ onEdit, refreshKey }: RecordsTableProps) => {
  const { toast } = useToast();
  const [records, setRecords] = useState<RevenueRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState<string>('all');
  const [filterPayment, setFilterPayment] = useState<string>('all');

  const loadRecords = async () => {
    setLoading(true);
    try {
      const data = await fetchRecords();
      setRecords(data);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : '無法讀取記錄', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, [refreshKey]);

  const filtered = records.filter((r) => {
    if (filterDept !== 'all' && r.department !== filterDept) return false;
    if (filterPayment !== 'all' && r.paymentMethod !== filterPayment) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        r.date.includes(term) ||
        r.department.includes(term) ||
        r.amount.toString().includes(term) ||
        r.paymentMethod.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const totalAmount = filtered.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜尋記錄..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        <Select value={filterDept} onValueChange={setFilterDept}>
          <SelectTrigger className="w-full sm:w-36 h-10">
            <Filter className="mr-2 h-3.5 w-3.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有部門</SelectItem>
            {DEPARTMENTS.map((d) => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterPayment} onValueChange={setFilterPayment}>
          <SelectTrigger className="w-full sm:w-36 h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有方式</SelectItem>
            {PAYMENT_METHODS.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between px-1">
        <span className="text-sm text-muted-foreground">
          共 {filtered.length} 筆記錄
        </span>
        <span className="text-sm font-semibold text-foreground">
          總計: HKD ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">載入中...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">暫無記錄</p>
          <p className="text-sm mt-1">新增記錄後將會在此顯示</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">日期</TableHead>
                <TableHead className="font-semibold">部門</TableHead>
                <TableHead className="font-semibold">同事</TableHead>
                <TableHead className="font-semibold text-right">金額</TableHead>
                <TableHead className="font-semibold">收款方式</TableHead>
                <TableHead className="font-semibold w-16">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((record) => (
                <TableRow key={record.id} className="group hover:bg-muted/30 transition-colors">
                  <TableCell className="font-medium">
                    {(() => {
                      try {
                        return format(parseISO(record.date), 'yyyy/MM/dd');
                      } catch {
                        return record.date;
                      }
                    })()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-normal">
                      {record.department}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{record.staff}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    ${record.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={paymentMethodColors[record.paymentMethod] || ''}
                    >
                      {record.paymentMethod}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(record)}
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
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

export default RecordsTable;
