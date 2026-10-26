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
import './utils/dateUtils';

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
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      dnsPrefetchControl: { allow: false },
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
  const configuredClients = (ENV.CLIENT_URL || '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);

  const defaultAllowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    ...configuredClients,
  ];

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server health checks)
        if (!origin) return callback(null, true);

        const normalizedOrigin = origin.replace(/\/$/, '');

        if (ENV.NODE_ENV !== 'production') {
          // In development, allow localhost or configured client URLs
          if (
            defaultAllowedOrigins.includes(normalizedOrigin) ||
            configuredClients.length === 0 ||
            configuredClients.includes('*')
          ) {
            return callback(null, true);
          }
        } else {
          // In production, strictly allow only explicitly listed origins
          if (defaultAllowedOrigins.includes(normalizedOrigin)) {
            return callback(null, true);
          }
        }

        // Return false without throwing 500 error
        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
      optionsSuccessStatus: 200,
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
