export enum AccountType {
  CASH = 'CASH',
  BANK = 'BANK',
}

export enum TransactionType {
  INFLOW = 'INFLOW',
  OUTFLOW = 'OUTFLOW',
  TRANSFER = 'TRANSFER',
}

export enum TransactionSource {
  CASHBOOK_ADJUSTMENT = 'CASHBOOK_ADJUSTMENT',
  TRANSFER = 'TRANSFER',
  EXPENSE = 'EXPENSE',
  CREDIT_GIVEN = 'CREDIT_GIVEN',
  CREDIT_REPAID = 'CREDIT_REPAID',
  PAYABLE_BORROWED = 'PAYABLE_BORROWED',
  PAYABLE_REPAID = 'PAYABLE_REPAID',
  CREDIT_CARD_CASH_DRAWN = 'CREDIT_CARD_CASH_DRAWN',
  CREDIT_CARD_PAYMENT = 'CREDIT_CARD_PAYMENT',
  OTHER = 'OTHER',
}

export enum CreditTransactionType {
  GIVEN = 'GIVEN',
  REPAYMENT = 'REPAYMENT',
}

export enum PayableTransactionType {
  BORROWED = 'BORROWED',
  PAID = 'PAID',
}

export enum CreditCardTransactionType {
  PURCHASE = 'PURCHASE',
  CASH_DRAWN = 'CASH_DRAWN',
  PAYMENT = 'PAYMENT',
}

