import { useState, useRef } from 'react';
import { Upload, FileText, Loader2, CheckCircle2, Trash2, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { extractTextFromPDF, parseHSBCStatement, type ParsedTransaction } from '@/lib/pdfParser';
import { submitExpense } from '@/lib/googleSheets';
import { EXPENSE_CATEGORIES, type ExpenseCategory } from '@/types/record';
import { cn } from '@/lib/utils';

const CreditCardUpload = () => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [fileName, setFileName] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast({ title: '請上傳 PDF 檔案', variant: 'destructive' });
      return;
    }

    setFileName(file.name);
    setParsing(true);
    setTransactions([]);
    setSelected(new Set());
    setSubmitted(false);

    try {
      const pages = await extractTextFromPDF(file);
      const parsed = parseHSBCStatement(pages);
      
      if (parsed.length === 0) {
        toast({ title: '未能從 PDF 中提取到交易記錄，請檢查檔案格式', variant: 'destructive' });
      } else {
        setTransactions(parsed);
        // Select all by default
        setSelected(new Set(parsed.map((_, i) => i)));
        toast({ title: `成功提取 ${parsed.length} 筆交易記錄` });
      }
    } catch (err) {
      toast({ title: '解析 PDF 失敗: ' + (err instanceof Error ? err.message : '未知錯誤'), variant: 'destructive' });
    } finally {
      setParsing(false);
    }
  };

  const toggleSelect = (idx: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === transactions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(transactions.map((_, i) => i)));
    }
  };

  const updateTransaction = (idx: number, field: keyof ParsedTransaction, value: any) => {
    setTransactions(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t));
  };

  const removeTransaction = (idx: number) => {
    setTransactions(prev => prev.filter((_, i) => i !== idx));
    setSelected(prev => {
      const next = new Set<number>();
      for (const s of prev) {
        if (s < idx) next.add(s);
        else if (s > idx) next.add(s - 1);
      }
      return next;
    });
    if (editingIdx === idx) setEditingIdx(null);
  };

  const handleApproveAndSubmit = async () => {
    const selectedTxns = transactions.filter((_, i) => selected.has(i));
    if (selectedTxns.length === 0) {
      toast({ title: '請先選擇要提交的交易', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      let successCount = 0;
      for (const txn of selectedTxns) {
        await submitExpense({
          date: txn.date,
          department: '老闆',
          staff: 'admin',
          category: txn.category,
          amount: txn.amount,
          remarks: txn.remarks || txn.description,
          currency: 'HKD',
        });
        successCount++;
      }
      
      setSubmitted(true);
      toast({ title: `成功提交 ${successCount} 筆支出記錄到 Google Sheet` });
      
      setTimeout(() => {
        setTransactions([]);
        setSelected(new Set());
        setSubmitted(false);
        setFileName('');
        if (fileInputRef.current) fileInputRef.current.value = '';
      }, 2000);
    } catch (err) {
      toast({ title: '提交失敗: ' + (err instanceof Error ? err.message : '未知錯誤'), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedTotal = transactions
    .filter((_, i) => selected.has(i))
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <Card>
      <CardHeader className="pb-3 px-4">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          信用卡月結單匯入
        </CardTitle>
        <CardDescription className="text-xs">
          上傳 HSBC 信用卡 PDF 月結單，自動分類後確認提交
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 space-y-4">
        {/* Upload area */}
        <div
          className={cn(
            'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
            'hover:border-primary/50 hover:bg-primary/5',
            parsing && 'pointer-events-none opacity-60'
          )}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleFileUpload}
          />
          {parsing ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">正在解析 PDF...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">點擊上傳 PDF 月結單</p>
              <p className="text-xs text-muted-foreground">支援 HSBC 信用卡月結單格式</p>
              {fileName && <p className="text-xs text-primary mt-1">已上傳: {fileName}</p>}
            </div>
          )}
        </div>

        {/* Review table */}
        {transactions.length > 0 && !submitted && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                共 {transactions.length} 筆交易，已選 {selected.size} 筆
                <span className="text-primary ml-2">
                  合計: ${selectedTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </p>
              <Button variant="outline" size="sm" onClick={toggleAll} className="text-xs h-7">
                {selected.size === transactions.length ? '取消全選' : '全選'}
              </Button>
            </div>

            <div className="max-h-[400px] overflow-y-auto border rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="p-2 text-left w-8">
                      <Checkbox
                        checked={selected.size === transactions.length}
                        onCheckedChange={toggleAll}
                      />
                    </th>
                    <th className="p-2 text-left">日期</th>
                    <th className="p-2 text-left">描述</th>
                    <th className="p-2 text-left">類別</th>
                    <th className="p-2 text-right">金額</th>
                    <th className="p-2 w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((txn, idx) => (
                    <tr key={idx} className={cn('border-t hover:bg-muted/30', !selected.has(idx) && 'opacity-50')}>
                      <td className="p-2">
                        <Checkbox
                          checked={selected.has(idx)}
                          onCheckedChange={() => toggleSelect(idx)}
                        />
                      </td>
                      <td className="p-2 whitespace-nowrap">{txn.date.slice(5)}</td>
                      <td className="p-2">
                        <div className="max-w-[150px] truncate" title={txn.description}>
                          {txn.description}
                        </div>
                        {editingIdx === idx && (
                          <Input
                            value={txn.remarks}
                            onChange={(e) => updateTransaction(idx, 'remarks', e.target.value)}
                            placeholder="備注"
                            className="mt-1 h-7 text-xs"
                          />
                        )}
                      </td>
                      <td className="p-2">
                        {editingIdx === idx ? (
                          <Select
                            value={txn.category}
                            onValueChange={(v) => updateTransaction(idx, 'category', v as ExpenseCategory)}
                          >
                            <SelectTrigger className="h-7 text-xs w-[100px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {EXPENSE_CATEGORIES.map((c) => (
                                <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px]">
                            {txn.category}
                          </span>
                        )}
                      </td>
                      <td className="p-2 text-right whitespace-nowrap font-medium">
                        ${txn.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-2">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => setEditingIdx(editingIdx === idx ? null : idx)}
                          >
                            <Edit3 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive"
                            onClick={() => removeTransaction(idx)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Button
              onClick={handleApproveAndSubmit}
              disabled={submitting || selected.size === 0}
              className="w-full h-11 text-base font-semibold"
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitting ? '提交中...' : `確認提交 ${selected.size} 筆記錄`}
            </Button>
          </div>
        )}

        {/* Success state */}
        {submitted && (
          <div className="flex flex-col items-center gap-2 py-6">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            <p className="text-sm font-medium">所有記錄已成功提交！</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CreditCardUpload;
