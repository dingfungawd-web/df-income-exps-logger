import { RevenueRecord, ExpenseRecord, StaffUser, ClaimRecord, HandoverRecord } from '@/types/record';

const SCRIPT_URL_KEY = 'google_apps_script_url';
const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxihZB0WtALeaE7Fm_g72B9FW3dbKVblRX8S-S-ak2Lnd2Y9szCZjmEH9p2YhWosF1X/exec';

export function getScriptUrl(): string {
  const stored = localStorage.getItem(SCRIPT_URL_KEY);
  // If stored URL differs from default, clear it to use latest default
  if (stored && stored !== DEFAULT_SCRIPT_URL) {
    localStorage.removeItem(SCRIPT_URL_KEY);
  }
  return DEFAULT_SCRIPT_URL;
}

export function setScriptUrl(url: string): void {
  localStorage.setItem(SCRIPT_URL_KEY, url);
}

// ─── Revenue ───
export async function fetchRecords(): Promise<RevenueRecord[]> {
  const url = getScriptUrl();
  const res = await fetch(`${url}?action=getAll`, { redirect: 'follow' });
  if (!res.ok) throw new Error('無法讀取資料');
  const data = await res.json();
  return data.records || [];
}

export async function submitRecord(record: Omit<RevenueRecord, 'id'>): Promise<void> {
  const url = getScriptUrl();
  const res = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({ action: 'add', ...record }),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error('提交失敗');
}

export async function updateRecord(record: RevenueRecord): Promise<void> {
  const url = getScriptUrl();
  const res = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({ action: 'update', ...record }),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error('更新失敗');
}

// ─── Handover 交數 ───
export async function fetchHandoverHistory(): Promise<HandoverRecord[]> {
  const url = getScriptUrl();
  const res = await fetch(`${url}?action=getHandoverHistory`, { redirect: 'follow' });
  if (!res.ok) throw new Error('無法讀取交數記錄');
  const data = await res.json();
  return data.records || [];
}

export async function confirmHandover(revenueIds: string[], staff: string, totalAmount: number): Promise<void> {
  const url = getScriptUrl();
  const res = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({ action: 'confirmHandover', revenueIds, staff, totalAmount }),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error('交數確認失敗');
}

// ─── Expenses ───
export async function fetchExpenses(): Promise<ExpenseRecord[]> {
  const url = getScriptUrl();
  const res = await fetch(`${url}?action=getExpenses`, { redirect: 'follow' });
  if (!res.ok) throw new Error('無法讀取支出資料');
  const data = await res.json();
  return data.records || [];
}

export async function submitExpense(record: Omit<ExpenseRecord, 'id' | 'claimed' | 'claimDate' | 'claimAmount'>): Promise<void> {
  const url = getScriptUrl();
  const res = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({ action: 'addExpense', ...record }),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error('提交支出失敗');
}

export async function updateExpense(record: ExpenseRecord): Promise<void> {
  const url = getScriptUrl();
  const res = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({ action: 'updateExpense', ...record }),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error('更新支出失敗');
}

// ─── Claim ───
export async function claimExpenses(expenseIds: string[], staff: string, totalAmount: number): Promise<void> {
  const url = getScriptUrl();
  const res = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({ action: 'claimExpenses', expenseIds, staff, totalAmount }),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error('Claim 失敗');
}

export async function fetchClaimHistory(): Promise<ClaimRecord[]> {
  const url = getScriptUrl();
  const res = await fetch(`${url}?action=getClaimHistory`, { redirect: 'follow' });
  if (!res.ok) throw new Error('無法讀取 Claim 記錄');
  const data = await res.json();
  return data.records || [];
}

// ─── Auth ───
export async function loginUser(name: string, password: string): Promise<{ success: boolean; message: string }> {
  const url = getScriptUrl();
  const res = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({ action: 'login', name, password }),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error('登入失敗');
  return res.json();
}

export async function registerUser(name: string, password: string): Promise<{ success: boolean; message: string }> {
  const url = getScriptUrl();
  const res = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({ action: 'register', name, password }),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error('註冊失敗');
  return res.json();
}

export async function fetchAllUsers(): Promise<StaffUser[]> {
  const url = getScriptUrl();
  const res = await fetch(`${url}?action=getAllUsers`, { redirect: 'follow' });
  if (!res.ok) throw new Error('無法讀取用戶資料');
  const data = await res.json();
  return data.users || [];
}

export async function deleteUser(name: string): Promise<{ success: boolean; message: string }> {
  const url = getScriptUrl();
  const res = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({ action: 'deleteUser', name }),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error('刪除用戶失敗');
  return res.json();
}

