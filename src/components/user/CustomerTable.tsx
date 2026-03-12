import { useState, useMemo } from 'react';
import { Search, ChevronRight, AlertTriangle, Filter } from 'lucide-react';
import { useApp } from '@/lib/store';
import { cn, maskAadhaar, maskPAN, formatCurrency, formatDateShort } from '@/lib/utils';
import type { Customer, AccountStatus, KYCStatus } from '@/types';

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

  return (
    <div className="p-6 space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Customers', value: customers.length, color: 'text-sky-400' },
          { label: 'Dormant', value: customers.filter(c => c.accountStatus === 'Dormant').length, color: 'text-red-400' },
          { label: 'Inactive', value: customers.filter(c => c.accountStatus === 'Inactive').length, color: 'text-amber-400' },
        ].map(s => (
          <div key={s.label} className="bg-[#0d1f35] border border-slate-700/40 rounded-xl p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wider">{s.label}</p>
            <p className={cn("text-2xl font-bold mt-1", s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, ID, account number..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-[#0d1f35] border border-slate-700/40 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
          />
        </div>
        <div className="flex gap-1 bg-[#0d1f35] border border-slate-700/40 rounded-lg p-1">
          {(['All', 'Active', 'Inactive', 'Dormant'] as const).map(s => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                statusFilter === s ? "bg-sky-600 text-white" : "text-slate-400 hover:text-white"
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-[#0d1f35] border border-slate-700/40 rounded-lg p-1">
          {['All', 'Savings', 'Current', 'Fixed Deposit'].map(t => (
            <button
              key={t}
              onClick={() => { setTypeFilter(t); setPage(1); }}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                typeFilter === t ? "bg-sky-600 text-white" : "text-slate-400 hover:text-white"
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
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
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
              ) : paginated.map(customer => (
                <tr
                  key={customer.id}
                  className={cn(
                    "border-b border-slate-700/20 hover:bg-slate-700/10 transition-colors cursor-pointer",
                    customer.accountStatus === 'Dormant' ? 'bg-red-500/5' : ''
                  )}
                  onClick={() => onSelectCustomer(customer)}
                >
                  <td className="px-4 py-3 text-xs font-mono text-slate-400">{customer.id}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {customer.accountStatus === 'Dormant' && (
                        <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
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
                    <span className={cn("text-xs font-medium px-2 py-1 rounded-full", STATUS_COLORS[customer.accountStatus])}>
                      {customer.accountStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs font-medium", KYC_COLORS[customer.kycStatus])}>
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
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-700/40 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 text-xs text-slate-300 bg-slate-700/40 hover:bg-slate-700/60 rounded-lg disabled:opacity-40 transition-all">
                Previous
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1.5 text-xs text-slate-300 bg-slate-700/40 hover:bg-slate-700/60 rounded-lg disabled:opacity-40 transition-all">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
