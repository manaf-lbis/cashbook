import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let errors: any[] = [];

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    errors = err.errors || [];
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Database Validation Error';
    errors = Object.values(err.errors).map((e: any) => ({
      field: e.path,
      message: e.message,
    }));
  } else if (err.code === 11000) {
    statusCode = 400;
    message = 'Duplicate field value entered';
    errors = [err.keyValue];
  } else if (err instanceof Error) {
    message = err.message;
  }

  if (process.env.NODE_ENV !== 'production' && statusCode === 500) {
    console.error('[Unhandled Error]', err);
  }

  ApiResponse.error(res, message, statusCode, errors);
};
