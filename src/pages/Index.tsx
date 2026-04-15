import { useState } from 'react';
import { DollarSign, FileText, LogOut, MinusCircle, Shield, CreditCard } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import DataEntryForm from '@/components/DataEntryForm';
import RecordsTable from '@/components/RecordsTable';
import ExpenseEntryForm from '@/components/ExpenseEntryForm';
import ExpenseRecordsTable from '@/components/ExpenseRecordsTable';
import AdminClaimPanel from '@/components/AdminClaimPanel';
import CreditCardUpload from '@/components/CreditCardUpload';
import StaffLogin from '@/components/StaffLogin';
import { useStaff } from '@/contexts/StaffContext';
import { type RevenueRecord, type ExpenseRecord } from '@/types/record';
import dfLogo from '@/assets/df-logo.jpg';

const Index = () => {
  const { staffName, isAdmin, isLoggedIn, logout } = useStaff();
  const [activeTab, setActiveTab] = useState('revenue-entry');
  const [editingRevenue, setEditingRevenue] = useState<RevenueRecord | null>(null);
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null);
  const [revenueRefreshKey, setRevenueRefreshKey] = useState(0);
  const [expenseRefreshKey, setExpenseRefreshKey] = useState(0);

  if (!isLoggedIn) return <StaffLogin />;

  const handleEditRevenue = (record: RevenueRecord) => {
    setEditingRevenue(record);
    setActiveTab('revenue-entry');
  };

  const handleEditExpense = (record: ExpenseRecord) => {
    setEditingExpense(record);
    setActiveTab('expense-entry');
  };

  const handleRevenueComplete = () => {
    setEditingRevenue(null);
    setRevenueRefreshKey((k) => k + 1);
  };

  const handleExpenseComplete = () => {
    setEditingExpense(null);
    setExpenseRefreshKey((k) => k + 1);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-3 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={dfLogo} alt="DF創意家居" className="h-9 w-9 object-contain rounded" />
            <div className="leading-tight">
              <h1 className="text-base font-bold text-foreground tracking-tight">DF創意家居</h1>
              <p className="text-[11px] text-muted-foreground">
                {staffName} {isAdmin && <span className="text-primary font-semibold">（管理員）</span>}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={logout} className="h-9 w-9" title="登出">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-3 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-6' : 'grid-cols-4'} h-11 mb-4`}>
            <TabsTrigger value="revenue-entry" className="text-xs font-medium gap-1">
              <DollarSign className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{editingRevenue ? '修改' : '收入'}</span>
              <span className="sm:hidden">收入</span>
            </TabsTrigger>
            <TabsTrigger value="revenue-records" className="text-xs font-medium gap-1">
              <FileText className="h-3.5 w-3.5" />
              <span>收入紀錄</span>
            </TabsTrigger>
            <TabsTrigger value="expense-entry" className="text-xs font-medium gap-1">
              <MinusCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{editingExpense ? '修改' : '支出'}</span>
              <span className="sm:hidden">支出</span>
            </TabsTrigger>
            <TabsTrigger value="expense-records" className="text-xs font-medium gap-1">
              <FileText className="h-3.5 w-3.5" />
              <span>支出紀錄</span>
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="credit-card" className="text-xs font-medium gap-1">
                <CreditCard className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">月結單</span>
                <span className="sm:hidden">卡</span>
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="admin" className="text-xs font-medium gap-1">
                <Shield className="h-3.5 w-3.5" />
                <span>管理</span>
              </TabsTrigger>
            )}
          </TabsList>

          {/* Revenue Entry */}
          <TabsContent value="revenue-entry">
            <Card>
              <CardHeader className="pb-3 px-4">
                <CardTitle className="text-base">{editingRevenue ? '修改收入記錄' : '輸入收入資料'}</CardTitle>
                {editingRevenue && <CardDescription className="text-xs">修改後將覆寫原有資料</CardDescription>}
              </CardHeader>
              <CardContent className="px-4">
                <DataEntryForm
                  key={editingRevenue?.id || 'new'}
                  editingRecord={editingRevenue}
                  onComplete={handleRevenueComplete}
                  onCancelEdit={editingRevenue ? () => setEditingRevenue(null) : undefined}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Revenue Records */}
          <TabsContent value="revenue-records">
            <Card>
              <CardHeader className="pb-3 px-4">
                <CardTitle className="text-base">{isAdmin ? '所有收入記錄' : '我的收入記錄'}</CardTitle>
                <CardDescription className="text-xs">
                  {isAdmin ? '查看所有同事的收入記錄' : '查看及修改你提交的記錄'}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4">
                <RecordsTable onEdit={handleEditRevenue} refreshKey={revenueRefreshKey} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Expense Entry */}
          <TabsContent value="expense-entry">
            <Card>
              <CardHeader className="pb-3 px-4">
                <CardTitle className="text-base">{editingExpense ? '修改支出記錄' : '輸入支出資料'}</CardTitle>
                {editingExpense && <CardDescription className="text-xs">修改後將覆寫原有資料</CardDescription>}
              </CardHeader>
              <CardContent className="px-4">
                <ExpenseEntryForm
                  key={editingExpense?.id || 'new'}
                  editingRecord={editingExpense}
                  onComplete={handleExpenseComplete}
                  onCancelEdit={editingExpense ? () => setEditingExpense(null) : undefined}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Expense Records */}
          <TabsContent value="expense-records">
            <Card>
              <CardHeader className="pb-3 px-4">
                <CardTitle className="text-base">{isAdmin ? '所有支出記錄' : '我的支出記錄'}</CardTitle>
                <CardDescription className="text-xs">
                  {isAdmin ? '查看所有同事的支出記錄' : '查看你的支出及 Claim 狀態'}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4">
                <ExpenseRecordsTable onEdit={handleEditExpense} refreshKey={expenseRefreshKey} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Credit Card Upload */}
          {isAdmin && (
            <TabsContent value="credit-card">
              <CreditCardUpload />
            </TabsContent>
          )}

          {/* Admin Panel */}
          {isAdmin && (
            <TabsContent value="admin">
              <AdminClaimPanel />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
