import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from '../controllers/AuthController';
import { validateRequest } from '../middlewares/validateRequest';
import { LoginSchema } from '../validators/schemas';
import { requireAuth } from '../middlewares/authMiddleware';

const router = Router();

// Rate limiter for login endpoint to prevent brute-force attacks
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts from this IP, please try again after 15 minutes',
  },
});

router.post('/login', loginRateLimiter, validateRequest(LoginSchema), AuthController.login);
router.get('/me', requireAuth, AuthController.getMe);

export default router;
