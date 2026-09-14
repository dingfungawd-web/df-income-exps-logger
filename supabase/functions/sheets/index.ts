// DF創意家居 — Google Sheet 直接讀寫（透過 Lovable 連接器閘道）
const SPREADSHEET_ID = '1OyVFhHCa4WofhGsaDc2vcPmP26Q1ZlAwxnc7eP8lTtA';
const GATEWAY = 'https://connector-gateway.lovable.dev/google_sheets/v4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const SHEET = {
  revenue: '收入',
  expense: '支出',
  expenseRMB: '支出(人民幣)',
  users: '用戶',
  claim: 'Claim記錄',
  claimRMB: 'Claim記錄(人民幣)',
  handover: '交數記錄',
};

function authHeaders() {
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');
  const connKey = Deno.env.get('GOOGLE_SHEETS_API_KEY');
  if (!lovableKey || !connKey) throw new Error('Google Sheet 連接未設定');
  return {
    Authorization: `Bearer ${lovableKey}`,
    'X-Connection-Api-Key': connKey,
    'Content-Type': 'application/json',
  };
}

function enc(range: string) {
  return encodeURIComponent(range).replace(/%3A/g, ':');
}

async function gw(path: string, init: RequestInit = {}) {
  const res = await fetch(`${GATEWAY}${path}`, { ...init, headers: authHeaders() });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Sheets gateway ${res.status}: ${body}`);
    throw new Error(`Google Sheet 請求失敗 (${res.status})`);
  }
  return await res.json();
}

async function getValues(sheet: string, span = 'A2:J'): Promise<string[][]> {
  const data = await gw(`/spreadsheets/${SPREADSHEET_ID}/values/${enc(`'${sheet}'!${span}`)}`);
  return (data.values || []) as string[][];
}

async function batchGet(ranges: string[]): Promise<Record<string, string[][]>> {
  const qs = ranges.map((r) => `ranges=${enc(`'${r}'`)}`).join('&');
  const data = await gw(`/spreadsheets/${SPREADSHEET_ID}/values:batchGet?${qs}`);
  const out: Record<string, string[][]> = {};
  ranges.forEach((r, i) => {
    out[r] = (data.valueRanges?.[i]?.values || []) as string[][];
  });
  return out;
}

async function append(sheet: string, rows: unknown[][]) {
  await gw(
    `/spreadsheets/${SPREADSHEET_ID}/values/${enc(`'${sheet}'!A1`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { method: 'POST', body: JSON.stringify({ values: rows }) },
  );
}

async function setRange(range: string, values: unknown[][]) {
  await gw(`/spreadsheets/${SPREADSHEET_ID}/values/${enc(range)}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    body: JSON.stringify({ values }),
  });
}

async function batchUpdateValues(data: { range: string; values: unknown[][] }[]) {
  if (!data.length) return;
  await gw(`/spreadsheets/${SPREADSHEET_ID}/values:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data }),
  });
}

let sheetIdCache: Record<string, number> | null = null;
async function sheetId(title: string): Promise<number> {
  if (!sheetIdCache) {
    const meta = await gw(`/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties`);
    sheetIdCache = {};
    for (const s of meta.sheets || []) sheetIdCache[s.properties.title] = s.properties.sheetId;
  }
  const id = sheetIdCache[title];
  if (id === undefined) throw new Error(`找不到分頁 ${title}`);
  return id;
}

