export type Department = '度尺銷售部' | '安裝部';

export type PaymentMethod = '現金' | '支票' | '轉數快' | '微信支付' | 'PayMe';

export interface RevenueRecord {
  id: string;
  date: string;
  department: Department;
  amount: number;
  paymentMethod: PaymentMethod;
  staff: string;
}

export const DEPARTMENTS: Department[] = ['度尺銷售部', '安裝部'];

export const PAYMENT_METHODS: PaymentMethod[] = [
  '現金', '支票', '轉數快', '微信支付', 'PayMe'
];
