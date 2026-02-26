import { useState } from 'react';
import { User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useStaff } from '@/contexts/StaffContext';
import { useToast } from '@/hooks/use-toast';
import dfLogo from '@/assets/df-logo.jpg';

const CHINESE_NAME_REGEX = /^[\u4e00-\u9fff]{2,5}$/;

const StaffLogin = () => {
  const { setStaffName } = useStaff();
  const { toast } = useToast();
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!CHINESE_NAME_REGEX.test(trimmed)) {
      toast({ title: '請輸入中文全名（2-5個中文字）', variant: 'destructive' });
      return;
    }
    setStaffName(trimmed);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-sm shadow-lg border-0 bg-card">
        <CardContent className="pt-8 pb-8 px-6">
          <div className="flex flex-col items-center mb-8">
            <img src={dfLogo} alt="DF創意家居" className="h-16 w-16 object-contain rounded-lg mb-4" />
            <h1 className="text-xl font-bold text-foreground tracking-tight">DF創意家居</h1>
            <p className="text-sm text-muted-foreground mt-1">每日收入記錄系統</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">請輸入你的中文全名</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：陳大文"
                  className="pl-10 h-12 text-base"
                  autoFocus
                />
              </div>
              <p className="text-xs text-muted-foreground">輸入後只會顯示你本人的記錄</p>
            </div>
            <Button type="submit" className="w-full h-12 text-base font-semibold">
              進入系統
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default StaffLogin;