async function deleteRowAt(sheet: string, rowIndex: number) {
  await gw(`/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: { sheetId: await sheetId(sheet), dimension: 'ROWS', startIndex: rowIndex, endIndex: rowIndex + 1 },
          },
        },
      ],
    }),
  });
}

const num = (v: unknown) => (v === '' || v === null || v === undefined ? 0 : Number(v) || 0);
const bool = (v: unknown) => v === true || String(v).toUpperCase() === 'TRUE';
const hkDate = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
const colLetter = (n: number) => String.fromCharCode(64 + n);

function mapRevenue(rows: string[][]) {
  return rows
    .filter((r) => r[0])
    .map((r) => ({
      id: r[0],
      caseId: r[1] || '',
      date: r[2],
      department: r[3],
      category: r[4] || '',
      amount: num(r[5]),
      paymentMethod: r[6],
      staff: r[7] || '',
      handed: bool(r[8]),
      handoverDate: r[9] || '',
    }));
}

function mapExpense(rows: string[][]) {
  return rows
    .filter((r) => r[0])
    .map((r) => ({
      id: r[0],
      date: r[1],
      department: r[2],
      staff: r[3],
      category: r[4],
      remarks: r[5] || '',
      amount: num(r[6]),
      claimed: bool(r[7]),
      claimDate: r[8] || '',
      claimAmount: num(r[9]),
    }));
}

function mapClaim(rows: string[][]) {
  return rows
    .filter((r) => r[0])
    .map((r) => ({ id: r[0], staff: r[1], claimDate: r[2], totalAmount: num(r[3]), expenseIds: r[4] || '' }));
}

function mapHandover(rows: string[][]) {
  return rows
    .filter((r) => r[0])
    .map((r) => ({ id: r[0], staff: r[1], handoverDate: r[2], totalAmount: num(r[3]), revenueIds: r[4] || '' }));
}

// 逐欄更新指定 ID 所在的一行
async function updateRowById(sheet: string, id: string, startCol: number, values: unknown[]) {
  const rows = await getValues(sheet, 'A2:A');
  const idx = rows.findIndex((r) => String(r[0]) === String(id));
  if (idx === -1) return false;
  const rowNo = idx + 2;
  const endCol = startCol + values.length - 1;
  await setRange(`'${sheet}'!${colLetter(startCol)}${rowNo}:${colLetter(endCol)}${rowNo}`, [values]);
  return true;
}

async function deleteById(sheet: string, id: string) {
  const rows = await getValues(sheet, 'A2:A');
  const idx = rows.findIndex((r) => String(r[0]) === String(id));
  if (idx === -1) return false;
  await deleteRowAt(sheet, idx + 1);
  return true;
}

function needsHandover(staff: string, department: string, paymentMethod: string) {
  return staff !== 'admin' && department !== '老闆' && (paymentMethod === '現金' || paymentMethod === '支票');
}

async function handle(action: string, d: Record<string, any>): Promise<unknown> {
  switch (action) {
    // ── 讀取 ──
    case 'getAll':
      return { records: mapRevenue(await getValues(SHEET.revenue)) };
    case 'getExpenses':
      return { records: mapExpense(await getValues(SHEET.expense)) };
    case 'getExpensesRMB':
      return { records: mapExpense(await getValues(SHEET.expenseRMB)) };
    case 'getClaimHistory':
      return { records: mapClaim(await getValues(SHEET.claim, 'A2:E')) };
    case 'getClaimHistoryRMB':
      return { records: mapClaim(await getValues(SHEET.claimRMB, 'A2:E')) };
    case 'getHandoverHistory':
      return { records: mapHandover(await getValues(SHEET.handover, 'A2:E')) };
    case 'getAllUsers':
      return {
        users: (await getValues(SHEET.users, 'A2:B'))
          .filter((r) => r[0])
          .map((r) => ({ name: String(r[0]), password: String(r[1] ?? '') })),
      };

    // ── 收入 ──
    case 'add': {
      const id = crypto.randomUUID();
      const nh = needsHandover(d.staff, d.department, d.paymentMethod);
      await append(SHEET.revenue, [
        [id, d.caseId || '', d.date, d.department, d.category || '', d.amount, d.paymentMethod, d.staff, nh ? 'FALSE' : '', ''],
      ]);
      return { success: true, id };
    }
    case 'update': {
      const nh = needsHandover(d.staff, d.department, d.paymentMethod);
      const rows = await getValues(SHEET.revenue);
      const idx = rows.findIndex((r) => String(r[0]) === String(d.id));
      if (idx === -1) return { success: false, message: '找不到此記錄' };
      const rowNo = idx + 2;
      const wasHanded = bool(rows[idx][8]);
      await setRange(`'${SHEET.revenue}'!B${rowNo}:J${rowNo}`, [
        [
          d.caseId || '',
          d.date,
          d.department,
          d.category || '',
          d.amount,
          d.paymentMethod,
          d.staff,
          nh ? (wasHanded ? 'TRUE' : 'FALSE') : '',
          nh ? rows[idx][9] || '' : '',
        ],
      ]);
      return { success: true };
    }
    case 'deleteRecord':
      return (await deleteById(SHEET.revenue, d.id)) ? { success: true } : { success: false, message: '找不到此記錄' };

    // ── 支出 ──
    case 'addExpense':
    case 'addExpenseRMB': {
      const sheet = action === 'addExpenseRMB' ? SHEET.expenseRMB : SHEET.expense;
      const id = crypto.randomUUID();
      const noClaim = d.staff === 'admin' || d.department === '老闆';
      await append(sheet, [
        [id, d.date, d.department, d.staff, d.category, d.remarks || '', d.amount, noClaim ? '' : 'FALSE', '', noClaim ? '' : 0],
      ]);
      return { success: true, id };
    }
    case 'updateExpense':
    case 'updateExpenseRMB': {
      const sheet = action === 'updateExpenseRMB' ? SHEET.expenseRMB : SHEET.expense;
      const ok = await updateRowById(sheet, d.id, 2, [d.date, d.department, d.staff, d.category, d.remarks || '', d.amount]);
      return ok ? { success: true } : { success: false, message: '找不到此記錄' };
    }
    case 'deleteExpense':
    case 'deleteExpenseRMB': {
      const sheet = action === 'deleteExpenseRMB' ? SHEET.expenseRMB : SHEET.expense;
      return (await deleteById(sheet, d.id)) ? { success: true } : { success: false, message: '找不到此記錄' };
    }

    // ── Claim ──
    case 'claimExpenses':
    case 'claimExpensesRMB': {
      const rmb = action === 'claimExpensesRMB';
      const expSheet = rmb ? SHEET.expenseRMB : SHEET.expense;
      const claimSheet = rmb ? SHEET.claimRMB : SHEET.claim;
      const ids = new Set((d.expenseIds || []).map(String));
      const rows = await getValues(expSheet);
      const claimDate = hkDate();
      const updates: { range: string; values: unknown[][] }[] = [];
      rows.forEach((r, i) => {
        if (ids.has(String(r[0]))) {
          const rowNo = i + 2;
          updates.push({ range: `'${expSheet}'!H${rowNo}:J${rowNo}`, values: [['TRUE', claimDate, num(r[6])]] });
        }
      });
      await batchUpdateValues(updates);
      const claimId = crypto.randomUUID();
      await append(claimSheet, [[claimId, d.staff, claimDate, d.totalAmount, [...ids].join(',')]]);
      return { success: true, id: claimId };
    }
    case 'deleteClaimRecord':
    case 'deleteClaimRecordRMB': {
      const rmb = action === 'deleteClaimRecordRMB';
      const expSheet = rmb ? SHEET.expenseRMB : SHEET.expense;
      const claimSheet = rmb ? SHEET.claimRMB : SHEET.claim;
      const claimRows = await getValues(claimSheet, 'A2:E');
      const idx = claimRows.findIndex((r) => String(r[0]) === String(d.id));
      if (idx === -1) return { success: false, message: '找不到此 Claim 記錄' };
      const expIds = new Set(String(claimRows[idx][4] || '').split(',').map((s) => s.trim()));
      const expRows = await getValues(expSheet, 'A2:A');
      const updates: { range: string; values: unknown[][] }[] = [];
      expRows.forEach((r, i) => {
        if (expIds.has(String(r[0]))) {
          const rowNo = i + 2;
          updates.push({ range: `'${expSheet}'!H${rowNo}:J${rowNo}`, values: [['FALSE', '', 0]] });
        }
      });
      await batchUpdateValues(updates);
      await deleteRowAt(claimSheet, idx + 1);
      return { success: true };
    }
    case 'updateClaimRecord':
    case 'updateClaimRecordRMB': {
      const sheet = action === 'updateClaimRecordRMB' ? SHEET.claimRMB : SHEET.claim;
      const ok = await updateRowById(sheet, d.id, 2, [d.staff, d.claimDate, d.totalAmount]);
      return ok ? { success: true } : { success: false, message: '找不到此 Claim 記錄' };
    }

    // ── 交數 ──
    case 'confirmHandover': {
      const ids = new Set((d.revenueIds || []).map(String));
      const rows = await getValues(SHEET.revenue);
      const date = hkDate();
      const updates: { range: string; values: unknown[][] }[] = [];
      const newRows: unknown[][] = [];
      rows.forEach((r, i) => {
        if (ids.has(String(r[0]))) {
          const rowNo = i + 2;
          updates.push({ range: `'${SHEET.revenue}'!I${rowNo}:J${rowNo}`, values: [['TRUE', date]] });
          newRows.push([crypto.randomUUID(), d.staff, date, num(r[5]), r[0]]);
        }
      });
      await batchUpdateValues(updates);
      if (newRows.length) await append(SHEET.handover, newRows);
      return { success: true };
    }
    case 'deleteHandoverRecord': {
      const hoRows = await getValues(SHEET.handover, 'A2:E');
      const idx = hoRows.findIndex((r) => String(r[0]) === String(d.id));
      if (idx === -1) return { success: false, message: '找不到此交數記錄' };
      const revIds = new Set(String(hoRows[idx][4] || '').split(',').map((s) => s.trim()));
      const revRows = await getValues(SHEET.revenue, 'A2:A');
      const updates: { range: string; values: unknown[][] }[] = [];
      revRows.forEach((r, i) => {
        if (revIds.has(String(r[0]))) {
          updates.push({ range: `'${SHEET.revenue}'!I${i + 2}:J${i + 2}`, values: [['FALSE', '']] });
        }
      });
      await batchUpdateValues(updates);
      await deleteRowAt(SHEET.handover, idx + 1);
      return { success: true };
    }
    case 'updateHandoverRecord': {
      const ok = await updateRowById(SHEET.handover, d.id, 2, [d.staff, d.handoverDate, d.totalAmount]);
      return ok ? { success: true } : { success: false, message: '找不到此交數記錄' };
    }

    // ── 帳戶 ──
    case 'login': {
      if (String(d.name) === 'admin' && String(d.password) === '20170402') {
        return { success: true, message: 'admin' };
      }
      const rows = await getValues(SHEET.users, 'A2:B');
      const row = rows.find((r) => String(r[0]) === String(d.name));
      if (!row) return { success: false, message: '用戶不存在，請先註冊' };
      return String(row[1] ?? '') === String(d.password)
        ? { success: true, message: 'ok' }
        : { success: false, message: '密碼錯誤' };
    }
    case 'register': {
      const rows = await getValues(SHEET.users, 'A2:B');
      if (rows.some((r) => String(r[0]) === String(d.name))) return { success: false, message: '此名稱已註冊' };
      await append(SHEET.users, [[String(d.name), String(d.password)]]);
      return { success: true, message: '註冊成功' };
    }
    case 'deleteUser': {
      const rows = await getValues(SHEET.users, 'A2:B');
      const idx = rows.findIndex((r) => String(r[0]) === String(d.name));
      if (idx === -1) return { success: false, message: '找不到此用戶' };
      await deleteRowAt(SHEET.users, idx + 1);
      return { success: true, message: '已刪除用戶' };
    }

    default:
      return { success: false, error: '未知操作' };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    let action = '';
    let payload: Record<string, any> = {};
    if (req.method === 'GET') {
      action = new URL(req.url).searchParams.get('action') || '';
    } else {
      payload = await req.json();
      action = String(payload.action || '');
    }
    const result = await handle(action, payload);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知錯誤';
    console.error('sheets function error:', message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
