import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Mail,
  ShieldCheck,
  Zap,
  Layers,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Clock,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { user, loginWithGoogle, loginWithDev, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [oauthError, setOauthError] = useState<string | null>(null);
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
      setOauthError(decodeURIComponent(error));
    }
  }, [location]);

  const handleDemoLogin = async () => {
    setIsDemoLoggingIn(true);
    try {
      await loginWithDev('reviewer@reachinbox.ai', 'ReachInbox Reviewer');
      navigate('/dashboard');
    } catch {
      // ignore
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

        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">ReachInbox</h1>
        <p className="mt-1.5 text-xs sm:text-sm text-gray-400 font-medium">
          Production-grade Full-Stack Email Job Scheduler
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-[#12151F] border border-[#1F2433] py-8 px-6 sm:px-10 rounded-3xl shadow-2xl shadow-black/80 space-y-6">
          {oauthError && (
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <div>
                <p className="font-semibold text-amber-300">Authentication Note</p>
                <p className="text-[11px] text-amber-400/90 mt-0.5">{oauthError}</p>
              </div>
            </div>
          )}

          <div className="space-y-3.5">
            {/* Real Google OAuth Button */}
            <button
              onClick={loginWithGoogle}
              disabled={loading || isDemoLoggingIn}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-[#2E354B] hover:border-gray-500 bg-[#0E1017] hover:bg-[#1A1E2C] text-sm font-semibold text-white rounded-2xl transition-all shadow-lg active:scale-[0.99]"
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

            <div className="relative flex items-center justify-center my-4">
              <div className="border-t border-[#1F2433] w-full"></div>
              <span className="bg-[#12151F] px-3 text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                Or Instant Dev Access
              </span>
            </div>

            {/* Instant Demo Login Button */}
            <button
              onClick={handleDemoLogin}
              disabled={loading || isDemoLoggingIn}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-2xl shadow-xl shadow-brand-600/25 transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              {isDemoLoggingIn ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Signing In...</span>
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

          {/* Architecture Badges */}
          <div className="pt-4 border-t border-[#1F2433] space-y-2.5 text-xs text-gray-400">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand-400 shrink-0" />
              <span>BullMQ + Redis delayed queue persistence across restarts</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Deterministic idempotency prevents duplicate email dispatches</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Atomic hourly rate-limiting with real-time Slack alerts</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Ethereal SMTP delivery & Elasticsearch instant search</span>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-500 mt-6">
          ReachInbox / Outbox Labs Assessment • Monorepo Architecture
        </p>
      </div>
    </div>
  );
};
