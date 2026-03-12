import { cn } from '@/lib/utils';

interface RiskScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const getRiskLevel = (score: number) => {
  if (score >= 80) return { label: 'CRITICAL', color: 'text-red-400', bg: 'bg-red-500/15 border-red-500/30', bar: 'bg-red-500' };
  if (score >= 60) return { label: 'HIGH', color: 'text-orange-400', bg: 'bg-orange-500/15 border-orange-500/30', bar: 'bg-orange-500' };
  if (score >= 40) return { label: 'MEDIUM', color: 'text-yellow-400', bg: 'bg-yellow-500/15 border-yellow-500/30', bar: 'bg-yellow-500' };
  return { label: 'LOW', color: 'text-green-400', bg: 'bg-green-500/15 border-green-500/30', bar: 'bg-green-500' };
};

export default function RiskScoreBadge({ score, size = 'md', showLabel = true }: RiskScoreBadgeProps) {
  const risk = getRiskLevel(score);

  if (size === 'lg') {
    return (
      <div className={cn('flex flex-col items-center px-5 py-4 rounded-xl border', risk.bg)}>
        <div className={cn('text-4xl font-bold font-mono', risk.color)}>{score}</div>
        <div className="text-[10px] text-slate-500 mt-1">RISK SCORE</div>
        {showLabel && (
          <div className={cn('text-xs font-semibold mt-2 px-2 py-0.5 rounded-md', risk.bg, risk.color)}>
            {risk.label}
          </div>
        )}
        <div className="w-full mt-3 h-1.5 rounded-full bg-white/10">
          <div
            className={cn('h-1.5 rounded-full transition-all', risk.bar)}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('inline-flex items-center gap-1.5 border rounded-lg font-mono',
      size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
      risk.bg, risk.color
    )}>
      <span className="font-bold">{score}</span>
      {showLabel && <span className="text-[10px] opacity-70">{risk.label}</span>}
    </div>
  );
}
