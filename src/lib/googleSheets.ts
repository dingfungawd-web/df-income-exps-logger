import { RevenueRecord, ExpenseRecord, StaffUser, ClaimRecord, HandoverRecord } from '@/types/record';

const SCRIPT_URL_KEY = 'google_apps_script_url';
const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz50_d-1CTSkeobzxFEKcwAzHc1IWri1p0F3YOl9oy2OHnpcSYrlcTcinEYC8phgDYc/exec';

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

  // Auto-migrate: if stored URL differs from the latest default, update it
  if (normalizedStored !== DEFAULT_SCRIPT_URL) {
    localStorage.setItem(SCRIPT_URL_KEY, DEFAULT_SCRIPT_URL);
    return DEFAULT_SCRIPT_URL;
  }

  if (normalizedStored !== stored) {
    localStorage.setItem(SCRIPT_URL_KEY, normalizedStored);
  }

  return normalizedStored;
}

export function setScriptUrl(url: string): void {
  localStorage.setItem(SCRIPT_URL_KEY, normalizeScriptUrl(url));
}

// Helper for POST requests – Google Apps Script redirects can cause
// `res.ok` to be false even when the write succeeds (CORS on redirect).
// We try to parse the JSON body; if that succeeds with `success:true` we
// treat it as OK.  If the response is opaque we optimistically assume success.
async function postToScript(payload: Record<string, unknown>): Promise<any> {
  const url = getScriptUrl();
  const res = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(payload),
    redirect: 'follow',
  });

  // Opaque responses (e.g. from no-cors fallback) – assume success
  if (res.type === 'opaque') return { success: true };

  try {
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return json;
  } catch {
    if (!res.ok) throw new Error(`請求失敗 (${res.status})`);
    return { success: true };
  }
}

// ─── Revenue ───
export async function fetchRecords(): Promise<RevenueRecord[]> {
  const res = await fetch(buildScriptActionUrl('getAll'), { redirect: 'follow' });
  if (!res.ok) throw new Error('無法讀取資料');
  const data = await res.json();
  return data.records || [];
}

export async function submitRecord(record: Omit<RevenueRecord, 'id'>): Promise<void> {
  await postToScript({ action: 'add', ...record });
}

export async function updateRecord(record: RevenueRecord): Promise<void> {
  await postToScript({ action: 'update', ...record });
}

// ─── Handover 交數 ───
export async function fetchHandoverHistory(): Promise<HandoverRecord[]> {
  const res = await fetch(buildScriptActionUrl('getHandoverHistory'), { redirect: 'follow' });
  if (!res.ok) throw new Error('無法讀取交數記錄');
  const data = await res.json();
  return data.records || [];
}

export async function confirmHandover(revenueIds: string[], staff: string, totalAmount: number): Promise<void> {
  await postToScript({ action: 'confirmHandover', revenueIds, staff, totalAmount });
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
  await postToScript({ action, ...record });
}

export async function updateExpense(record: ExpenseRecord): Promise<void> {
  const action = record.currency === 'RMB' ? 'updateExpenseRMB' : 'updateExpense';
  await postToScript({ action, ...record });
}

export async function deleteRecord(id: string): Promise<void> {
  await postToScript({ action: 'deleteRecord', id });
}

export async function deleteExpense(id: string, currency: 'HKD' | 'RMB' = 'HKD'): Promise<void> {
  const action = currency === 'RMB' ? 'deleteExpenseRMB' : 'deleteExpense';
  await postToScript({ action, id });
}

// ─── Delete Claim Record (reverse claim status) ───
export async function deleteClaimRecord(id: string, currency: 'HKD' | 'RMB' = 'HKD'): Promise<void> {
  const action = currency === 'RMB' ? 'deleteClaimRecordRMB' : 'deleteClaimRecord';
  await postToScript({ action, id });
}

// ─── Delete Handover Record (reverse handover status) ───
export async function deleteHandoverRecord(id: string): Promise<void> {
  await postToScript({ action: 'deleteHandoverRecord', id });
}

// ─── Claim ───
export async function claimExpenses(expenseIds: string[], staff: string, totalAmount: number, currency: 'HKD' | 'RMB' = 'HKD'): Promise<void> {
  const action = currency === 'RMB' ? 'claimExpensesRMB' : 'claimExpenses';
  await postToScript({ action, expenseIds, staff, totalAmount });
}

export async function fetchClaimHistory(): Promise<ClaimRecord[]> {
  const [hkdRes, rmbRes] = await Promise.all([
    fetch(buildScriptActionUrl('getClaimHistory'), { redirect: 'follow' }),
    fetch(buildScriptActionUrl('getClaimHistoryRMB'), { redirect: 'follow' }),
  ]);
  if (!hkdRes.ok) throw new Error('無法讀取 Claim 記錄');
  const hkdData = await hkdRes.json();
  const hkdRecords: ClaimRecord[] = (hkdData.records || []).map((r: any) => ({ ...r, currency: 'HKD' as const }));

  let rmbRecords: ClaimRecord[] = [];
  if (rmbRes.ok) {
    const rmbData = await rmbRes.json();
    rmbRecords = (rmbData.records || []).map((r: any) => ({ ...r, currency: 'RMB' as const }));
  }

  return [...hkdRecords, ...rmbRecords];
}

