import mongoose, { Document, Schema } from 'mongoose';
import { CreditCardTransactionType } from '../constants/enums';

export interface ICreditCardTransaction extends Document {
  cardId: mongoose.Types.ObjectId;
  type: CreditCardTransactionType; // 'PURCHASE' | 'CASH_DRAWN' | 'PAYMENT'
  amount: number;
  depositToAccountId?: mongoose.Types.ObjectId; // For CASH_DRAWN: deposited into Cash in Hand or Bank
  paidFromAccountId?: mongoose.Types.ObjectId;  // For PAYMENT: paid from Cash or Bank
  remarks?: string;
  date: Date;
  balanceAfter: number;
  createdAt: Date;
  updatedAt: Date;
}

const CreditCardTransactionSchema = new Schema<ICreditCardTransaction>(
  {
    cardId: { type: Schema.Types.ObjectId, ref: 'CreditCard', required: true },
    type: { type: String, enum: Object.values(CreditCardTransactionType), required: true },
    amount: { type: Number, required: true, min: 0.01 },
    depositToAccountId: { type: Schema.Types.ObjectId, ref: 'Account' },
    paidFromAccountId: { type: Schema.Types.ObjectId, ref: 'Account' },
    remarks: { type: String, trim: true },
    date: { type: Date, default: Date.now, required: true },
    balanceAfter: { type: Number, required: true },
  },
  { timestamps: true }
);

CreditCardTransactionSchema.index({ cardId: 1, date: -1 });

export const CreditCardTransactionModel = mongoose.model<ICreditCardTransaction>(
  'CreditCardTransaction',
  CreditCardTransactionSchema
);
