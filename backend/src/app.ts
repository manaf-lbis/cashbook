import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import apiRouter from './routes';
import { errorHandler } from './middlewares/errorHandler';
import { ApiError } from './utils/ApiError';
import { ENV } from './config/env';

export const createApp = (): Application => {
  const app = express();

  // Middleware
  app.use(cors({ origin: [ENV.CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'], credentials: true }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  if (ENV.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  // Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Mount API
  app.use('/api', apiRouter);

  // 404 Route
  app.use((_req: Request, _res: Response, next: NextFunction) => {
    next(ApiError.notFound('Requested API route not found'));
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
};
