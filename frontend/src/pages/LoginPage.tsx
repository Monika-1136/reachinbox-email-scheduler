import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Mail,
  Lock,
  ShieldCheck,
  Zap,
  Layers,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Clock,
  LogIn,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { user, loginWithGoogle, loginWithCredentials, loginWithDev, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDemoLoggingIn, setIsDemoLoggingIn] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const error = params.get('error');
    if (error) {
      setErrorMessage(decodeURIComponent(error));
    }
  }, [location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await loginWithCredentials(email.trim(), password);
      navigate('/dashboard');
    } catch (err) {
      setErrorMessage((err as Error).message || 'Invalid email or password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoLogin = async () => {
    setErrorMessage(null);
    setIsDemoLoggingIn(true);
    try {
      await loginWithDev('demo@reachinbox.local', 'Demo User');
      navigate('/dashboard');
    } catch (err) {
      setErrorMessage((err as Error).message || 'Demo login failed.');
    } finally {
      setIsDemoLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0D13] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden selection:bg-brand-500 selection:text-white">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-brand-600/15 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-[350px] h-[350px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        {/* Brand Icon */}
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 via-brand-500 to-indigo-400 p-0.5 shadow-2xl shadow-brand-500/30 mx-auto mb-4 flex items-center justify-center">
          <div className="w-full h-full bg-[#0E1017] rounded-[14px] flex items-center justify-center">
            <Mail className="w-7 h-7 text-brand-400" />
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Welcome back</h1>
        <p className="mt-1.5 text-xs sm:text-sm text-gray-400 font-medium">
          Sign in to manage your high-throughput email scheduling queues
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-[#12151F] border border-[#1F2433] py-8 px-6 sm:px-10 rounded-3xl shadow-2xl shadow-black/80 space-y-6">
          {errorMessage && (
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <div>
                <p className="font-semibold text-amber-300">Authentication Alert</p>
                <p className="text-[11px] text-amber-400/90 mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Email & Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0E1017] border border-[#23293B] focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-sm text-white placeholder-gray-600 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0E1017] border border-[#23293B] focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl text-sm text-white placeholder-gray-600 outline-none transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || isSubmitting || isDemoLoggingIn}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-brand-600/30 active:scale-[0.99] disabled:opacity-60"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Login</span>
                </>
              )}
            </button>
          </form>

          <div className="relative flex items-center justify-center my-4">
            <div className="border-t border-[#1F2433] w-full"></div>
            <span className="bg-[#12151F] px-3 text-[11px] font-medium text-gray-500 uppercase tracking-wider">
              Or Instant Options
            </span>
          </div>

          <div className="space-y-3">
            {/* Real Google OAuth Button */}
            <button
              type="button"
              onClick={loginWithGoogle}
              disabled={loading || isSubmitting || isDemoLoggingIn}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-[#2E354B] hover:border-gray-500 bg-[#0E1017] hover:bg-[#1A1E2C] text-sm font-semibold text-white rounded-xl transition-all shadow-md active:scale-[0.99]"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.2 8.9 5 12 5z"
                />
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.3 14.7c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.6 7.2C.6 9.2 0 11.5 0 14s.6 4.8 1.6 6.8l3.7-2.9z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5L1.6 16.2C3.5 20.1 7.4 23 12 23z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* Instant Demo Login Button */}
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={loading || isSubmitting || isDemoLoggingIn}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-brand-600/25 transition-all active:scale-[0.99]"
            >
              {isDemoLoggingIn ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>1-Click Demo Login</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {/* Signup link */}
          <div className="text-center pt-2">
            <p className="text-xs text-gray-400">
              Don't have an account?{' '}
              <Link to="/signup" className="text-brand-400 hover:text-brand-300 font-semibold hover:underline">
                Create an account
              </Link>
            </p>
          </div>

          {/* Architecture Badges */}
          <div className="pt-4 border-t border-[#1F2433] space-y-2 text-xs text-gray-400">
            <div className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-brand-400 shrink-0" />
              <span>BullMQ + Redis delayed queue persistence across restarts</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Deterministic idempotency prevents duplicate email dispatches</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Atomic hourly rate-limiting with real-time alerts</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>Ethereal & Real SMTP with Elasticsearch instant search</span>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-500 mt-6">
          ReachInbox Email Scheduler • Monorepo Architecture
        </p>
      </div>
    </div>
  );
};
