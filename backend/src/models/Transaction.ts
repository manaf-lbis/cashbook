import mongoose, { Document, Schema } from 'mongoose';
import { TransactionType, TransactionSource } from '../constants/enums';

export interface ITransaction extends Document {
  accountId: mongoose.Types.ObjectId;
  type: TransactionType;
  amount: number;
  source: TransactionSource;
  referenceId?: mongoose.Types.ObjectId | string;
  destinationAccountId?: mongoose.Types.ObjectId;
  description: string;
  balanceAfter: number;
  date: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    type: { type: String, enum: Object.values(TransactionType), required: true },
    amount: { type: Number, required: true },
    source: { type: String, enum: Object.values(TransactionSource), required: true },
    referenceId: { type: Schema.Types.Mixed },
    destinationAccountId: { type: Schema.Types.ObjectId, ref: 'Account' },
    description: { type: String, required: true },
    balanceAfter: { type: Number, required: true },
    date: { type: Date, default: Date.now, required: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

TransactionSchema.index({ accountId: 1, date: -1 });
TransactionSchema.index({ source: 1, date: -1 });

export const TransactionModel = mongoose.model<ITransaction>('Transaction', TransactionSchema);
