import mongoose, { Document, Schema } from 'mongoose';

export interface IExpense extends Document {
  title: string;
  amount: number;
  category: string;
  accountId: mongoose.Types.ObjectId;
  date: Date;
  remarks?: string;
  receiptNumber?: string;
  isDeleted?: boolean;
  deletedAt?: Date;
  deletedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseSchema = new Schema<IExpense>(
  {
    title: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0.01 },
    category: { type: String, required: true, trim: true },
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    date: { type: Date, default: Date.now, required: true },
    remarks: { type: String, trim: true },
    receiptNumber: { type: String, trim: true },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    deletedReason: { type: String, trim: true },
  },
  { timestamps: true }
);

ExpenseSchema.index({ date: -1 });
ExpenseSchema.index({ category: 1 });
ExpenseSchema.index({ accountId: 1 });

export const ExpenseModel = mongoose.model<IExpense>('Expense', ExpenseSchema);