// ─── Clear All Records ───
export async function clearAllRecords(): Promise<{ success: boolean; message: string }> {
  return await postToScript({ action: 'clearAllRecords' });
}

// ─── Auth ───
export async function loginUser(name: string, password: string): Promise<{ success: boolean; message: string }> {
  return await postToScript({ action: 'login', name, password });
}

export async function registerUser(name: string, password: string): Promise<{ success: boolean; message: string }> {
  return await postToScript({ action: 'register', name, password });
}

export async function fetchAllUsers(): Promise<StaffUser[]> {
  const res = await fetch(buildScriptActionUrl('getAllUsers'), { redirect: 'follow' });
  if (!res.ok) throw new Error('無法讀取用戶資料');
  const data = await res.json();
  return data.users || [];
}

export async function deleteUser(name: string): Promise<{ success: boolean; message: string }> {
  return await postToScript({ action: 'deleteUser', name });
}

export const APPS_SCRIPT_CODE = `
// ====== DF創意家居 - Google Apps Script ======
// 部署為網路應用程式（Deploy > New deployment > Web app）
// 存取權限設為「所有人」
//
// 需要以下 Sheet 分頁（首次請求時自動建立）:
// 1. "收入"              - ID, Case ID, 日期, 部門, 收入類別, 金額, 收款方式, 同事, 已交數, 交數日期
// 2. "支出"              - ID, 日期, 部門, 同事, 支出類別, 支出備註, 金額, 已Claim, Claim日期, Claim金額
// 3. "支出(人民幣)"      - ID, 日期, 部門, 同事, 支出類別, 支出備註, 金額, 已Claim, Claim日期, Claim金額
// 4. "用戶"              - 姓名, 密碼
// 5. "Claim記錄"         - ID, 同事, Claim日期, 總金額, 支出ID列表
// 6. "Claim記錄(人民幣)" - ID, 同事, Claim日期, 總金額, 支出ID列表
// 7. "交數記錄"          - ID, 同事, 交數日期, 金額, 收入ID

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
    } else if (name === 'Claim記錄' || name === 'Claim記錄(人民幣)') {
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

// Helper to read claim records from a sheet
function readClaimRecords(sheetName) {
  var sheet = getSheet(sheetName);
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
    return ContentService.createTextOutput(JSON.stringify({ records: readExpenseRecords('支出') }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'getExpensesRMB') {
    return ContentService.createTextOutput(JSON.stringify({ records: readExpenseRecords('支出(人民幣)') }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'getClaimHistory') {
    return ContentService.createTextOutput(JSON.stringify({ records: readClaimRecords('Claim記錄') }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'getClaimHistoryRMB') {
    return ContentService.createTextOutput(JSON.stringify({ records: readClaimRecords('Claim記錄(人民幣)') }))
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
    var isBoss = (data.department === '老闆');
    var needHandover = !isAdmin && !isBoss && (data.paymentMethod === '現金' || data.paymentMethod === '支票');
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
        // 重新計算是否需要交數
        var isAdmin = (data.staff === 'admin');
        var isBoss = (data.department === '老闆');
        var needHandover = !isAdmin && !isBoss && (data.paymentMethod === '現金' || data.paymentMethod === '支票');
        if (needHandover) {
          // 如果之前未設定交數狀態，設為 false
          var currentHanded = allData[i][8];
          if (currentHanded !== true && currentHanded !== 'TRUE' && currentHanded !== 'true') {
            sheet.getRange(i + 1, 9).setValue(false);
          }
        } else {
          // 唔需要交數：清除已交數及交數日期
          sheet.getRange(i + 1, 9).setValue('');
          sheet.getRange(i + 1, 10).setValue('');
        }
        break;
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ─── 支出 (港幣) ───
  if (data.action === 'addExpense') {
    var sheet = getSheet('支出');
    var id = Utilities.getUuid();
    var isAdmin = (data.staff === 'admin');
    var isBoss = (data.department === '老闆');
    if (isAdmin || isBoss) {
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

  // ─── 支出 (人民幣) ───
  if (data.action === 'addExpenseRMB') {
    var sheet = getSheet('支出(人民幣)');
    var id = Utilities.getUuid();
    var isAdmin = (data.staff === 'admin');
    var isBoss = (data.department === '老闆');
    if (isAdmin || isBoss) {
      sheet.appendRow([id, data.date, data.department, data.staff, data.category, data.remarks || '', data.amount, '', '', '']);
    } else {
      sheet.appendRow([id, data.date, data.department, data.staff, data.category, data.remarks || '', data.amount, false, '', 0]);
    }
    return ContentService.createTextOutput(JSON.stringify({ success: true, id: id }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (data.action === 'updateExpenseRMB') {
    var sheet = getSheet('支出(人民幣)');
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

  // ─── Claim 報銷 (港幣) ───
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

  // ─── Claim 報銷 (人民幣) ───
  if (data.action === 'claimExpensesRMB') {
    var expSheet = getSheet('支出(人民幣)');
    var claimSheet = getSheet('Claim記錄(人民幣)');
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

  // ─── 刪除單筆收入記錄 ───
  if (data.action === 'deleteRecord') {
    var sheet = getSheet('收入');
    var allData = sheet.getDataRange().getValues();
    for (var i = 1; i < allData.length; i++) {
      if (allData[i][0] === data.id) {
        sheet.deleteRow(i + 1);
        return ContentService.createTextOutput(JSON.stringify({ success: true }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: '找不到此記錄' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ─── 刪除單筆支出記錄 (港幣) ───
  if (data.action === 'deleteExpense') {
    var sheet = getSheet('支出');
    var allData = sheet.getDataRange().getValues();
    for (var i = 1; i < allData.length; i++) {
      if (allData[i][0] === data.id) {
        sheet.deleteRow(i + 1);
        return ContentService.createTextOutput(JSON.stringify({ success: true }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: '找不到此記錄' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ─── 刪除單筆支出記錄 (人民幣) ───
  if (data.action === 'deleteExpenseRMB') {
    var sheet = getSheet('支出(人民幣)');
    var allData = sheet.getDataRange().getValues();
    for (var i = 1; i < allData.length; i++) {
      if (allData[i][0] === data.id) {
        sheet.deleteRow(i + 1);
        return ContentService.createTextOutput(JSON.stringify({ success: true }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: '找不到此記錄' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ─── 刪除 Claim 記錄 (港幣) 並還原支出狀態 ───
  if (data.action === 'deleteClaimRecord') {
    var claimSheet = getSheet('Claim記錄');
    var expSheet = getSheet('支出');
    var claimData2 = claimSheet.getDataRange().getValues();
    for (var i = 1; i < claimData2.length; i++) {
      if (claimData2[i][0] === data.id) {
        var expIds = String(claimData2[i][4]).split(',');
        var expData = expSheet.getDataRange().getValues();
        for (var j = 1; j < expData.length; j++) {
          if (expIds.indexOf(String(expData[j][0])) > -1) {
            expSheet.getRange(j + 1, 8).setValue(false);
            expSheet.getRange(j + 1, 9).setValue('');
            expSheet.getRange(j + 1, 10).setValue(0);
          }
        }
        claimSheet.deleteRow(i + 1);
        return ContentService.createTextOutput(JSON.stringify({ success: true }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: '找不到此 Claim 記錄' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ─── 刪除 Claim 記錄 (人民幣) 並還原支出狀態 ───
  if (data.action === 'deleteClaimRecordRMB') {
    var claimSheet = getSheet('Claim記錄(人民幣)');
    var expSheet = getSheet('支出(人民幣)');
    var claimData2 = claimSheet.getDataRange().getValues();
    for (var i = 1; i < claimData2.length; i++) {
      if (claimData2[i][0] === data.id) {
        var expIds = String(claimData2[i][4]).split(',');
        var expData = expSheet.getDataRange().getValues();
        for (var j = 1; j < expData.length; j++) {
          if (expIds.indexOf(String(expData[j][0])) > -1) {
            expSheet.getRange(j + 1, 8).setValue(false);
            expSheet.getRange(j + 1, 9).setValue('');
            expSheet.getRange(j + 1, 10).setValue(0);
          }
        }
        claimSheet.deleteRow(i + 1);
        return ContentService.createTextOutput(JSON.stringify({ success: true }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: '找不到此 Claim 記錄' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ─── 刪除交數記錄並還原收入狀態 ───
  if (data.action === 'deleteHandoverRecord') {
    var hoSheet = getSheet('交數記錄');
    var revSheet = getSheet('收入');
    var hoData = hoSheet.getDataRange().getValues();
    for (var i = 1; i < hoData.length; i++) {
      if (hoData[i][0] === data.id) {
        var revId = String(hoData[i][4]);
        var revData = revSheet.getDataRange().getValues();
        for (var j = 1; j < revData.length; j++) {
          if (String(revData[j][0]) === revId) {
            revSheet.getRange(j + 1, 9).setValue(false);
            revSheet.getRange(j + 1, 10).setValue('');
            break;
          }
        }
        hoSheet.deleteRow(i + 1);
        return ContentService.createTextOutput(JSON.stringify({ success: true }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: '找不到此交數記錄' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ─── 清除所有收入及支出記錄 ───
  if (data.action === 'clearAllRecords') {
    var sheets = ['收入', '支出', '支出(人民幣)', 'Claim記錄', 'Claim記錄(人民幣)', '交數記錄'];
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
