import { useState } from 'react';
import { useCustomer } from '@/lib/customerStore';
import { formatCurrency, formatDateShort, cn } from '@/lib/utils';
import { CreditCard, Plus, X, Clock, CheckCircle, XCircle, Banknote } from 'lucide-react';
import { toast } from 'sonner';

const LOAN_TYPES = ['Home Loan', 'Personal Loan', 'Car Loan', 'Education Loan', 'Business Loan', 'Gold Loan'];
const TENURES = [12, 24, 36, 48, 60, 84, 120, 180, 240];

export default function LoanApplications() {
  const { state, applyLoan } = useCustomer();
  const [showForm, setShowForm] = useState(false);
  const [loanType, setLoanType] = useState(LOAN_TYPES[0]);
  const [amount, setAmount] = useState('');
  const [tenure, setTenure] = useState(36);
  const [purpose, setPurpose] = useState('');
  const [loading, setLoading] = useState(false);

  const { currentCustomer, loans } = state;
  if (!currentCustomer) return null;

  const parsedAmount = parseFloat(amount) || 0;
  const rate = 8.5;
  const emi = parsedAmount > 0
    ? (parsedAmount * (rate / 1200) * Math.pow(1 + rate / 1200, tenure)) / (Math.pow(1 + rate / 1200, tenure) - 1)
    : 0;

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedAmount < 10000) { toast.error('Minimum loan amount is ₹10,000'); return; }
    setLoading(true);
    const ok = await applyLoan(loanType, parsedAmount, tenure, purpose);
    setLoading(false);
    if (ok) {
      toast.success('Loan application submitted successfully');
      setAmount(''); setPurpose(''); setShowForm(false);
    } else {
      toast.error('Application failed. Please try again.');
    }
  };

  const statusIcon = (s: string) => {
    switch (s) {
      case 'approved': case 'disbursed': return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'rejected': return <XCircle className="w-4 h-4 text-red-400" />;
      case 'pending_approval': return <Clock className="w-4 h-4 text-violet-400" />;
      case 'under_review': return <Clock className="w-4 h-4 text-sky-400" />;
      default: return <Clock className="w-4 h-4 text-amber-400" />;
    }
  };

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      pending: 'Pending',
      under_review: 'Under Review',
      pending_approval: 'Awaiting Approval',
      approved: 'Approved',
      rejected: 'Rejected',
      disbursed: 'Disbursed',
    };
    return map[s] || s;
  };

  const statusStyle = (s: string) => {
    switch (s) {
      case 'approved': return 'bg-emerald-500/15 text-emerald-300';
      case 'disbursed': return 'bg-sky-500/15 text-sky-300';
      case 'rejected': return 'bg-red-500/15 text-red-300';
      case 'pending_approval': return 'bg-violet-500/15 text-violet-300';
      case 'under_review': return 'bg-sky-500/15 text-sky-300';
      default: return 'bg-amber-500/15 text-amber-300';
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Loan Applications</h2>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'Apply for Loan'}
        </button>
      </div>

      {/* Application form */}
      {showForm && (
        <form onSubmit={handleApply} className="bg-[#061a10] border border-violet-700/30 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-violet-300">New Loan Application</h3>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">Loan Type</label>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              {LOAN_TYPES.map(lt => (
                <button key={lt} type="button" onClick={() => setLoanType(lt)}
                  className={cn("p-2.5 rounded-lg border text-xs font-medium transition-all",
                    loanType === lt ? 'bg-violet-600/20 border-violet-500/50 text-violet-300' : 'bg-[#040d08] border-emerald-900/40 text-slate-400 hover:text-slate-200'
                  )}>
                  {lt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">Loan Amount (₹)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min="10000" placeholder="Minimum ₹10,000"
              className="w-full bg-[#040d08] border border-emerald-900/40 rounded-lg px-4 py-3 text-white text-lg font-bold placeholder-slate-600 focus:outline-none focus:border-violet-600 transition-colors" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">Tenure</label>
            <div className="flex gap-2 flex-wrap">
              {TENURES.map(t => (
                <button key={t} type="button" onClick={() => setTenure(t)}
                  className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    tenure === t ? 'bg-violet-600 text-white' : 'bg-[#040d08] border border-emerald-900/40 text-slate-400 hover:text-slate-200'
                  )}>
                  {t >= 12 ? `${t / 12}Y` : `${t}M`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">Purpose</label>
            <input value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="Briefly describe the loan purpose..."
              className="w-full bg-[#040d08] border border-emerald-900/40 rounded-lg px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-violet-600 transition-colors" />
          </div>

          {parsedAmount >= 10000 && (
            <div className="bg-violet-900/20 border border-violet-700/30 rounded-xl p-3 grid grid-cols-3 gap-3 text-xs">
              <div>
                <p className="text-slate-500">Loan Amount</p>
                <p className="text-white font-semibold mt-0.5">{formatCurrency(parsedAmount)}</p>
              </div>
              <div>
                <p className="text-slate-500">Interest Rate</p>
                <p className="text-white font-semibold mt-0.5">{rate}% p.a.</p>
              </div>
              <div>
                <p className="text-slate-500">Est. EMI</p>
                <p className="text-violet-300 font-bold mt-0.5">{formatCurrency(Math.round(emi))}/mo</p>
              </div>
            </div>
          )}

          <button type="submit" disabled={loading || parsedAmount < 10000}
            className="w-full bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-500 hover:to-purple-600 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            {loading ? 'Submitting...' : 'Submit Application'}
          </button>
        </form>
      )}

      {/* Loan list */}
      {loans.length === 0 ? (
        <div className="bg-[#061a10] border border-emerald-900/40 rounded-xl p-8 text-center">
          <CreditCard className="w-8 h-8 text-slate-500 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">No loan applications yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {loans.map(loan => (
            <div key={loan.id} className="bg-[#061a10] border border-emerald-900/40 rounded-2xl p-5 hover:border-emerald-700/40 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {statusIcon(loan.status)}
                    <span className="text-white font-semibold">{loan.loanType}</span>
                  </div>
                  <p className="text-xs text-slate-400">{loan.purpose || 'No purpose specified'}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-bold text-white">{formatCurrency(loan.amount)}</p>
                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full uppercase", statusStyle(loan.status))}>
                    {statusLabel(loan.status)}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-emerald-900/30 text-xs">
                <div>
                  <p className="text-slate-500">Tenure</p>
                  <p className="text-white mt-0.5">{loan.tenureMonths >= 12 ? `${loan.tenureMonths / 12} Year${loan.tenureMonths > 12 ? 's' : ''}` : `${loan.tenureMonths} Months`}</p>
                </div>
                {loan.emi && (
                  <div>
                    <p className="text-slate-500">EMI</p>
                    <p className="text-violet-300 mt-0.5 font-semibold">{formatCurrency(loan.emi)}/mo</p>
                  </div>
                )}
                <div>
                  <p className="text-slate-500">Applied On</p>
                  <p className="text-white mt-0.5">{formatDateShort(loan.createdAt)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
