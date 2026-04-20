import type { ExpenseCategory } from '@/types/record';

export interface ParsedTransaction {
  date: string;        // yyyy-MM-dd
  description: string;
  amount: number;
  category: ExpenseCategory;
  remarks: string;
  isCredit: boolean;
}

// Keyword → category mapping for auto-classification
// Keyword → category mapping aligned with EXPENSE_CATEGORIES in types/record.ts
// Categories: 轉介優惠回贈, 八達通增值, Call車, 月租停車場, 時租停車場, 入油, 貨物順豐運費, 度尺工具, 安裝工具, 文具費用, 貨倉飲品, 退款, 賠償, 貨款, 其他
const CATEGORY_RULES: { pattern: RegExp; category: ExpenseCategory; remarks?: string }[] = [
  // 入油
  { pattern: /GOGO ENERGY/i, category: '入油', remarks: '入油' },
  { pattern: /SHELL|ESSO|CALTEX|SINOPEC|中石化/i, category: '入油', remarks: '入油' },
  // 隧道費 (直接寫入 Google Sheet，不在網站類別列表中)
  { pattern: /HKeToll|Autotoll/i, category: '隧道費' as ExpenseCategory, remarks: '隧道費' },
  // 月租停車場
  { pattern: /PARKING|停車|月租/i, category: '月租停車場', remarks: '停車場' },
  // Call車
  { pattern: /DIDI Taxi|DiDi|ALP\*DIDI/i, category: 'Call車', remarks: 'DiDi' },
  // 貨物順豐運費
  { pattern: /順豐|S\.?F\.?\s*EXPRESS/i, category: '貨物順豐運費', remarks: '順豐運費' },
  // 貨款
  { pattern: /ALP\*Taobao|TAOBAO/i, category: '貨款', remarks: '淘寶' },
  // 其他 (with specific remarks)
  { pattern: /Google\s*AD|Google\s*Workspace/i, category: '其他', remarks: 'Google廣告費' },
  { pattern: /HKBN/i, category: '其他', remarks: '寬頻月費' },
  { pattern: /FACEBK|FACEBOOK|META/i, category: '其他', remarks: 'Meta收費' },
  { pattern: /TUBEBUDDY/i, category: '其他', remarks: 'TubeBuddy' },
  // 利得稅 (直接寫入 Google Sheet，不在網站類別列表中)
  { pattern: /Inland Revenue|稅務局|利得稅/i, category: '利得稅' as ExpenseCategory, remarks: '利得稅' },
  // AI用量收費 (直接寫入 Google Sheet，不在網站類別列表中)
  { pattern: /MAKE\.COM|MAKE COM|MANUS|LOVABLE/i, category: 'AI用量收費' as ExpenseCategory, remarks: 'AI用量收費' },
  // 雲端服務 (直接寫入 Google Sheet，不在網站類別列表中)
  { pattern: /DROPBOX/i, category: '雲端服務' as ExpenseCategory, remarks: '雲端服務' },
  // 招聘平台收費 (直接寫入 Google Sheet，不在網站類別列表中)
  { pattern: /MOOVUP/i, category: '招聘平台收費' as ExpenseCategory, remarks: '招聘平台收費' },
  // 保險 (直接寫入 Google Sheet，不在網站類別列表中)
  { pattern: /ZURICH|AIA|PRUDENTIAL|MANULIFE|保險/i, category: '保險' as ExpenseCategory, remarks: '保險' },
];

function classifyTransaction(description: string): { category: ExpenseCategory; remarks: string } {
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(description)) {
      return { category: rule.category, remarks: rule.remarks || description.trim() };
    }
  }
  return { category: '其他', remarks: description.trim() };
}

/**
 * Parse HSBC credit card statement PDF text content into transactions.
 * Expects raw text extracted page-by-page from pdfjs-dist.
 */
