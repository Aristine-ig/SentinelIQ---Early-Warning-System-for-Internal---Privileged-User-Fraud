import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  variant?: 'default' | 'critical' | 'warning' | 'success' | 'info';
  className?: string;
}

const variantStyles = {
  default: 'border-[hsl(220,20%,18%)] bg-[hsl(220,25%,11%)]',
  critical: 'border-red-500/30 bg-red-500/5',
  warning: 'border-orange-500/30 bg-orange-500/5',
  success: 'border-green-500/30 bg-green-500/5',
  info: 'border-cyan-500/30 bg-cyan-500/5',
};

const iconVariantStyles = {
  default: 'bg-slate-500/15 text-slate-400',
  critical: 'bg-red-500/15 text-red-400',
  warning: 'bg-orange-500/15 text-orange-400',
  success: 'bg-green-500/15 text-green-400',
  info: 'bg-cyan-500/15 text-cyan-400',
};

const valueVariantStyles = {
  default: 'text-white',
  critical: 'text-red-400',
  warning: 'text-orange-400',
  success: 'text-green-400',
  info: 'text-cyan-400',
};

export default function MetricCard({
  label, value, subValue, icon: Icon, trend, trendValue, variant = 'default', className
}: MetricCardProps) {
  return (
    <div className={cn('rounded-xl border p-4 transition-all hover:border-cyan-500/20', variantStyles[variant], className)}>
      <div className="flex items-start justify-between mb-3">
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', iconVariantStyles[variant])}>
          <Icon className="w-4 h-4" />
        </div>
        {trend && trendValue && (
          <span className={cn(
            'text-[11px] font-medium px-1.5 py-0.5 rounded-md',
            trend === 'up' ? 'bg-red-500/15 text-red-400' : trend === 'down' ? 'bg-green-500/15 text-green-400' : 'bg-slate-500/15 text-slate-400'
          )}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
          </span>
        )}
      </div>
      <div className={cn('text-2xl font-bold tracking-tight', valueVariantStyles[variant])}>{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
      {subValue && <div className="text-[11px] text-slate-600 mt-0.5">{subValue}</div>}
    </div>
  );
}
