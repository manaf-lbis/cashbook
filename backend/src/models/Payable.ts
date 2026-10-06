import mongoose, { Document, Schema } from 'mongoose';
import { PayableTransactionType } from '../constants/enums';

export interface IPayableEntry {
  _id?: mongoose.Types.ObjectId;
  type: PayableTransactionType; // 'BORROWED' | 'PAID'
  amount: number;
  accountId: mongoose.Types.ObjectId;
  date: Date;
  remarks?: string;
  isDeleted?: boolean;
  deletedAt?: Date;
  createdAt?: Date;
}

export interface IPayable extends Document {
  partyName: string;
  phone?: string;
  totalBorrowed: number;
  totalPaid: number;
  balancePending: number;
  dueDate?: Date;
  status: 'ACTIVE' | 'SETTLED';
  entries: IPayableEntry[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PayableEntrySchema = new Schema<IPayableEntry>(
  {
    type: { type: String, enum: Object.values(PayableTransactionType), required: true },
    amount: { type: Number, required: true, min: 0.01 },
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    date: { type: Date, default: Date.now, required: true },
    remarks: { type: String, trim: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

const PayableSchema = new Schema<IPayable>(
  {
    partyName: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    totalBorrowed: { type: Number, default: 0, required: true },
    totalPaid: { type: Number, default: 0, required: true },
    balancePending: { type: Number, default: 0, required: true },
    dueDate: { type: Date },
    status: { type: String, enum: ['ACTIVE', 'SETTLED'], default: 'ACTIVE' },
    entries: [PayableEntrySchema],
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

PayableSchema.index({ partyName: 1 });
PayableSchema.index({ status: 1 });
PayableSchema.index({ balancePending: -1 });

export const PayableModel = mongoose.model<IPayable>('Payable', PayableSchema);
