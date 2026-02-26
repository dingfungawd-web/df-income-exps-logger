import { useState } from 'react';
import { DollarSign, FileText, LogOut } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import DataEntryForm from '@/components/DataEntryForm';
import RecordsTable from '@/components/RecordsTable';
import SetupDialog from '@/components/SetupDialog';
import StaffLogin from '@/components/StaffLogin';
import { useStaff } from '@/contexts/StaffContext';
import { type RevenueRecord } from '@/types/record';
import dfLogo from '@/assets/df-logo.jpg';

const Index = () => {
  const { staffName, isLoggedIn, logout } = useStaff();
  const [activeTab, setActiveTab] = useState('entry');
  const [editingRecord, setEditingRecord] = useState<RevenueRecord | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  if (!isLoggedIn) return <StaffLogin />;

  const handleEdit = (record: RevenueRecord) => {
    setEditingRecord(record);
    setActiveTab('entry');
  };

  const handleComplete = () => {
    setEditingRecord(null);
    setRefreshKey((k) => k + 1);
  };

  const handleCancelEdit = () => {
    setEditingRecord(null);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header - mobile optimized */}
      <header className="border-b bg-card shadow-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-3 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={dfLogo} alt="DF創意家居" className="h-9 w-9 object-contain rounded" />
            <div className="leading-tight">
              <h1 className="text-base font-bold text-foreground tracking-tight">DF創意家居</h1>
              <p className="text-[11px] text-muted-foreground">{staffName}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <SetupDialog onSetup={() => setRefreshKey((k) => k + 1)} />
            <Button variant="ghost" size="icon" onClick={logout} className="h-9 w-9" title="登出">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main - mobile optimized */}
      <main className="max-w-lg mx-auto px-3 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 h-11 mb-4">
            <TabsTrigger value="entry" className="text-sm font-medium gap-1.5">
              <DollarSign className="h-4 w-4" />
              {editingRecord ? '修改記錄' : '新增記錄'}
            </TabsTrigger>
            <TabsTrigger value="records" className="text-sm font-medium gap-1.5">
              <FileText className="h-4 w-4" />
              查看記錄
            </TabsTrigger>
          </TabsList>

          <TabsContent value="entry">
            <Card>
              <CardHeader className="pb-3 px-4">
                <CardTitle className="text-base">
                  {editingRecord ? '修改收入記錄' : '輸入收入資料'}
                </CardTitle>
                {editingRecord && (
                  <CardDescription className="text-xs">修改後將覆寫原有資料</CardDescription>
                )}
              </CardHeader>
              <CardContent className="px-4">
                <DataEntryForm
                  key={editingRecord?.id || 'new'}
                  editingRecord={editingRecord}
                  onComplete={handleComplete}
                  onCancelEdit={editingRecord ? handleCancelEdit : undefined}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="records">
            <Card>
              <CardHeader className="pb-3 px-4">
                <CardTitle className="text-base">我的記錄</CardTitle>
                <CardDescription className="text-xs">查看及修改你提交的記錄</CardDescription>
              </CardHeader>
              <CardContent className="px-4">
                <RecordsTable onEdit={handleEdit} refreshKey={refreshKey} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
