import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { ApiResponse } from '../utils/ApiResponse';
import { AuditLogger } from '../utils/AuditLogger';

export class AuthController {
  static async sendOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;
      const result = await AuthService.sendLoginOtp(email);
      AuditLogger.log(req, 'AUTH_OTP_REQUEST', 'SUCCESS', { email });
      ApiResponse.success(res, result, result.message);
    } catch (error: any) {
      AuditLogger.log(req, 'AUTH_OTP_REQUEST', 'FAILURE', {
        email: req.body?.email,
        reason: error?.message || 'OTP generation failure',
      });
      next(error);
    }
  }

  static async verifyOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, otp } = req.body;
      const authData = await AuthService.verifyLoginOtp(email, otp);
      AuditLogger.log(req, 'AUTH_OTP_LOGIN', 'SUCCESS', { email, userId: authData.user.id });
      ApiResponse.success(res, authData, 'Authentication successful! Welcome to Cashbook.');
    } catch (error: any) {
      AuditLogger.log(req, 'AUTH_OTP_LOGIN', 'FAILURE', {
        email: req.body?.email,
        reason: error?.message || 'OTP verification failure',
      });
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { username, password } = req.body;
      const authData = await AuthService.login(username, password);
      AuditLogger.log(req, 'AUTH_LOGIN', 'SUCCESS', { username });
      ApiResponse.success(res, authData, 'Login successful');
    } catch (error: any) {
      AuditLogger.log(req, 'AUTH_LOGIN', 'FAILURE', {
        username: req.body?.username,
        reason: error?.message || 'Authentication error',
      });
      next(error);
    }
  }

  static async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const user = await AuthService.getCurrentUser(userId);
      ApiResponse.success(res, user, 'User details retrieved');
    } catch (error) {
      next(error);
    }
  }
}

