import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  Mail,
  ArrowRight,
  AlertCircle,
  KeyRound,
  ShieldCheck,
  Scale,
  Clock,
  RotateCcw,
  Sparkles,
  Lock,
  CheckCircle2,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { sendOtp, verifyOtp } = useAuth();
  const { showToast } = useToast();

  const [step, setStep] = useState<'EMAIL' | 'OTP'>('EMAIL');
  const [email, setEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const rawFrom = (location.state as any)?.from?.pathname;
  const isSafeRelativePath =
    typeof rawFrom === 'string' &&
    rawFrom.startsWith('/') &&
    !rawFrom.startsWith('//') &&
    !rawFrom.includes(':') &&
    !rawFrom.includes('\\');
  const from = isSafeRelativePath ? rawFrom : '/';

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage('Please enter your email address');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await sendOtp(cleanEmail);
      setStep('OTP');
      setCountdown(60);
      setOtpDigits(['', '', '', '', '', '']);
      if (res && res.emailDelivery === false) {
        showToast(res.message || 'Verification code logged to server console', 'info');
      } else {
        showToast('Verification code sent to your email', 'success');
      }

      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 120);
    } catch (err: any) {
      setErrorMessage(err.message || 'Access denied: Email not authorized');
      showToast(err.message || 'Access denied', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const cleaned = value.replace(/\D/g, '');
    const newDigits = [...otpDigits];

    if (cleaned.length > 1) {
      const pasted = cleaned.slice(0, 6).split('');
      pasted.forEach((char, i) => {
        newDigits[i] = char;
      });
      setOtpDigits(newDigits);
      const nextIndex = Math.min(pasted.length, 5);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    newDigits[index] = cleaned;
    setOtpDigits(newDigits);

    if (cleaned && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pastedData) return;

    const newDigits = [...otpDigits];
    pastedData.split('').forEach((char, i) => {
      newDigits[i] = char;
    });
    setOtpDigits(newDigits);
    const targetIdx = Math.min(pastedData.length, 5);
    inputRefs.current[targetIdx]?.focus();
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const fullOtp = otpDigits.join('');
    if (fullOtp.length !== 6) {
      setErrorMessage('Please enter all 6 digits of the code');
      return;
    }

    setIsSubmitting(true);
    try {
      await verifyOtp(email, fullOtp);
      showToast('Welcome back! Signed in successfully.', 'success');
      navigate(from, { replace: true });
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid or expired code. Please try again.');
      showToast(err.message || 'Verification failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#090D16] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans select-none text-slate-100">
      {/* Aesthetic Ambient Glowing Lights */}
      <div className="absolute top-1/4 -left-20 w-[450px] h-[450px] bg-gradient-to-tr from-blue-600/25 via-indigo-600/20 to-purple-600/10 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-[450px] h-[450px] bg-gradient-to-bl from-indigo-500/20 via-cyan-500/15 to-blue-600/25 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-blue-600/10 via-transparent to-transparent pointer-events-none" />

      {/* Subtle Dot Matrix Overlay */}
      <div
        className="absolute inset-0 opacity-[0.035] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.7) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative z-10 w-full max-w-[410px]">
        {/* Floating Aesthetic Glass Card */}
        <div className="bg-slate-900/70 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] p-8 sm:p-9 relative overflow-hidden">
          {/* Top Hairline Gradient Glow */}
          <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-blue-500/60 to-transparent" />

          {/* Logo Brand Header */}
          <div className="text-center mb-7">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-500 text-white shadow-lg shadow-blue-500/25 border border-white/20 mb-3.5">
              <Scale className="w-6 h-6" />
            </div>
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-white font-mono">
                Cashbook
              </h1>
              <span className="bg-gradient-to-r from-blue-500 to-indigo-500 text-[10px] font-black uppercase px-2 py-0.5 rounded-md text-white tracking-wider border border-white/10 shadow-xs">
                PRO
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              {step === 'EMAIL' ? 'Shop Financial Ledger & Terminal' : 'Security Passcode Verification'}
            </p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="mb-5 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {step === 'EMAIL' ? (
            /* STEP 1: EMAIL ADDRESS */
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    autoFocus
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full h-12 pl-10 pr-4 bg-slate-800/60 border border-slate-700/80 rounded-2xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 focus:bg-slate-800/90 transition-all font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:opacity-95 text-white font-bold text-sm rounded-2xl shadow-lg shadow-blue-500/25 transition-all transform active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 mt-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Sending Code...</span>
                  </>
                ) : (
                  <>
                    <span>Send Login Code</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* STEP 2: 6-DIGIT PASSCODE */
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    One-Time Passcode
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('EMAIL');
                      setErrorMessage(null);
                    }}
                    className="text-xs text-blue-400 hover:text-blue-300 font-semibold transition-colors"
                  >
                    Change Email
                  </button>
                </div>

                <div className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/60 mb-3.5 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Sent to:</span>
                  <span className="font-bold font-mono text-slate-200">{email}</span>
                </div>

                {/* 6 Digit Input Cells */}
                <div className="flex justify-between gap-1.5 sm:gap-2" onPaste={handlePaste}>
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (inputRefs.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      className={`w-11 sm:w-12 h-14 rounded-2xl text-center text-2xl font-black font-mono transition-all border ${
                        digit
                          ? 'border-blue-500 bg-blue-500/15 text-white shadow-[0_0_15px_rgba(59,130,246,0.25)] ring-2 ring-blue-500/20'
                          : 'border-slate-700/80 bg-slate-800/50 text-white focus:border-blue-500 focus:bg-slate-800/80 focus:ring-2 focus:ring-blue-500/20 focus:outline-none'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || otpDigits.join('').length !== 6}
                className="w-full h-12 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:opacity-95 text-white font-bold text-sm rounded-2xl shadow-lg shadow-blue-500/25 transition-all transform active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>Verify & Enter Terminal</span>
                  </>
                )}
              </button>

              <div className="text-center pt-1 border-t border-slate-800/60">
                {countdown > 0 ? (
                  <p className="text-xs text-slate-400 flex items-center justify-center gap-1.5 font-medium">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    Resend passcode in <span className="font-bold font-mono text-slate-200">{countdown}s</span>
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSendOtp()}
                    disabled={isSubmitting}
                    className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center justify-center gap-1 mx-auto transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Didn't receive code? Resend OTP</span>
                  </button>
                )}
              </div>
            </form>
          )}

          {/* Bottom Security Highlights */}
          <div className="mt-7 pt-4 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1 text-slate-300 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Resend Delivery
            </span>
            <span>TLS 1.3 Encrypted</span>
            <span>10-Min Expiry</span>
          </div>
        </div>

        {/* Outer Minimal Footer */}
        <div className="mt-6 text-center text-xs text-slate-500 font-medium flex items-center justify-center gap-2">
          <Lock className="w-3.5 h-3.5 text-slate-500" />
          <span>Authorized Access Only • Cashbook PRO</span>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
