export class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;
  errors?: any[];

  constructor(statusCode: number, message: string, errors: any[] = [], isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(msg: string, errors: any[] = []) {
    return new ApiError(400, msg, errors);
  }

  static notFound(msg: string = 'Resource not found') {
    return new ApiError(404, msg);
  }

  static unauthorized(msg: string = 'Unauthorized') {
    return new ApiError(401, msg);
  }

  static forbidden(msg: string = 'Forbidden: Access denied') {
    return new ApiError(403, msg);
  }

  static internal(msg: string = 'Internal Server Error') {
    return new ApiError(500, msg, [], false);
  }

}
