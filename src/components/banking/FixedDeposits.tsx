import { useState } from 'react';
import { useCustomer } from '@/lib/customerStore';
import { formatCurrency, formatDateShort, cn } from '@/lib/utils';
import { PiggyBank, Plus, TrendingUp, Calendar, Percent, X } from 'lucide-react';
import { toast } from 'sonner';

const TENURES = [
  { months: 3, label: '3 Months', rate: 5.5 },
  { months: 6, label: '6 Months', rate: 6.0 },
  { months: 12, label: '1 Year', rate: 6.75 },
  { months: 24, label: '2 Years', rate: 7.0 },
  { months: 36, label: '3 Years', rate: 7.25 },
  { months: 60, label: '5 Years', rate: 7.5 },
];

export default function FixedDeposits() {
  const { state, openFD } = useCustomer();
  const [showForm, setShowForm] = useState(false);
  const [principal, setPrincipal] = useState('');
  const [tenureIdx, setTenureIdx] = useState(2);
  const [loading, setLoading] = useState(false);

  const { currentCustomer, fixedDeposits } = state;
  if (!currentCustomer) return null;

  const parsedPrincipal = parseFloat(principal) || 0;
  const selectedTenure = TENURES[tenureIdx];
  const previewMaturity = parsedPrincipal * (1 + (selectedTenure.rate / 100) * (selectedTenure.months / 12));
  const interest = previewMaturity - parsedPrincipal;

  const handleOpen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedPrincipal < 1000) { toast.error('Minimum FD amount is ₹1,000'); return; }
    if (parsedPrincipal > currentCustomer.balance) { toast.error('Insufficient balance'); return; }
    setLoading(true);
    const ok = await openFD(parsedPrincipal, selectedTenure.months);
    setLoading(false);
    if (ok) {
      toast.success(`FD of ${formatCurrency(parsedPrincipal)} opened for ${selectedTenure.label}`);
      setPrincipal('');
      setShowForm(false);
    } else {
      toast.error('Failed to open FD');
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Fixed Deposits</h2>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'Open FD'}
        </button>
      </div>

      {/* Open FD form */}
      {showForm && (
        <form onSubmit={handleOpen} className="bg-[#061a10] border border-amber-700/30 rounded-2xl p-5 space-y-5">
          <h3 className="text-sm font-semibold text-amber-300">New Fixed Deposit</h3>
          <p className="text-xs text-slate-400">Available Balance: <span className="text-emerald-400 font-semibold">{formatCurrency(currentCustomer.balance)}</span></p>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">Principal Amount (₹)</label>
            <input type="number" value={principal} onChange={e => setPrincipal(e.target.value)} min="1000" max={currentCustomer.balance} placeholder="Minimum ₹1,000"
              className="w-full bg-[#040d08] border border-emerald-900/40 rounded-lg px-4 py-3 text-white text-lg font-bold placeholder-slate-600 focus:outline-none focus:border-amber-600 transition-colors" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">Tenure</label>
            <div className="grid grid-cols-3 gap-2">
              {TENURES.map((t, i) => (
                <button key={t.months} type="button" onClick={() => setTenureIdx(i)}
                  className={cn("p-3 rounded-xl border text-left transition-all",
                    tenureIdx === i ? 'bg-amber-600/20 border-amber-500/50' : 'bg-[#040d08] border-emerald-900/40 hover:border-emerald-700/40'
                  )}>
                  <p className={cn("text-sm font-semibold", tenureIdx === i ? 'text-amber-300' : 'text-white')}>{t.label}</p>
                  <p className="text-xs text-emerald-400 mt-0.5">{t.rate}% p.a.</p>
                </button>
              ))}
            </div>
          </div>

          {parsedPrincipal >= 1000 && (
            <div className="bg-amber-900/20 border border-amber-700/30 rounded-xl p-4 space-y-2 text-xs">
              <h4 className="text-amber-300 font-semibold">Maturity Summary</h4>
              <div className="flex justify-between">
                <span className="text-slate-400">Principal</span>
                <span className="text-white">{formatCurrency(parsedPrincipal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Interest Earned</span>
                <span className="text-emerald-400">+{formatCurrency(interest)}</span>
              </div>
              <div className="flex justify-between border-t border-amber-800/30 pt-2">
                <span className="text-amber-300 font-semibold">Maturity Amount</span>
                <span className="text-amber-300 font-bold">{formatCurrency(previewMaturity)}</span>
              </div>
            </div>
          )}

          <button type="submit" disabled={loading || parsedPrincipal < 1000 || parsedPrincipal > currentCustomer.balance}
            className="w-full bg-gradient-to-r from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            {loading ? 'Opening FD...' : `Open FD — ${formatCurrency(parsedPrincipal)}`}
          </button>
        </form>
      )}

      {/* FD list */}
      {fixedDeposits.length === 0 ? (
        <div className="bg-[#061a10] border border-emerald-900/40 rounded-xl p-8 text-center">
          <PiggyBank className="w-8 h-8 text-slate-500 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">No fixed deposits found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {fixedDeposits.map(fd => (
            <div key={fd.id} className={cn("bg-[#061a10] border rounded-2xl p-5",
              fd.status === 'active' ? 'border-emerald-800/40' :
              fd.status === 'matured' ? 'border-amber-700/40' : 'border-red-800/40'
            )}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <PiggyBank className="w-4 h-4 text-amber-400" />
                    <span className="text-white font-semibold">{formatCurrency(fd.principal)}</span>
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full",
                      fd.status === 'active' ? 'bg-emerald-500/20 text-emerald-300' :
                      fd.status === 'matured' ? 'bg-amber-500/20 text-amber-300' :
                      'bg-red-500/20 text-red-300'
                    )}>
                      {fd.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{fd.tenureMonths} months @ {fd.interestRate}% p.a.</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-amber-300">{formatCurrency(fd.maturityAmount)}</p>
                  <p className="text-[10px] text-slate-500">Maturity Amount</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-emerald-900/30">
                <div>
                  <p className="text-[10px] text-slate-500 flex items-center gap-1"><Calendar className="w-3 h-3" /> Opened</p>
                  <p className="text-xs text-white mt-0.5">{formatDateShort(fd.createdAt)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 flex items-center gap-1"><Calendar className="w-3 h-3" /> Matures</p>
                  <p className="text-xs text-white mt-0.5">{formatDateShort(fd.maturityDate)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Interest</p>
                  <p className="text-xs text-emerald-400 mt-0.5">+{formatCurrency(fd.maturityAmount - fd.principal)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
