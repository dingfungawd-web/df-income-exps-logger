import { useState, useEffect, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { Loader2, CheckCircle2, Users, DollarSign, History, Trash2, Banknote, BarChart3, Pencil } from 'lucide-react';
import AdminDashboard from '@/components/AdminDashboard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { type ExpenseRecord, type ClaimRecord, type StaffUser, type RevenueRecord, type HandoverRecord, CURRENCY_SYMBOLS } from '@/types/record';
import { fetchExpenses, fetchClaimHistory, fetchAllUsers, claimExpenses, deleteUser, fetchRecords, confirmHandover, fetchHandoverHistory, clearAllRecords, deleteRecord, deleteExpense, deleteClaimRecord, deleteHandoverRecord, updateClaimRecord, updateHandoverRecord } from '@/lib/googleSheets';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

const AdminClaimPanel = () => {
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [revenues, setRevenues] = useState<RevenueRecord[]>([]);
  const [handoverHistory, setHandoverHistory] = useState<HandoverRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [claimLoading, setClaimLoading] = useState(false);
  const [handoverLoading, setHandoverLoading] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Handover selections
  const [handoverStaff, setHandoverStaff] = useState<string>('all');
  const [handoverSelectedIds, setHandoverSelectedIds] = useState<Set<string>>(new Set());
  // History multi-select
  const [claimHistorySelectedIds, setClaimHistorySelectedIds] = useState<Set<string>>(new Set());
  const [handoverHistorySelectedIds, setHandoverHistorySelectedIds] = useState<Set<string>>(new Set());
  // Batch delete confirmation
  const [batchDeleteTarget, setBatchDeleteTarget] = useState<'claim-pending' | 'handover-pending' | 'claim-history' | 'handover-history' | null>(null);
  // Edit dialogs
  const [editingClaim, setEditingClaim] = useState<ClaimRecord | null>(null);
  const [editingHandover, setEditingHandover] = useState<HandoverRecord | null>(null);
  const [editClaimForm, setEditClaimForm] = useState({ staff: '', claimDate: '', totalAmount: '' });
  const [editHandoverForm, setEditHandoverForm] = useState({ staff: '', handoverDate: '', totalAmount: '' });
  const [editSaving, setEditSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [expData, claimData, userData, revData, hoData] = await Promise.all([
        fetchExpenses(), fetchClaimHistory(), fetchAllUsers(), fetchRecords(), fetchHandoverHistory()
      ]);
      setExpenses(expData);
      setClaims(claimData);
      setUsers(userData);
      setRevenues(revData);
      setHandoverHistory(hoData);
    } catch (err) {
      toast({ title: '載入資料失敗', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // ─── Claim logic ───
  const staffNames = useMemo(() => {
    const names = new Set(expenses.map(e => e.staff));
    return Array.from(names).sort();
  }, [expenses]);

  const unclaimedExpenses = useMemo(() => {
    return expenses
      .filter(e => !e.claimed && e.staff !== 'admin' && e.department !== '老闆')
      .filter(e => selectedStaff === 'all' || e.staff === selectedStaff)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, selectedStaff]);

  const selectedTotal = useMemo(() => {
    return unclaimedExpenses
      .filter(e => selectedIds.has(e.id))
      .reduce((sum, e) => sum + e.amount, 0);
  }, [unclaimedExpenses, selectedIds]);

  const selectedCurrency = useMemo(() => {
    const selected = unclaimedExpenses.filter(e => selectedIds.has(e.id));
    if (selected.length === 0) return 'HKD';
    return selected[0]?.currency || 'HKD';
  }, [unclaimedExpenses, selectedIds]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllForStaff = (staff: string) => {
    const ids = unclaimedExpenses.filter(e => e.staff === staff).map(e => e.id);
    setSelectedIds(new Set(ids));
  };

  const handleClaim = async () => {
    if (selectedIds.size === 0) {
      toast({ title: '請選擇要 Claim 的支出', variant: 'destructive' });
      return;
    }
    const ids = Array.from(selectedIds);
    const staffToClaim = unclaimedExpenses.find(e => ids.includes(e.id))?.staff;
    if (!staffToClaim) return;
    const allSameStaff = ids.every(id => unclaimedExpenses.find(e => e.id === id)?.staff === staffToClaim);
    if (!allSameStaff) {
      toast({ title: '請只選擇同一位同事的支出進行 Claim', variant: 'destructive' });
      return;
    }
    const selectedRecords = unclaimedExpenses.filter(e => ids.includes(e.id));
    const currencies = new Set(selectedRecords.map(e => e.currency || 'HKD'));
    if (currencies.size > 1) {
      toast({ title: '請只選擇同一幣種的支出進行 Claim', variant: 'destructive' });
      return;
    }
    const claimCurrency = selectedRecords[0]?.currency || 'HKD';
    setClaimLoading(true);
    try {
      await claimExpenses(ids, staffToClaim, selectedTotal, claimCurrency);
      const symbol = CURRENCY_SYMBOLS[claimCurrency];
      toast({ title: `已成功 Claim ${symbol}${selectedTotal.toFixed(2)} 給 ${staffToClaim}` });
      setSelectedIds(new Set());
      await loadData();
    } catch (err) {
      toast({ title: 'Claim 失敗', variant: 'destructive' });
    } finally {
      setClaimLoading(false);
    }
  };

  // ─── Handover logic ───
  const handoverStaffNames = useMemo(() => {
    const names = new Set(
      revenues.filter(r => (r.paymentMethod === '現金' || r.paymentMethod === '支票') && !r.handed).map(r => r.staff)
    );
    return Array.from(names).sort();
  }, [revenues]);

  const unhandedRevenues = useMemo(() => {
    return revenues
      .filter(r => (r.paymentMethod === '現金' || r.paymentMethod === '支票') && !r.handed && r.staff !== 'admin' && r.department !== '老闆')
      .filter(r => handoverStaff === 'all' || r.staff === handoverStaff)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [revenues, handoverStaff]);

  const handoverSelectedTotal = useMemo(() => {
    return unhandedRevenues
      .filter(r => handoverSelectedIds.has(r.id))
      .reduce((sum, r) => sum + r.amount, 0);
  }, [unhandedRevenues, handoverSelectedIds]);

  const toggleHandoverSelect = (id: string) => {
    setHandoverSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllHandoverForStaff = (staff: string) => {
    const ids = unhandedRevenues.filter(r => r.staff === staff).map(r => r.id);
    setHandoverSelectedIds(new Set(ids));
  };

  const handleHandover = async () => {
    if (handoverSelectedIds.size === 0) {
      toast({ title: '請選擇要確認交數的收入', variant: 'destructive' });
      return;
    }
    const ids = Array.from(handoverSelectedIds);
    const staffToHandover = unhandedRevenues.find(r => ids.includes(r.id))?.staff;
    if (!staffToHandover) return;
    const allSameStaff = ids.every(id => unhandedRevenues.find(r => r.id === id)?.staff === staffToHandover);
    if (!allSameStaff) {
      toast({ title: '請只選擇同一位同事的收入進行交數', variant: 'destructive' });
      return;
    }
    setHandoverLoading(true);
    try {
      await confirmHandover(ids, staffToHandover, handoverSelectedTotal);
      toast({ title: `已確認 ${staffToHandover} 交數 $${handoverSelectedTotal.toFixed(2)}` });
      setHandoverSelectedIds(new Set());
      await loadData();
    } catch (err) {
      toast({ title: '交數確認失敗', variant: 'destructive' });
    } finally {
      setHandoverLoading(false);
    }
  };

  // ─── Batch delete helpers ───
  const handleBatchDelete = async () => {
    if (!batchDeleteTarget) return;
    try {
      if (batchDeleteTarget === 'claim-pending') {
        const ids = Array.from(selectedIds);
        for (const id of ids) {
          const exp = unclaimedExpenses.find(e => e.id === id);
          if (exp) await deleteExpense(id, exp.currency || 'HKD');
        }
        toast({ title: `已刪除 ${ids.length} 筆支出記錄` });
        setSelectedIds(new Set());
      } else if (batchDeleteTarget === 'handover-pending') {
        const ids = Array.from(handoverSelectedIds);
        for (const id of ids) {
          await deleteRecord(id);
        }
        toast({ title: `已刪除 ${ids.length} 筆收入記錄` });
        setHandoverSelectedIds(new Set());
      } else if (batchDeleteTarget === 'claim-history') {
        const ids = Array.from(claimHistorySelectedIds);
        for (const id of ids) {
          const claim = claims.find(c => c.id === id);
          if (claim) await deleteClaimRecord(id, claim.currency || 'HKD');
        }
        toast({ title: `已刪除 ${ids.length} 筆 Claim 記錄，支出已還原` });
        setClaimHistorySelectedIds(new Set());
      } else if (batchDeleteTarget === 'handover-history') {
        const ids = Array.from(handoverHistorySelectedIds);
        for (const id of ids) {
          await deleteHandoverRecord(id);
        }
        toast({ title: `已刪除 ${ids.length} 筆交數記錄，收入已還原` });
        setHandoverHistorySelectedIds(new Set());
      }
      await loadData();
    } catch {
      toast({ title: '批量刪除失敗', variant: 'destructive' });
    } finally {
      setBatchDeleteTarget(null);
    }
  };

  // ─── Edit claim record ───
  const openEditClaim = (claim: ClaimRecord) => {
    setEditingClaim(claim);
    setEditClaimForm({
      staff: claim.staff,
      claimDate: claim.claimDate,
      totalAmount: String(claim.totalAmount),
    });
  };

  const handleSaveClaim = async () => {
    if (!editingClaim) return;
    setEditSaving(true);
    try {
      await updateClaimRecord(editingClaim.id, {
        staff: editClaimForm.staff,
        claimDate: editClaimForm.claimDate,
        totalAmount: parseFloat(editClaimForm.totalAmount),
      }, editingClaim.currency || 'HKD');
      toast({ title: 'Claim 記錄已更新' });
      setEditingClaim(null);
      await loadData();
    } catch {
      toast({ title: '更新失敗', variant: 'destructive' });
    } finally {
      setEditSaving(false);
    }
  };

  // ─── Edit handover record ───
  const openEditHandover = (h: HandoverRecord) => {
    setEditingHandover(h);
    setEditHandoverForm({
      staff: h.staff,
      handoverDate: h.handoverDate,
      totalAmount: String(h.totalAmount),
    });
  };

  const handleSaveHandover = async () => {
    if (!editingHandover) return;
    setEditSaving(true);
    try {
      await updateHandoverRecord(editingHandover.id, {
        staff: editHandoverForm.staff,
        handoverDate: editHandoverForm.handoverDate,
        totalAmount: parseFloat(editHandoverForm.totalAmount),
      });
      toast({ title: '交數記錄已更新' });
      setEditingHandover(null);
      await loadData();
    } catch {
      toast({ title: '更新失敗', variant: 'destructive' });
    } finally {
      setEditSaving(false);
    }
  };

  // ─── History toggle helpers ───
  const toggleClaimHistorySelect = (id: string) => {
    setClaimHistorySelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleHandoverHistorySelect = (id: string) => {
    setHandoverHistorySelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const sortedClaims = useMemo(() => [...claims].sort((a, b) => b.claimDate.localeCompare(a.claimDate)), [claims]);
  const sortedHandoverHistory = useMemo(() => [...handoverHistory].sort((a, b) => b.handoverDate.localeCompare(a.handoverDate)), [handoverHistory]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">載入中...</span>
      </div>
    );
  }

  return (
    <>
      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6 h-11">
          <TabsTrigger value="dashboard" className="text-xs gap-1"><BarChart3 className="h-4 w-4" />圖表</TabsTrigger>
          <TabsTrigger value="handover" className="text-xs gap-1"><Banknote className="h-4 w-4" />交數</TabsTrigger>
          <TabsTrigger value="claim" className="text-xs gap-1"><DollarSign className="h-4 w-4" />Claim</TabsTrigger>
          <TabsTrigger value="handover-history" className="text-xs gap-1"><History className="h-4 w-4" />交數記錄</TabsTrigger>
          <TabsTrigger value="history" className="text-xs gap-1"><History className="h-4 w-4" />Claim記錄</TabsTrigger>
          <TabsTrigger value="users" className="text-xs gap-1"><Users className="h-4 w-4" />帳戶</TabsTrigger>
        </TabsList>

        {/* Dashboard */}
        <TabsContent value="dashboard">
          <AdminDashboard />
        </TabsContent>

        {/* Handover Tab */}
        <TabsContent value="handover">
          <Card>
            <CardHeader className="pb-3 px-4">
              <CardTitle className="text-base">確認交數</CardTitle>
              <CardDescription className="text-xs">選擇同事的現金／支票收入，確認已交數</CardDescription>
            </CardHeader>
            <CardContent className="px-4 space-y-4">
              <div className="flex gap-3 items-end flex-wrap">
                <div className="flex-1 min-w-[150px]">
                  <Select value={handoverStaff} onValueChange={(v) => { setHandoverStaff(v); setHandoverSelectedIds(new Set()); }}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="篩選同事" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">所有同事</SelectItem>
                      {handoverStaffNames.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                {handoverStaff !== 'all' && (
                  <Button variant="outline" size="sm" onClick={() => selectAllHandoverForStaff(handoverStaff)}>
                    全選 {handoverStaff}
                  </Button>
                )}
              </div>

              {handoverSelectedIds.size > 0 && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20 gap-2 flex-wrap">
                  <span className="text-sm font-medium">已選 {handoverSelectedIds.size} 筆，總計: <span className="text-primary font-bold">${handoverSelectedTotal.toFixed(2)}</span></span>
                  <div className="flex gap-2">
                    <Button variant="destructive" size="sm" onClick={() => setBatchDeleteTarget('handover-pending')}>
                      <Trash2 className="mr-1.5 h-4 w-4" />批量刪除
                    </Button>
                    <Button onClick={handleHandover} disabled={handoverLoading} size="sm">
                      {handoverLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <CheckCircle2 className="mr-1.5 h-4 w-4" />確認交數
                    </Button>
                  </div>
                </div>
              )}

              {unhandedRevenues.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <p className="font-medium">暫無待交數收入</p>
                </div>
              ) : (
                <div className="rounded-lg border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-10"></TableHead>
                        <TableHead className="font-semibold">日期</TableHead>
                        <TableHead className="font-semibold">同事</TableHead>
                        <TableHead className="font-semibold">收款方式</TableHead>
                        <TableHead className="font-semibold">部門</TableHead>
                        <TableHead className="font-semibold text-right">金額</TableHead>
                        <TableHead className="font-semibold w-12">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unhandedRevenues.map((rev) => (
                        <TableRow key={rev.id} className="hover:bg-muted/30 cursor-pointer group" onClick={() => toggleHandoverSelect(rev.id)}>
                          <TableCell>
                            <Checkbox checked={handoverSelectedIds.has(rev.id)} onCheckedChange={() => toggleHandoverSelect(rev.id)} />
                          </TableCell>
                          <TableCell className="font-medium">
                            {(() => { try { return format(parseISO(rev.date), 'MM/dd'); } catch { return rev.date; } })()}
                          </TableCell>
                          <TableCell>{rev.staff}</TableCell>
                          <TableCell><Badge variant="outline">{rev.paymentMethod}</Badge></TableCell>
                          <TableCell><Badge variant="secondary" className="font-normal">{rev.department}</Badge></TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">${Number(rev.amount).toFixed(2)}</TableCell>
                          <TableCell>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10" onClick={(e) => e.stopPropagation()}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>確定刪除此收入記錄？</AlertDialogTitle>
                                  <AlertDialogDescription>此操作無法撤銷，記錄將從 Google Sheet 中永久刪除。</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>取消</AlertDialogCancel>
                                  <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={async () => {
                                    try { await deleteRecord(rev.id); toast({ title: '收入記錄已刪除' }); loadData(); } catch { toast({ title: '刪除失敗', variant: 'destructive' }); }
                                  }}>確定刪除</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Claim Tab */}
        <TabsContent value="claim">
          <Card>
            <CardHeader className="pb-3 px-4">
              <CardTitle className="text-base">支出報銷</CardTitle>
              <CardDescription className="text-xs">選擇同事的未 Claim 支出進行報銷</CardDescription>
            </CardHeader>
            <CardContent className="px-4 space-y-4">
              <div className="flex gap-3 items-end flex-wrap">
                <div className="flex-1 min-w-[150px]">
                  <Select value={selectedStaff} onValueChange={(v) => { setSelectedStaff(v); setSelectedIds(new Set()); }}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="篩選同事" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">所有同事</SelectItem>
                      {staffNames.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedStaff !== 'all' && (
                  <Button variant="outline" size="sm" onClick={() => selectAllForStaff(selectedStaff)}>
                    全選 {selectedStaff}
                  </Button>
                )}
              </div>

              {selectedIds.size > 0 && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20 gap-2 flex-wrap">
                  <span className="text-sm font-medium">已選 {selectedIds.size} 筆，總計: <span className="text-primary font-bold">{CURRENCY_SYMBOLS[selectedCurrency]}{selectedTotal.toFixed(2)}</span></span>
                  <div className="flex gap-2">
                    <Button variant="destructive" size="sm" onClick={() => setBatchDeleteTarget('claim-pending')}>
                      <Trash2 className="mr-1.5 h-4 w-4" />批量刪除
                    </Button>
                    <Button onClick={handleClaim} disabled={claimLoading} size="sm">
                      {claimLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <CheckCircle2 className="mr-1.5 h-4 w-4" />確認 Claim
                    </Button>
                  </div>
                </div>
              )}

              {unclaimedExpenses.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <p className="font-medium">暫無待 Claim 支出</p>
                </div>
              ) : (
                <div className="rounded-lg border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-10"></TableHead>
                        <TableHead className="font-semibold">日期</TableHead>
                        <TableHead className="font-semibold">同事</TableHead>
                        <TableHead className="font-semibold">類別</TableHead>
                        <TableHead className="font-semibold text-right">金額</TableHead>
                        <TableHead className="font-semibold">幣種</TableHead>
                        <TableHead className="font-semibold w-12">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unclaimedExpenses.map((exp) => (
                        <TableRow key={exp.id} className="hover:bg-muted/30 cursor-pointer group" onClick={() => toggleSelect(exp.id)}>
                          <TableCell>
                            <Checkbox checked={selectedIds.has(exp.id)} onCheckedChange={() => toggleSelect(exp.id)} />
                          </TableCell>
                          <TableCell className="font-medium">
                            {(() => { try { return format(parseISO(exp.date), 'MM/dd'); } catch { return exp.date; } })()}
                          </TableCell>
                          <TableCell>{exp.staff}</TableCell>
                          <TableCell><Badge variant="outline">{exp.category}</Badge></TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">{CURRENCY_SYMBOLS[exp.currency || 'HKD']}{Number(exp.amount).toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge variant={exp.currency === 'RMB' ? 'destructive' : 'secondary'} className="font-normal text-xs">
                              {exp.currency || 'HKD'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10" onClick={(e) => e.stopPropagation()}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>確定刪除此支出記錄？</AlertDialogTitle>
                                  <AlertDialogDescription>此操作無法撤銷，記錄將從 Google Sheet 中永久刪除。</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>取消</AlertDialogCancel>
                                  <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={async () => {
                                    try { await deleteExpense(exp.id, exp.currency || 'HKD'); toast({ title: '支出記錄已刪除' }); loadData(); } catch { toast({ title: '刪除失敗', variant: 'destructive' }); }
                                  }}>確定刪除</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Handover History */}
        <TabsContent value="handover-history">
          <Card>
            <CardHeader className="pb-3 px-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">交數歷史記錄</CardTitle>
                </div>
                {handoverHistorySelectedIds.size > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">已選 {handoverHistorySelectedIds.size} 筆</span>
                    <Button variant="destructive" size="sm" onClick={() => setBatchDeleteTarget('handover-history')}>
                      <Trash2 className="mr-1.5 h-4 w-4" />批量刪除
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-4">
              {handoverHistory.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground"><p>暫無交數記錄</p></div>
              ) : (
                <div className="rounded-lg border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-10">
                          <Checkbox
                            checked={handoverHistorySelectedIds.size === sortedHandoverHistory.length && sortedHandoverHistory.length > 0}
                            onCheckedChange={(checked) => {
                              if (checked) setHandoverHistorySelectedIds(new Set(sortedHandoverHistory.map(h => h.id)));
                              else setHandoverHistorySelectedIds(new Set());
                            }}
                          />
                        </TableHead>
                        <TableHead className="font-semibold">日期</TableHead>
                        <TableHead className="font-semibold">同事</TableHead>
                        <TableHead className="font-semibold text-right">金額</TableHead>
                        <TableHead className="font-semibold">項目數</TableHead>
                        <TableHead className="font-semibold w-20">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedHandoverHistory.map((h) => (
                        <TableRow key={h.id} className="group cursor-pointer hover:bg-muted/30" onClick={() => toggleHandoverHistorySelect(h.id)}>
                          <TableCell>
                            <Checkbox checked={handoverHistorySelectedIds.has(h.id)} onCheckedChange={() => toggleHandoverHistorySelect(h.id)} />
                          </TableCell>
                          <TableCell className="font-medium">
                            {(() => { try { return format(parseISO(h.handoverDate), 'yyyy/MM/dd'); } catch { return h.handoverDate; } })()}
                          </TableCell>
                          <TableCell>{h.staff}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">${Number(h.totalAmount).toFixed(2)}</TableCell>
                          <TableCell>{h.revenueIds ? h.revenueIds.split(',').length : 0} 筆</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); openEditHandover(h); }}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10" onClick={(e) => e.stopPropagation()}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>確定刪除此交數記錄？</AlertDialogTitle>
                                    <AlertDialogDescription>刪除後對應的收入記錄將還原為「未交數」狀態。</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>取消</AlertDialogCancel>
                                    <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={async () => {
                                      try { await deleteHandoverRecord(h.id); toast({ title: '交數記錄已刪除，收入已還原為未交數' }); loadData(); } catch { toast({ title: '刪除失敗', variant: 'destructive' }); }
                                    }}>確定刪除</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Claim History */}
        <TabsContent value="history">
          <Card>
            <CardHeader className="pb-3 px-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Claim 歷史記錄</CardTitle>
                </div>
                {claimHistorySelectedIds.size > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">已選 {claimHistorySelectedIds.size} 筆</span>
                    <Button variant="destructive" size="sm" onClick={() => setBatchDeleteTarget('claim-history')}>
                      <Trash2 className="mr-1.5 h-4 w-4" />批量刪除
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-4">
              {claims.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground"><p>暫無 Claim 記錄</p></div>
              ) : (
                <div className="rounded-lg border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-10">
                          <Checkbox
                            checked={claimHistorySelectedIds.size === sortedClaims.length && sortedClaims.length > 0}
                            onCheckedChange={(checked) => {
                              if (checked) setClaimHistorySelectedIds(new Set(sortedClaims.map(c => c.id)));
                              else setClaimHistorySelectedIds(new Set());
                            }}
                          />
                        </TableHead>
                        <TableHead className="font-semibold">日期</TableHead>
                        <TableHead className="font-semibold">同事</TableHead>
                        <TableHead className="font-semibold text-right">金額</TableHead>
                        <TableHead className="font-semibold">幣種</TableHead>
                        <TableHead className="font-semibold">項目數</TableHead>
                        <TableHead className="font-semibold w-20">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedClaims.map((claim) => (
                        <TableRow key={claim.id} className="group cursor-pointer hover:bg-muted/30" onClick={() => toggleClaimHistorySelect(claim.id)}>
                          <TableCell>
                            <Checkbox checked={claimHistorySelectedIds.has(claim.id)} onCheckedChange={() => toggleClaimHistorySelect(claim.id)} />
                          </TableCell>
                          <TableCell className="font-medium">
                            {(() => { try { return format(parseISO(claim.claimDate), 'yyyy/MM/dd'); } catch { return claim.claimDate; } })()}
                          </TableCell>
                          <TableCell>{claim.staff}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">{CURRENCY_SYMBOLS[claim.currency || 'HKD']}{Number(claim.totalAmount).toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge variant={claim.currency === 'RMB' ? 'destructive' : 'secondary'} className="font-normal text-xs">
                              {claim.currency || 'HKD'}
                            </Badge>
                          </TableCell>
                          <TableCell>{claim.expenseIds ? claim.expenseIds.split(',').length : 0} 筆</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); openEditClaim(claim); }}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10" onClick={(e) => e.stopPropagation()}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>確定刪除此 Claim 記錄？</AlertDialogTitle>
                                    <AlertDialogDescription>刪除後對應的支出記錄將還原為「未 Claim」狀態。</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>取消</AlertDialogCancel>
                                    <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={async () => {
                                      try { await deleteClaimRecord(claim.id, claim.currency || 'HKD'); toast({ title: 'Claim 記錄已刪除，支出已還原為未 Claim' }); loadData(); } catch { toast({ title: '刪除失敗', variant: 'destructive' }); }
                                    }}>確定刪除</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader className="pb-3 px-4">
              <CardTitle className="text-base">同事帳戶</CardTitle>
              <CardDescription className="text-xs">查看所有已註冊同事的登入資料</CardDescription>
            </CardHeader>
            <CardContent className="px-4 space-y-6">
              {users.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground"><p>暫無已註冊帳戶</p></div>
              ) : (
                <div className="rounded-lg border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-semibold">姓名</TableHead>
                        <TableHead className="font-semibold">密碼</TableHead>
                        <TableHead className="font-semibold w-20 text-center">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell className="text-muted-foreground">{user.password}</TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={async () => {
                                if (!confirm(`確定要刪除帳戶「${user.name}」嗎？`)) return;
                                try {
                                  await deleteUser(user.name);
                                  toast({ title: `已刪除帳戶「${user.name}」` });
                                  await loadData();
                                } catch {
                                  toast({ title: '刪除失敗', variant: 'destructive' });
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Batch Delete Confirmation Dialog */}
      <AlertDialog open={!!batchDeleteTarget} onOpenChange={(open) => { if (!open) setBatchDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定批量刪除？</AlertDialogTitle>
            <AlertDialogDescription>
              {batchDeleteTarget === 'claim-pending' && `將刪除 ${selectedIds.size} 筆支出記錄，此操作無法撤銷。`}
              {batchDeleteTarget === 'handover-pending' && `將刪除 ${handoverSelectedIds.size} 筆收入記錄，此操作無法撤銷。`}
              {batchDeleteTarget === 'claim-history' && `將刪除 ${claimHistorySelectedIds.size} 筆 Claim 記錄，對應支出將還原為「未 Claim」狀態。`}
              {batchDeleteTarget === 'handover-history' && `將刪除 ${handoverHistorySelectedIds.size} 筆交數記錄，對應收入將還原為「未交數」狀態。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleBatchDelete}>確定刪除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Claim Dialog */}
      <Dialog open={!!editingClaim} onOpenChange={(open) => { if (!open) setEditingClaim(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改 Claim 記錄</DialogTitle>
            <DialogDescription>修改此 Claim 記錄的資料</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>同事</Label>
              <Input value={editClaimForm.staff} onChange={(e) => setEditClaimForm(f => ({ ...f, staff: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Claim 日期</Label>
              <Input type="date" value={editClaimForm.claimDate} onChange={(e) => setEditClaimForm(f => ({ ...f, claimDate: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>總金額</Label>
              <Input type="number" step="0.01" value={editClaimForm.totalAmount} onChange={(e) => setEditClaimForm(f => ({ ...f, totalAmount: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingClaim(null)}>取消</Button>
            <Button onClick={handleSaveClaim} disabled={editSaving}>
              {editSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Handover Dialog */}
      <Dialog open={!!editingHandover} onOpenChange={(open) => { if (!open) setEditingHandover(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改交數記錄</DialogTitle>
            <DialogDescription>修改此交數記錄的資料</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>同事</Label>
              <Input value={editHandoverForm.staff} onChange={(e) => setEditHandoverForm(f => ({ ...f, staff: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>交數日期</Label>
              <Input type="date" value={editHandoverForm.handoverDate} onChange={(e) => setEditHandoverForm(f => ({ ...f, handoverDate: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>金額</Label>
              <Input type="number" step="0.01" value={editHandoverForm.totalAmount} onChange={(e) => setEditHandoverForm(f => ({ ...f, totalAmount: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingHandover(null)}>取消</Button>
            <Button onClick={handleSaveHandover} disabled={editSaving}>
              {editSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdminClaimPanel;
