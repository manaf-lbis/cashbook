import { z } from 'zod';
import { AccountType, CreditCardTransactionType } from '../constants/enums';

export const CreateAccountSchema = z.object({
  name: z.string().min(1, 'Account name is required').trim(),
  type: z.nativeEnum(AccountType),
  bankName: z.string().trim().optional(),
  accountNumber: z.string().trim().optional(),
  ifscCode: z.string().trim().optional(),
  balance: z.number().min(0, 'Balance must be non-negative').optional().default(0),
  isDefaultCash: z.boolean().optional(),
});

export const TransferFundsSchema = z.object({
  fromAccountId: z.string().min(1, 'Source account is required'),
  toAccountId: z.string().min(1, 'Destination account is required'),
  amount: z.number().positive('Amount must be positive'),
  remarks: z.string().trim().optional(),
  date: z.string().optional(),
});

export const CreateExpenseSchema = z.object({
  title: z.string().min(1, 'Title is required').trim(),
  amount: z.number().positive('Amount must be positive'),
  category: z.string().trim().optional(),
  accountId: z.string().optional(),
  date: z.string().optional(),
  remarks: z.string().trim().optional(),
  receiptNumber: z.string().trim().optional(),
});

export const UpdateExpenseSchema = z.object({
  title: z.string().trim().optional(),
  amount: z.number().positive('Amount must be positive').optional(),
  category: z.string().trim().optional(),
  date: z.string().optional(),
});

export const UpdateCreditEntrySchema = z.object({
  amount: z.number().positive('Amount must be positive').optional(),
  remarks: z.string().trim().optional(),
  date: z.string().optional(),
});

export const UpdatePayableEntrySchema = z.object({
  amount: z.number().positive('Amount must be positive').optional(),
  remarks: z.string().trim().optional(),
  date: z.string().optional(),
});

export const UpdateCardTransactionSchema = z.object({
  amount: z.number().positive('Amount must be positive').optional(),
  remarks: z.string().trim().optional(),
  description: z.string().trim().optional(),
  date: z.string().optional(),
});

export const GiveCreditSchema = z.object({
  partyName: z.string().min(1, 'Party name is required').trim(),
  phone: z.string().trim().optional(),
  amount: z.number().positive('Amount must be positive'),
  accountId: z.string().optional(),
  date: z.string().optional(),
  remarks: z.string().trim().optional(),
  dueDate: z.string().optional(),
});

export const RepayCreditSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  accountId: z.string().optional(),
  date: z.string().optional(),
  remarks: z.string().trim().optional(),
});

export const BorrowPayableSchema = z.object({
  partyName: z.string().min(1, 'Creditor name is required').trim(),
  phone: z.string().trim().optional(),
  amount: z.number().positive('Amount must be positive'),
  accountId: z.string().optional(),
  date: z.string().optional(),
  remarks: z.string().trim().optional(),
  dueDate: z.string().optional(),
});

export const PayBackPayableSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  accountId: z.string().optional(),
  date: z.string().optional(),
  remarks: z.string().trim().optional(),
});

export const CreateCardSchema = z.object({
  cardName: z.string().min(1, 'Card name is required').trim(),
  bankName: z.string().min(1, 'Bank name is required').trim(),
  last4Digits: z.string().length(4, 'Last 4 digits must be exactly 4 numbers'),
  creditLimit: z.number().positive('Credit limit must be positive'),
  billingCycleDate: z.number().min(1).max(31).optional(),
  dueDate: z.number().min(1).max(31).optional(),
  colorTheme: z.string().optional(),
});

export const CardTransactionSchema = z.object({
  cardId: z.string().min(1, 'Card is required'),
  type: z.nativeEnum(CreditCardTransactionType).optional().default(CreditCardTransactionType.PURCHASE),
  amount: z.number().positive('Amount must be positive'),
  depositToAccountId: z.string().optional(),
  paidFromAccountId: z.string().optional(),
  remarks: z.string().trim().optional(),
  description: z.string().trim().optional(),
  date: z.string().optional(),
});

export const CreateBillerSchema = z.object({
  name: z.string().min(1, 'Billing person name is required').trim(),
  phone: z.string().trim().optional(),
  role: z.string().trim().optional(),
});

export const CreateDayBookEntrySchema = z.object({
  billerId: z.string().optional(),
  amount: z.number().positive('Sale amount must be positive'),
  accountId: z.string().optional(),
  paymentMode: z.enum(['CASH', 'BANK', 'UPI']).optional(),
  date: z.string().optional(),
  billNumber: z.string().trim().optional(),
  customerName: z.string().trim().optional(),
  remarks: z.string().trim().optional(),
  description: z.string().trim().optional(),
});

export const UpdateDayBookEntrySchema = z.object({
  amount: z.number().positive('Sale amount must be positive').optional(),
  paymentMode: z.enum(['CASH', 'BANK', 'UPI']).optional(),
  date: z.string().optional(),
  billNumber: z.string().trim().optional(),
  customerName: z.string().trim().optional(),
  remarks: z.string().trim().optional(),
  description: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

export const ManualCashSplitUpSchema = z.object({
  sourceName: z.string().min(1, 'Source / Account name is required').trim(),
  amount: z.number().min(0, 'Amount cannot be negative'),
  notes: z.string().trim().optional(),
});

export const SaveDailyClosingSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  openingBalance: z.number().min(0, 'Opening balance cannot be negative'),
  dayBookSales: z.number().default(0),
  customerNet: z.number().default(0),
  customerRepayments: z.number().default(0),
  customerCreditGiven: z.number().default(0),
  expenseTotal: z.number().default(0),
  creditCardNet: z.number().default(0),
  creditCardDrawn: z.number().default(0),
  creditCardPayment: z.number().default(0),
  manualSplitUps: z.array(ManualCashSplitUpSchema).min(1, 'At least one cash/bank split-up source is required'),
  notes: z.string().trim().optional(),
});

export const LoginSchema = z.object({
  username: z.string().min(1, 'Username / Phone is required').trim(),
  password: z.string().min(1, 'Password is required'),
});

export const CreateCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').trim(),
  description: z.string().trim().optional(),
  color: z.string().trim().optional(),
});

export const UpdateCardSchema = z.object({
  cardName: z.string().min(1).trim().optional(),
  bankName: z.string().min(1).trim().optional(),
  last4Digits: z.string().length(4).optional(),
  creditLimit: z.number().positive().optional(),
  billingCycleDate: z.number().min(1).max(31).optional(),
  dueDate: z.number().min(1).max(31).optional(),
  colorTheme: z.string().optional(),
  isActive: z.boolean().optional(),
});




