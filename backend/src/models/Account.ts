import mongoose, { Document, Schema } from 'mongoose';
import { AccountType } from '../constants/enums';

export interface IAccount extends Document {
  name: string;
  type: AccountType;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  balance: number;
  isActive: boolean;
  isDefaultCash: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AccountSchema = new Schema<IAccount>(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: Object.values(AccountType), required: true },
    bankName: { type: String, trim: true },
    accountNumber: { type: String, trim: true },
    ifscCode: { type: String, trim: true },
    balance: { type: Number, default: 0, required: true },
    isActive: { type: Boolean, default: true },
    isDefaultCash: { type: Boolean, default: false },
  },
  { timestamps: true }
);

AccountSchema.index({ type: 1, isActive: 1 });

export const AccountModel = mongoose.model<IAccount>('Account', AccountSchema);
