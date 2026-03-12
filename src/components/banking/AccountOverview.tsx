
import { useState } from 'react';
import { useCustomer } from '@/lib/customerStore';
import { formatCurrency, formatDate, formatDateShort, maskAadhaar, maskPAN, cn } from '@/lib/utils';
import {
  TrendingUp, TrendingDown, ArrowUpRight, CreditCard,
  PiggyBank, Bell, ArrowRight, Activity,
  Shield, AlertTriangle, CheckCircle, Clock,
} from 'lucide-react';
import { toast } from 'sonner';

type Panel = 'home' | 'transactions' | 'transfer' | 'beneficiaries' | 'fd' | 'loans' | 'profile' | 'notifications';

interface Props { onNavigate: (panel: Panel) => void; }

export default function AccountOverview({ onNavigate }: Props) {
  const { state, initiateKYC } = useCustomer();
  const [kycLoading, setKycLoading] = useState(false);
  const { currentCustomer, transactions, fixedDeposits, loans, notifications } = state;
  if (!currentCustomer) return null;

  const recentTx = transactions.slice(0, 5);
  const creditTotal = transactions.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
  const debitTotal = transactions.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0);
  const activeFDs = fixedDeposits.filter(f => f.status === 'active');
  const pendingLoans = loans.filter(l => l.status === 'pending' || l.status === 'approved');
  const unreadNotifs = notifications.filter(n => !n.isRead).length;

  const quickActions: { label: string; icon: React.ElementType; panel: Panel; color: string }[] = [
    { label: 'Transfer Funds', icon: ArrowUpRight, panel: 'transfer', color: 'from-emerald-600 to-teal-700' },
    { label: 'View Statement', icon: Activity, panel: 'transactions', color: 'from-sky-600 to-blue-700' },
    { label: 'Apply Loan', icon: CreditCard, panel: 'loans', color: 'from-violet-600 to-purple-700' },
    { label: 'Open FD', icon: PiggyBank, panel: 'fd', color: 'from-amber-600 to-orange-700' },
  ];

  const handleInitiateKYC = async () => {
    setKycLoading(true);
    const result = await initiateKYC();
    setKycLoading(false);
    if (result.success) {
      toast.success('KYC request submitted successfully! Our team will review it shortly.');
    } else {
      toast.error(result.error || 'Failed to submit KYC request');
    }
  };

  return (
    <div className="space-y-6"> {/* Added a root div element to wrap multiple JSX elements */}
      {/* KYC Alert Banner for new/pending customers */}
      {currentCustomer.kycStatus !== 'Verified' && (
        <div className={cn(
          "border rounded-2xl p-4 flex items-start gap-4",
          currentCustomer.kycStatus === 'Pending'
            ? "bg-amber-500/10 border-amber-500/30"
            : "bg-red-500/10 border-red-500/30"
        )}>
          <AlertTriangle className={cn("w-5 h-5 mt-0.5 flex-shrink-0",
            currentCustomer.kycStatus === 'Pending' ? 'text-amber-400' : 'text-red-400'
          )} />
          <div className="flex-1">
            <p className={cn("text-sm font-bold",
              currentCustomer.kycStatus === 'Pending' ? 'text-amber-300' : 'text-red-300'
            )}>
              {currentCustomer.kycStatus === 'Pending' ? 'KYC Verification Required' : 'KYC Expired'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {currentCustomer.kycStatus === 'Pending'
                ? 'Your account has limited features until KYC is verified. Click below to submit your KYC request.'
                : 'Your KYC has expired. Please re-submit to continue using all banking features.'}
            </p>
          </div>
          <button
            onClick={handleInitiateKYC}
            disabled={kycLoading}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs rounded-lg transition-all flex-shrink-0 disabled:opacity-60 disabled:cursor-not-allowed">
            {kycLoading ? (
              <>
                <Clock className="w-3.5 h-3.5 animate-spin" /> Submitting...
              </>
            ) : (
              <>
                <Shield className="w-3.5 h-3.5" /> Initiate KYC
              </>
            )}
          </button>
        </div>
      )}

      {/* KYC verified badge */}
      {currentCustomer.kycStatus === 'Verified' && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span className="text-xs text-emerald-300 font-semibold">KYC Verified — Account fully active</span>
        </div>
      )}
      {/* Welcome banner */}
      <div className="bg-gradient-to-br from-emerald-800/40 to-teal-900/20 border border-emerald-700/30 rounded-2xl p-5 lg:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <p className="text-emerald-400/70 text-sm">Good to see you,</p>
            <h2 className="text-2xl font-bold text-white mt-0.5">{currentCustomer.fullName}</h2>
            <p className="text-slate-400 text-xs mt-1">
              {currentCustomer.accountType} Account · {currentCustomer.branch}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-emerald-400/70">Available Balance</p>
            <p className="text-3xl font-bold text-white">{formatCurrency(currentCustomer.balance)}</p>
            <p className="text-xs text-slate-500 mt-1">A/C: ···· {currentCustomer.accountNumber.slice(-4)}</p>
          </div>
        </div>

        {/* Income/Expense bar */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Total Credits</p>
              <p className="text-sm font-bold text-emerald-300">{formatCurrency(creditTotal)}</p>
            </div>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-3">
            <TrendingDown className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Total Debits</p>
              <p className="text-sm font-bold text-red-300">{formatCurrency(debitTotal)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {quickActions.map(a => (
            <button key={a.panel} onClick={() => onNavigate(a.panel)}
              className={cn("bg-gradient-to-br rounded-xl p-4 text-white text-left hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg", a.color)}>
              <a.icon className="w-6 h-6 mb-3 opacity-90" />
              <p className="text-sm font-semibold">{a.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <button onClick={() => onNavigate('fd')}
          className="bg-[#061a10] border border-emerald-900/40 rounded-xl p-4 text-left hover:border-emerald-700/40 transition-all group">
          <div className="flex items-center justify-between mb-2">
            <PiggyBank className="w-5 h-5 text-emerald-400" />
            <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 transition-colors" />
          </div>
          <p className="text-xl font-bold text-white">{activeFDs.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">Active FDs</p>
          {activeFDs.length > 0 && (
            <p className="text-xs text-emerald-400 mt-1">{formatCurrency(activeFDs.reduce((s, f) => s + f.principal, 0))}</p>
          )}
        </button>

        <button onClick={() => onNavigate('loans')}
          className="bg-[#061a10] border border-emerald-900/40 rounded-xl p-4 text-left hover:border-emerald-700/40 transition-all group">
          <div className="flex items-center justify-between mb-2">
            <CreditCard className="w-5 h-5 text-violet-400" />
            <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-violet-400 transition-colors" />
          </div>
          <p className="text-xl font-bold text-white">{pendingLoans.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">Loan Applications</p>
          {pendingLoans.length > 0 && (
            <p className="text-xs text-violet-400 mt-1">{pendingLoans[0]?.status}</p>
          )}
        </button>

        <button onClick={() => onNavigate('notifications')}
          className="bg-[#061a10] border border-emerald-900/40 rounded-xl p-4 text-left hover:border-emerald-700/40 transition-all group col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <Bell className="w-5 h-5 text-amber-400" />
            <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-amber-400 transition-colors" />
          </div>
          <p className="text-xl font-bold text-white">{unreadNotifs}</p>
          <p className="text-xs text-slate-400 mt-0.5">Unread Alerts</p>
        </button>
      </div>

      {/* Recent transactions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-300">Recent Transactions</h3>
          <button onClick={() => onNavigate('transactions')} className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors">
            View all <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="bg-[#061a10] border border-emerald-900/40 rounded-xl overflow-hidden">
          {recentTx.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-sm">No transactions yet</div>
          ) : (
            <div className="divide-y divide-emerald-900/20">
              {recentTx.map(tx => (
                <div key={tx.id} className="flex items-center gap-3 px-4 py-3 hover:bg-emerald-900/10 transition-colors">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                    tx.type === 'credit' ? 'bg-emerald-500/15' : 'bg-red-500/15'
                  )}>
                    {tx.type === 'credit' ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{tx.description}</p>
                    <p className="text-xs text-slate-500">{tx.category} · {formatDateShort(tx.timestamp)}</p>
                  </div>
                  <span className={cn("text-sm font-bold flex-shrink-0", tx.type === 'credit' ? 'text-emerald-400' : 'text-red-400')}>
                    {tx.type === 'credit' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Account details */}
      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Account Details</h3>
        <div className="bg-[#061a10] border border-emerald-900/40 rounded-xl p-4 grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: 'Account Number', value: currentCustomer.accountNumber },
            { label: 'Account Type', value: currentCustomer.accountType },
            { label: 'Bank Name', value: currentCustomer.bankName },
            { label: 'IFSC Code', value: currentCustomer.ifscCode },
            { label: 'KYC Status', value: currentCustomer.kycStatus },
            { label: 'Aadhaar', value: maskAadhaar(currentCustomer.aadhaar) },
            { label: 'PAN', value: maskPAN(currentCustomer.pan) },
            { label: 'Opened On', value: formatDateShort(currentCustomer.dateOpened) },
          ].map(f => (
            <div key={f.label}>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">{f.label}</p>
              <p className={cn("text-sm font-medium mt-0.5",
                f.label === 'KYC Status' && currentCustomer.kycStatus === 'Verified' ? 'text-emerald-400' :
                f.label === 'KYC Status' && currentCustomer.kycStatus === 'Expired' ? 'text-red-400' :
                'text-white'
              )}>{f.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
