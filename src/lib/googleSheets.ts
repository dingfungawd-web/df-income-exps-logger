import { RevenueRecord } from '@/types/record';

const SCRIPT_URL_KEY = 'google_apps_script_url';

export function getScriptUrl(): string | null {
  return localStorage.getItem(SCRIPT_URL_KEY);
}

export function setScriptUrl(url: string): void {
  localStorage.setItem(SCRIPT_URL_KEY, url);
}

export async function fetchRecords(): Promise<RevenueRecord[]> {
  const url = getScriptUrl();
  if (!url) throw new Error('請先設定 Google Apps Script 網址');

  const res = await fetch(`${url}?action=getAll`);
  if (!res.ok) throw new Error('無法讀取資料');
  const data = await res.json();
  return data.records || [];
}

export async function submitRecord(record: Omit<RevenueRecord, 'id'>): Promise<void> {
  const url = getScriptUrl();
  if (!url) throw new Error('請先設定 Google Apps Script 網址');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'add', ...record }),
  });
  if (!res.ok) throw new Error('提交失敗');
}

export async function updateRecord(record: RevenueRecord): Promise<void> {
  const url = getScriptUrl();
  if (!url) throw new Error('請先設定 Google Apps Script 網址');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'update', ...record }),
  });
  if (!res.ok) throw new Error('更新失敗');
}

export const APPS_SCRIPT_CODE = `
// 請將此程式碼貼到 Google Apps Script 編輯器中
// 然後部署為網路應用程式（Deploy > New deployment > Web app）
// 存取權限設為「所有人」

function doGet(e) {
  var action = e.parameter.action;
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  if (action === 'getAll') {
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var records = [];
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === '') continue;
      records.push({
        id: data[i][0],
        date: data[i][1],
        department: data[i][2],
        amount: data[i][3],
        paymentMethod: data[i][4],
        staff: data[i][5] || ''
      });
    }
    
    return ContentService.createTextOutput(JSON.stringify({ records: records }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);
  
  if (data.action === 'add') {
    var id = Utilities.getUuid();
    sheet.appendRow([id, data.date, data.department, data.amount, data.paymentMethod, data.staff]);
    return ContentService.createTextOutput(JSON.stringify({ success: true, id: id }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  if (data.action === 'update') {
    var allData = sheet.getDataRange().getValues();
    for (var i = 1; i < allData.length; i++) {
      if (allData[i][0] === data.id) {
        sheet.getRange(i + 1, 2).setValue(data.date);
        sheet.getRange(i + 1, 3).setValue(data.department);
        sheet.getRange(i + 1, 4).setValue(data.amount);
        sheet.getRange(i + 1, 5).setValue(data.paymentMethod);
        break;
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
`;
