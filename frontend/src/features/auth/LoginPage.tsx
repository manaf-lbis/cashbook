import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  Lock,
  Phone,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  BookOpen,
  Sparkles,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { showToast } = useToast();

  const [username, setUsername] = useState('7994414155');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Validate return path to prevent Open Redirect exploits (CWE-601)
  const rawFrom = (location.state as any)?.from?.pathname;
  const isSafeRelativePath =
    typeof rawFrom === 'string' &&
    rawFrom.startsWith('/') &&
    !rawFrom.startsWith('//') &&
    !rawFrom.includes(':') &&
    !rawFrom.includes('\\');
  const from = isSafeRelativePath ? rawFrom : '/';


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!username.trim()) {
      setErrorMessage('Please enter your phone number / username');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(username, password);
      showToast('Welcome back! Signed in successfully.', 'success');
      navigate(from, { replace: true });
    } catch (err: any) {
      const msg = err.message || 'Login failed. Please verify your credentials.';
      setErrorMessage(msg);
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUseCredentials = () => {
    setUsername('7994414155');
    setPassword('Login@8520');
    setErrorMessage(null);
    showToast('Credentials filled! Click Sign In to continue.', 'info');
  };

  return (
    <div className="min-h-screen w-screen bg-slate-900 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden font-sans">
      {/* Background Subtle Gradient Blobs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden relative z-10">
        {/* Header Header Brand */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 p-7 text-white text-center relative">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/30 mb-3">
            <BookOpen className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center justify-center gap-2">
            Cashbook <span className="bg-blue-500 text-[10px] font-black uppercase px-2 py-0.5 rounded text-white tracking-wider">PRO</span>
          </h1>
          <p className="text-xs text-slate-300 mt-1 font-medium">
            Shop Ledger & Cash Management Terminal
          </p>

          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-slate-200 text-xs font-medium backdrop-blur-sm border border-white/10">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Secure Authorized Access</span>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-7 sm:p-8">
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username / Phone Field */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Phone Number / Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. 7994414155"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-mono"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your security password"
                  className="w-full pl-10 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-500/25 transition-all transform active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Cashbook</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Helper Box for Configured Account */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" /> Authorized Login
                </span>
                <button
                  type="button"
                  onClick={handleUseCredentials}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 underline underline-offset-2"
                >
                  Auto-fill
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-white p-2 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 text-[10px] block font-sans">Username:</span>
                  <span className="font-bold text-slate-800">7994414155</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block font-sans">Password:</span>
                  <span className="font-bold text-slate-800">Login@8520</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Security Badges */}
        <div className="bg-slate-50 px-7 py-3.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            JWT Protected
          </span>
          <span>Bcrypt Hashed</span>
          <span>Rate Limited</span>
        </div>
      </div>

      <div className="mt-6 text-center text-xs text-slate-400 font-medium">
        Cashbook PRO &copy; {new Date().getFullYear()} • Safe & Secure Daily Ledgers
      </div>
    </div>
  );
};

export default LoginPage;
