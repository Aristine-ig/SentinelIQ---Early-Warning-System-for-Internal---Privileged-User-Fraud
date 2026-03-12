import { useState } from 'react';
import { Search, Filter, AlertTriangle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import Header from '@/components/layout/Header';
import RiskScoreBadge from '@/components/features/RiskScoreBadge';
import { MOCK_ACTIVITIES, formatSystemLabel, formatAnomalyType } from '@/constants/mockData';
import { cn } from '@/lib/utils';

export default function ActivityLog() {
  const [search, setSearch] = useState('');
  const [showAnomalyOnly, setShowAnomalyOnly] = useState(false);

  const filtered = MOCK_ACTIVITIES.filter(event => {
    const matchSearch = !search ||
      event.userName.toLowerCase().includes(search.toLowerCase()) ||
      event.action.toLowerCase().includes(search.toLowerCase()) ||
      event.details.toLowerCase().includes(search.toLowerCase());
    const matchAnomaly = !showAnomalyOnly || event.anomalyFlag;
    return matchSearch && matchAnomaly;
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header title="Activity Log" subtitle="Real-time event stream across all monitored banking systems" />

      <div className="flex-1 p-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search events by user, action, or details..."
              className="w-full h-9 pl-9 pr-3 text-sm bg-[hsl(220,25%,11%)] border border-[hsl(220,20%,18%)] rounded-lg text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40"
            />
          </div>
          <button
            onClick={() => setShowAnomalyOnly(!showAnomalyOnly)}
            className={cn(
              'flex items-center gap-2 px-4 h-9 rounded-lg text-xs font-medium border transition-all',
              showAnomalyOnly
                ? 'bg-red-500/20 border-red-500/30 text-red-400'
                : 'bg-[hsl(220,25%,11%)] border-[hsl(220,20%,18%)] text-slate-400 hover:text-slate-200'
            )}
          >
            <Filter className="w-3.5 h-3.5" />
            Anomalies Only
          </button>
        </div>

        {/* Table */}
        <div className="bg-[hsl(220,25%,11%)] border border-[hsl(220,20%,18%)] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[hsl(220,20%,16%)]">
                  <th className="text-left text-[10px] text-slate-500 uppercase tracking-widest px-4 py-3 font-medium">Timestamp</th>
                  <th className="text-left text-[10px] text-slate-500 uppercase tracking-widest px-4 py-3 font-medium">User</th>
                  <th className="text-left text-[10px] text-slate-500 uppercase tracking-widest px-4 py-3 font-medium hidden lg:table-cell">Action</th>
                  <th className="text-left text-[10px] text-slate-500 uppercase tracking-widest px-4 py-3 font-medium hidden md:table-cell">System</th>
                  <th className="text-left text-[10px] text-slate-500 uppercase tracking-widest px-4 py-3 font-medium hidden xl:table-cell">IP Address</th>
                  <th className="text-left text-[10px] text-slate-500 uppercase tracking-widest px-4 py-3 font-medium">Risk</th>
                  <th className="text-left text-[10px] text-slate-500 uppercase tracking-widest px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((event, idx) => (
                  <tr
                    key={event.id}
                    className={cn(
                      'border-b border-[hsl(220,20%,14%)] hover:bg-white/5 transition-colors',
                      event.anomalyFlag ? 'bg-red-500/5' : ''
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="text-xs font-mono text-slate-400">
                        {format(new Date(event.timestamp), 'MM/dd HH:mm:ss')}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-medium text-slate-200">{event.userName}</div>
                      <div className="text-[10px] text-slate-500 capitalize">{event.userRole.replace('_', ' ')}</div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="text-xs text-slate-300 max-w-[200px] truncate">{event.action}</div>
                      <div className="text-[10px] text-slate-600 max-w-[200px] truncate mt-0.5">{event.details}</div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-[10px] text-slate-400 bg-slate-500/10 border border-slate-500/15 px-2 py-0.5 rounded font-mono">
                        {formatSystemLabel(event.system)}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <span className="text-[10px] font-mono text-slate-500">{event.ipAddress}</span>
                    </td>
                    <td className="px-4 py-3">
                      <RiskScoreBadge score={event.riskScore} size="sm" showLabel={false} />
                    </td>
                    <td className="px-4 py-3">
                      {event.anomalyFlag ? (
                        <div className="flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                          <span className="text-[10px] text-red-400 hidden sm:block">{formatAnomalyType(event.anomalyType!)}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5 text-green-400/60" />
                          <span className="text-[10px] text-slate-600 hidden sm:block">Normal</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-12 text-slate-500 text-sm">No events match your filters</div>
          )}

          <div className="px-4 py-3 border-t border-[hsl(220,20%,16%)] flex items-center justify-between">
            <div className="text-xs text-slate-500">{filtered.length} events shown</div>
            <div className="text-xs text-slate-600">Real-time feed · Auto-refreshing</div>
          </div>
        </div>
      </div>
    </div>
  );
}
