import mongoose, { Document, Schema } from 'mongoose';

export interface IEditLog {
  editedAt: Date;
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

export interface IDayBookEntry extends Document {
  billerId: mongoose.Types.ObjectId;
  amount: number;
  accountId: mongoose.Types.ObjectId;
  paymentMode: 'CASH' | 'BANK' | 'UPI';
  date: Date;
  monthKey: string; // 'YYYY-MM', e.g., '2026-09'
  billNumber?: string;
  customerName?: string;
  remarks?: string;
  isEdited?: boolean;
  editLogs?: IEditLog[];
  isDeleted?: boolean;
  deletedAt?: Date;
  deletedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const EditLogSchema = new Schema<IEditLog>(
  {
    editedAt: { type: Date, default: Date.now },
    previousAmount: { type: Number, required: true },
    newAmount: { type: Number, required: true },
    previousRemarks: { type: String },
    newRemarks: { type: String },
    previousCustomerName: { type: String },
    newCustomerName: { type: String },
    previousBillNumber: { type: String },
    newBillNumber: { type: String },
    reason: { type: String },
  },
  { _id: false }
);

const DayBookEntrySchema = new Schema<IDayBookEntry>(
  {
    billerId: { type: Schema.Types.ObjectId, ref: 'Biller', required: true, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    paymentMode: { type: String, enum: ['CASH', 'BANK', 'UPI'], default: 'CASH', required: true },
    date: { type: Date, default: Date.now, required: true },
    monthKey: { type: String, required: true, index: true },
    billNumber: { type: String, trim: true },
    customerName: { type: String, trim: true },
    remarks: { type: String, trim: true },
    isEdited: { type: Boolean, default: false },
    editLogs: { type: [EditLogSchema], default: [] },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    deletedReason: { type: String, trim: true },
  },
  { timestamps: true }
);

DayBookEntrySchema.index({ monthKey: 1, billerId: 1 });
DayBookEntrySchema.index({ date: -1 });

export const DayBookEntryModel = mongoose.model<IDayBookEntry>('DayBookEntry', DayBookEntrySchema);
