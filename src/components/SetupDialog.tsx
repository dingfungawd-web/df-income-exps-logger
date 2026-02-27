import { useState } from 'react';
import { Settings, Copy, CheckCircle2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { getScriptUrl, setScriptUrl, APPS_SCRIPT_CODE } from '@/lib/googleSheets';
import { useToast } from '@/hooks/use-toast';

interface SetupDialogProps {
  onSetup: () => void;
}

const SetupDialog = ({ onSetup }: SetupDialogProps) => {
  const { toast } = useToast();
  const [url, setUrl] = useState(getScriptUrl() || '');
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const handleSave = () => {
    if (!url.trim()) {
      toast({ title: '請輸入網址', variant: 'destructive' });
      return;
    }
    setScriptUrl(url.trim());
    toast({ title: '設定已儲存' });
    setOpen(false);
    onSetup();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: '程式碼已複製' });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="h-9 w-9">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>連接 Google Sheets</DialogTitle>
          <DialogDescription>
            按以下步驟設定 Google Apps Script 以連接你的 Google Sheet
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Steps */}
          <div className="space-y-3 text-sm">
            <div className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">1</span>
              <div>
                <p className="font-medium">開啟你的 Google Sheet</p>
                <a
                  href="https://docs.google.com/spreadsheets/d/1OyVFhHCa4WofhGsaDc2vcPmP26Q1ZlAwxnc7eP8lTtA/edit"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1 mt-0.5"
                >
                  開啟 Google Sheet <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">2</span>
              <div>
                <p className="font-medium">新增標題列</p>
                <p className="text-muted-foreground">在第一行輸入：ID、日期、部門、金額、收款方式</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">3</span>
              <div>
                <p className="font-medium">開啟 Apps Script</p>
                <p className="text-muted-foreground">點擊「擴充功能」→「Apps Script」</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">4</span>
              <div>
                <p className="font-medium">貼上以下程式碼</p>
                <div className="mt-2">
                  <Button variant="outline" size="sm" onClick={handleCopy} className="mb-2">
                    {copied ? <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                    {copied ? '已複製' : '複製程式碼'}
                  </Button>
                  <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto max-h-40 overflow-y-auto">
                    {APPS_SCRIPT_CODE.trim()}
                  </pre>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">5</span>
              <div>
                <p className="font-medium">部署為網路應用程式</p>
                <p className="text-muted-foreground">點擊「Deploy」→「New deployment」→ 類型選「Web app」→ 存取權限選「Anyone」→ 部署</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">6</span>
              <div>
                <p className="font-medium">將網址貼到下方</p>
              </div>
            </div>
          </div>

          {/* URL Input */}
          <div className="space-y-2">
            <Label>Google Apps Script 網址</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/..."
              className="h-10"
            />
          </div>

          <Button onClick={handleSave} className="w-full h-10 font-semibold">
            儲存設定
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SetupDialog;
