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
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or server health checks)
        if (!origin) return callback(null, true);

        const configuredClient = ENV.CLIENT_URL ? ENV.CLIENT_URL.replace(/\/$/, '') : '';
        const allowed = [
          configuredClient,
          'http://localhost:5173',
          'http://127.0.0.1:5173',
        ].filter(Boolean);

        if (
          !configuredClient ||
          configuredClient === '*' ||
          allowed.includes(origin.replace(/\/$/, '')) ||
          ENV.NODE_ENV !== 'production'
        ) {
          return callback(null, true);
        }
        return callback(null, true);
      },
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  if (ENV.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  // Health check (supports both /health and /api/health)
  const healthCheck = (_req: Request, res: Response) => {
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  };
  app.get('/health', healthCheck);
  app.get('/api/health', healthCheck);

  // Mount API (supports both with /api and without /api)
  app.use('/api', apiRouter);
  app.use('/', apiRouter);

  // 404 Route
  app.use((_req: Request, _res: Response, next: NextFunction) => {
    next(ApiError.notFound('Requested API route not found'));
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
};
