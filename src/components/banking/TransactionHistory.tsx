import { useState } from 'react';
import { useCustomer } from '@/lib/customerStore';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { Search, TrendingUp, TrendingDown, Filter, Download } from 'lucide-react';

const CATEGORIES = ['All', 'Salary', 'Shopping', 'Food & Dining', 'Utilities', 'Transfer', 'EMI', 'ATM Withdrawal', 'Investment', 'Interest'];

export default function TransactionHistory() {
  const { state } = useCustomer();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'credit' | 'debit'>('all');
  const [filterCategory, setFilterCategory] = useState('All');

  const filtered = state.transactions.filter(t => {
    const matchSearch = t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.referenceNumber.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || t.type === filterType;
    const matchCat = filterCategory === 'All' || t.category === filterCategory;
    return matchSearch && matchType && matchCat;
  });

  const totalCredit = filtered.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
  const totalDebit = filtered.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0);

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Transaction History</h2>
        <button className="flex items-center gap-2 text-xs text-emerald-400 border border-emerald-700/40 px-3 py-1.5 rounded-lg hover:bg-emerald-900/20 transition-colors">
          <Download className="w-3.5 h-3.5" /> Export
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-slate-400">Credits</span>
          </div>
          <p className="text-lg font-bold text-emerald-300 mt-1">{formatCurrency(totalCredit)}</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-red-400" />
            <span className="text-xs text-slate-400">Debits</span>
          </div>
          <p className="text-lg font-bold text-red-300 mt-1">{formatCurrency(totalDebit)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search transactions..."
            className="w-full bg-[#061a10] border border-emerald-900/40 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-600 transition-colors" />
        </div>

        <div className="flex gap-2 flex-wrap">
          {(['all', 'credit', 'debit'] as const).map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize",
                filterType === t ? 'bg-emerald-600 text-white' : 'bg-[#061a10] border border-emerald-900/40 text-slate-400 hover:text-slate-200'
              )}>
              {t === 'all' ? 'All Types' : t === 'credit' ? 'Credits' : 'Debits'}
            </button>
          ))}
        </div>

        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setFilterCategory(cat)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                filterCategory === cat ? 'bg-teal-700 text-white' : 'bg-[#061a10] border border-emerald-900/40 text-slate-400 hover:text-slate-200'
              )}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#061a10] border border-emerald-900/40 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-500">No transactions found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-emerald-900/40">
                  {['Date', 'Description', 'Category', 'Reference', 'Amount', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-900/20">
                {filtered.map(tx => (
                  <tr key={tx.id} className="hover:bg-emerald-900/10 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{formatDate(tx.timestamp)}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-white font-medium truncate max-w-[160px]">{tx.description}</p>
                        {tx.beneficiaryName && <p className="text-xs text-slate-500">To: {tx.beneficiaryName}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-slate-700/50 text-slate-300 px-2 py-0.5 rounded-full whitespace-nowrap">{tx.category}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 font-mono whitespace-nowrap">{tx.referenceNumber}</td>
                    <td className={cn("px-4 py-3 font-bold whitespace-nowrap", tx.type === 'credit' ? 'text-emerald-400' : 'text-red-400')}>
                      {tx.type === 'credit' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full",
                        tx.status === 'completed' ? 'bg-emerald-500/15 text-emerald-300' :
                        tx.status === 'pending' ? 'bg-amber-500/15 text-amber-300' :
                        'bg-red-500/15 text-red-300'
                      )}>
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
