export type Department = '度尺銷售部' | '安裝部';

export type PaymentMethod = '現金' | '支票' | '轉數快' | '微信支付' | '支付寶' | 'PayMe';

export type ExpenseCategory = '交通費' | '材料費' | '餐飲費' | '工具費' | '雜項';

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
  '交通費', '材料費', '餐飲費', '工具費', '雜項'
];
