import mongoose, { Document, Schema } from 'mongoose';

export interface IManualCashSplitUp {
  sourceName: string;
  amount: number;
  notes?: string;
}

export interface IDailyClosing extends Document {
  date: string; // Format 'YYYY-MM-DD'
  openingBalance: number; // Liquid cash declared / carried from previous closing
  dayBookSales: number; // Total sales today from all billers
  customerNet: number; // Net from customers book (+ repayments - given)
  customerRepayments: number; // Customer payments received (+)
  customerCreditGiven: number; // Credit given to customers (-)
  expenseTotal: number; // Expenses today (-)
  creditCardNet: number; // Credit card transactions net
  creditCardDrawn: number; // Cash drawn / swipe (+)
  creditCardPayment: number; // Card bill paid (-)
  expectedClosingBalance: number; // openingBalance + dayBookSales + customerNet - expenseTotal + creditCardNet
  manualSplitUps: IManualCashSplitUp[];
  actualClosingBalance: number; // sum of manualSplitUps
  variance: number; // actualClosingBalance - expectedClosingBalance
  status: 'BALANCED' | 'DISCREPANCY';
  notes?: string;
  isClosed: boolean;
  closedAt?: Date;
  editLogs?: Array<{
    editedAt: Date;
    previousActual: number;
    newActual: number;
    previousVariance: number;
    newVariance: number;
    reason?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const ManualCashSplitUpSchema = new Schema<IManualCashSplitUp>(
  {
    sourceName: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, default: 0 },
    notes: { type: String, trim: true },
  },
  { _id: false }
);

const DailyClosingSchema = new Schema<IDailyClosing>(
  {
    date: { type: String, required: true, unique: true, index: true },
    openingBalance: { type: Number, required: true, default: 0 },
    dayBookSales: { type: Number, required: true, default: 0 },
    customerNet: { type: Number, required: true, default: 0 },
    customerRepayments: { type: Number, required: true, default: 0 },
    customerCreditGiven: { type: Number, required: true, default: 0 },
    expenseTotal: { type: Number, required: true, default: 0 },
    creditCardNet: { type: Number, required: true, default: 0 },
    creditCardDrawn: { type: Number, required: true, default: 0 },
    creditCardPayment: { type: Number, required: true, default: 0 },
    expectedClosingBalance: { type: Number, required: true, default: 0 },
    manualSplitUps: { type: [ManualCashSplitUpSchema], default: [] },
    actualClosingBalance: { type: Number, required: true, default: 0 },
    variance: { type: Number, required: true, default: 0 },
    status: { type: String, enum: ['BALANCED', 'DISCREPANCY'], default: 'BALANCED' },
    notes: { type: String, trim: true },
    isClosed: { type: Boolean, default: true },
    closedAt: { type: Date, default: Date.now },
    editLogs: [
      {
        editedAt: { type: Date, default: Date.now },
        previousActual: Number,
        newActual: Number,
        previousVariance: Number,
        newVariance: Number,
        reason: String,
      },
    ],
  },
  { timestamps: true }
);

DailyClosingSchema.index({ date: -1 });

export const DailyClosingModel = mongoose.model<IDailyClosing>('DailyClosing', DailyClosingSchema);
