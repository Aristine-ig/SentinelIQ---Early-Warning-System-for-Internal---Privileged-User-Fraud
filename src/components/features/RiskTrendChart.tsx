import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, AreaChart
} from 'recharts';
import type { RiskTrendPoint } from '@/types';

interface RiskTrendChartProps {
  data: RiskTrendPoint[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[hsl(220,25%,11%)] border border-[hsl(220,20%,20%)] rounded-lg p-3 shadow-xl">
        <div className="text-xs text-slate-400 mb-2">{label}</div>
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full" style={{ background: entry.color }}></div>
            <span className="text-slate-400">{entry.name}:</span>
            <span className="text-white font-mono font-bold">{entry.value}{entry.name === 'Risk Score' ? '' : ''}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function RiskTrendChart({ data }: RiskTrendChartProps) {
  return (
    <div className="bg-[hsl(220,25%,11%)] border border-[hsl(220,20%,18%)] rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-semibold text-slate-200">Enterprise Risk Trend</div>
          <div className="text-xs text-slate-500 mt-0.5">14-day aggregated risk score</div>
        </div>
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-lg font-mono font-semibold">
          ↑ +57 pts / 14d
        </div>
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(0, 85%, 58%)" stopOpacity={0.25} />
              <stop offset="95%" stopColor="hsl(0, 85%, 58%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsla(220,20%,25%,0.5)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: 'hsl(215, 20%, 45%)', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval={3}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: 'hsl(215, 20%, 45%)', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={80} stroke="hsl(0, 85%, 58%)" strokeDasharray="4 2" strokeWidth={1} strokeOpacity={0.5} label={{ value: 'CRITICAL', fill: 'hsl(0,85%,58%)', fontSize: 9, position: 'insideTopRight' }} />
          <ReferenceLine y={60} stroke="hsl(25, 95%, 55%)" strokeDasharray="4 2" strokeWidth={1} strokeOpacity={0.4} />
          <Area
            type="monotone"
            dataKey="score"
            name="Risk Score"
            stroke="hsl(0, 85%, 58%)"
            strokeWidth={2}
            fill="url(#riskGrad)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
