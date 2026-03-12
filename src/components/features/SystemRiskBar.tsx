import type { SystemStats } from '@/types';
import { cn } from '@/lib/utils';

interface SystemRiskBarProps {
  systems: SystemStats[];
}

const getRiskBarColor = (score: number) => {
  if (score >= 80) return 'bg-red-500';
  if (score >= 60) return 'bg-orange-500';
  if (score >= 40) return 'bg-yellow-500';
  return 'bg-green-500';
};

const getRiskTextColor = (score: number) => {
  if (score >= 80) return 'text-red-400';
  if (score >= 60) return 'text-orange-400';
  if (score >= 40) return 'text-yellow-400';
  return 'text-green-400';
};

export default function SystemRiskBar({ systems }: SystemRiskBarProps) {
  const sorted = [...systems].sort((a, b) => b.riskScore - a.riskScore);

  return (
    <div className="bg-[hsl(220,25%,11%)] border border-[hsl(220,20%,18%)] rounded-xl p-4">
      <div className="text-sm font-semibold text-slate-200 mb-1">System Risk Overview</div>
      <div className="text-xs text-slate-500 mb-4">Risk scores across monitored banking systems</div>

      <div className="space-y-3">
        {sorted.map(system => (
          <div key={system.system}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-300 font-medium">{system.label}</span>
                <span className="text-[10px] text-slate-600 bg-slate-500/10 border border-slate-500/15 px-1.5 py-0.5 rounded font-mono">
                  {system.alertCount} alerts
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500">{system.monitoredUsers} users</span>
                <span className={cn('text-xs font-bold font-mono', getRiskTextColor(system.riskScore))}>
                  {system.riskScore}
                </span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-white/5">
              <div
                className={cn('h-1.5 rounded-full transition-all', getRiskBarColor(system.riskScore))}
                style={{ width: `${system.riskScore}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
