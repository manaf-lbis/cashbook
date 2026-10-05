import mongoose, { Document, Schema } from 'mongoose';

export interface ICreditCard extends Document {
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
  createdAt: Date;
  updatedAt: Date;
}

const CreditCardSchema = new Schema<ICreditCard>(
  {
    cardName: { type: String, required: true, trim: true },
    bankName: { type: String, required: true, trim: true },
    last4Digits: { type: String, required: true, trim: true, maxlength: 4 },
    creditLimit: { type: Number, required: true, min: 0 },
    totalOutstanding: { type: Number, default: 0, required: true },
    availableLimit: { type: Number, required: true },
    billingCycleDate: { type: Number, min: 1, max: 31 },
    dueDate: { type: Number, min: 1, max: 31 },
    colorTheme: { type: String, default: 'indigo' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

CreditCardSchema.pre('validate', function (next) {
  if (this.creditLimit !== undefined && this.totalOutstanding !== undefined) {
    this.availableLimit = Math.max(0, this.creditLimit - this.totalOutstanding);
  }
  next();
});

export const CreditCardModel = mongoose.model<ICreditCard>('CreditCard', CreditCardSchema);
