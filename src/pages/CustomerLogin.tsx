import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, Eye, EyeOff, AlertCircle, UserPlus, LogIn, ArrowLeft } from 'lucide-react';
import { useCustomer } from '@/lib/customerStore';
import bankingBg from '@/assets/banking-bg.jpg';
import { cn } from '@/lib/utils';

type Mode = 'login' | 'signup';

export default function CustomerLogin() {
  const { login, signup, state } = useCustomer();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mobile, setMobile] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const result = await login(email.trim(), password);
    if (result.success) {
      navigate('/banking');
    } else {
      setError(result.error || 'Login failed');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!fullName.trim() || fullName.trim().length < 3) { setError('Please enter your full name (min 3 characters)'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    const result = await signup(email.trim(), password, mobile, fullName.trim());
    if (result.success) {
      navigate('/banking');
    } else {
      setError(result.error || 'Registration failed');
    }
  };

  const fill = (e: string, p: string) => { setEmail(e); setPassword(p); setError(''); };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${bankingBg})` }} />
      <div className="absolute inset-0 bg-[#020f0a]/80 backdrop-blur-sm" />
      <div className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: 'linear-gradient(rgba(16,185,129,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.4) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Back to staff login */}
        <Link to="/" className="flex items-center gap-2 text-emerald-400/70 hover:text-emerald-300 text-xs mb-4 transition-colors w-fit">
          <ArrowLeft className="w-3.5 h-3.5" />
          Staff Login
        </Link>

        <div className="bg-[#061a10]/90 border border-emerald-500/20 rounded-2xl shadow-2xl shadow-emerald-900/40 p-8 backdrop-blur-md">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">SecureBank</h1>
              <p className="text-xs text-emerald-400/80">Personal Net Banking</p>
            </div>
          </div>

          {/* Mode tabs */}
          <div className="flex rounded-xl bg-[#041209] border border-emerald-800/30 p-1 mb-6">
            {(['login', 'signup'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all",
                  mode === m
                    ? "bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                )}
              >
                {m === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                {m === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <Input label="Email Address" type="email" value={email} onChange={setEmail} placeholder="your@email.com" />
              <PasswordInput label="Password" value={password} onChange={setPassword} show={showPassword} onToggle={() => setShowPassword(!showPassword)} />
              {error && <ErrorMsg msg={error} />}
              <SubmitBtn loading={state.loading} label="Sign In" loadingLabel="Signing in..." />
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              <Input label="Full Name" value={fullName} onChange={setFullName} placeholder="e.g. Rahul Sharma" />
              <Input label="Email Address" type="email" value={email} onChange={setEmail} placeholder="your@email.com" />
              <Input label="Mobile Number" type="tel" value={mobile} onChange={setMobile} placeholder="9876543210" />
              <PasswordInput label="Password" value={password} onChange={setPassword} show={showPassword} onToggle={() => setShowPassword(!showPassword)} />
              <Input label="Confirm Password" type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={setConfirmPassword} placeholder="Repeat password" />
              {error && <ErrorMsg msg={error} />}
              <SubmitBtn loading={state.loading} label="Create Account" loadingLabel="Creating account..." />
            </form>
          )}

          {/* Demo credentials */}
          {mode === 'login' && (
            <div className="mt-6 pt-5 border-t border-emerald-900/40">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-3">Demo Accounts</p>
              <div className="space-y-2">
                {[
                  { label: 'Customer 1', email: 'demo1@bank.com', pass: 'Customer@1' },
                  { label: 'Customer 2', email: 'demo2@bank.com', pass: 'Customer@1' },
                  { label: 'Customer 3', email: 'demo3@bank.com', pass: 'Customer@1' },
                ].map(c => (
                  <button key={c.email} type="button" onClick={() => fill(c.email, c.pass)}
                    className="w-full flex items-center justify-between bg-[#041209] rounded-lg px-3 py-2 hover:bg-[#072010] transition-colors">
                    <span className="text-xs text-slate-300">{c.label}</span>
                    <span className="text-xs text-emerald-400 font-mono">{c.email}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === 'signup' && (
            <div className="mt-4 bg-emerald-950/40 border border-emerald-800/30 rounded-xl px-4 py-3">
              <p className="text-xs text-emerald-400/80 font-semibold">Your Customer ID will be auto-generated</p>
              <p className="text-xs text-slate-500 mt-0.5">A unique Customer ID will be assigned to your account upon registration.</p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-600 mt-4">
          Secured by SecureGuard AI · 256-bit encryption
        </p>
      </div>
    </div>
  );
}

// ─── Local helpers ─────────────────────────────────────────────────────────────

function Input({ label, type = 'text', value, onChange, placeholder }: { label: string; type?: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required
        className="w-full bg-[#041209] border border-emerald-800/40 rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm" />
    </div>
  );
}

function PasswordInput({ label, value, onChange, show, onToggle }: { label: string; value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">{label}</label>
      <div className="relative">
        <input type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} required
          className="w-full bg-[#041209] border border-emerald-800/40 rounded-lg px-4 py-3 pr-11 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm" />
        <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1">
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5">
      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
      <p className="text-sm text-red-300">{msg}</p>
    </div>
  );
}

function SubmitBtn({ loading, label, loadingLabel }: { loading: boolean; label: string; loadingLabel: string }) {
  return (
    <button type="submit" disabled={loading}
      className="w-full bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-semibold rounded-lg py-3 transition-all duration-200 shadow-lg shadow-emerald-900/40 disabled:opacity-50 disabled:cursor-not-allowed mt-2">
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
            <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
          </svg>
          {loadingLabel}
        </span>
      ) : label}
    </button>
  );
}
