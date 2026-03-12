import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts';
import type { BehaviorDataPoint } from '@/types';

interface BehaviorChartProps {
  data: BehaviorDataPoint[];
  title?: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const isAnomaly = payload[0]?.payload?.anomaly;
    return (
      <div className={`bg-[hsl(220,25%,11%)] border rounded-lg p-3 shadow-xl ${isAnomaly ? 'border-red-500/40' : 'border-[hsl(220,20%,20%)]'}`}>
        <div className="text-xs text-slate-400 mb-2">{String(label).padStart(2, '0')}:00</div>
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full" style={{ background: entry.color }}></div>
            <span className="text-slate-400">{entry.name}:</span>
            <span className="text-white font-mono">{entry.value}</span>
          </div>
        ))}
        {isAnomaly && (
          <div className="mt-2 text-[10px] text-red-400 font-medium">⚠ Anomaly detected</div>
        )}
      </div>
    );
  }
  return null;
};

export default function BehaviorChart({ data, title = "Access Activity vs. Baseline" }: BehaviorChartProps) {
  const anomalyHours = data.filter(d => d.anomaly).map(d => d.hour);

  return (
    <div className="bg-[hsl(220,25%,11%)] border border-[hsl(220,20%,18%)] rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-semibold text-slate-200">{title}</div>
          <div className="text-xs text-slate-500 mt-0.5">24-hour activity profile — today</div>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-cyan-400/60 rounded"></div>
            <span className="text-slate-500">Baseline</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-cyan-400 rounded"></div>
            <span className="text-slate-500">Actual</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-red-400 rounded"></div>
            <span className="text-slate-500">Anomaly</span>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="baselineGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(192, 100%, 50%)" stopOpacity={0.1} />
              <stop offset="95%" stopColor="hsl(192, 100%, 50%)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(192, 100%, 50%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(192, 100%, 50%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsla(220,20%,25%,0.5)" vertical={false} />
          <XAxis
            dataKey="hour"
            tickFormatter={(v: number) => `${String(v).padStart(2, '0')}:00`}
            tick={{ fill: 'hsl(215, 20%, 45%)', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval={3}
          />
          <YAxis
            tick={{ fill: 'hsl(215, 20%, 45%)', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          {anomalyHours.map(h => (
            <ReferenceLine key={h} x={h} stroke="hsl(0, 85%, 58%)" strokeDasharray="4 2" strokeWidth={1} />
          ))}
          <Area
            type="monotone"
            dataKey="baseline"
            name="Baseline"
            stroke="hsl(192, 100%, 50%)"
            strokeWidth={1}
            strokeDasharray="4 2"
            strokeOpacity={0.5}
            fill="url(#baselineGrad)"
          />
          <Area
            type="monotone"
            dataKey="actual"
            name="Actual"
            stroke="hsl(192, 100%, 50%)"
            strokeWidth={2}
            fill="url(#actualGrad)"
            dot={(props: any) => {
              if (props.payload?.anomaly) {
                return <circle key={props.index} cx={props.cx} cy={props.cy} r={4} fill="hsl(0, 85%, 58%)" stroke="none" />;
              }
              return <circle key={props.index} cx={0} cy={0} r={0} fill="none" />;
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
