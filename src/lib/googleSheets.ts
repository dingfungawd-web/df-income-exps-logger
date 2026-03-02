import { RevenueRecord, ExpenseRecord, StaffUser, ClaimRecord, HandoverRecord } from '@/types/record';

const SCRIPT_URL_KEY = 'google_apps_script_url';
const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxnLcrNBqKHBPjWoXSChCUen4OC4KuXW0Xno2KzHf3YBAc5YkUxtZfScGbR-yO9Pd1W/exec';

function normalizeScriptUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return DEFAULT_SCRIPT_URL;

  try {
    const parsed = new URL(trimmed);
    parsed.search = '';
    parsed.hash = '';
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    return parsed.toString();
  } catch {
    return DEFAULT_SCRIPT_URL;
  }
}

function buildScriptActionUrl(action: string): string {
  const parsed = new URL(getScriptUrl());
  parsed.searchParams.set('action', action);
  return parsed.toString();
}

export function getScriptUrl(): string {
  const stored = localStorage.getItem(SCRIPT_URL_KEY);
  if (!stored) return DEFAULT_SCRIPT_URL;

  const normalizedStored = normalizeScriptUrl(stored);
  if (normalizedStored !== stored) {
    localStorage.setItem(SCRIPT_URL_KEY, normalizedStored);
  }

  return normalizedStored;
}

export function setScriptUrl(url: string): void {
  localStorage.setItem(SCRIPT_URL_KEY, normalizeScriptUrl(url));
}

// ─── Revenue ───
export async function fetchRecords(): Promise<RevenueRecord[]> {
  const res = await fetch(buildScriptActionUrl('getAll'), { redirect: 'follow' });
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
  const res = await fetch(buildScriptActionUrl('getHandoverHistory'), { redirect: 'follow' });
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
  const [hkdRes, rmbRes] = await Promise.all([
    fetch(buildScriptActionUrl('getExpenses'), { redirect: 'follow' }),
    fetch(buildScriptActionUrl('getExpensesRMB'), { redirect: 'follow' }),
  ]);
  if (!hkdRes.ok) throw new Error('無法讀取支出資料');
  const hkdData = await hkdRes.json();
  const hkdRecords: ExpenseRecord[] = (hkdData.records || []).map((r: any) => ({ ...r, currency: 'HKD' as const }));

  let rmbRecords: ExpenseRecord[] = [];
  if (rmbRes.ok) {
    const rmbData = await rmbRes.json();
    rmbRecords = (rmbData.records || []).map((r: any) => ({ ...r, currency: 'RMB' as const }));
  }

  return [...hkdRecords, ...rmbRecords];
}

export async function submitExpense(record: Omit<ExpenseRecord, 'id' | 'claimed' | 'claimDate' | 'claimAmount'>): Promise<void> {
  const action = record.currency === 'RMB' ? 'addExpenseRMB' : 'addExpense';
  const url = getScriptUrl();
  const res = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({ action, ...record }),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error('提交支出失敗');
}

export async function updateExpense(record: ExpenseRecord): Promise<void> {
  const action = record.currency === 'RMB' ? 'updateExpenseRMB' : 'updateExpense';
  const url = getScriptUrl();
  const res = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({ action, ...record }),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error('更新支出失敗');
}

// ─── Claim ───
export async function claimExpenses(expenseIds: string[], staff: string, totalAmount: number, currency: 'HKD' | 'RMB' = 'HKD'): Promise<void> {
  const action = currency === 'RMB' ? 'claimExpensesRMB' : 'claimExpenses';
  const url = getScriptUrl();
  const res = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({ action, expenseIds, staff, totalAmount }),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error('Claim 失敗');
}

export async function fetchClaimHistory(): Promise<ClaimRecord[]> {
  const res = await fetch(buildScriptActionUrl('getClaimHistory'), { redirect: 'follow' });
  if (!res.ok) throw new Error('無法讀取 Claim 記錄');
  const data = await res.json();
  return data.records || [];
}

// ─── Clear All Records ───
export async function clearAllRecords(): Promise<{ success: boolean; message: string }> {
  const url = getScriptUrl();
  const res = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({ action: 'clearAllRecords' }),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error('清除記錄失敗');
  return res.json();
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
  const res = await fetch(buildScriptActionUrl('getAllUsers'), { redirect: 'follow' });
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
// 1. "收入"           - ID, Case ID, 日期, 部門, 收入類別, 金額, 收款方式, 同事, 已交數, 交數日期
// 2. "支出"           - ID, 日期, 部門, 同事, 支出類別, 支出備註, 金額, 已Claim, Claim日期, Claim金額
// 3. "支出(人民幣)"   - ID, 日期, 部門, 同事, 支出類別, 支出備註, 金額, 已Claim, Claim日期, Claim金額
// 4. "用戶"           - 姓名, 密碼
// 5. "Claim記錄"      - ID, 同事, Claim日期, 總金額, 支出ID列表
// 6. "交數記錄"       - ID, 同事, 交數日期, 金額, 收入ID

function getSheet(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (name === '收入') {
      sheet.appendRow(['ID', 'Case ID', '日期', '部門', '收入類別', '金額', '收款方式', '同事', '已交數', '交數日期']);
    } else if (name === '支出' || name === '支出(人民幣)') {
      sheet.appendRow(['ID', '日期', '部門', '同事', '支出類別', '支出備註', '金額', '已Claim', 'Claim日期', 'Claim金額']);
    } else if (name === '用戶') {
      sheet.appendRow(['姓名', '密碼']);
    } else if (name === 'Claim記錄') {
      sheet.appendRow(['ID', '同事', 'Claim日期', '總金額', '支出ID列表']);
    } else if (name === '交數記錄') {
      sheet.appendRow(['ID', '同事', '交數日期', '金額', '收入ID']);
    }
  }
  return sheet;
}

