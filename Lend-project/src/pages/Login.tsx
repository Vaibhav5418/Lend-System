import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Sparkles, Landmark } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { login, token, loading: authLoading } = useAuth();
  useEffect(() => {
    if (!authLoading && token) navigate('/', { replace: true });
  }, [token, authLoading, navigate]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (authLoading || token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin w-10 h-10 border-2 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left: Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 text-white p-12 flex-col justify-between">
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
          <p className="text-4xl font-semibold leading-tight max-w-md">
            Manage inquiries, borrowers and investors in one place.
          </p>
          <p className="text-slate-400 mt-6 max-w-sm">
            Sign in to access your dashboard and view all inquiries shared with your team.
          </p>
        </div>
        <div className="flex gap-2 text-slate-500 text-sm">
          <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>Secure login · All users see the same inquiry list</span>
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

          <h2 className="text-2xl font-bold text-slate-900 mb-2">Welcome back</h2>
          <p className="text-slate-600 mb-8">Sign in to your account to continue</p>

          <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-5">
            {error && (
              <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-sm font-medium">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-slate-700 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="login-password" className="block text-sm font-medium text-slate-700">Password</label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  id="login-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
            >
              {loading ? 'Signing in…' : 'Sign in'}
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>

          <p className="mt-8 text-center text-slate-600 text-sm">
            Don't have an account?{' '}
            <Link to="/register" className="font-semibold text-indigo-600 hover:text-indigo-700">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
