import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import apiRouter from './routes';
import { errorHandler } from './middlewares/errorHandler';
import { mongoSanitize } from './middlewares/mongoSanitize';
import { ApiError } from './utils/ApiError';
import { ENV } from './config/env';

export const createApp = (): Application => {
  const app = express();

  // Security Headers via Helmet
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          workerSrc: ["'self'"],
          manifestSrc: ["'self'"],
        },
      },

      frameguard: { action: 'deny' },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
      hidePoweredBy: true,
      noSniff: true,
    })
  );

  // Global rate limiter to protect against DDoS
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Limit each IP to 500 requests per 15 minutes
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Too many requests from this IP address, please try again later.',
    },
  });
  app.use('/api', apiLimiter);

  // Stricter Rate Limiter for state-changing write operations (POST, PUT, DELETE, PATCH)
  const writeLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60, // Limit each IP to 60 mutations per minute
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method === 'GET' || req.method === 'OPTIONS',
    message: {
      success: false,
      message: 'Write operation limit exceeded, please slow down.',
    },
  });
  app.use('/api', writeLimiter);

  // Strict CORS Configuration
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, server health checks)
        if (!origin) return callback(null, true);

        const configuredClient = ENV.CLIENT_URL ? ENV.CLIENT_URL.replace(/\/$/, '') : '';
        const allowed = [
          configuredClient,
          'http://localhost:5173',
          'http://127.0.0.1:5173',
          'http://localhost:3000',
        ].filter(Boolean);

        if (
          ENV.NODE_ENV !== 'production'
            ? allowed.includes(origin.replace(/\/$/, '')) || !configuredClient || configuredClient === '*'
            : allowed.includes(origin.replace(/\/$/, ''))
        ) {
          return callback(null, true);
        }
        return callback(new Error('Blocked by CORS policy'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // Body parser with size limits
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Sanitize all incoming parameters and bodies against NoSQL injection
  app.use(mongoSanitize);

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
