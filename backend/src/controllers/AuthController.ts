import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { ApiResponse } from '../utils/ApiResponse';
import { AuditLogger } from '../utils/AuditLogger';

export class AuthController {
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

