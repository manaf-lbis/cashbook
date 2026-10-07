import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/ApiError';
import { ENV } from '../config/env';
import { UserModel } from '../models/User';

export interface AuthenticatedUser {
  userId: string;
  username: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const requireAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Authentication required. Please sign in to access this resource.');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw ApiError.unauthorized('Authentication token missing.');
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, ENV.JWT_SECRET, { algorithms: ['HS256'] });
    } catch (jwtErr: any) {
      if (jwtErr.name === 'TokenExpiredError') {
        throw ApiError.unauthorized('Your session has expired. Please log in again.');
      }
      throw ApiError.unauthorized('Invalid authentication token.');
    }


    if (!decoded || !decoded.userId) {
      throw ApiError.unauthorized('Malformed authentication payload.');
    }

    // Verify user exists and is active in DB
    const user = await UserModel.findById(decoded.userId);
    if (!user || !user.isActive) {
      throw ApiError.unauthorized('User account not found or deactivated.');
    }

    req.user = {
      userId: user._id.toString(),
      username: user.username,
      role: user.role,
    };

    next();
  } catch (error) {
    next(error);
  }
};