export const APPS_SCRIPT_CODE = `
// ====== DF創意家居 - Google Apps Script ======
// 部署為網路應用程式（Deploy > New deployment > Web app）
// 存取權限設為「所有人」
//
// 需要以下 Sheet 分頁（首次請求時自動建立）:
// 1. "收入"       - ID, 日期, 部門, 金額, 收款方式, 同事, 已交數, 交數日期
// 2. "支出"       - ID, 日期, 部門, 同事, 支出類別, 金額, 已Claim, Claim日期, Claim金額
// 3. "用戶"       - 姓名, 密碼
// 4. "Claim記錄"  - ID, 同事, Claim日期, 總金額, 支出ID列表
// 5. "交數記錄"   - ID, 同事, 交數日期, 總金額, 收入ID列表

function getSheet(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (name === '收入') {
      sheet.appendRow(['ID', '日期', '部門', '金額', '收款方式', '同事', '已交數', '交數日期']);
    } else if (name === '支出') {
      sheet.appendRow(['ID', '日期', '部門', '同事', '支出類別', '金額', '已Claim', 'Claim日期', 'Claim金額']);
    } else if (name === '用戶') {
      sheet.appendRow(['姓名', '密碼']);
    } else if (name === 'Claim記錄') {
      sheet.appendRow(['ID', '同事', 'Claim日期', '總金額', '支出ID列表']);
    } else if (name === '交數記錄') {
      sheet.appendRow(['ID', '同事', '交數日期', '總金額', '收入ID列表']);
    }
  }
  return sheet;
}

function doGet(e) {
  var action = e.parameter.action;

  if (action === 'getAll') {
    var sheet = getSheet('收入');
    var data = sheet.getDataRange().getValues();
    var records = [];
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === '') continue;
      records.push({
        id: data[i][0],
        date: data[i][1],
        department: data[i][2],
        amount: data[i][3],
        paymentMethod: data[i][4],
        staff: data[i][5] || '',
        handed: data[i][6] === true || data[i][6] === 'TRUE' || data[i][6] === 'true',
        handoverDate: data[i][7] || ''
      });
    }
    return ContentService.createTextOutput(JSON.stringify({ records: records }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'getExpenses') {
    var sheet = getSheet('支出');
    var data = sheet.getDataRange().getValues();
    var records = [];
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === '') continue;
      records.push({
        id: data[i][0],
        date: data[i][1],
        department: data[i][2],
        staff: data[i][3],
        category: data[i][4],
        amount: data[i][5],
        claimed: data[i][6] === true || data[i][6] === 'TRUE' || data[i][6] === 'true',
        claimDate: data[i][7] || '',
        claimAmount: data[i][8] || 0
      });
    }
    return ContentService.createTextOutput(JSON.stringify({ records: records }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'getClaimHistory') {
    var sheet = getSheet('Claim記錄');
    var data = sheet.getDataRange().getValues();
    var records = [];
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === '') continue;
      records.push({
        id: data[i][0],
        staff: data[i][1],
        claimDate: data[i][2],
        totalAmount: data[i][3],
        expenseIds: data[i][4]
      });
    }
    return ContentService.createTextOutput(JSON.stringify({ records: records }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'getHandoverHistory') {
    var sheet = getSheet('交數記錄');
    var data = sheet.getDataRange().getValues();
    var records = [];
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === '') continue;
      records.push({
        id: data[i][0],
        staff: data[i][1],
        handoverDate: data[i][2],
        totalAmount: data[i][3],
        revenueIds: data[i][4]
      });
    }
    return ContentService.createTextOutput(JSON.stringify({ records: records }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'getAllUsers') {
    var sheet = getSheet('用戶');
    var data = sheet.getDataRange().getValues();
    var users = [];
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === '') continue;
      users.push({ name: String(data[i][0]), password: String(data[i][1]) });
    }
    return ContentService.createTextOutput(JSON.stringify({ users: users }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({ error: '未知操作' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var data = JSON.parse(e.postData.contents);

  // ─── 收入 ───
  if (data.action === 'add') {
    var sheet = getSheet('收入');
    var id = Utilities.getUuid();
    var needHandover = (data.paymentMethod === '現金' || data.paymentMethod === '支票');
    sheet.appendRow([id, data.date, data.department, data.amount, data.paymentMethod, data.staff, needHandover ? false : '', needHandover ? '' : '']);
    return ContentService.createTextOutput(JSON.stringify({ success: true, id: id }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (data.action === 'update') {
    var sheet = getSheet('收入');
    var allData = sheet.getDataRange().getValues();
    for (var i = 1; i < allData.length; i++) {
      if (allData[i][0] === data.id) {
        sheet.getRange(i + 1, 2).setValue(data.date);
        sheet.getRange(i + 1, 3).setValue(data.department);
        sheet.getRange(i + 1, 4).setValue(data.amount);
        sheet.getRange(i + 1, 5).setValue(data.paymentMethod);
        sheet.getRange(i + 1, 6).setValue(data.staff);
        break;
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ─── 支出 ───
  if (data.action === 'addExpense') {
    var sheet = getSheet('支出');
    var id = Utilities.getUuid();
    sheet.appendRow([id, data.date, data.department, data.staff, data.category, data.amount, false, '', 0]);
    return ContentService.createTextOutput(JSON.stringify({ success: true, id: id }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (data.action === 'updateExpense') {
    var sheet = getSheet('支出');
    var allData = sheet.getDataRange().getValues();
    for (var i = 1; i < allData.length; i++) {
      if (allData[i][0] === data.id) {
        sheet.getRange(i + 1, 2).setValue(data.date);
        sheet.getRange(i + 1, 3).setValue(data.department);
        sheet.getRange(i + 1, 4).setValue(data.staff);
        sheet.getRange(i + 1, 5).setValue(data.category);
        sheet.getRange(i + 1, 6).setValue(data.amount);
        break;
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ─── Claim 報銷 ───
  if (data.action === 'claimExpenses') {
    var expSheet = getSheet('支出');
    var claimSheet = getSheet('Claim記錄');
    var claimId = Utilities.getUuid();
    var claimDate = Utilities.formatDate(new Date(), 'Asia/Hong_Kong', 'yyyy-MM-dd');
    var expenseIds = data.expenseIds;

    var allData = expSheet.getDataRange().getValues();
    for (var i = 1; i < allData.length; i++) {
      if (expenseIds.indexOf(allData[i][0]) > -1) {
        expSheet.getRange(i + 1, 7).setValue(true);
        expSheet.getRange(i + 1, 8).setValue(claimDate);
        expSheet.getRange(i + 1, 9).setValue(allData[i][5]);
      }
    }

    claimSheet.appendRow([claimId, data.staff, claimDate, data.totalAmount, expenseIds.join(',')]);

    return ContentService.createTextOutput(JSON.stringify({ success: true, id: claimId }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ─── 交數確認 ───
  if (data.action === 'confirmHandover') {
    var revSheet = getSheet('收入');
    var hoSheet = getSheet('交數記錄');
    var hoId = Utilities.getUuid();
    var hoDate = Utilities.formatDate(new Date(), 'Asia/Hong_Kong', 'yyyy-MM-dd');
    var revenueIds = data.revenueIds;

    var allData = revSheet.getDataRange().getValues();
    for (var i = 1; i < allData.length; i++) {
      if (revenueIds.indexOf(allData[i][0]) > -1) {
        revSheet.getRange(i + 1, 7).setValue(true);
        revSheet.getRange(i + 1, 8).setValue(hoDate);
      }
    }

    hoSheet.appendRow([hoId, data.staff, hoDate, data.totalAmount, revenueIds.join(',')]);

    return ContentService.createTextOutput(JSON.stringify({ success: true, id: hoId }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ─── 登入 ───
  if (data.action === 'login') {
    if (data.name === 'admin' && String(data.password) === '20170402') {
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: 'admin' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var sheet = getSheet('用戶');
    var allData = sheet.getDataRange().getValues();
    for (var i = 1; i < allData.length; i++) {
      if (String(allData[i][0]) === String(data.name)) {
        if (String(allData[i][1]) === String(data.password)) {
          return ContentService.createTextOutput(JSON.stringify({ success: true, message: 'ok' }))
            .setMimeType(ContentService.MimeType.JSON);
        } else {
          return ContentService.createTextOutput(JSON.stringify({ success: false, message: '密碼錯誤' }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: '用戶不存在，請先註冊' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ─── 註冊 ───
  if (data.action === 'register') {
    var sheet = getSheet('用戶');
    var allData = sheet.getDataRange().getValues();
    for (var i = 1; i < allData.length; i++) {
      if (String(allData[i][0]) === String(data.name)) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, message: '此名稱已註冊' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    sheet.appendRow([data.name, String(data.password)]);
    return ContentService.createTextOutput(JSON.stringify({ success: true, message: '註冊成功' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ─── 刪除用戶 ───
  if (data.action === 'deleteUser') {
    var sheet = getSheet('用戶');
    var allData = sheet.getDataRange().getValues();
    for (var i = 1; i < allData.length; i++) {
      if (String(allData[i][0]) === String(data.name)) {
        sheet.deleteRow(i + 1);
        return ContentService.createTextOutput(JSON.stringify({ success: true, message: '已刪除用戶' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: '找不到此用戶' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({ error: '未知操作' }))
    .setMimeType(ContentService.MimeType.JSON);
}
`;
