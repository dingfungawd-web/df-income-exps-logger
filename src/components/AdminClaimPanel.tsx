import { useState, useEffect, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { Loader2, CheckCircle2, Users, DollarSign, History, Trash2, Banknote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type ExpenseRecord, type ClaimRecord, type StaffUser, type RevenueRecord, type HandoverRecord } from '@/types/record';
import { fetchExpenses, fetchClaimHistory, fetchAllUsers, claimExpenses, deleteUser, fetchRecords, confirmHandover, fetchHandoverHistory, clearAllRecords } from '@/lib/googleSheets';
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

  // ─── Claim logic (unchanged) ───
  const staffNames = useMemo(() => {
    const names = new Set(expenses.map(e => e.staff));
    return Array.from(names).sort();
  }, [expenses]);

  const unclaimedExpenses = useMemo(() => {
    return expenses
      .filter(e => !e.claimed)
      .filter(e => selectedStaff === 'all' || e.staff === selectedStaff)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, selectedStaff]);

  const selectedTotal = useMemo(() => {
    return unclaimedExpenses
      .filter(e => selectedIds.has(e.id))
      .reduce((sum, e) => sum + e.amount, 0);
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
    setClaimLoading(true);
    try {
      await claimExpenses(ids, staffToClaim, selectedTotal);
      toast({ title: `已成功 Claim $${selectedTotal.toFixed(2)} 給 ${staffToClaim}` });
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
      .filter(r => (r.paymentMethod === '現金' || r.paymentMethod === '支票') && !r.handed)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">載入中...</span>
      </div>
    );
  }

  return (
    <Tabs defaultValue="handover" className="space-y-4">
      <TabsList className="grid w-full grid-cols-5 h-11">
        <TabsTrigger value="handover" className="text-xs gap-1"><Banknote className="h-4 w-4" />交數</TabsTrigger>
        <TabsTrigger value="claim" className="text-xs gap-1"><DollarSign className="h-4 w-4" />Claim</TabsTrigger>
        <TabsTrigger value="handover-history" className="text-xs gap-1"><History className="h-4 w-4" />交數記錄</TabsTrigger>
        <TabsTrigger value="history" className="text-xs gap-1"><History className="h-4 w-4" />Claim記錄</TabsTrigger>
        <TabsTrigger value="users" className="text-xs gap-1"><Users className="h-4 w-4" />帳戶</TabsTrigger>
      </TabsList>

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
              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
                <span className="text-sm font-medium">已選 {handoverSelectedIds.size} 筆，總計: <span className="text-primary font-bold">${handoverSelectedTotal.toFixed(2)}</span></span>
                <Button onClick={handleHandover} disabled={handoverLoading} size="sm">
                  {handoverLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />確認交數
                </Button>
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unhandedRevenues.map((rev) => (
                      <TableRow key={rev.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => toggleHandoverSelect(rev.id)}>
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
              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
                <span className="text-sm font-medium">已選 {selectedIds.size} 筆，總計: <span className="text-primary font-bold">${selectedTotal.toFixed(2)}</span></span>
                <Button onClick={handleClaim} disabled={claimLoading} size="sm">
                  {claimLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />確認 Claim
                </Button>
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unclaimedExpenses.map((exp) => (
                      <TableRow key={exp.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => toggleSelect(exp.id)}>
                        <TableCell>
                          <Checkbox checked={selectedIds.has(exp.id)} onCheckedChange={() => toggleSelect(exp.id)} />
                        </TableCell>
                        <TableCell className="font-medium">
                          {(() => { try { return format(parseISO(exp.date), 'MM/dd'); } catch { return exp.date; } })()}
                        </TableCell>
                        <TableCell>{exp.staff}</TableCell>
                        <TableCell><Badge variant="outline">{exp.category}</Badge></TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">${Number(exp.amount).toFixed(2)}</TableCell>
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
            <CardTitle className="text-base">交數歷史記錄</CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            {handoverHistory.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground"><p>暫無交數記錄</p></div>
            ) : (
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">日期</TableHead>
                      <TableHead className="font-semibold">同事</TableHead>
                      <TableHead className="font-semibold text-right">金額</TableHead>
                      <TableHead className="font-semibold">項目數</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {handoverHistory.sort((a, b) => b.handoverDate.localeCompare(a.handoverDate)).map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="font-medium">
                          {(() => { try { return format(parseISO(h.handoverDate), 'yyyy/MM/dd'); } catch { return h.handoverDate; } })()}
                        </TableCell>
                        <TableCell>{h.staff}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">${Number(h.totalAmount).toFixed(2)}</TableCell>
                        <TableCell>{h.revenueIds ? h.revenueIds.split(',').length : 0} 筆</TableCell>
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
            <CardTitle className="text-base">Claim 歷史記錄</CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            {claims.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground"><p>暫無 Claim 記錄</p></div>
            ) : (
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">日期</TableHead>
                      <TableHead className="font-semibold">同事</TableHead>
                      <TableHead className="font-semibold text-right">金額</TableHead>
                      <TableHead className="font-semibold">項目數</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {claims.sort((a, b) => b.claimDate.localeCompare(a.claimDate)).map((claim) => (
                      <TableRow key={claim.id}>
                        <TableCell className="font-medium">
                          {(() => { try { return format(parseISO(claim.claimDate), 'yyyy/MM/dd'); } catch { return claim.claimDate; } })()}
                        </TableCell>
                        <TableCell>{claim.staff}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">${Number(claim.totalAmount).toFixed(2)}</TableCell>
                        <TableCell>{claim.expenseIds ? claim.expenseIds.split(',').length : 0} 筆</TableCell>
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
  );
};

export default AdminClaimPanel;
