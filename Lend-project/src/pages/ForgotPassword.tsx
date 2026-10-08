import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight, ArrowLeft, Landmark, CheckCircle2, ShieldCheck, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const { verifyEmail, resetPassword, token, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && token) navigate('/', { replace: true });
  }, [token, authLoading, navigate]);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (authLoading || token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin w-10 h-10 border-2 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Step 1: Verify Email
  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await verifyEmail(email);
      setUserName(res.name || '');
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Email verification failed');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email, password);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left: Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-12 flex-col justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 flex-shrink-0 rounded-xl bg-white/10 flex items-center justify-center">
            <Landmark className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Loanly</h1>
            <p className="text-slate-400 text-sm">CRM & Inquiry Hub</p>
          </div>
        </div>
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-medium mb-4 border border-indigo-500/30">
            <KeyRound className="w-3.5 h-3.5" />
            <span>Account Security</span>
          </div>
          <p className="text-4xl font-semibold leading-tight max-w-md">
            Reset and recover your account access safely.
          </p>
          <p className="text-slate-400 mt-6 max-w-sm">
            Enter your registered email address to verify your account and set a new secure password.
          </p>
        </div>
        <div className="flex gap-2 text-slate-500 text-sm">
          <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5 text-indigo-400" />
          <span>Encrypted credentials · Safe & instant password recovery</span>
        </div>
      </div>

      {/* Right: Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-slate-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="h-10 w-10 flex-shrink-0 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Landmark className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900">Loanly</span>
          </div>

          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to sign in
          </Link>

          {step === 1 && (
            <>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Forgot password?</h2>
              <p className="text-slate-600 mb-8">
                No worries! Enter your email address and we'll help you reset your password.
              </p>

              <form onSubmit={(e) => { void handleVerifyEmail(e); }} className="space-y-5">
                {error && (
                  <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm font-medium">
                    {error}
                  </div>
                )}

                <div>
                  <label htmlFor="forgot-email" className="block text-sm font-medium text-slate-700 mb-2">Registered Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      id="forgot-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-slate-900"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                >
                  {loading ? 'Checking account…' : 'Continue'}
                  <ArrowRight className="w-5 h-5" />
                </button>
              </form>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Create new password</h2>
              <p className="text-slate-600 mb-8">
                {userName ? `Hi ${userName}, set ` : 'Set '} a new secure password for{' '}
                <span className="font-semibold text-slate-800">{email}</span>.
              </p>

              <form onSubmit={(e) => { void handleResetPassword(e); }} className="space-y-5">
                {error && (
                  <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm font-medium">
                    {error}
                  </div>
                )}

                <div>
                  <label htmlFor="forgot-password" className="block text-sm font-medium text-slate-700 mb-2">New password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      id="forgot-password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="forgot-confirm-password" className="block text-sm font-medium text-slate-700 mb-2">Confirm new password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      id="forgot-confirm-password"
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-slate-900"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      setStep(1);
                    }}
                    className="w-1/3 py-3 px-4 border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-2/3 py-3 px-4 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                  >
                    {loading ? 'Resetting…' : 'Reset Password'}
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </form>
            </>
          )}

          {step === 3 && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-sm">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Password Reset Successful!</h2>
              <p className="text-slate-600 mb-8 max-w-sm mx-auto">
                Your password has been updated. You can now sign in to your Loanly account with your new credentials.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="w-full py-3 px-4 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
              >
                Go to Sign in
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}

          <p className="mt-8 text-center text-slate-600 text-sm">
            Remember your password?{' '}
            <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
