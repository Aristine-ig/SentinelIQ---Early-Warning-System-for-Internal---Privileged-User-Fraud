import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Brain, MapPin, Clock, Cpu, Globe, AlertTriangle, CheckCircle, XCircle, FileText } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import Header from '@/components/layout/Header';
import RiskScoreBadge from '@/components/features/RiskScoreBadge';
import { MOCK_ALERTS, getRiskBadgeClasses, getStatusBadgeClasses, formatSystemLabel, formatAnomalyType } from '@/constants/mockData';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function AlertDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const alert = MOCK_ALERTS.find(a => a.id === id);

  if (!alert) {
    return (
      <div className="flex flex-col h-full overflow-auto">
        <Header title="Alert Not Found" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-slate-500">
            <div className="text-4xl mb-3">⚠️</div>
            <div>Alert {id} not found</div>
            <button onClick={() => navigate('/alerts')} className="mt-4 text-cyan-400 hover:text-cyan-300 text-sm">
              Back to Alerts
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleAction = (action: string) => {
    toast.success(`Alert ${action} — case updated`);
  };

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header title="Alert Detail" subtitle={`Alert ID: ${alert.id.toUpperCase()}`} />

      <div className="flex-1 p-6">
        {/* Back button */}
        <button
          onClick={() => navigate('/alerts')}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-cyan-400 mb-5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Alerts
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-4">
            {/* Alert Header */}
            <div className="bg-[hsl(220,25%,11%)] border border-[hsl(220,20%,18%)] rounded-xl p-5">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-lg uppercase tracking-wide border', getRiskBadgeClasses(alert.riskLevel))}>
                  {alert.riskLevel} Risk
                </span>
                <span className={cn('text-xs px-2.5 py-1 rounded-lg border capitalize', getStatusBadgeClasses(alert.status))}>
                  {alert.status.replace('_', ' ')}
                </span>
                <span className="text-xs text-slate-500 bg-slate-500/10 border border-slate-500/20 px-2.5 py-1 rounded-lg">
                  {formatAnomalyType(alert.anomalyType)}
                </span>
                <span className="text-xs text-slate-500 bg-slate-500/10 border border-slate-500/20 px-2.5 py-1 rounded-lg">
                  {formatSystemLabel(alert.system)}
                </span>
              </div>

              <h2 className="text-lg font-bold text-white mb-3">{alert.title}</h2>
              <p className="text-sm text-slate-400 leading-relaxed">{alert.description}</p>

              <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-[hsl(220,20%,16%)]">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <AlertTriangle className="w-3.5 h-3.5 text-slate-500" />
                  <span>{alert.userName} · {alert.department}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>{format(new Date(alert.timestamp), 'MMM dd, yyyy HH:mm:ss')} ({formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })})</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  <span>{alert.location}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Globe className="w-3.5 h-3.5 text-slate-500" />
                  <span className="font-mono">{alert.ipAddress}</span>
                </div>
              </div>
            </div>

            {/* AI Explanation */}
            <div className="bg-[hsl(220,25%,11%)] border border-cyan-500/20 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center">
                  <Brain className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-200">AI Behavioral Analysis</div>
                  <div className="text-[10px] text-slate-500">ML ensemble model explanation · Confidence: High</div>
                </div>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed bg-cyan-500/5 border border-cyan-500/10 rounded-lg p-4 font-mono text-xs">
                {alert.aiExplanation}
              </p>
            </div>

            {/* Tags */}
            {alert.tags.length > 0 && (
              <div className="bg-[hsl(220,25%,11%)] border border-[hsl(220,20%,18%)] rounded-xl p-4">
                <div className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wide">Threat Indicators</div>
                <div className="flex flex-wrap gap-2">
                  {alert.tags.map(tag => (
                    <span key={tag} className="text-xs text-slate-400 bg-slate-500/10 border border-slate-500/20 px-2.5 py-1 rounded-lg font-mono">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Risk Score */}
            <RiskScoreBadge score={alert.riskScore} size="lg" />

            {/* Key Facts */}
            <div className="bg-[hsl(220,25%,11%)] border border-[hsl(220,20%,18%)] rounded-xl p-4">
              <div className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wide">Key Facts</div>
              <div className="space-y-3">
                <div>
                  <div className="text-[10px] text-slate-600 uppercase tracking-wide mb-0.5">User</div>
                  <div className="text-sm text-slate-200 font-medium">{alert.userName}</div>
                  <div className="text-xs text-slate-500">{alert.userRole} · {alert.department}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-600 uppercase tracking-wide mb-0.5">System</div>
                  <div className="text-sm text-slate-200">{formatSystemLabel(alert.system)}</div>
                </div>
                {alert.transactionAmount && (
                  <div>
                    <div className="text-[10px] text-slate-600 uppercase tracking-wide mb-0.5">Amount at Risk</div>
                    <div className="text-sm text-orange-400 font-bold font-mono">${alert.transactionAmount.toLocaleString()}</div>
                  </div>
                )}
                {alert.affectedRecords && (
                  <div>
                    <div className="text-[10px] text-slate-600 uppercase tracking-wide mb-0.5">Affected Records</div>
                    <div className="text-sm text-orange-400 font-bold font-mono">{alert.affectedRecords.toLocaleString()}</div>
                  </div>
                )}
                {alert.assignedTo && (
                  <div>
                    <div className="text-[10px] text-slate-600 uppercase tracking-wide mb-0.5">Assigned To</div>
                    <div className="text-sm text-cyan-400">{alert.assignedTo}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="bg-[hsl(220,25%,11%)] border border-[hsl(220,20%,18%)] rounded-xl p-4">
              <div className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wide">Actions</div>
              <div className="space-y-2">
                <button
                  onClick={() => handleAction('assigned to Chen Wei')}
                  className="w-full flex items-center justify-center gap-2 h-9 px-3 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 text-xs font-medium hover:bg-cyan-500/25 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Assign to Me
                </button>
                <button
                  onClick={() => handleAction('escalated to CISO')}
                  className="w-full flex items-center justify-center gap-2 h-9 px-3 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-medium hover:bg-orange-500/25 transition-colors"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Escalate to CISO
                </button>
                <button
                  onClick={() => handleAction('marked as resolved')}
                  className="w-full flex items-center justify-center gap-2 h-9 px-3 rounded-lg bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-medium hover:bg-green-500/25 transition-colors"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Mark Resolved
                </button>
                <button
                  onClick={() => handleAction('marked as false positive')}
                  className="w-full flex items-center justify-center gap-2 h-9 px-3 rounded-lg bg-slate-500/15 border border-slate-500/30 text-slate-400 text-xs font-medium hover:bg-slate-500/25 transition-colors"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  False Positive
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
