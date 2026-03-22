import { useState, useMemo } from 'react';
import { Search, ChevronRight, AlertTriangle } from 'lucide-react';
import { useApp } from '@/lib/store';
import { cn, formatCurrency } from '@/lib/utils';
import { RULE_DEFINITIONS } from '@/constants';
import type { Customer, AccountStatus, KYCStatus } from '@/types';

// ── Lightweight mule score for inline badges in the customer table ──────────
function quickMuleScore(customer: Customer, allCustomers: Customer[]): number {
  let score = 0;
  const now = new Date();
  const openedAt = new Date(customer.dateOpened);
  const lastTxnAt = new Date(customer.lastTransactionDate);
  const accountAgeDays = Math.floor((now.getTime() - openedAt.getTime()) / 86400000);
  const daysSinceLastTxn = Math.floor((now.getTime() - lastTxnAt.getTime()) / 86400000);
  if (accountAgeDays < 30 && customer.balance > 100000) score += RULE_DEFINITIONS.R100.score;
  if (daysSinceLastTxn <= 1 && customer.balance < 500 && accountAgeDays > 30) score += RULE_DEFINITIONS.R101.score;
  if (customer.balance > 0 && customer.balance % 10000 === 0 && customer.balance >= 50000) score += RULE_DEFINITIONS.R102.score;
  const dupM = allCustomers.filter(c => c.id !== customer.id && c.mobile === customer.mobile && customer.mobile !== '').length;
  const dupE = allCustomers.filter(c => c.id !== customer.id && c.email  === customer.email  && customer.email  !== '').length;
  if (dupM > 0 || dupE > 0) score += RULE_DEFINITIONS.R103.score;
  if (customer.accountStatus === 'Dormant' && customer.balance > 500000) score += RULE_DEFINITIONS.R104.score;
  if (customer.kycStatus !== 'Verified' && customer.accountStatus === 'Active' && customer.balance > 50000) score += RULE_DEFINITIONS.R109.score;
  if (customer.balance >= 180000 && customer.balance < 200000) score += RULE_DEFINITIONS.R108.score;
  return score;
}

interface Props {
  onSelectCustomer: (customer: Customer) => void;
}

const STATUS_COLORS: Record<AccountStatus, string> = {
  Active: 'text-emerald-400 bg-emerald-400/10',
  Inactive: 'text-amber-400 bg-amber-400/10',
  Dormant: 'text-red-400 bg-red-400/10',
};

const KYC_COLORS: Record<KYCStatus, string> = {
  Verified: 'text-emerald-400',
  Pending: 'text-amber-400',
  Expired: 'text-red-400',
};

export default function CustomerTable({ onSelectCustomer }: Props) {
  const { state } = useApp();
  const { customers } = state;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | AccountStatus>('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const filtered = useMemo(() => {
    return customers.filter(c => {
      const searchOk = !search ||
        c.fullName.toLowerCase().includes(search.toLowerCase()) ||
        c.id.toLowerCase().includes(search.toLowerCase()) ||
        c.accountNumber.includes(search) ||
        c.branch.toLowerCase().includes(search.toLowerCase());
      const statusOk = statusFilter === 'All' || c.accountStatus === statusFilter;
      const typeOk = typeFilter === 'All' || c.accountType === typeFilter;
      return searchOk && statusOk && typeOk;
    });
  }, [customers, search, statusFilter, typeFilter]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  // Mule suspect count for the stats row
  const muleCount = useMemo(
    () => customers.filter(c => quickMuleScore(c, customers) >= 80).length,
    [customers]
  );

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Customers', value: customers.length, color: 'text-sky-400' },
          { label: 'Dormant', value: customers.filter(c => c.accountStatus === 'Dormant').length, color: 'text-red-400' },
          { label: 'Inactive', value: customers.filter(c => c.accountStatus === 'Inactive').length, color: 'text-amber-400' },
          { label: 'Mule Suspects', value: muleCount, color: 'text-rose-400' },
        ].map(s => (
          <div key={s.label} className="bg-[#0d1f35] border border-slate-700/40 rounded-xl p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wider">{s.label}</p>
            <p className={cn('text-2xl font-bold mt-1', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, ID, account number..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-[#0d1f35] border border-slate-700/40 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
          />
        </div>
        <div className="flex gap-1 bg-[#0d1f35] border border-slate-700/40 rounded-lg p-1 overflow-x-auto flex-nowrap">
          {(['All', 'Active', 'Inactive', 'Dormant'] as const).map(s => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap',
                statusFilter === s ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-[#0d1f35] border border-slate-700/40 rounded-lg p-1 overflow-x-auto flex-nowrap">
          {['All', 'Savings', 'Current', 'Fixed Deposit'].map(t => (
            <button
              key={t}
              onClick={() => { setTypeFilter(t); setPage(1); }}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap',
                typeFilter === t ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#0d1f35] border border-slate-700/40 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700/40 bg-[#060e1a]/50">
                {['Customer ID', 'Name', 'Account', 'Type', 'Balance', 'Status', 'KYC', 'Branch', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-500 text-sm">
                    No customers found
                  </td>
                </tr>
              ) : paginated.map(customer => {
                const muleScore = quickMuleScore(customer, customers);
                const isMuleSuspect = muleScore >= 80;
                const isWatchList   = muleScore >= 40 && muleScore < 80;
                return (
                  <tr
                    key={customer.id}
                    className={cn(
                      'border-b border-slate-700/20 hover:bg-slate-700/10 transition-colors cursor-pointer',
                      customer.accountStatus === 'Dormant' ? 'bg-red-500/5' : '',
                      isMuleSuspect ? 'bg-rose-500/5' : ''
                    )}
                    onClick={() => onSelectCustomer(customer)}
                  >
                    <td className="px-4 py-3 text-xs font-mono text-slate-400">{customer.id}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {customer.accountStatus === 'Dormant' && (
                          <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                        )}
                        {isMuleSuspect && (
                          <span title={`Mule risk score: ${muleScore}`} className="text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 px-1.5 py-0.5 rounded flex-shrink-0">
                            MULE {muleScore}
                          </span>
                        )}
                        {isWatchList && (
                          <span title={`Watch score: ${muleScore}`} className="text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded flex-shrink-0">
                            WATCH
                          </span>
                        )}
                        <span className="text-sm font-medium text-white">{customer.fullName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-400">
                      ••••{customer.accountNumber.slice(-4)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">{customer.accountType}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-white">
                      {formatCurrency(customer.balance)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs font-medium px-2 py-1 rounded-full', STATUS_COLORS[customer.accountStatus])}>
                        {customer.accountStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs font-medium', KYC_COLORS[customer.kycStatus])}>
                        {customer.kycStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 max-w-[120px] truncate">
                      {customer.branch}
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-700/40 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-xs text-slate-300 bg-slate-700/40 hover:bg-slate-700/60 rounded-lg disabled:opacity-40 transition-all"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-xs text-slate-300 bg-slate-700/40 hover:bg-slate-700/60 rounded-lg disabled:opacity-40 transition-all"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
