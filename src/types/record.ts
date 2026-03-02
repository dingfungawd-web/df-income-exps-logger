export type Department = '度尺銷售部' | '安裝部' | '老闆';

export type PaymentMethod = '現金' | '支票' | '轉數快' | '微信支付' | '支付寶' | 'PayMe';

export type ExpenseCategory = '八達通增值' | 'Call車' | '月租停車場' | '時租停車場' | '入油' | '貨物順豐運費' | '度尺工具' | '安裝工具' | '文具費用' | '貨倉飲品' | '其他';

export type RevenueCategory = '訂金' | '餘款';

export interface RevenueRecord {
  id: string;
  caseId: string;
  date: string;
  department: Department;
  category: RevenueCategory;
  amount: number;
  paymentMethod: PaymentMethod;
  staff: string;
  handed: boolean;
  handoverDate: string;
}

export interface HandoverRecord {
  id: string;
  staff: string;
  handoverDate: string;
  totalAmount: number;
  revenueIds: string;
}

export interface ExpenseRecord {
  id: string;
  date: string;
  department: Department;
  staff: string;
  category: ExpenseCategory;
  amount: number;
  claimed: boolean;
  claimDate: string;
  claimAmount: number;
  remarks: string;
}

export interface StaffUser {
  name: string;
  password: string;
}

export interface ClaimRecord {
  id: string;
  staff: string;
  claimDate: string;
  totalAmount: number;
  expenseIds: string;
}

export const DEPARTMENTS: Department[] = ['度尺銷售部', '安裝部'];

export const PAYMENT_METHODS: PaymentMethod[] = [
  '現金', '支票', '轉數快', '微信支付', '支付寶', 'PayMe'
];

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  '八達通增值', 'Call車', '月租停車場', '時租停車場', '入油', '貨物順豐運費', '度尺工具', '安裝工具', '文具費用', '貨倉飲品', '其他'
];

export const REVENUE_CATEGORIES: RevenueCategory[] = ['訂金', '餘款'];