export enum CashbookStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export interface IAccount {
  _id: string;
  name: string;
  type: AccountType;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  balance: number;
  isActive: boolean;
  isDefaultCash: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IOpeningBankBalance {
  accountId: string;
  accountName: string;
  balance: number;
}

export interface IDailyCashbook {
  _id: string;
  date: string;
  openingCashInHand: number;
  openingBankBalances: IOpeningBankBalance[];
  totalOpeningLiquidity: number;
  inflows: number;
  outflows: number;
  closingCashCalculated: number;
  closingCashActual?: number;
  cashVariance?: number;
  notes?: string;
  status: CashbookStatus;
  closedAt?: string;
}

export interface IExpenseCategory {
  _id: string;
  name: string;
  description?: string;
  color?: string;
  totalSpent: number;
  count: number;
  lastExpenseDate?: string | null;
  createdAt?: string;
}

export interface IExpense {
  _id: string;
  title: string;
  amount: number;
  category: string;
  accountId: IAccount | string;
  date: string;
  remarks?: string;
  receiptNumber?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedReason?: string;
  isReconciled?: boolean;
  createdAt: string;
}

export interface ICreditEntry {
  _id: string;
  type: CreditTransactionType;
  amount: number;
  accountId: IAccount | string;
  date: string;
  remarks?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  isReconciled?: boolean;
}

export interface ICredit {
  _id: string;
  partyName: string;
  phone?: string;
  totalGiven: number;
  totalRepaid: number;
  balanceDue: number;
  dueDate?: string;
  status: 'ACTIVE' | 'SETTLED';
  entries: ICreditEntry[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IPayableEntry {
  _id: string;
  type: PayableTransactionType;
  amount: number;
  accountId: IAccount | string;
  date: string;
  remarks?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  isReconciled?: boolean;
}

export interface IPayable {
  _id: string;
  partyName: string;
  phone?: string;
  totalBorrowed: number;
  totalPaid: number;
  balancePending: number;
  dueDate?: string;
  status: 'ACTIVE' | 'SETTLED';
  entries: IPayableEntry[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ICreditCard {
  _id: string;
  cardName: string;
  bankName: string;
  last4Digits: string;
  creditLimit: number;
  totalOutstanding: number;
  availableLimit: number;
  billingCycleDate?: number;
  dueDate?: number;
  colorTheme?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ICreditCardTransaction {
  _id: string;
  cardId: string;
  type: CreditCardTransactionType;
  amount: number;
  depositToAccountId?: IAccount;
  paidFromAccountId?: IAccount;
  remarks?: string;
  date: string;
  balanceAfter: number;
}

export interface ITransaction {
  _id: string;
  accountId: IAccount;
  type: TransactionType;
  amount: number;
  source: TransactionSource;
  destinationAccountId?: IAccount;
  description: string;
  balanceAfter: number;
  date: string;
}

export interface IDashboardSummary {
  liquidity: {
    cashInHand: number;
    bankBalancesTotal: number;
    totalLiquidity: number;
  };
  receivables: {
    totalOutstanding: number;
  };
  payables: {
    totalOutstanding: number;
  };
  creditCards: {
    totalDebt: number;
  };
  netPosition: number;
  todayCashbook?: {
    date: string;
    status?: string;
    openingCashInHand?: number;
    inflows?: number;
    outflows?: number;
    closingCashCalculated?: number;
  };
  monthlyExpensesTotal: number;
  categoryExpenses: { _id: string; totalAmount: number; count: number }[];
  recentTransactions: ITransaction[];
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errors?: any[];
}

export type MonthStatus = 'LOCKED' | 'ACTIVE' | 'VIEW_ONLY';

export interface IDayBookMonth {
  monthKey: string;
  monthName: string;
  year: number;
  label: string;
  shortLabel: string;
  status: MonthStatus;
  isCurrent: boolean;
  totalSales: number;
  totalBills: number;
}

export interface IBiller {
  _id: string;
  name: string;
  phone?: string;
  role: string;
  isActive: boolean;
  allTimeSales: number;
  monthSales: number;
  monthBills: number;
  createdAt: string;
}

export interface IEditLog {
  editedAt: string;
  previousAmount: number;
  newAmount: number;
  previousRemarks?: string;
  newRemarks?: string;
  previousCustomerName?: string;
  newCustomerName?: string;
  previousBillNumber?: string;
  newBillNumber?: string;
  reason?: string;
}

export interface IDayBookEntry {
  _id: string;
  billerId: string;
  amount: number;
  accountId: IAccount | string;
  paymentMode: 'CASH' | 'BANK' | 'UPI';
  date: string;
  monthKey: string;
  billNumber?: string;
  customerName?: string;
  remarks?: string;
  isEdited?: boolean;
  editLogs?: IEditLog[];
  isDeleted?: boolean;
  deletedAt?: string;
  deletedReason?: string;
  isReconciled?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface IDayBookBillersResponse {
  monthKey: string;
  monthStatus: MonthStatus;
  totalMonthSales: number;
  totalMonthBills: number;
  billers: IBiller[];
}

export interface IDayBookEntriesResponse {
  biller: IBiller;
  monthKey: string;
  monthStatus: MonthStatus;
  entries: IDayBookEntry[];
}

export interface IManualCashSplitUp {
  sourceName: string;
  amount: number;
  notes?: string;
}

export interface IDailyClosing {
  _id?: string;
  date: string;
  openingBalance: number;
  dayBookSales: number;
  customerNet: number;
  customerRepayments: number;
  customerCreditGiven: number;
  expenseTotal: number;
  creditCardNet: number;
  creditCardDrawn: number;
  creditCardPayment: number;
  expectedClosingBalance: number;
  manualSplitUps: IManualCashSplitUp[];
  actualClosingBalance: number;
  variance: number;
  status: 'BALANCED' | 'DISCREPANCY';
  notes?: string;
  isClosed?: boolean;
  closedAt?: string;
  editLogs?: Array<{
    editedAt: string;
    previousActual: number;
    newActual: number;
    previousVariance: number;
    newVariance: number;
    reason?: string;
  }>;
  createdAt?: string;
  updatedAt?: string;
}

export interface IDailyClosingSummary {
  date: string;
  isAlreadyClosed: boolean;
  existingClosing: IDailyClosing | null;
  previousClosing: {
    date: string;
    actualClosingBalance: number;
    variance: number;
    status: 'BALANCED' | 'DISCREPANCY';
  } | null;
  openingBalance: number;
  suggestedOpeningBalance: number;
  dayBook: {
    totalSales: number;
    totalEntries: number;
    billerBreakdown: Array<{
      billerId: string;
      billerName: string;
      totalSales: number;
      count: number;
    }>;
    entries: any[];
  };
  customerBook: {
    customerNet: number;
    totalRepayments: number;
    totalCreditGiven: number;
    totalTransactions: number;
    transactions: any[];
  };
  expenseBook: {
    totalExpenses: number;
    totalEntries: number;
    categoryBreakdown: Array<{
      category: string;
      total: number;
      count: number;
    }>;
    expenses: any[];
  };
  creditCardBook: {
    creditCardNet: number;
    creditCardDrawn: number;
    creditCardPayment: number;
    totalTransactions: number;
    transactions: any[];
  };
  expectedClosingBalance: number;
  defaultSplitUps: IManualCashSplitUp[];
}

export interface ITimelineDay {
  date: string;
  status: 'CLOSED_BALANCED' | 'CLOSED_DISCREPANCY' | 'OPENING' | 'NOT_CLOSED' | 'OPENING_ONLY';
  displayStatus: string;
  isSaved: boolean;
  isToday: boolean;
  openingBalance: number;
  dayBookSales: number;
  customerNet: number;
  customerRepayments: number;
  customerCreditGiven: number;
  expenseTotal: number;
  creditCardNet: number;
  expectedClosingBalance: number;
  actualClosingBalance: number | null;
  variance: number | null;
  grossCashAvailable: number;
  cardLiabilities: number;
  payableLiabilities: number;
  totalLiabilities: number;
  netCashBalance: number;
  manualSplitUps: IManualCashSplitUp[];
  notes?: string;
  closedAt?: string;
}

export interface ITimelineMetrics {
  totalDays: number;
  closedCount: number;
  balancedCount?: number;
  discrepancyCount?: number;
  notClosedCount: number;
  openingCount: number;
  totalPeriodSales?: number;
  totalPeriodExpenses?: number;
  totalNetVariance?: number;
  currentGrossCash: number;
  totalCardDebt: number;
  totalPayableDebt: number;
  totalLiabilities: number;
  currentNetBalance: number;
}

export interface ITimelineResponse {
  metrics: ITimelineMetrics;
  timeline: ITimelineDay[];
}

export interface IUser {
  id: string;
  username: string;
  name: string;
  role: string;
}

export interface ILoginResponse {
  token: string;
  user: IUser;
}



