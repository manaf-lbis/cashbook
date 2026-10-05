import { Response } from 'express';

export class ApiResponse {
  static success<T>(res: Response, data: T, message: string = 'Success', statusCode: number = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  }

  static created<T>(res: Response, data: T, message: string = 'Created successfully') {
    return this.success(res, data, message, 201);
  }

  static error(res: Response, message: string = 'Error occurred', statusCode: number = 500, errors: any[] = []) {
    return res.status(statusCode).json({
      success: false,
      message,
      errors: errors.length > 0 ? errors : undefined,
    });
  }
}
