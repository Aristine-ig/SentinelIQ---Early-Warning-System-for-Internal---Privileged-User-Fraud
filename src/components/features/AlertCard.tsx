import { useNavigate } from 'react-router-dom';
import { Clock, MapPin, Cpu, AlertTriangle, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Alert } from '@/types';
import { getRiskBadgeClasses, getStatusBadgeClasses, formatSystemLabel, formatAnomalyType } from '@/constants/mockData';
import RiskScoreBadge from './RiskScoreBadge';
import { cn } from '@/lib/utils';

interface AlertCardProps {
  alert: Alert;
  compact?: boolean;
}

const criticalGlow: Record<string, string> = {
  critical: 'border-l-red-500 shadow-red-500/10',
  high: 'border-l-orange-500 shadow-orange-500/10',
  medium: 'border-l-yellow-500 shadow-yellow-500/10',
  low: 'border-l-green-500 shadow-green-500/10',
};

export default function AlertCard({ alert, compact = false }: AlertCardProps) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/alerts/${alert.id}`)}
      className={cn(
        'bg-[hsl(220,25%,11%)] border border-[hsl(220,20%,18%)] rounded-xl cursor-pointer transition-all duration-200 hover:border-cyan-500/25 hover:bg-[hsl(220,25%,13%)] group border-l-4',
        criticalGlow[alert.riskLevel],
        compact ? 'p-3' : 'p-4'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-wide', getRiskBadgeClasses(alert.riskLevel))}>
              {alert.riskLevel}
            </span>
            <span className={cn('text-[10px] px-2 py-0.5 rounded-md capitalize', getStatusBadgeClasses(alert.status))}>
              {alert.status.replace('_', ' ')}
            </span>
            <span className="text-[10px] text-slate-500 bg-slate-500/10 border border-slate-500/20 px-2 py-0.5 rounded-md">
              {formatAnomalyType(alert.anomalyType)}
            </span>
          </div>

          <div className={cn('font-semibold text-slate-100 group-hover:text-white leading-tight', compact ? 'text-xs' : 'text-sm')}>
            {alert.title}
          </div>

          {!compact && (
            <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
              {alert.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <AlertTriangle className="w-3 h-3" />
              <span>{alert.userName} · {alert.department}</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <Cpu className="w-3 h-3" />
              <span>{formatSystemLabel(alert.system)}</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <Clock className="w-3 h-3" />
              <span>{formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}</span>
            </div>
            {alert.location && !compact && (
              <div className="flex items-center gap-1 text-[11px] text-slate-500">
                <MapPin className="w-3 h-3" />
                <span className="truncate max-w-[200px]">{alert.location}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <RiskScoreBadge score={alert.riskScore} size="sm" showLabel={false} />
          <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-cyan-500 transition-colors" />
        </div>
      </div>

      {!compact && alert.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-[hsl(220,20%,16%)]">
          {alert.tags.map(tag => (
            <span key={tag} className="text-[10px] text-slate-500 bg-slate-500/10 border border-slate-500/15 px-1.5 py-0.5 rounded font-mono">
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
