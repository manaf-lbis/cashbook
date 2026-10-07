import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError';

/**
 * Middleware to validate that request parameters representing MongoDB IDs
 * are valid 24-character hexadecimal ObjectIds, preventing BOLA/IDOR probing and CastErrors.
 */
export const validateObjectIdParams = (
  paramNames: string[] = ['id', 'billerId', 'txId', 'entryId', 'cardId', 'accountId']
) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    for (const paramName of paramNames) {
      const val = req.params[paramName];
      if (val !== undefined && val !== null) {
        if (!mongoose.Types.ObjectId.isValid(val)) {
          return next(
            ApiError.badRequest(`Invalid identifier format for parameter '${paramName}': ${val}`)
          );
        }
      }
    }
    next();
  };
};
