import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderOpen, Clock, User, AlertTriangle, ChevronRight } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import Header from '@/components/layout/Header';
import { MOCK_CASES, getRiskBadgeClasses, getStatusBadgeClasses } from '@/constants/mockData';
import type { CaseStatus } from '@/types';
import { cn } from '@/lib/utils';

const statusFilters: { label: string; value: CaseStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Open', value: 'open' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Escalated', value: 'escalated' },
  { label: 'Closed', value: 'closed' },
];

export default function Cases() {
  const [statusFilter, setStatusFilter] = useState<CaseStatus | 'all'>('all');
  const navigate = useNavigate();

  const filtered = MOCK_CASES.filter(c =>
    statusFilter === 'all' || c.status === statusFilter
  ).sort((a, b) => {
    const priority = { critical: 4, high: 3, medium: 2, low: 1 };
    return priority[b.priority] - priority[a.priority];
  });

  const stats = {
    open: MOCK_CASES.filter(c => c.status === 'open').length,
    in_progress: MOCK_CASES.filter(c => c.status === 'in_progress').length,
    escalated: MOCK_CASES.filter(c => c.status === 'escalated').length,
    estimatedLoss: MOCK_CASES.reduce((sum, c) => sum + (c.estimatedLoss || 0), 0),
  };

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header title="Case Management" subtitle="Investigation workspace for confirmed and suspected fraud cases" />

      <div className="flex-1 p-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <div className="bg-[hsl(220,25%,11%)] border border-red-500/20 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-red-400">{stats.open}</div>
            <div className="text-xs text-slate-500 mt-1">Open Cases</div>
          </div>
          <div className="bg-[hsl(220,25%,11%)] border border-cyan-500/20 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-cyan-400">{stats.in_progress}</div>
            <div className="text-xs text-slate-500 mt-1">In Progress</div>
          </div>
          <div className="bg-[hsl(220,25%,11%)] border border-purple-500/20 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-purple-400">{stats.escalated}</div>
            <div className="text-xs text-slate-500 mt-1">Escalated</div>
          </div>
          <div className="bg-[hsl(220,25%,11%)] border border-orange-500/20 rounded-xl p-4 text-center">
            <div className="text-xl font-bold text-orange-400 font-mono">${(stats.estimatedLoss / 1000000).toFixed(1)}M</div>
            <div className="text-xs text-slate-500 mt-1">Est. Financial Risk</div>
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1 mb-5 flex-wrap">
          {statusFilters.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                statusFilter === f.value
                  ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                  : 'bg-transparent text-slate-500 border-transparent hover:text-slate-300'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Cases List */}
        <div className="space-y-3">
          {filtered.map(c => (
            <div
              key={c.id}
              onClick={() => navigate(`/cases/${c.id}`)}
              className="bg-[hsl(220,25%,11%)] border border-[hsl(220,20%,18%)] rounded-xl p-4 cursor-pointer hover:border-cyan-500/25 hover:bg-[hsl(220,25%,13%)] transition-all group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded border uppercase tracking-wide', getRiskBadgeClasses(c.priority))}>
                      {c.priority}
                    </span>
                    <span className={cn('text-[10px] px-2 py-0.5 rounded border capitalize', getStatusBadgeClasses(c.status))}>
                      {c.status.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] text-slate-600 font-mono">{c.id.toUpperCase()}</span>
                  </div>

                  <div className="text-sm font-semibold text-slate-100 group-hover:text-white mb-1.5 leading-tight">
                    {c.title}
                  </div>
                  <div className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{c.description}</div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <User className="w-3 h-3" />
                      <span>{c.userName}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <AlertTriangle className="w-3 h-3" />
                      <span>{c.alertIds.length} linked alert{c.alertIds.length > 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <Clock className="w-3 h-3" />
                      <span>Updated {formatDistanceToNow(new Date(c.updatedAt), { addSuffix: true })}</span>
                    </div>
                    {c.estimatedLoss && (
                      <div className="flex items-center gap-1.5 text-[11px] text-orange-400 font-mono font-medium">
                        Est. risk: ${c.estimatedLoss.toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <div className="text-xs text-slate-500">
                    {c.assignedTo === 'Unassigned'
                      ? <span className="text-yellow-500">Unassigned</span>
                      : <span className="text-cyan-400">{c.assignedTo}</span>}
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-cyan-500 transition-colors" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
