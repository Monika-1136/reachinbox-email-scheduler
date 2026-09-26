import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import {
  Mail,
  Lock,
  User as UserIcon,
  ArrowRight,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

export const SignupPage: React.FC = () => {
  const { user, signupWithCredentials, loginWithDev, loginWithGoogle, loading } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Full name is required.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await signupWithCredentials(name, email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.message || err.message || 'Failed to create account. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
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

        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Create Account</h1>
        <p className="mt-1.5 text-xs sm:text-sm text-gray-400 font-medium">
          Join ReachInbox Outbound Email Scheduler
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-[#12151F] border border-[#1F2433] py-8 px-6 sm:px-10 rounded-3xl shadow-2xl shadow-black/80 space-y-6">
          {errorMessage && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <div>
                <p className="font-semibold text-rose-300">Signup Failed</p>
                <p className="text-[11px] text-rose-400/90 mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Sarah Connor"
                  className="w-full bg-[#0B0D13] border border-[#1F2433] focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-600 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sarah@company.com"
                  className="w-full bg-[#0B0D13] border border-[#1F2433] focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-600 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#0B0D13] border border-[#1F2433] focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-600 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#0B0D13] border border-[#1F2433] focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-600 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || loading}
              className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-3 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-2xl shadow-lg shadow-brand-500/25 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="relative flex items-center justify-center my-4">
            <div className="border-t border-[#1F2433] w-full"></div>
            <span className="bg-[#12151F] px-3 text-[11px] font-medium text-gray-500 uppercase tracking-wider">
              Or
            </span>
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={loginWithGoogle}
              disabled={loading || isSubmitting}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-[#2E354B] hover:border-gray-500 bg-[#0E1017] hover:bg-[#1A1E2C] text-xs font-semibold text-white rounded-xl transition-all shadow-md active:scale-[0.99]"
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

            <button
              type="button"
              onClick={() => loginWithDev('demo@reachinbox.local', 'Demo User')}
              disabled={loading || isSubmitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1F2433] hover:bg-[#2A3144] text-gray-200 text-xs font-semibold rounded-xl transition-all shadow-md active:scale-[0.99]"
            >
              <Sparkles className="w-3.5 h-3.5 text-brand-400" />
              <span>1-Click Demo Login</span>
            </button>
          </div>

          <p className="text-center text-xs text-gray-400 pt-2 border-t border-[#1F2433]">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-400 font-semibold hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
