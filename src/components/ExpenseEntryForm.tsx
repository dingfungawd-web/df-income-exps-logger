import { useState } from 'react';
import { format } from 'date-fns';
import { useStaff } from '@/contexts/StaffContext';
import { CalendarIcon, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { DEPARTMENTS, ADMIN_DEPARTMENTS, EXPENSE_CATEGORIES, EXPENSE_CURRENCIES, CURRENCY_LABELS, CURRENCY_SYMBOLS, type Department, type ExpenseCategory, type ExpenseCurrency, type ExpenseRecord } from '@/types/record';
import { submitExpense, updateExpense } from '@/lib/googleSheets';
import { useToast } from '@/hooks/use-toast';

interface ExpenseEntryFormProps {
  editingRecord?: ExpenseRecord | null;
  onComplete: () => void;
  onCancelEdit?: () => void;
}

const ExpenseEntryForm = ({ editingRecord, onComplete, onCancelEdit }: ExpenseEntryFormProps) => {
  const { staffName, isAdmin } = useStaff();
  const departmentOptions = isAdmin ? ADMIN_DEPARTMENTS : DEPARTMENTS;
  const { toast } = useToast();
  const [date, setDate] = useState<Date | undefined>(
    editingRecord ? new Date(editingRecord.date) : new Date()
  );
  const [department, setDepartment] = useState<Department | ''>(editingRecord?.department || '');
  const [category, setCategory] = useState<ExpenseCategory | ''>(editingRecord?.category || '');
  const [amount, setAmount] = useState(editingRecord?.amount?.toString() || '');
  const [remarks, setRemarks] = useState(editingRecord?.remarks || '');
  const [currency, setCurrency] = useState<ExpenseCurrency>(editingRecord?.currency || 'HKD');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !department || !category || !amount) {
      toast({ title: '請填寫所有欄位', variant: 'destructive' });
      return;
    }

    if (category === '其他' && !remarks.trim()) {
      toast({ title: '請輸入備注', variant: 'destructive' });
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast({ title: '請輸入有效金額', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const record = {
        date: format(date, 'yyyy-MM-dd'),
        department: department as Department,
        staff: staffName,
        category: category as ExpenseCategory,
        amount: parsedAmount,
        remarks: category === '其他' ? remarks.trim() : '',
        currency,
      };

      if (editingRecord) {
        await updateExpense({ ...record, id: editingRecord.id, claimed: editingRecord.claimed, claimDate: editingRecord.claimDate, claimAmount: editingRecord.claimAmount, remarks: record.remarks });
        toast({ title: '支出記錄已更新' });
      } else {
        await submitExpense(record);
        toast({ title: '支出記錄已提交' });
      }

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        if (!editingRecord) {
          setAmount('');
          setCategory('');
          setRemarks('');
        }
        onComplete();
      }, 1200);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : '操作失敗', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">幣種</Label>
        <RadioGroup value={currency} onValueChange={(v) => setCurrency(v as ExpenseCurrency)} className="flex gap-4">
          {EXPENSE_CURRENCIES.map((c) => (
            <div key={c} className="flex items-center gap-2">
              <RadioGroupItem value={c} id={`currency-${c}`} />
              <Label htmlFor={`currency-${c}`} className="text-sm cursor-pointer font-normal">{CURRENCY_LABELS[c]}</Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">日期</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn('w-full justify-start text-left font-normal h-11', !date && 'text-muted-foreground')}>
              <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
              {date ? format(date, 'yyyy年MM月dd日') : '選擇日期'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">部門</Label>
        <Select value={department} onValueChange={(v) => setDepartment(v as Department)}>
          <SelectTrigger className="h-11"><SelectValue placeholder="選擇部門" /></SelectTrigger>
          <SelectContent>
            {departmentOptions.map((d) => (<SelectItem key={d} value={d}>{d}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">支出類別</Label>
        <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
          <SelectTrigger className="h-11"><SelectValue placeholder="選擇類別" /></SelectTrigger>
          <SelectContent>
            {EXPENSE_CATEGORIES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      {category === '其他' && (
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">備注</Label>
          <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="請輸入備注" className="h-11 text-base" />
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">金額 ({currency === 'RMB' ? 'RMB' : 'HKD'})</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">{CURRENCY_SYMBOLS[currency]}</span>
          <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="pl-8 h-11 text-base" />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={loading || success} className={cn('flex-1 h-11 text-base font-semibold transition-all', success && 'bg-success hover:bg-success')}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {success && <CheckCircle2 className="mr-2 h-4 w-4" />}
          {success ? '完成' : editingRecord ? '更新記錄' : '提交支出'}
        </Button>
        {editingRecord && onCancelEdit && (
          <Button type="button" variant="outline" onClick={onCancelEdit} className="h-11">取消</Button>
        )}
      </div>
    </form>
  );
};

export default ExpenseEntryForm;
