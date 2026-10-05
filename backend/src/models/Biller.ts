import mongoose, { Document, Schema } from 'mongoose';

export interface IBiller extends Document {
  name: string;
  phone?: string;
  role: string;
  isActive: boolean;
  totalSales: number;
  createdAt: Date;
  updatedAt: Date;
}

const BillerSchema = new Schema<IBiller>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    role: { type: String, default: 'Billing Counter', trim: true },
    isActive: { type: Boolean, default: true },
    totalSales: { type: Number, default: 0 },
  },
  { timestamps: true }
);

BillerSchema.index({ name: 1 });
BillerSchema.index({ isActive: 1 });

export const BillerModel = mongoose.model<IBiller>('Biller', BillerSchema);
