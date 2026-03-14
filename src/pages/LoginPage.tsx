import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useApp } from '@/lib/store';
import loginBg from '@/assets/login-bg.jpg';

export default function LoginPage() {
  const { login } = useApp();
  const navigate = useNavigate();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    await new Promise(r => setTimeout(r, 600));

    const result = await login(loginId.trim(), password);
    setLoading(false);

    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error || 'Login failed');
    }
  };

  const fillCredentials = (id: string, pass: string) => {
    setLoginId(id);
    setPassword(pass);
    setError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${loginBg})` }}
      />
      <div className="absolute inset-0 bg-[#020b18]/80 backdrop-blur-sm" />

      {/* Animated grid overlay */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            'linear-gradient(rgba(56,189,248,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.3) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-md px-4">
        <div className="bg-[#0d1f35]/90 border border-sky-500/20 rounded-2xl shadow-2xl shadow-sky-900/40 p-8 backdrop-blur-md">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center shadow-lg shadow-sky-500/30">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">SecureGuard AI</h1>
              <p className="text-xs text-sky-400/80">Insider Threat Early Warning System</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white mb-1">Sign In</h2>
          <p className="text-sm text-slate-400 mb-6">
            Authorized personnel only. All access is monitored.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Login ID
              </label>
              <input
                type="text"
                value={loginId}
                onChange={e => setLoginId(e.target.value)}
                className="w-full bg-[#0a1628] border border-slate-600/50 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/40 transition-all text-sm"
                placeholder="Enter your login ID"
                required
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-[#0a1628] border border-slate-600/50 rounded-lg px-4 py-3 pr-11 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/40 transition-all text-sm"
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 text-white font-semibold rounded-lg py-3 transition-all duration-200 shadow-lg shadow-sky-900/40 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                    <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
                  </svg>
                  Authenticating...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-6 pt-5 border-t border-slate-700/50">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-3">
              Demo Credentials
            </p>
            <div className="space-y-1.5">
              {[
                { label: 'Admin', id: 'admin', pass: 'admin123' },
                { label: 'Teller', id: 'sneha.patel', pass: 'Pass@1234' },
                { label: 'Loan Officer', id: 'rohit.mehta', pass: 'Pass@1234' },
                { label: 'Treasury Analyst', id: 'priya.iyer', pass: 'Pass@1234' },
                { label: 'DB Admin', id: 'arjun.sharma', pass: 'Pass@1234' },
              ].map(cred => (
                <button
                  key={cred.id}
                  type="button"
                  onClick={() => fillCredentials(cred.id, cred.pass)}
                  className="w-full flex items-center justify-between bg-[#0a1628] rounded-lg px-3 py-2 cursor-pointer hover:bg-[#0f2040] transition-colors gap-2"
                >
                  <span className="text-xs text-slate-300 font-medium flex-shrink-0">{cred.label}</span>
                  <span className="text-[10px] text-sky-400 font-mono truncate text-right">
                    {cred.id}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="text-center mt-4 space-y-1">
          <p className="text-xs text-slate-600">All sessions are recorded and monitored · SecureGuard AI v2.4</p>
          <p className="text-xs text-slate-500">
            Are you a bank customer?{' '}
            <a href="/customer" className="text-emerald-400 hover:text-emerald-300 transition-colors font-medium">Login to Net Banking →</a>
          </p>
        </div>
      </div>
    </div>
  );
}
