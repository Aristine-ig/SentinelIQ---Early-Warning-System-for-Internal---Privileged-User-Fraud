import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/lib/store';
import LoginPage from './LoginPage';
import { Shield } from 'lucide-react';

export default function Index() {
  const { state } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (state.currentUser) {
      navigate('/dashboard');
    }
  }, [state.currentUser, navigate]);

  if (state.loading) {
    return (
      <div className="min-h-screen bg-[#020b18] flex flex-col items-center justify-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center shadow-xl shadow-sky-900/40">
          <Shield className="w-7 h-7 text-white" />
        </div>
        <div className="text-center">
          <p className="text-white font-semibold text-lg">SecureGuard AI</p>
          <p className="text-slate-400 text-sm mt-1">Loading system data...</p>
        </div>
        <div className="flex gap-1.5 mt-2">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-sky-500 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    );
  }

  return <LoginPage />;
}
