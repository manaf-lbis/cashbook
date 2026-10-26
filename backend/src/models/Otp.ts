import mongoose, { Document, Schema } from 'mongoose';

export interface IOtp extends Document {
  email: string;
  otp: string;
  expiresAt: Date;
  attempts: number;
  isUsed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const OtpSchema = new Schema<IOtp>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    otp: {
      type: String,
      required: true,
      trim: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL index: MongoDB automatically purges expired OTP documents
    },
    attempts: {
      type: Number,
      default: 0,
    },
    isUsed: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

OtpSchema.index({ email: 1, isUsed: 1, expiresAt: 1 });

export const OtpModel = mongoose.model<IOtp>('Otp', OtpSchema);
