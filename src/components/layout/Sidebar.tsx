import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Bell, Users, Activity, FolderOpen, Shield, ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MOCK_ALERTS, MOCK_CASES } from '@/constants/mockData';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/alerts', label: 'Alerts', icon: Bell, badge: true },
  { path: '/users', label: 'User Profiles', icon: Users },
  { path: '/activity', label: 'Activity Log', icon: Activity },
  { path: '/cases', label: 'Cases', icon: FolderOpen, caseBadge: true },
];

export default function Sidebar() {
  const location = useLocation();
  const openAlerts = MOCK_ALERTS.filter(a => a.status === 'open').length;
  const openCases = MOCK_CASES.filter(c => c.status === 'open' || c.status === 'in_progress' || c.status === 'escalated').length;

  return (
    <aside className="w-60 min-h-screen bg-[hsl(222,35%,6%)] border-r border-[hsl(220,20%,14%)] flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[hsl(220,20%,14%)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center glow-cyan">
            <Shield className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="font-bold text-sm text-white tracking-wide">SentinelIQ</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-widest">Fraud EWS</div>
          </div>
        </div>
      </div>

      {/* Live Status */}
      <div className="mx-4 mt-4 mb-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
        <div className="flex items-center gap-2">
          <div className="relative w-2 h-2">
            <div className="w-2 h-2 rounded-full bg-green-400"></div>
            <div className="absolute inset-0 w-2 h-2 rounded-full bg-green-400 animate-ping opacity-40"></div>
          </div>
          <span className="text-xs text-green-400 font-medium">Live Monitoring</span>
        </div>
        <div className="mt-1 text-[10px] text-slate-500">412 users · Updated now</div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1">
        {navItems.map(({ path, label, icon: Icon, badge, caseBadge }) => {
          const isActive = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
          return (
            <NavLink
              key={path}
              to={path}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group',
                isActive
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              )}
            >
              <Icon className={cn('w-4 h-4', isActive ? 'text-cyan-400' : 'text-slate-500 group-hover:text-slate-300')} />
              <span className="flex-1">{label}</span>
              {badge && openAlerts > 0 && (
                <span className="text-[10px] bg-red-500 text-white rounded-full px-1.5 py-0.5 min-w-[20px] text-center font-bold">
                  {openAlerts}
                </span>
              )}
              {caseBadge && openCases > 0 && (
                <span className="text-[10px] bg-orange-500 text-white rounded-full px-1.5 py-0.5 min-w-[20px] text-center font-bold">
                  {openCases}
                </span>
              )}
              {isActive && <ChevronRight className="w-3 h-3 text-cyan-500/60" />}
            </NavLink>
          );
        })}
      </nav>

      {/* User Info */}
      <div className="px-4 py-4 border-t border-[hsl(220,20%,14%)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-xs text-cyan-400 font-bold">
            CW
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-slate-200 font-medium truncate">Chen Wei</div>
            <div className="text-[10px] text-slate-500 truncate">Lead Investigator</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
