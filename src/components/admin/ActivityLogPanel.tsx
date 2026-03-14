import { useState, useMemo } from 'react';
import { Search, Filter, Download } from 'lucide-react';
import { useApp } from '@/lib/store';
import { cn, formatDate } from '@/lib/utils';
import type { ActionType } from '@/types';
import { toast } from 'sonner';

const ACTION_TYPES: ActionType[] = [
  'LOGIN', 'LOGOUT', 'VIEW_ACCOUNT', 'MODIFY_CONTACT', 'INITIATE_TRANSACTION',
  'RUN_REPORT', 'TRIGGER_OTP', 'APPROVE_LOAN', 'CREATE_USER', 'EDIT_USER',
  'DEACTIVATE_USER', 'PROMOTE_USER', 'LOGIN_FAILED',
];

export default function ActivityLogPanel() {
  const { state, logAction } = useApp();
  const { activityLogs, users } = state;
  const [search, setSearch] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState<'all' | ActionType>('all');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 30;

  const filtered = useMemo(() => {
    return activityLogs.filter(log => {
      const searchOk = !search ||
        log.userName.toLowerCase().includes(search.toLowerCase()) ||
        log.actionType.toLowerCase().includes(search.toLowerCase()) ||
        (log.customerName || '').toLowerCase().includes(search.toLowerCase()) ||
        (log.customerId || '').toLowerCase().includes(search.toLowerCase()) ||
        log.id.toLowerCase().includes(search.toLowerCase());
      const userOk = userFilter === 'all' || log.userId === userFilter;
      const actionOk = actionFilter === 'all' || log.actionType === actionFilter;
      return searchOk && userOk && actionOk;
    });
  }, [activityLogs, search, userFilter, actionFilter]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const getActionColor = (action: ActionType) => {
    if (['LOGIN'].includes(action)) return 'text-sky-400 bg-sky-500/10';
    if (['LOGOUT'].includes(action)) return 'text-slate-400 bg-slate-500/10';
    if (['MODIFY_CONTACT', 'TRIGGER_OTP'].includes(action)) return 'text-amber-400 bg-amber-500/10';
    if (['INITIATE_TRANSACTION', 'APPROVE_LOAN'].includes(action)) return 'text-orange-400 bg-orange-500/10';
    if (['CREATE_USER', 'EDIT_USER', 'PROMOTE_USER'].includes(action)) return 'text-purple-400 bg-purple-500/10';
    if (['DEACTIVATE_USER', 'DELETE_AUDIT_LOG_ATTEMPT'].includes(action)) return 'text-red-400 bg-red-500/10';
    if (['RUN_REPORT'].includes(action)) return 'text-emerald-400 bg-emerald-500/10';
    return 'text-slate-300 bg-slate-500/10';
  };

  const handleExport = () => {
    logAction('RUN_REPORT', 'All Systems', undefined, {
      recordCount: filtered.length,
      fields: ['User', 'Action', 'Timestamp', 'IP'],
    });
    toast.success(`Exported ${filtered.length} log entries (simulated)`);
  };

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Activity Log</h2>
          <p className="text-xs text-slate-400">{filtered.length} entries</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 bg-[#0d1f35] border border-slate-700/40 hover:border-sky-500/40 rounded-lg transition-all"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search logs..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-[#0d1f35] border border-slate-700/40 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
          />
        </div>
        <select
          value={userFilter}
          onChange={e => { setUserFilter(e.target.value); setPage(1); }}
          className="bg-[#0d1f35] border border-slate-700/40 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50"
        >
          <option value="all">All Users</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
        </select>
        <select
          value={actionFilter}
          onChange={e => { setActionFilter(e.target.value as 'all' | ActionType); setPage(1); }}
          className="bg-[#0d1f35] border border-slate-700/40 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50"
        >
          <option value="all">All Actions</option>
          {ACTION_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* Table — desktop */}
      <div className="bg-[#0d1f35] border border-slate-700/40 rounded-xl overflow-hidden">
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700/40 bg-[#060e1a]/50">
                {['Log ID', 'User', 'Action', 'System', 'Customer', 'Timestamp', 'IP'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500 text-sm">
                    No logs match the current filters
                  </td>
                </tr>
              ) : paginated.map(log => (
                <tr key={log.id} className="border-b border-slate-700/20 hover:bg-slate-700/10 transition-colors">
                  <td className="px-4 py-2.5 text-xs font-mono text-slate-400">{log.id}</td>
                  <td className="px-4 py-2.5">
                    <div>
                      <p className="text-xs font-medium text-white">{log.userName}</p>
                      <p className="text-[10px] text-slate-500">{log.userId}</p>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={cn("text-xs font-semibold px-2 py-1 rounded", getActionColor(log.actionType))}>
                      {log.actionType}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">{log.system}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">
                    {log.customerName ? (
                      <div>
                        <p className="text-white">{log.customerName}</p>
                        <p className="text-slate-500">{log.customerId}</p>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-400 whitespace-nowrap">
                    {formatDate(log.timestamp)}
                  </td>
                  <td className="px-4 py-2.5 text-xs font-mono text-slate-500">{log.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile card list */}
        <div className="sm:hidden divide-y divide-slate-700/30">
          {paginated.length === 0 ? (
            <p className="text-center py-10 text-slate-500 text-sm">No logs match the current filters</p>
          ) : paginated.map(log => (
            <div key={log.id} className="p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded", getActionColor(log.actionType))}>
                  {log.actionType}
                </span>
                <span className="text-[10px] text-slate-500">{formatDate(log.timestamp)}</span>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-medium text-white">{log.userName}</p>
                <span className="text-[10px] text-slate-500">{log.system}</span>
              </div>
              {log.customerName && (
                <p className="text-[10px] text-slate-400">{log.customerName} ({log.customerId})</p>
              )}
              <p className="text-[10px] font-mono text-slate-600">{log.ip}</p>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-700/40 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Page {page} of {totalPages} · {filtered.length} total
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
