import { X, AlertTriangle, ChevronDown } from 'lucide-react';
import { useApp } from '@/lib/store';
import { cn, formatDate, getSeverityBg, getSeverityColor } from '@/lib/utils';
import type { Alert, AlertStatus } from '@/types';
import { toast } from 'sonner';

interface Props {
  alert: Alert;
  onClose: () => void;
}

export default function CaseDetailView({ alert, onClose }: Props) {
  const { updateAlert, updateUser, state } = useApp();

  const user = state.users.find(u => u.id === alert.userId);
  const session = state.sessions[alert.userId];
  const activityLogs = state.activityLogs
    .filter(l => l.userId === alert.userId)
    .slice(0, 20);

  const STATUS_OPTIONS: { value: AlertStatus; label: string; classes: string }[] = [
    { value: 'open',           label: 'Open',          classes: 'text-sky-300 bg-sky-500/10 border-sky-500/30' },
    { value: 'escalated',     label: 'Escalated',     classes: 'text-purple-300 bg-purple-500/10 border-purple-500/30' },
    { value: 'closed',        label: 'Closed',        classes: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' },
    { value: 'false_positive',label: 'False Positive',classes: 'text-slate-300 bg-slate-500/10 border-slate-500/30' },
  ];

  const currentStatusOpt = STATUS_OPTIONS.find(s => s.value === alert.status) ?? STATUS_OPTIONS[0];

  const handleStatusChange = (newStatus: AlertStatus) => {
    if (newStatus === alert.status) return;
    updateAlert(alert.id, { status: newStatus });
    const labels: Record<AlertStatus, string> = {
      open: 'Case re-opened',
      escalated: 'Escalated to Compliance team',
      closed: 'Case closed',
      false_positive: 'Marked as false positive',
    };
    toast.success(labels[newStatus]);
  };

  const handleSuspend = () => {
    if (user) {
      updateUser({ ...user, status: 'suspended' });
      updateAlert(alert.id, { status: 'escalated' });
      toast.warning(`${user.fullName}'s account has been suspended`);
    }
  };

  const scorePercent = alert.totalScore;
  const color = getSeverityColor(alert.severity);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#0d1f35] border border-slate-700/50 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-[#0d1f35] border-b border-slate-700/50 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <div>
              <h2 className="text-base font-bold text-white">Case Detail — {alert.id}</h2>
              <p className="text-xs text-slate-400">{formatDate(alert.timestamp)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Risk Score Gauge */}
          <div className="bg-[#060e1a] rounded-xl p-5 border border-slate-700/30">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">Risk Score</h3>
              <span className={cn("text-sm font-bold px-3 py-1 rounded-lg border", getSeverityBg(alert.severity))}>
                {alert.severity}
              </span>
            </div>
            <div className="relative w-full bg-slate-700/50 rounded-full h-4 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${scorePercent}%`,
                  background: `linear-gradient(90deg, #1e3a5f, ${color})`,
                  boxShadow: `0 0 12px ${color}60`,
                }}
              />
              <div
                className="absolute top-0 h-full w-0.5 bg-white/30"
                style={{ left: `${scorePercent}%` }}
              />
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-xs text-slate-500">0</span>
              <span className="text-lg font-bold" style={{ color }}>{scorePercent}/100</span>
              <span className="text-xs text-slate-500">100</span>
            </div>
          </div>

          {/* User Profile */}
          <div className="bg-[#060e1a] rounded-xl p-5 border border-slate-700/30">
            <h3 className="text-sm font-semibold text-white mb-3">User Profile</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Name', value: alert.userName },
                { label: 'Role', value: alert.role },
                { label: 'Department', value: alert.department },
                { label: 'System', value: alert.system },
                { label: 'User ID', value: alert.userId },
                { label: 'Status', value: user?.status || 'Unknown' },
              ].map(f => (
                <div key={f.label}>
                  <p className="text-xs text-slate-500 uppercase tracking-wider">{f.label}</p>
                  <p className={cn("text-sm font-medium mt-0.5",
                    f.label === 'Status' && user?.status === 'suspended' ? 'text-red-400' : 'text-white'
                  )}>
                    {f.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Explanation */}
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-amber-300 mb-2">AI Analysis</h3>
            <p className="text-sm text-slate-300 leading-relaxed">{alert.explanation}</p>
            <div className="flex items-center gap-4 mt-3">
              <div>
                <p className="text-xs text-slate-500">Predicted Scam</p>
                <p className="text-sm font-semibold text-amber-300">{alert.scamType}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Confidence</p>
                <span className={cn("text-sm font-bold",
                  alert.confidence === 'HIGH' ? 'text-red-400' :
                  alert.confidence === 'MEDIUM' ? 'text-amber-400' : 'text-emerald-400'
                )}>
                  {alert.confidence}
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-500">Recommended Action</p>
                <p className="text-sm font-semibold text-white">{alert.recommendedAction}</p>
              </div>
            </div>
          </div>

          {/* Triggered Rules */}
          <div className="bg-[#060e1a] rounded-xl p-5 border border-slate-700/30">
            <h3 className="text-sm font-semibold text-white mb-3">
              Triggered Rules ({alert.triggeredRules.length})
            </h3>
            <div className="space-y-2">
              {alert.triggeredRules.map(rule => (
                <div key={rule.ruleId} className="flex items-start gap-3 p-2.5 bg-slate-700/20 rounded-lg">
                  <span className="text-xs font-mono font-bold text-sky-400 bg-sky-500/10 px-2 py-1 rounded flex-shrink-0">
                    {rule.ruleId}
                  </span>
                  <div className="flex-1">
                    <p className="text-xs text-slate-300">{rule.description}</p>
                  </div>
                  <span className="text-xs font-bold text-orange-400 flex-shrink-0">+{rule.score}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="bg-[#060e1a] rounded-xl p-5 border border-slate-700/30">
            <h3 className="text-sm font-semibold text-white mb-3">Activity Timeline</h3>
            {activityLogs.length === 0 ? (
              <p className="text-slate-500 text-sm">No activity logged</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {activityLogs.map(log => (
                  <div key={log.id} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-sky-500 mt-2 flex-shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white">{log.actionType}</span>
                        {log.customerName && (
                          <span className="text-xs text-slate-400">on {log.customerName} ({log.customerId})</span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500">{formatDate(log.timestamp)} · {log.ip}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Case Status + Actions */}
          <div className="bg-[#060e1a] rounded-xl p-5 border border-slate-700/30 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Case Status</h3>
              <div className="relative">
                <select
                  value={alert.status}
                  onChange={e => handleStatusChange(e.target.value as AlertStatus)}
                  className={cn(
                    "appearance-none pl-3 pr-8 py-2 rounded-lg border text-xs font-semibold cursor-pointer focus:outline-none transition-all",
                    currentStatusOpt.classes
                  )}
                  style={{ background: 'transparent' }}
                >
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value} className="bg-[#0d1f35] text-white">
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none opacity-70" />
              </div>
            </div>

            {/* Suspend User — always available if user is active */}
            {user && user.status !== 'suspended' && (
              <button
                onClick={handleSuspend}
                className="w-full px-3 py-2.5 text-xs font-semibold text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg transition-all"
              >
                Suspend User Session
              </button>
            )}
            {user && user.status === 'suspended' && (
              <div className="text-center py-2 text-xs text-red-400 font-medium">
                User account is currently suspended
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
