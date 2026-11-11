import mongoose, { Document, Schema } from 'mongoose';

export interface IManualCashSplitUp {
  sourceName: string;
  amount: number;
  notes?: string;
}

export interface IDailyClosing extends Document {
  date: string; // Format 'YYYY-MM-DD'
  // Opening State (locked once opened, view-only forever)
  isOpened: boolean;
  openedAt?: Date;
  openingBalance: number; // Authoritative system opening balance (from yesterday's close + adjustments)
  openingCountedBalance: number; // Counted liquid cash when opening
  openingExpectedBalance: number; // Expected balance when opening
  openingVariance: number; // Variance when opening
  openingManualSplitUps: IManualCashSplitUp[];
  openingNotes?: string;
  previousClosingCash?: number; // Counted cash from previous day's close
  afterClosingExpenses?: number; // Expenses that occurred after previous day close
  afterClosingCollections?: number; // Collections that occurred after previous day close
  // Daily Activity Metrics
  dayBookSales: number; // Total sales today from all billers
  customerNet: number; // Net from customers book (+ repayments - given today)
  customerRepayments: number; // Customer payments received (+)
  customerCreditGiven: number; // Credit given to customers (-)
  customerToGet?: number; // Total customer receivables (You'll Get)
  customerToGive?: number; // Total customer payables (You'll Give)
  customerCollectionNet?: number; // customerToGet - customerToGive
  expenseTotal: number; // Expenses today (-)
  creditCardNet: number; // Credit card transactions net
  creditCardDrawn: number; // Cash drawn / swipe (+)
  creditCardPayment: number; // Card bill paid (-)
  // Closing State (allowed up to 23:59 IST on same day; re-close on same day is closing edit)
  expectedClosingBalance: number; // openingBalance + dayBookSales + customerNet - expenseTotal + creditCardNet
  manualSplitUps: IManualCashSplitUp[];
  actualClosingBalance: number; // sum of manualSplitUps
  variance: number; // actualClosingBalance - expectedClosingBalance
  status: 'BALANCED' | 'DISCREPANCY';
  notes?: string;
  isClosed: boolean;
  closedAt?: Date;
  // 6 Core Daily Financial Tracking Fields & Milestones
  cashInHand: number;
  totalLiquidAmount: number;
  amountToGive: number;
  amountToGet: number;
  grossAmount: number;
  netAmount: number;
  openingGrossAmount?: number;
  openingNetAmount?: number;
  closingGrossAmount?: number;
  closingNetAmount?: number;
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
    isOpened: { type: Boolean, default: false, index: true },
    openedAt: { type: Date },
    openingBalance: { type: Number, required: true, default: 0 },
    openingCountedBalance: { type: Number, default: 0 },
    openingExpectedBalance: { type: Number, default: 0 },
    openingVariance: { type: Number, default: 0 },
    openingManualSplitUps: { type: [ManualCashSplitUpSchema], default: [] },
    openingNotes: { type: String, trim: true },
    previousClosingCash: { type: Number, default: 0 },
    afterClosingExpenses: { type: Number, default: 0 },
    afterClosingCollections: { type: Number, default: 0 },
    dayBookSales: { type: Number, required: true, default: 0 },
    customerNet: { type: Number, required: true, default: 0 },
    customerRepayments: { type: Number, required: true, default: 0 },
    customerCreditGiven: { type: Number, required: true, default: 0 },
    customerToGet: { type: Number, default: 0 },
    customerToGive: { type: Number, default: 0 },
    customerCollectionNet: { type: Number, default: 0 },
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
    isClosed: { type: Boolean, default: false, index: true },
    closedAt: { type: Date },
    cashInHand: { type: Number, default: 0 },
    totalLiquidAmount: { type: Number, default: 0 },
    amountToGive: { type: Number, default: 0 },
    amountToGet: { type: Number, default: 0 },
    grossAmount: { type: Number, default: 0 },
    netAmount: { type: Number, default: 0 },
    openingGrossAmount: { type: Number, default: 0 },
    openingNetAmount: { type: Number, default: 0 },
    closingGrossAmount: { type: Number, default: 0 },
    closingNetAmount: { type: Number, default: 0 },
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

DailyClosingSchema.index({ date: -1, isClosed: 1 });

export const DailyClosingModel = mongoose.model<IDailyClosing>('DailyClosing', DailyClosingSchema);
