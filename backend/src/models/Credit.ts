import mongoose, { Document, Schema } from 'mongoose';
import { CreditTransactionType } from '../constants/enums';

export interface ICreditEntry {
  _id?: mongoose.Types.ObjectId;
  type: CreditTransactionType; // 'GIVEN' | 'REPAYMENT'
  amount: number;
  accountId: mongoose.Types.ObjectId;
  date: Date;
  remarks?: string;
  isDeleted?: boolean;
  deletedAt?: Date;
  createdAt?: Date;
}

export interface ICredit extends Document {
  partyName: string;
  phone?: string;
  totalGiven: number;
  totalRepaid: number;
  balanceDue: number;
  dueDate?: Date;
  status: 'ACTIVE' | 'SETTLED';
  entries: ICreditEntry[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CreditEntrySchema = new Schema<ICreditEntry>(
  {
    type: { type: String, enum: Object.values(CreditTransactionType), required: true },
    amount: { type: Number, required: true, min: 0.01 },
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    date: { type: Date, default: Date.now, required: true },
    remarks: { type: String, trim: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

const CreditSchema = new Schema<ICredit>(
  {
    partyName: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    totalGiven: { type: Number, default: 0, required: true },
    totalRepaid: { type: Number, default: 0, required: true },
    balanceDue: { type: Number, default: 0, required: true },
    dueDate: { type: Date },
    status: { type: String, enum: ['ACTIVE', 'SETTLED'], default: 'ACTIVE' },
    entries: [CreditEntrySchema],
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

CreditSchema.index({ partyName: 1 });
CreditSchema.index({ status: 1 });
CreditSchema.index({ balanceDue: -1 });

export const CreditModel = mongoose.model<ICredit>('Credit', CreditSchema);
