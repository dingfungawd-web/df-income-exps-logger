import { useState } from 'react';
import { format } from 'date-fns';
import { useStaff } from '@/contexts/StaffContext';
import { CalendarIcon, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { DEPARTMENTS, PAYMENT_METHODS, type Department, type PaymentMethod, type RevenueRecord } from '@/types/record';
import { submitRecord, updateRecord } from '@/lib/googleSheets';
import { useToast } from '@/hooks/use-toast';

interface DataEntryFormProps {
  editingRecord?: RevenueRecord | null;
  onComplete: () => void;
  onCancelEdit?: () => void;
}

const DataEntryForm = ({ editingRecord, onComplete, onCancelEdit }: DataEntryFormProps) => {
  const { staffName } = useStaff();
  const { toast } = useToast();
  const [date, setDate] = useState<Date | undefined>(
    editingRecord ? new Date(editingRecord.date) : new Date()
  );
  const [department, setDepartment] = useState<Department | ''>(editingRecord?.department || '');
  const [amount, setAmount] = useState(editingRecord?.amount?.toString() || '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>(editingRecord?.paymentMethod || '');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !department || !amount || !paymentMethod) {
      toast({ title: '請填寫所有欄位', variant: 'destructive' });
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
        amount: parsedAmount,
        paymentMethod: paymentMethod as PaymentMethod,
        staff: staffName,
      };

      if (editingRecord) {
        await updateRecord({ ...record, id: editingRecord.id });
        toast({ title: '記錄已更新' });
      } else {
        await submitRecord(record);
        toast({ title: '記錄已提交' });
      }

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        if (!editingRecord) {
          setAmount('');
          setPaymentMethod('');
          setStaff('');
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
      {/* Date */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">日期</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-full justify-start text-left font-normal h-11',
                !date && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
              {date ? format(date, 'yyyy年MM月dd日') : '選擇日期'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
          </PopoverContent>
        </Popover>
      </div>

      {/* Department */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">部門</Label>
        <Select value={department} onValueChange={(v) => setDepartment(v as Department)}>
          <SelectTrigger className="h-11">
            <SelectValue placeholder="選擇部門" />
          </SelectTrigger>
          <SelectContent>
            {DEPARTMENTS.map((d) => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Staff */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">同事</Label>
        <Input
          type="text"
          value={staff}
          onChange={(e) => setStaff(e.target.value)}
          placeholder="輸入同事姓名"
          className="h-11 text-base"
        />
      </div>

      {/* Amount */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">金額 (HKD)</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="pl-8 h-11 text-base"
          />
        </div>
      </div>

      {/* Payment Method */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">收款方式</Label>
        <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
          <SelectTrigger className="h-11">
            <SelectValue placeholder="選擇收款方式" />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_METHODS.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Buttons */}
      <div className="flex gap-3 pt-2">
        <Button
          type="submit"
          disabled={loading || success}
          className={cn(
            'flex-1 h-11 text-base font-semibold transition-all',
            success && 'bg-success hover:bg-success'
          )}
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {success && <CheckCircle2 className="mr-2 h-4 w-4" />}
          {success ? '完成' : editingRecord ? '更新記錄' : '提交記錄'}
        </Button>
        {editingRecord && onCancelEdit && (
          <Button type="button" variant="outline" onClick={onCancelEdit} className="h-11">
            取消
          </Button>
        )}
      </div>
    </form>
  );
};

export default DataEntryForm;
