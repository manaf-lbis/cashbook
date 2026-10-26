import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { ApiError } from '../utils/ApiError';

export const validateRequest = (
  schema: AnyZodObject,
  source: 'body' | 'query' | 'params' = 'body'
) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (source === 'query') {
        req.query = await schema.parseAsync(req.query);
      } else if (source === 'params') {
        req.params = await schema.parseAsync(req.params);
      } else {
        req.body = await schema.parseAsync(req.body);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        next(ApiError.badRequest(`Validation failed on request ${source}`, errorMessages));
      } else {
        next(error);
      }
    }
  };
};
