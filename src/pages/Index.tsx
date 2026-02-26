import { useState } from 'react';
import { DollarSign, FileText } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import DataEntryForm from '@/components/DataEntryForm';
import RecordsTable from '@/components/RecordsTable';
import SetupDialog from '@/components/SetupDialog';
import { type RevenueRecord } from '@/types/record';

const Index = () => {
  const [activeTab, setActiveTab] = useState('entry');
  const [editingRecord, setEditingRecord] = useState<RevenueRecord | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

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
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              DF創意家居
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              每日收入記錄 · 度尺銷售部 · 安裝部
            </p>
          </div>
          <SetupDialog onSetup={() => setRefreshKey((k) => k + 1)} />
        </div>
      </header>

      {/* Main */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 h-11 mb-6">
            <TabsTrigger value="entry" className="text-sm font-medium gap-2">
              <DollarSign className="h-4 w-4" />
              {editingRecord ? '修改記錄' : '新增記錄'}
            </TabsTrigger>
            <TabsTrigger value="records" className="text-sm font-medium gap-2">
              <FileText className="h-4 w-4" />
              查看記錄
            </TabsTrigger>
          </TabsList>

          <TabsContent value="entry">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">
                  {editingRecord ? '修改收入記錄' : '輸入收入資料'}
                </CardTitle>
                <CardDescription>
                  {editingRecord
                    ? '修改後將覆寫原有資料'
                    : '填寫以下資料並提交至 Google Sheet'}
                </CardDescription>
              </CardHeader>
              <CardContent>
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
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">收入記錄</CardTitle>
                <CardDescription>查看及修改已提交的記錄</CardDescription>
              </CardHeader>
              <CardContent>
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