export function parseHSBCStatement(pages: string[], statementYear?: number): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  const year = statementYear || new Date().getFullYear();
  
  // Detect statement date for year context
  let detectedYear = year;
  const allText = pages.join('\n');
  const stmtDateMatch = allText.match(/(?:Statement date|結單日)[^]*?(\d{1,2}\s+[A-Z]{3}\s+(\d{4}))/i);
  if (stmtDateMatch) {
    detectedYear = parseInt(stmtDateMatch[2]);
  }

  const MONTH_MAP: Record<string, string> = {
    JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
    JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
  };

  // Lines to skip
  const SKIP_PATTERNS = [
    /PREVIOUS BALANCE/i,
    /PAID BY AUTOPAY/i,
    /REWARDCASH/i,
    /FINANCE CHARGE/i,
    /BALANCE TYPE/i,
    /ANNUALISED/i,
    /CASH ADVANCE/i,
    /PURCHASE\s+\d/i,
    /TOTAL FINANCE/i,
    /CREDIT REWARD/i,
    /^\*{3,}/,
    /^Information for/i,
    /minimum payment/i,
    /EXCHANGE RATE/i,
    /^Post date/i,
    /^Cardholder/i,
    /^Page \d/i,
    /Statement date/i,
    /Account number/i,
    /^For important/i,
    /^card reporting/i,
    /^please visit/i,
    /^Thank you/i,
    /^If you are/i,
    /^crossed cheque/i,
    /^Corporation/i,
    /Cheque number/i,
    /BY AUTOPAY$/i,
    /^PO BOX/i,
    /^NO\.\s*\d/i,
    /滙豐/,
    /BUSINESS CARD/i,
    /World Business/i,
    /^CHEUNG/i,
    /^5592/i,
    /^HKD\d/i,
    /^Current minimum/i,
    /^Please pay by/i,
    /^Overdue/i,
    /^Total minimum/i,
    /www\.hsbc/i,
    /85227488288/i,
    /^Amount \(HKD\)/i,
    /Description of/i,
  ];

  // Card number line (sub-account header)
  const CARD_LINE = /^\d{4}\s+\d{4}\s+\d{4}\s+\d{4}/;

  // Primary pattern: "14FEB 13FEB HKeToll (Autotoll) Hong Kong HK 361.00"
  // Foreign currency: "25FEB 25FEB FACEBK *SZRTSFHXE2 DUBLIN 2 IE USD 50.00 398.87"
  // The LAST number is always the HKD amount
  const TX_PATTERN = /^(\d{1,2})([A-Z]{3})\s+(\d{1,2})([A-Z]{3})\s+(.+?)\s+([\d,]+\.\d{2})(CR)?$/;

  for (const pageText of pages) {
    const lines = pageText.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Skip known non-transaction lines
      if (SKIP_PATTERNS.some(p => p.test(line))) continue;
      if (CARD_LINE.test(line)) continue;

      const txMatch = line.match(TX_PATTERN);
      
      if (txMatch) {
        const [, , , transDay, transMonth, rawDesc, amountStr, cr] = txMatch;
        
        const monthNum = MONTH_MAP[transMonth];
        if (!monthNum) continue;
        
        const day = transDay.padStart(2, '0');
        const dateStr = `${detectedYear}-${monthNum}-${day}`;
        const amount = parseFloat(amountStr.replace(/,/g, ''));
        const isCredit = !!cr;

        // Skip credit transactions (payments, rebates)
        if (isCredit) continue;

        // Clean description: remove foreign currency info at the end
        // e.g. "FACEBK *SZRTSFHXE2 DUBLIN 2 IE USD 50.00" → "FACEBK *SZRTSFHXE2 DUBLIN 2 IE"
        // e.g. "ALP*DIDI Taxi Shanghai CN CNY 50.70" → "ALP*DIDI Taxi Shanghai CN"
        let desc = rawDesc.trim();
        // Remove trailing foreign amount like "USD 50.00" or "CNY 141.91"
        desc = desc.replace(/\s+[A-Z]{3}\s+[\d,]+\.\d{2}$/, '').trim();
        // Also remove trailing amount if desc still ends with a number (edge case)
        
        const { category, remarks } = classifyTransaction(desc);

        transactions.push({
          date: dateStr,
          description: desc,
          amount,
          category,
          remarks,
          isCredit: false,
        });
      }
    }
  }

  return transactions;
}

/**
 * Extract text from PDF using pdfjs-dist
 */
export async function extractTextFromPDF(file: File): Promise<string[]> {
  const pdfjsLib = await import('pdfjs-dist');
  
  // Set worker source
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    
    // Reconstruct lines from text items with position awareness
    const items = textContent.items as any[];
    if (items.length === 0) {
      pages.push('');
      continue;
    }

    // Group items by Y position (same line)
    const lineMap = new Map<number, { x: number; text: string; width: number }[]>();
    for (const item of items) {
      if (!item.str) continue;
      const y = Math.round(item.transform[5]); // Y position
      const x = item.transform[4]; // X position
      const width = item.width || item.str.length * 4;
      if (!lineMap.has(y)) lineMap.set(y, []);
      lineMap.get(y)!.push({ x, text: item.str, width });
    }

    // Sort by Y descending (top to bottom), then X ascending
    const sortedLines = [...lineMap.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, items]) => {
        items.sort((a, b) => a.x - b.x);
        // Join with appropriate spacing
        let line = '';
        for (let j = 0; j < items.length; j++) {
          if (j > 0) {
            const gap = items[j].x - (items[j - 1].x + items[j - 1].width);
            line += gap > 10 ? '  ' : (gap > 2 ? ' ' : '');
          }
          line += items[j].text;
        }
        return line.trim();
      });

    pages.push(sortedLines.join('\n'));
  }

  return pages;
}
