import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { UserModel, IUser } from '../models/User';
import { OtpModel } from '../models/Otp';
import { EmailService } from './EmailService';
import { ApiError } from '../utils/ApiError';
import { ENV } from '../config/env';

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    username: string;
    email?: string;
    name: string;
    role: string;
  };
}

export class AuthService {
  /**
   * Automatically ensure default admin account exists upon server start.
   */
  static async ensureDefaultAdmin(): Promise<void> {
    try {
      const targetEmail = (ENV.ADMIN_USERNAME || 'loginktkd@gmail.com').toLowerCase().trim();

      // Look for any existing admin or target user (including legacy username '7994414155')
      let admin = await UserModel.findOne({
        $or: [
          { email: targetEmail },
          { username: targetEmail },
          { username: '7994414155' },
          { role: 'ADMIN' },
        ],
      });

      if (!admin) {
        console.log(`[Security] Initializing default administrator account (${targetEmail})...`);
        admin = new UserModel({
          username: targetEmail,
          email: targetEmail,
          password: ENV.ADMIN_PASSWORD,
          name: 'Store Administrator',
          role: 'ADMIN',
          isActive: true,
        });
        await admin.save();
        console.log(`[Security] Default administrator account ready: ${targetEmail}`);
      } else {
        let needsSave = false;
        if (!admin.email || admin.email.toLowerCase() !== targetEmail) {
          admin.email = targetEmail;
          needsSave = true;
        }
        if (admin.username === '7994414155' || !admin.username) {
          admin.username = targetEmail;
          needsSave = true;
        }
        if (!admin.isActive) {
          admin.isActive = true;
          needsSave = true;
        }
        if (needsSave) {
          await admin.save();
          console.log(`[Security] Updated administrator account to ${targetEmail} (Active: true)`);
        }
      }
    } catch (err) {
      console.error('[Security] Error ensuring default admin user:', err);
    }
  }

  /**
   * Generates a 6-digit OTP only for pre-registered active users,
   * records it in DB, logs to console, and sends email via Resend.
   */
  static async sendLoginOtp(email: string): Promise<{ success: boolean; message: string; emailDelivery: boolean; error?: string }> {
    const formattedEmail = email.toLowerCase().trim();
    const adminEmail = (ENV.ADMIN_USERNAME || 'loginktkd@gmail.com').toLowerCase().trim();

    // STRICT ACCESS CONTROL: Only allow registered users in the database
    let user = await UserModel.findOne({
      $or: [{ email: formattedEmail }, { username: formattedEmail }],
    });

    // Auto-link/ensure the administrator account if logging in with the designated admin email
    if (!user && (formattedEmail === adminEmail || formattedEmail === 'loginktkd@gmail.com')) {
      user = await UserModel.findOne({
        $or: [{ username: '7994414155' }, { role: 'ADMIN' }],
      });

      if (user) {
        user.email = formattedEmail;
        user.username = formattedEmail;
        user.isActive = true;
        await user.save();
      } else {
        user = await UserModel.create({
          username: formattedEmail,
          email: formattedEmail,
          password: ENV.ADMIN_PASSWORD,
          name: 'Store Administrator',
          role: 'ADMIN',
          isActive: true,
        });
      }
    }

    if (!user) {
      throw ApiError.unauthorized(
        'Access denied: You are not a registered user. Only authorized store accounts can access this terminal.'
      );
    }

    if (!user.isActive) {
      throw ApiError.unauthorized('Your account has been deactivated. Please contact the administrator.');
    }

    // Invalidate any previous unexpired OTPs for this email
    await OtpModel.updateMany({ email: formattedEmail, isUsed: false }, { isUsed: true });

    // Generate secure 6-digit numeric OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save OTP to database
    await OtpModel.create({
      email: formattedEmail,
      otp,
      expiresAt,
      attempts: 0,
      isUsed: false,
    });

    // Send email via Resend and log to console
    const emailResult = await EmailService.sendLoginOtp(formattedEmail, otp);

    return {
      success: true,
      message: emailResult.success
        ? `Verification code sent to ${formattedEmail}`
        : `Verification code generated (logged to server console)`,
      emailDelivery: emailResult.success,
      error: emailResult.error,
    };
  }

  /**
   * Verifies the 6-digit OTP and authenticates the pre-registered user.
   */
  static async verifyLoginOtp(email: string, otp: string): Promise<AuthResponse> {
    const formattedEmail = email.toLowerCase().trim();
    const cleanOtp = otp.trim();

    // Verify user exists and is active
    let user = await UserModel.findOne({
      $or: [{ email: formattedEmail }, { username: formattedEmail }],
    });

    if (!user && (formattedEmail === (ENV.ADMIN_USERNAME || '').toLowerCase() || formattedEmail === 'loginktkd@gmail.com')) {
      user = await UserModel.findOne({
        $or: [{ username: '7994414155' }, { role: 'ADMIN' }],
      });
      if (user) {
        user.email = formattedEmail;
        user.username = formattedEmail;
        await user.save();
      }
    }

    if (!user) {
      throw ApiError.unauthorized('Access denied: You are not a registered user.');
    }

    if (!user.isActive) {
      throw ApiError.unauthorized('Your account has been deactivated. Please contact support.');
    }

    const otpRecord = await OtpModel.findOne({
      email: formattedEmail,
      isUsed: false,
      expiresAt: { $gte: new Date() },
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      throw ApiError.badRequest('Invalid or expired verification code. Please request a new OTP.');
    }

    if (otpRecord.otp !== cleanOtp) {
      otpRecord.attempts += 1;
      if (otpRecord.attempts >= 5) {
        otpRecord.isUsed = true;
      }
      await otpRecord.save();
      throw ApiError.badRequest('Incorrect verification code. Please check your email or console log.');
    }

    // Mark OTP as used
    otpRecord.isUsed = true;
    await otpRecord.save();

    const payload = {
      userId: user._id.toString(),
      username: user.username,
      email: user.email,
      role: user.role,
    };

    const signOptions: SignOptions = {
      expiresIn: (ENV.JWT_EXPIRES_IN || '7d') as any,
      algorithm: 'HS256',
    };

    const token = jwt.sign(payload, ENV.JWT_SECRET, signOptions);

    return {
      token,
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  /**
   * Authenticate user with username and password (backward compatibility).
   */
  static async login(username: string, password: string): Promise<AuthResponse> {
    const user = await UserModel.findOne({ username }).select('+password');
    if (!user) {
      throw ApiError.unauthorized('Invalid username or password');
    }

    if (!user.isActive) {
      throw ApiError.unauthorized('Your account has been deactivated. Please contact support.');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw ApiError.unauthorized('Invalid username or password');
    }

    const payload = {
      userId: user._id.toString(),
      username: user.username,
      email: user.email,
      role: user.role,
    };

    const signOptions: SignOptions = {
      expiresIn: (ENV.JWT_EXPIRES_IN || '7d') as any,
      algorithm: 'HS256',
    };

    const token = jwt.sign(payload, ENV.JWT_SECRET, signOptions);

    return {
      token,
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  /**
   * Fetch current authenticated user.
   */
  static async getCurrentUser(userId: string) {
    const user = await UserModel.findById(userId);
    if (!user || !user.isActive) {
      throw ApiError.unauthorized('User session invalid or user not found');
    }

    return {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }
}

