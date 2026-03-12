import { useState } from 'react';
import { useCustomer } from '@/lib/customerStore';
import { formatCurrency, formatDate, maskAadhaar, maskPAN, cn } from '@/lib/utils';
import {
  Home, ArrowLeftRight, Users, PiggyBank, CreditCard, FileText,
  Bell, User, LogOut, ChevronRight, TrendingUp, TrendingDown,
  Shield, Building2, Menu, X, RefreshCw,
} from 'lucide-react';

// ─── Sub-page imports ─────────────────────────────────────────────────────────
import AccountOverview from '@/components/banking/AccountOverview';
import TransactionHistory from '@/components/banking/TransactionHistory';
import FundTransfer from '@/components/banking/FundTransfer';
import BeneficiaryManager from '@/components/banking/BeneficiaryManager';
import FixedDeposits from '@/components/banking/FixedDeposits';
import LoanApplications from '@/components/banking/LoanApplications';
import CustomerProfileView from '@/components/banking/CustomerProfileView';
import NotificationsView from '@/components/banking/NotificationsView';

type Panel = 'home' | 'transactions' | 'transfer' | 'beneficiaries' | 'fd' | 'loans' | 'profile' | 'notifications';

const NAV: { id: Panel; label: string; icon: React.ElementType }[] = [
  { id: 'home', label: 'Dashboard', icon: Home },
  { id: 'transactions', label: 'Transactions', icon: FileText },
  { id: 'transfer', label: 'Fund Transfer', icon: ArrowLeftRight },
  { id: 'beneficiaries', label: 'Beneficiaries', icon: Users },
  { id: 'fd', label: 'Fixed Deposits', icon: PiggyBank },
  { id: 'loans', label: 'Loans', icon: CreditCard },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'profile', label: 'Profile', icon: User },
];

export default function BankingDashboard() {
  const { state, logout } = useCustomer();
  const [activePanel, setActivePanel] = useState<Panel>('home');
  const [mobileOpen, setMobileOpen] = useState(false);
  const { currentCustomer, notifications } = state;
  const unread = notifications.filter(n => !n.isRead).length;

  if (!currentCustomer) return null;

  const creditTotal = state.transactions.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
  const debitTotal = state.transactions.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0);

  const renderPanel = () => {
    switch (activePanel) {
      case 'home': return <AccountOverview onNavigate={setActivePanel} />;
      case 'transactions': return <TransactionHistory />;
      case 'transfer': return <FundTransfer />;
      case 'beneficiaries': return <BeneficiaryManager />;
      case 'fd': return <FixedDeposits />;
      case 'loans': return <LoanApplications />;
      case 'profile': return <CustomerProfileView />;
      case 'notifications': return <NotificationsView />;
      default: return <AccountOverview onNavigate={setActivePanel} />;
    }
  };

  const NavContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-emerald-900/40">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/20">
          <Building2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="text-sm font-bold text-white">SecureBank</span>
          <span className="text-[10px] text-emerald-400/70 block">Net Banking</span>
        </div>
      </div>

      {/* Account card */}
      <div className="mx-3 mt-4 mb-3 bg-gradient-to-br from-emerald-800/40 to-teal-900/30 border border-emerald-700/30 rounded-xl p-3.5">
        <p className="text-[10px] text-emerald-400/70 uppercase tracking-wider">Available Balance</p>
        <p className="text-xl font-bold text-white mt-0.5">{formatCurrency(currentCustomer.balance)}</p>
        <div className="mt-2 pt-2 border-t border-emerald-900/30 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Customer ID</span>
            <span className="text-[10px] text-emerald-300 font-mono font-semibold">{currentCustomer.id}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Account</span>
            <span className="text-[10px] text-slate-300 font-mono">···· {currentCustomer.accountNumber.slice(-4)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">IFSC</span>
            <span className="text-[10px] text-slate-300 font-mono">{currentCustomer.ifscCode}</span>
          </div>
        </div>
        <div className="flex gap-3 mt-2.5">
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-emerald-400" />
            <span className="text-[10px] text-emerald-300">{formatCurrency(creditTotal)}</span>
          </div>
          <div className="flex items-center gap-1">
            <TrendingDown className="w-3 h-3 text-red-400" />
            <span className="text-[10px] text-red-300">{formatCurrency(debitTotal)}</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        {NAV.map(item => (
          <button key={item.id}
            onClick={() => { setActivePanel(item.id); setMobileOpen(false); }}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group",
              activePanel === item.id
                ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/30"
            )}
          >
            <item.icon className={cn("w-4 h-4 flex-shrink-0", activePanel === item.id ? "text-emerald-400" : "")} />
            <span className="text-sm font-medium flex-1 text-left">{item.label}</span>
            {item.id === 'notifications' && unread > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {unread}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Security badge */}
      <div className="mx-3 mb-3 flex items-center gap-2 bg-emerald-950/60 border border-emerald-800/30 rounded-lg px-3 py-2">
        <Shield className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-[10px] text-emerald-400/70">256-bit SSL secured</span>
      </div>

      {/* User + logout */}
      <div className="px-4 py-4 border-t border-emerald-900/40 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-white">{currentCustomer.fullName.charAt(0)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-white truncate">{currentCustomer.fullName}</p>
          <p className="text-[10px] text-slate-400 truncate">{currentCustomer.id}</p>
        </div>
        <button onClick={logout} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all" title="Logout">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#040d08] overflow-hidden">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-[#061a10] border-r border-emerald-900/40 z-50">
            <NavContent />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-[#061a10] border-r border-emerald-900/40 flex-shrink-0">
        <NavContent />
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-[#061a10]/80 border-b border-emerald-900/40 px-4 py-3 flex items-center gap-4 flex-shrink-0 backdrop-blur-sm">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 text-slate-400 hover:text-white">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-sm font-semibold text-white">
              {NAV.find(n => n.id === activePanel)?.label || 'Dashboard'}
            </h1>
            <p className="text-xs text-slate-500">{currentCustomer.branch}</p>
          </div>
          {state.dataLoading && (
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Loading...
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Secured
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-[#040d08]">
          {renderPanel()}
        </main>
      </div>
    </div>
  );
}
