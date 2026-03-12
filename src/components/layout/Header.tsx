import { Bell, Search, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { MOCK_ALERTS } from '@/constants/mockData';
import { formatDistanceToNow } from 'date-fns';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const criticalAlerts = MOCK_ALERTS.filter(a => a.riskLevel === 'critical' && a.status === 'open');

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <header className="h-14 border-b border-[hsl(220,20%,14%)] bg-[hsl(222,30%,7%)] flex items-center justify-between px-6 flex-shrink-0">
      <div>
        <h1 className="text-sm font-semibold text-slate-100">{title}</h1>
        {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {/* Timestamp */}
        <div className="text-[11px] text-slate-500 font-mono hidden md:block">
          {new Date().toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
        </div>

        {/* Refresh */}
        <button
          onClick={handleRefresh}
          className="w-8 h-8 rounded-lg border border-[hsl(220,20%,18%)] flex items-center justify-center text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>

        {/* Search */}
        <div className="relative hidden md:flex items-center">
          <Search className="absolute left-2.5 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search users, alerts..."
            className="w-48 h-8 pl-8 pr-3 text-xs bg-[hsl(220,20%,15%)] border border-[hsl(220,20%,18%)] rounded-lg text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40 focus:bg-[hsl(220,20%,17%)]"
          />
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative w-8 h-8 rounded-lg border border-[hsl(220,20%,18%)] flex items-center justify-center text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-colors"
          >
            <Bell className="w-3.5 h-3.5" />
            {criticalAlerts.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white font-bold flex items-center justify-center animate-pulse">
                {criticalAlerts.length}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-10 w-80 bg-[hsl(220,25%,11%)] border border-[hsl(220,20%,18%)] rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-[hsl(220,20%,18%)]">
                <div className="text-xs font-semibold text-slate-200">Critical Alerts</div>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {criticalAlerts.map(alert => (
                  <div key={alert.id} className="px-4 py-3 border-b border-[hsl(220,20%,14%)] hover:bg-white/5 cursor-pointer">
                    <div className="text-xs font-medium text-red-400">{alert.title}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{alert.userName} · {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
