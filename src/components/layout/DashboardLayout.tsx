import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, ShieldAlert, LayoutDashboard, Bell, Users, Activity, FileText,
  LogOut, ChevronLeft, ChevronRight, User, AlertTriangle,
  Menu, X, FileCheck, CreditCard, Phone,
} from 'lucide-react';
import { useApp } from '@/lib/store';
import { cn, getSeverity } from '@/lib/utils';

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
  roles?: string[]; // specific roles that can see this (in addition to admin)
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, adminOnly: true },
  { id: 'alerts', label: 'Live Alerts', icon: Bell, adminOnly: true },
  { id: 'behaviour', label: 'User Behaviour', icon: Activity, adminOnly: true },
  { id: 'usermgmt', label: 'User Management', icon: Users, adminOnly: true },
  { id: 'activitylog', label: 'Activity Log', icon: FileText, adminOnly: true },
  { id: 'kyc', label: 'KYC Requests', icon: FileCheck, adminOnly: true },
  { id: 'loanreqs', label: 'Loan Requests', icon: CreditCard, adminOnly: true, roles: ['Loan Officer', 'Branch Manager'] },
  { id: 'changereqs', label: 'Change Requests', icon: Phone, adminOnly: true, roles: ['Teller'] },
  { id: 'makerchecker', label: 'Maker-Checker', icon: ShieldAlert, adminOnly: true, roles: ['Branch Manager', 'Teller', 'Treasury Analyst'] },
  { id: 'customers', label: 'Customer Portal', icon: User, adminOnly: false },
];

interface DashboardLayoutProps {
  activePanel: string;
  onPanelChange: (id: string) => void;
  children: React.ReactNode;
}

export default function DashboardLayout({ activePanel, onPanelChange, children }: DashboardLayoutProps) {
  const { state, logout } = useApp();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { currentUser, currentSession, alerts } = state;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const riskScore = currentSession?.riskScore || 0;
  const severity = getSeverity(riskScore);
  const openAlerts = alerts.filter(a => a.status === 'open').length;

  // Strict role check — never derive from a potentially stale prop
  const isAdmin: boolean = currentUser?.isAdmin === true;
  const userRole = currentUser?.role ?? '';
  const visibleItems = NAV_ITEMS.filter(item => {
    if (isAdmin) return true;
    if (!item.adminOnly) return true;
    if (item.roles && item.roles.includes(userRole)) return true;
    return false;
  });

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn(
        "flex items-center gap-3 px-4 py-5 border-b border-slate-700/50",
        collapsed ? "justify-center" : ""
      )}>
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center flex-shrink-0 shadow-lg shadow-sky-500/20">
          <Shield className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div>
            <span className="text-sm font-bold text-white">SecureGuard</span>
            <span className="text-[10px] text-sky-400/70 block">AI Threat System</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {visibleItems.map(item => (
          <button
            key={item.id}
            onClick={() => { if (isAdmin || !item.adminOnly || (item.roles && item.roles.includes(userRole))) { onPanelChange(item.id); setMobileOpen(false); } }}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group",
              activePanel === item.id
                ? "bg-sky-600/20 text-sky-300 border border-sky-500/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/40",
              collapsed ? "justify-center" : ""
            )}
          >
            <item.icon className={cn("w-4 h-4 flex-shrink-0", activePanel === item.id ? "text-sky-400" : "")} />
            {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
            {!collapsed && item.id === 'alerts' && openAlerts > 0 && (
              <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {openAlerts > 99 ? '99+' : openAlerts}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* User session risk — admin only */}
      {isAdmin && !collapsed && currentSession && (
        <div className="px-3 py-3 mx-2 mb-2 bg-[#0a1628] rounded-lg border border-slate-700/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">Session Risk</span>
            <span className={cn(
              "text-[10px] font-bold px-1.5 py-0.5 rounded border",
              severity === 'Low' ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' :
              severity === 'Medium' ? 'text-amber-300 bg-amber-500/10 border-amber-500/30' :
              severity === 'High' ? 'text-orange-300 bg-orange-500/10 border-orange-500/30' :
              severity === 'Critical' ? 'text-red-300 bg-red-500/10 border-red-500/30' :
              'text-rose-200 bg-rose-500/20 border-rose-400/50 animate-pulse'
            )}>
              {severity}
            </span>
          </div>
          <div className="w-full bg-slate-700/50 rounded-full h-1.5">
            <div
              className={cn(
                "h-1.5 rounded-full transition-all duration-500",
                severity === 'Low' ? 'bg-emerald-500' :
                severity === 'Medium' ? 'bg-amber-500' :
                severity === 'High' ? 'bg-orange-500' :
                severity === 'Critical' ? 'bg-red-500' : 'bg-rose-500'
              )}
              style={{ width: `${riskScore}%` }}
            />
          </div>
          <div className="text-right text-[10px] text-slate-400 mt-1">{riskScore}/100</div>
        </div>
      )}

      {/* User info + logout */}
      <div className={cn(
        "px-4 py-4 border-t border-slate-700/50 flex items-center gap-3",
        collapsed ? "justify-center" : ""
      )}>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-white">
            {currentUser?.fullName.charAt(0) || 'U'}
          </span>
        </div>
        {!collapsed && (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{currentUser?.fullName}</p>
              <p className="text-[10px] text-slate-400 truncate">{currentUser?.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#060e1a] overflow-hidden">
      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-[#0d1f35] border-r border-slate-700/50 z-50">
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className={cn(
        "hidden lg:flex flex-col bg-[#0d1f35] border-r border-slate-700/50 flex-shrink-0 transition-all duration-300",
        collapsed ? "w-16" : "w-56"
      )}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute left-full top-16 z-10 ml-px w-5 h-8 bg-[#0d1f35] border border-slate-700/50 border-l-0 rounded-r-md flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
        <SidebarContent />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-[#0d1f35]/80 border-b border-slate-700/50 px-4 py-3 flex items-center gap-4 flex-shrink-0 backdrop-blur-sm">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 text-slate-400 hover:text-white"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex-1">
            <h1 className="text-sm font-semibold text-white">
              {visibleItems.find(i => i.id === activePanel)?.label || 'Dashboard'}
            </h1>
            {isAdmin && (
              <p className="text-xs text-slate-500">Administrator · All Systems</p>
            )}
          </div>

          {/* Severe warning */}
          {severity === 'Severe' && (
            <div className="flex items-center gap-2 bg-rose-500/20 border border-rose-500/40 rounded-lg px-3 py-1.5 animate-pulse">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span className="text-xs font-bold text-rose-300">SEVERE RISK — Session flagged</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
