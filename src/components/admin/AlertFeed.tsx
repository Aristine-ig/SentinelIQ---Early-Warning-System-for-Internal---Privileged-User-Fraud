import { useState } from 'react';
import { X, AlertTriangle, CheckCircle, ChevronRight, Clock, User, Shield } from 'lucide-react';
import { useApp } from '@/lib/store';
import { cn, formatDate, getSeverityBg } from '@/lib/utils';
import type { Alert, AlertStatus } from '@/types';
import CaseDetailView from './CaseDetailView';

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: 'All', value: 'all' },
  { label: 'Open', value: 'open' },
  { label: 'Escalated', value: 'escalated' },
  { label: 'Closed', value: 'closed' },
  { label: 'False Positive', value: 'false_positive' },
];

const SEVERITY_FILTERS = ['All', 'Low', 'Medium', 'High', 'Critical', 'Severe'];

export default function AlertFeed() {
  const { state } = useApp();
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('All');
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const { alerts } = state;

  const filtered = alerts.filter(a => {
    const statusOk = statusFilter === 'all' || a.status === statusFilter;
    const sevOk = severityFilter === 'All' || a.severity === severityFilter;
    return statusOk && sevOk;
  });

  const rowBg = (alert: Alert) => {
    if (alert.severity === 'Severe') return 'bg-rose-500/10 border-rose-500/30 hover:bg-rose-500/15';
    if (alert.severity === 'Critical') return 'bg-red-500/8 border-red-500/20 hover:bg-red-500/12';
    if (alert.severity === 'High') return 'bg-orange-500/8 border-orange-500/20 hover:bg-orange-500/12';
    return 'bg-[#0d1f35] border-slate-700/30 hover:bg-slate-700/20';
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">Live Alert Feed</h2>
          <p className="text-sm text-slate-400">{filtered.length} alerts • Auto-refreshing</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs text-red-400 font-medium">LIVE</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex gap-1 bg-[#0d1f35] border border-slate-700/40 rounded-lg p-1">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                statusFilter === f.value
                  ? "bg-sky-600 text-white"
                  : "text-slate-400 hover:text-white"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-[#0d1f35] border border-slate-700/40 rounded-lg p-1">
          {SEVERITY_FILTERS.map(s => (
            <button
              key={s}
              onClick={() => setSeverityFilter(s)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                severityFilter === s
                  ? "bg-sky-600 text-white"
                  : "text-slate-400 hover:text-white"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Alert table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <Shield className="w-12 h-12 mb-3 opacity-30" />
          <p className="font-medium">No alerts match the current filters</p>
          <p className="text-sm mt-1">Alerts appear here in real-time as rules are triggered</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(alert => (
            <button
              key={alert.id}
              onClick={() => setSelectedAlert(alert)}
              className={cn(
                "w-full text-left border rounded-xl px-4 py-3.5 transition-all duration-150 cursor-pointer",
                rowBg(alert),
                alert.severity === 'Severe' ? 'ring-1 ring-rose-500/30' : ''
              )}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {alert.severity === 'Severe' || alert.severity === 'Critical' ? (
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                  ) : (
                    <Shield className="w-4 h-4 text-slate-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-slate-400">{alert.id}</span>
                    <span className={cn("text-xs font-bold px-2 py-0.5 rounded border", getSeverityBg(alert.severity))}>
                      {alert.severity}
                    </span>
                    <span className="text-xs text-slate-500 bg-slate-700/40 px-2 py-0.5 rounded">
                      {alert.scamType}
                    </span>
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded border",
                      alert.status === 'open' ? 'text-sky-300 bg-sky-500/10 border-sky-500/30' :
                      alert.status === 'escalated' ? 'text-purple-300 bg-purple-500/10 border-purple-500/30' :
                      alert.status === 'false_positive' ? 'text-slate-300 bg-slate-500/10 border-slate-500/30' :
                      'text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
                    )}>
                      {alert.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1.5">
                    <span className="flex items-center gap-1 text-sm font-medium text-white">
                      <User className="w-3 h-3 text-slate-400" />
                      {alert.userName}
                    </span>
                    <span className="text-xs text-slate-400">{alert.role}</span>
                    <span className="text-xs font-bold text-white">Score: {alert.totalScore}/100</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-1">{alert.explanation}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Clock className="w-3 h-3" />
                      {formatDate(alert.timestamp)}
                    </div>
                    <div className="text-right mt-1">
                      <span className="text-xs text-slate-500">{alert.triggeredRules.length} rules</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedAlert && (
        <CaseDetailView
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
        />
      )}
    </div>
  );
}
