import { useState } from 'react';
import { User, Lock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useStaff } from '@/contexts/StaffContext';
import { useToast } from '@/hooks/use-toast';
import { loginUser, registerUser } from '@/lib/googleSheets';
import dfLogo from '@/assets/df-logo.jpg';

const CHINESE_NAME_REGEX = /^[\u4e00-\u9fff]{2,5}$/;

const StaffLogin = () => {
  const { setStaffLogin } = useStaff();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();

    // Admin login
    if (trimmed === 'admin') {
      if (!password) {
        toast({ title: '請輸入密碼', variant: 'destructive' });
        return;
      }
      setLoading(true);
      try {
        const result = await loginUser(trimmed, password);
        if (result.success) {
          setStaffLogin('Admin', true);
          toast({ title: '管理員登入成功' });
        } else {
          toast({ title: result.message || '登入失敗', variant: 'destructive' });
        }
      } catch {
        toast({ title: '登入失敗，請檢查網絡', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
      return;
    }

    // Staff validation
    if (!CHINESE_NAME_REGEX.test(trimmed)) {
      toast({ title: '請輸入中文全名（2-5個中文字）', variant: 'destructive' });
      return;
    }
    if (!password || password.length < 4) {
      toast({ title: '密碼最少4個字元', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      if (isRegister) {
        const result = await registerUser(trimmed, password);
        if (result.success) {
          setStaffLogin(trimmed, false);
          toast({ title: '註冊成功，已登入' });
        } else {
          toast({ title: result.message || '註冊失敗', variant: 'destructive' });
        }
      } else {
        const result = await loginUser(trimmed, password);
        if (result.success) {
          setStaffLogin(trimmed, false);
          toast({ title: '登入成功' });
        } else {
          toast({ title: result.message || '登入失敗', variant: 'destructive' });
        }
      }
    } catch {
      toast({ title: '操作失敗，請檢查網絡', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-sm shadow-lg border-0 bg-card">
        <CardContent className="pt-8 pb-8 px-6">
          <div className="flex flex-col items-center mb-8">
            <img src={dfLogo} alt="DF創意家居" className="h-16 w-16 object-contain rounded-lg mb-4" />
            <h1 className="text-xl font-bold text-foreground tracking-tight">DF創意家居</h1>
            <p className="text-sm text-muted-foreground mt-1">每日收支記錄系統</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {isRegister ? '設定登入名稱（中文全名）' : '登入名稱'}
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：陳大文 或 admin"
                  className="pl-10 h-12 text-base"
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {isRegister ? '設定密碼（最少4個字元）' : '密碼'}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="輸入密碼"
                  className="pl-10 h-12 text-base"
                />
              </div>
            </div>

            <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isRegister ? '註冊並登入' : '登入'}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsRegister(!isRegister)}
                className="text-sm text-primary hover:underline"
              >
                {isRegister ? '已有帳戶？返回登入' : '首次使用？立即註冊'}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default StaffLogin;