// Helper to read expense records from a sheet
function readExpenseRecords(sheetName) {
  var sheet = getSheet(sheetName);
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
      remarks: data[i][5] || '',
      amount: data[i][6],
      claimed: data[i][7] === true || data[i][7] === 'TRUE' || data[i][7] === 'true',
      claimDate: data[i][8] || '',
      claimAmount: data[i][9] || 0
    });
  }
  return records;
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
        caseId: data[i][1] || '',
        date: data[i][2],
        department: data[i][3],
        category: data[i][4] || '',
        amount: data[i][5],
        paymentMethod: data[i][6],
        staff: data[i][7] || '',
        handed: data[i][8] === true || data[i][8] === 'TRUE' || data[i][8] === 'true',
        handoverDate: data[i][9] || ''
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
        remarks: data[i][5] || '',
        amount: data[i][6],
        claimed: data[i][7] === true || data[i][7] === 'TRUE' || data[i][7] === 'true',
        claimDate: data[i][8] || '',
        claimAmount: data[i][9] || 0
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
    var isAdmin = (data.staff === 'admin');
    var needHandover = !isAdmin && (data.paymentMethod === '現金' || data.paymentMethod === '支票');
    sheet.appendRow([id, data.caseId || '', data.date, data.department, data.category || '', data.amount, data.paymentMethod, data.staff, needHandover ? false : '', needHandover ? '' : '']);
    return ContentService.createTextOutput(JSON.stringify({ success: true, id: id }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (data.action === 'update') {
    var sheet = getSheet('收入');
    var allData = sheet.getDataRange().getValues();
    for (var i = 1; i < allData.length; i++) {
      if (allData[i][0] === data.id) {
        sheet.getRange(i + 1, 2).setValue(data.caseId || '');
        sheet.getRange(i + 1, 3).setValue(data.date);
        sheet.getRange(i + 1, 4).setValue(data.department);
        sheet.getRange(i + 1, 5).setValue(data.category || '');
        sheet.getRange(i + 1, 6).setValue(data.amount);
        sheet.getRange(i + 1, 7).setValue(data.paymentMethod);
        sheet.getRange(i + 1, 8).setValue(data.staff);
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
    var isAdmin = (data.staff === 'admin');
    if (isAdmin) {
      sheet.appendRow([id, data.date, data.department, data.staff, data.category, data.remarks || '', data.amount, '', '', '']);
    } else {
      sheet.appendRow([id, data.date, data.department, data.staff, data.category, data.remarks || '', data.amount, false, '', 0]);
    }
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
        sheet.getRange(i + 1, 6).setValue(data.remarks || '');
        sheet.getRange(i + 1, 7).setValue(data.amount);
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
        expSheet.getRange(i + 1, 8).setValue(true);
        expSheet.getRange(i + 1, 9).setValue(claimDate);
        expSheet.getRange(i + 1, 10).setValue(allData[i][6]);
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
    var hoDate = Utilities.formatDate(new Date(), 'Asia/Hong_Kong', 'yyyy-MM-dd');
    var revenueIds = data.revenueIds;

    var allData = revSheet.getDataRange().getValues();
    for (var i = 1; i < allData.length; i++) {
      if (revenueIds.indexOf(allData[i][0]) > -1) {
        revSheet.getRange(i + 1, 9).setValue(true);
        revSheet.getRange(i + 1, 10).setValue(hoDate);
        // 每筆收入獨立寫入交數記錄
        var hoId = Utilities.getUuid();
        hoSheet.appendRow([hoId, data.staff, hoDate, allData[i][5], allData[i][0]]);
      }
    }

    return ContentService.createTextOutput(JSON.stringify({ success: true }))
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

  // ─── 清除所有收入及支出記錄 ───
  if (data.action === 'clearAllRecords') {
    var sheets = ['收入', '支出', 'Claim記錄', '交數記錄'];
    for (var s = 0; s < sheets.length; s++) {
      var sheet = getSheet(sheets[s]);
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ success: true, message: '已清除所有收入及支出記錄' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({ error: '未知操作' }))
    .setMimeType(ContentService.MimeType.JSON);
}
`;
