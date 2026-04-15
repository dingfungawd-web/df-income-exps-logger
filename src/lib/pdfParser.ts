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
const CATEGORY_RULES: { pattern: RegExp; category: ExpenseCategory; remarks?: string }[] = [
  { pattern: /HKeToll|Autotoll/i, category: '隧道費', remarks: '隧道費' },
  { pattern: /GOGO ENERGY/i, category: '入油', remarks: '入油' },
  { pattern: /SHELL|ESSO|CALTEX|SINOPEC|中石化/i, category: '入油', remarks: '入油' },
  { pattern: /DIDI Taxi|DiDi/i, category: 'Call車' },
  { pattern: /TAOBAO/i, category: '貨款', remarks: '淘寶' },
  { pattern: /Google\s*AD/i, category: '其他', remarks: 'Google廣告費' },
  { pattern: /HKBN/i, category: '其他', remarks: '寬頻月費' },
  { pattern: /FACEBK|FACEBOOK|META/i, category: '其他', remarks: 'Meta收費' },
  { pattern: /LOVABLE/i, category: '其他', remarks: 'Lovable' },
  { pattern: /TUBEBUDDY/i, category: '其他', remarks: 'TubeBuddy' },
  { pattern: /順豐|S\.?F\.?\s*EXPRESS/i, category: '貨物順豐運費' },
  { pattern: /PARKING|停車/i, category: '月租停車場' },
];

function classifyTransaction(description: string): { category: ExpenseCategory; remarks: string } {
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(description)) {
      return { category: rule.category, remarks: rule.remarks || '' };
    }
  }
  return { category: '其他', remarks: description.split(/\s{2,}/)[0]?.trim() || description };
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
  const stmtDateMatch = pages.join('\n').match(/Statement date[^]*?(\d{1,2}\s+[A-Z]{3}\s+(\d{4}))/i);
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
  ];

  // Card number line (sub-account header)
  const CARD_LINE = /^\d{4}\s+\d{4}\s+\d{4}\s+\d{4}/;

  for (const pageText of pages) {
    const lines = pageText.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Skip known non-transaction lines
      if (SKIP_PATTERNS.some(p => p.test(line))) continue;
      if (CARD_LINE.test(line)) continue;

      // Match transaction line: PostDate TransDate Description Amount
      // Format: "14FEB  13FEB  HKeToll (Autotoll) Hong Kong HK  361.00"
      const txMatch = line.match(
        /^(\d{1,2})([A-Z]{3})\s+(\d{1,2})([A-Z]{3})\s+(.+?)\s{2,}([\d,]+\.\d{2})(CR)?$/
      );
      
      if (txMatch) {
        const [, postDay, postMonth, transDay, transMonth, desc, amountStr, cr] = txMatch;
        
        const monthNum = MONTH_MAP[transMonth];
        if (!monthNum) continue;
        
        const day = transDay.padStart(2, '0');
        const dateStr = `${detectedYear}-${monthNum}-${day}`;
        const amount = parseFloat(amountStr.replace(/,/g, ''));
        const isCredit = !!cr;

        // Skip credit transactions (payments, rebates)
        if (isCredit) continue;

        const { category, remarks } = classifyTransaction(desc);

        transactions.push({
          date: dateStr,
          description: desc.trim(),
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
    const lineMap = new Map<number, { x: number; text: string }[]>();
    for (const item of items) {
      if (!item.str) continue;
      const y = Math.round(item.transform[5]); // Y position
      const x = item.transform[4]; // X position
      if (!lineMap.has(y)) lineMap.set(y, []);
      lineMap.get(y)!.push({ x, text: item.str });
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
            const gap = items[j].x - (items[j - 1].x + items[j - 1].text.length * 4);
            line += gap > 20 ? '  ' : ' ';
          }
          line += items[j].text;
        }
        return line.trim();
      });

    pages.push(sortedLines.join('\n'));
  }

  return pages;
}
