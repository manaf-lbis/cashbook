import jwt, { SignOptions } from 'jsonwebtoken';
import { UserModel, IUser } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { ENV } from '../config/env';

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    username: string;
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
      const existing = await UserModel.findOne({ username: ENV.ADMIN_USERNAME });
      if (!existing) {
        console.log(`[Security] Initializing default administrator account (${ENV.ADMIN_USERNAME})...`);
        const admin = new UserModel({
          username: ENV.ADMIN_USERNAME,
          password: ENV.ADMIN_PASSWORD,
          name: 'Store Administrator',
          role: 'ADMIN',
          isActive: true,
        });
        await admin.save();
        console.log(`[Security] Default administrator account ready.`);
      } else {
        // If password needs syncing or ensuring active
        if (!existing.isActive) {
          existing.isActive = true;
          await existing.save();
        }
      }
    } catch (err) {
      console.error('[Security] Error ensuring default admin user:', err);
    }
  }

  /**
   * Authenticate user with username and password.
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
      name: user.name,
      role: user.role,
    };
  }
}
