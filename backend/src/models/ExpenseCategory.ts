import mongoose, { Document, Schema } from 'mongoose';

export interface IExpenseCategory extends Document {
  name: string;
  description?: string;
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseCategorySchema = new Schema<IExpenseCategory>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true },
    color: { type: String, trim: true },
  },
  { timestamps: true }
);

export const ExpenseCategoryModel = mongoose.model<IExpenseCategory>('ExpenseCategory', ExpenseCategorySchema);

