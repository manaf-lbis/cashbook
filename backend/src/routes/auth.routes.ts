import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from '../controllers/AuthController';
import { validateRequest } from '../middlewares/validateRequest';
import { LoginSchema, SendOtpSchema, VerifyOtpSchema } from '../validators/schemas';
import { requireAuth } from '../middlewares/authMiddleware';

const router = Router();

// Rate limiter for login & OTP generation to prevent spam and brute-force attacks
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 attempts per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP, please try again after 15 minutes',
  },
});

const otpRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // Limit each IP to 20 OTP requests per 5 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many OTP requests. Please wait a few minutes before trying again.',
  },
});

router.post('/send-otp', otpRateLimiter, validateRequest(SendOtpSchema), AuthController.sendOtp);
router.post('/verify-otp', loginRateLimiter, validateRequest(VerifyOtpSchema), AuthController.verifyOtp);
router.post('/login', loginRateLimiter, validateRequest(LoginSchema), AuthController.login);
router.get('/me', requireAuth, AuthController.getMe);

export default router;
