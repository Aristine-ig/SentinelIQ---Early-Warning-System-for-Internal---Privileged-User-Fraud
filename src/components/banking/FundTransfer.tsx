import { useState } from 'react';
import { useCustomer } from '@/lib/customerStore';
import { formatCurrency, cn } from '@/lib/utils';
import { ArrowUpRight, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { toast } from 'sonner';

export default function FundTransfer() {
  const { state, transferFunds } = useCustomer();
  const [selectedBenId, setSelectedBenId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [lastRef, setLastRef] = useState('');

  const { currentCustomer, beneficiaries } = state;
  if (!currentCustomer) return null;

  const selectedBen = beneficiaries.find(b => b.id === selectedBenId);
  const parsedAmount = parseFloat(amount) || 0;
  const isValid = selectedBenId && parsedAmount > 0 && parsedAmount <= currentCustomer.balance;

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !selectedBen) return;
    setLoading(true);
    const ok = await transferFunds(parsedAmount, selectedBenId, description);
    setLoading(false);
    if (ok) {
      setSuccess(true);
      setLastRef('REF' + Math.random().toString(36).substr(2, 9).toUpperCase());
      toast.success(`₹${parsedAmount.toLocaleString('en-IN')} transferred to ${selectedBen.name}`);
    } else {
      toast.error('Transfer failed. Please check your balance.');
    }
  };

  const reset = () => { setSuccess(false); setAmount(''); setDescription(''); setSelectedBenId(''); };

  if (success) {
    return (
      <div className="p-4 lg:p-6 max-w-lg mx-auto">
        <div className="bg-[#061a10] border border-emerald-500/30 rounded-2xl p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Transfer Successful!</h3>
            <p className="text-slate-400 text-sm mt-1">Your money is on its way</p>
          </div>
          <div className="bg-[#040d08] rounded-xl p-4 space-y-2 text-left">
            {[
              { label: 'Amount', value: formatCurrency(parsedAmount), color: 'text-emerald-400' },
              { label: 'To', value: selectedBen?.name || '' },
              { label: 'Account', value: selectedBen?.accountNumber || '' },
              { label: 'Bank', value: selectedBen?.bankName || '' },
              { label: 'Reference', value: lastRef, mono: true },
            ].map(f => (
              <div key={f.label} className="flex justify-between">
                <span className="text-xs text-slate-500">{f.label}</span>
                <span className={cn("text-xs font-medium", f.color || 'text-white', f.mono && 'font-mono')}>{f.value}</span>
              </div>
            ))}
          </div>
          <button onClick={reset} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-xl transition-colors">
            Make Another Transfer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-lg mx-auto space-y-4">
      <h2 className="text-lg font-bold text-white">Fund Transfer</h2>

      {/* Balance */}
      <div className="bg-gradient-to-r from-emerald-800/30 to-teal-800/20 border border-emerald-700/30 rounded-xl p-4 flex justify-between items-center">
        <div>
          <p className="text-xs text-slate-400">Available Balance</p>
          <p className="text-xl font-bold text-white">{formatCurrency(currentCustomer.balance)}</p>
        </div>
        <ArrowUpRight className="w-8 h-8 text-emerald-400/40" />
      </div>

      {beneficiaries.length === 0 ? (
        <div className="bg-[#061a10] border border-amber-700/30 rounded-xl p-6 text-center">
          <Info className="w-8 h-8 text-amber-400 mx-auto mb-2" />
          <p className="text-white font-medium">No beneficiaries added</p>
          <p className="text-slate-400 text-sm mt-1">Please add a beneficiary first to transfer funds</p>
        </div>
      ) : (
        <form onSubmit={handleTransfer} className="space-y-4">
          {/* Select beneficiary */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">Select Beneficiary</label>
            <div className="space-y-2">
              {beneficiaries.map(ben => (
                <button key={ben.id} type="button" onClick={() => setSelectedBenId(ben.id)}
                  className={cn("w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all",
                    selectedBenId === ben.id
                      ? "bg-emerald-600/20 border-emerald-500/50"
                      : "bg-[#061a10] border-emerald-900/40 hover:border-emerald-700/40"
                  )}>
                  <div className={cn("w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm",
                    selectedBenId === ben.id ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-300'
                  )}>
                    {ben.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{ben.name}</p>
                    <p className="text-xs text-slate-400">{ben.bankName} · ···{ben.accountNumber.slice(-4)}</p>
                  </div>
                  {selectedBenId === ben.id && <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">Amount (₹)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min="1" max={currentCustomer.balance} placeholder="0.00"
              className="w-full bg-[#040d08] border border-emerald-900/40 rounded-xl px-4 py-3 text-white text-lg font-bold placeholder-slate-600 focus:outline-none focus:border-emerald-600 transition-colors" />
            {parsedAmount > currentCustomer.balance && (
              <div className="flex items-center gap-1.5 mt-1.5 text-red-400 text-xs">
                <AlertCircle className="w-3.5 h-3.5" />Insufficient balance
              </div>
            )}
            <div className="flex gap-2 mt-2">
              {[1000, 5000, 10000, 25000].map(amt => (
                <button key={amt} type="button" onClick={() => setAmount(String(amt))}
                  className="text-xs px-2.5 py-1 bg-emerald-900/30 border border-emerald-800/40 text-emerald-300 rounded-lg hover:bg-emerald-800/40 transition-colors">
                  {formatCurrency(amt)}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">Description (optional)</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Payment description..."
              className="w-full bg-[#040d08] border border-emerald-900/40 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-600 transition-colors" />
          </div>

          {/* Summary */}
          {isValid && selectedBen && (
            <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-xl p-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Transferring to</span><span className="text-white font-medium">{selectedBen.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Amount</span><span className="text-emerald-400 font-bold">{formatCurrency(parsedAmount)}</span>
              </div>
              <div className="flex justify-between border-t border-emerald-800/30 pt-1.5 mt-1.5">
                <span className="text-slate-400">Balance after transfer</span>
                <span className="text-white">{formatCurrency(currentCustomer.balance - parsedAmount)}</span>
              </div>
            </div>
          )}

          <button type="submit" disabled={!isValid || loading}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-900/40">
            {loading ? 'Processing...' : `Transfer ${parsedAmount > 0 ? formatCurrency(parsedAmount) : ''}`}
          </button>
        </form>
      )}
    </div>
  );
}
