import { useState } from 'react';
import { Filter, Search } from 'lucide-react';
import Header from '@/components/layout/Header';
import AlertCard from '@/components/features/AlertCard';
import { MOCK_ALERTS } from '@/constants/mockData';
import type { RiskLevel, AlertStatus } from '@/types';
import { cn } from '@/lib/utils';

const riskFilters: { label: string; value: RiskLevel | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Critical', value: 'critical' },
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' },
];

const statusFilters: { label: string; value: AlertStatus | 'all' }[] = [
  { label: 'All Status', value: 'all' },
  { label: 'Open', value: 'open' },
  { label: 'Investigating', value: 'investigating' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'False Positive', value: 'false_positive' },
];

export default function Alerts() {
  const [riskFilter, setRiskFilter] = useState<RiskLevel | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<AlertStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  const filtered = MOCK_ALERTS.filter(alert => {
    const matchRisk = riskFilter === 'all' || alert.riskLevel === riskFilter;
    const matchStatus = statusFilter === 'all' || alert.status === statusFilter;
    const matchSearch = !search ||
      alert.title.toLowerCase().includes(search.toLowerCase()) ||
      alert.userName.toLowerCase().includes(search.toLowerCase()) ||
      alert.department.toLowerCase().includes(search.toLowerCase());
    return matchRisk && matchStatus && matchSearch;
  }).sort((a, b) => b.riskScore - a.riskScore);

  const counts = {
    all: MOCK_ALERTS.length,
    critical: MOCK_ALERTS.filter(a => a.riskLevel === 'critical').length,
    high: MOCK_ALERTS.filter(a => a.riskLevel === 'high').length,
    medium: MOCK_ALERTS.filter(a => a.riskLevel === 'medium').length,
    low: MOCK_ALERTS.filter(a => a.riskLevel === 'low').length,
  };

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header title="Alert Management" subtitle="Triage and investigate anomaly alerts" />

      <div className="flex-1 p-6">
        {/* Filters */}
        <div className="bg-[hsl(220,25%,11%)] border border-[hsl(220,20%,18%)] rounded-xl p-4 mb-5">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by user, title, or department..."
                className="w-full h-9 pl-9 pr-3 text-sm bg-[hsl(220,20%,15%)] border border-[hsl(220,20%,20%)] rounded-lg text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40"
              />
            </div>

            {/* Risk Level Filter */}
            <div className="flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-slate-500 mr-1 flex-shrink-0" />
              {riskFilters.map(f => (
                <button
                  key={f.value}
                  onClick={() => setRiskFilter(f.value)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-medium transition-all border',
                    riskFilter === f.value
                      ? f.value === 'critical' ? 'bg-red-500/20 text-red-400 border-red-500/30'
                        : f.value === 'high' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                        : f.value === 'medium' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                        : f.value === 'low' ? 'bg-green-500/20 text-green-400 border-green-500/30'
                        : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                      : 'bg-transparent text-slate-500 border-transparent hover:text-slate-300'
                  )}
                >
                  {f.label} {f.value !== 'all' && <span className="ml-1 opacity-70">{counts[f.value as keyof typeof counts]}</span>}
                </button>
              ))}
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as AlertStatus | 'all')}
              className="h-9 px-3 text-xs bg-[hsl(220,20%,15%)] border border-[hsl(220,20%,20%)] rounded-lg text-slate-300 focus:outline-none focus:border-cyan-500/40"
            >
              {statusFilters.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-slate-400">
            <span className="text-white font-semibold">{filtered.length}</span> alerts found
          </div>
          <div className="text-xs text-slate-500">Sorted by risk score (highest first)</div>
        </div>

        {/* Alert List */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <div className="text-4xl mb-3">🔍</div>
              <div className="text-sm">No alerts match your current filters</div>
            </div>
          ) : (
            filtered.map(alert => (
              <AlertCard key={alert.id} alert={alert} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
