import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { AlertTriangle, Users, Shield, Activity } from 'lucide-react';
import { useApp } from '@/lib/store';
import { cn, getSeverity, getSeverityColor, getSeverityBg } from '@/lib/utils';
import type { Severity } from '@/types';

const SEVERITY_ORDER: Severity[] = ['Low', 'Medium', 'High', 'Critical', 'Severe'];

export default function OverviewPanel() {
  const { state } = useApp();
  const { alerts, users, sessions, customers } = state;

  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const recentAlerts = alerts.filter(a => new Date(a.timestamp) > last24h);

  const severityCounts = useMemo(() => {
    return SEVERITY_ORDER.map(sev => ({
      severity: sev,
      count: recentAlerts.filter(a => a.severity === sev).length,
    }));
  }, [recentAlerts]);

  // Top 5 risk users
  const topRiskUsers = useMemo(() => {
    return users
      .filter(u => !u.isAdmin)
      .map(u => ({
        user: u,
        score: sessions[u.id]?.riskScore || 0,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [users, sessions]);

  // 7-day trend
  const alertTrend = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);
      return d;
    });

    return days.map(day => {
      const nextDay = new Date(day.getTime() + 86400000);
      const dayAlerts = alerts.filter(a => {
        const t = new Date(a.timestamp);
        return t >= day && t < nextDay;
      });
      return {
        date: day.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }),
        alerts: dayAlerts.length,
        critical: dayAlerts.filter(a => ['Critical', 'Severe'].includes(a.severity)).length,
      };
    });
  }, [alerts]);

  // Scam type breakdown
  const scamBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    alerts.forEach(a => {
      counts[a.scamType] = (counts[a.scamType] || 0) + 1;
    });
    const colors = ['#38bdf8', '#818cf8', '#fb923c', '#34d399', '#f87171', '#a78bfa', '#facc15', '#60a5fa'];
    return Object.entries(counts).map(([type, count], i) => ({
      name: type,
      value: count,
      color: colors[i % colors.length],
    }));
  }, [alerts]);

  const activeSessions = Object.keys(sessions).length;
  const dormantCount = customers.filter(c => c.accountStatus === 'Dormant').length;

  const statCards = [
    { label: 'Active Sessions', value: activeSessions, icon: Users, colorClass: 'text-sky-400', bgClass: 'bg-sky-500/20' },
    { label: 'Alerts (24h)', value: recentAlerts.length, icon: BellIcon, colorClass: 'text-amber-400', bgClass: 'bg-amber-500/20' },
    { label: 'Open Cases', value: alerts.filter(a => a.status === 'open').length, icon: AlertTriangle, colorClass: 'text-orange-400', bgClass: 'bg-orange-500/20' },
    { label: 'Dormant Accounts', value: dormantCount, icon: Shield, colorClass: 'text-red-400', bgClass: 'bg-red-500/20' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(card => (
          <div key={card.label} className="bg-[#0d1f35] border border-slate-700/40 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-400 uppercase tracking-wider">{card.label}</span>
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', card.bgClass)}>
                <card.icon className={cn('w-4 h-4', card.colorClass)} />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Severity breakdown */}
      <div className="grid grid-cols-5 gap-2">
        {severityCounts.map(s => (
          <div key={s.severity} className={cn('rounded-xl p-3 border text-center', getSeverityBg(s.severity as Severity))}>
            <p className="text-xl font-bold">{s.count}</p>
            <p className="text-xs mt-0.5 opacity-80">{s.severity}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Alert trend chart */}
        <div className="bg-[#0d1f35] border border-slate-700/40 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Alert Trend — Last 7 Days</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={alertTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#0d1f35', border: '1px solid #1e3a5f', borderRadius: 8 }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Line type="monotone" dataKey="alerts" stroke="#38bdf8" strokeWidth={2} dot={{ fill: '#38bdf8', r: 3 }} name="Total" />
              <Line type="monotone" dataKey="critical" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 3 }} name="Critical+" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Scam type breakdown */}
        <div className="bg-[#0d1f35] border border-slate-700/40 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Alerts by Scam Type</h3>
          {scamBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={scamBreakdown}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  label={({ percent }) => (percent > 0.1 ? `${(percent * 100).toFixed(0)}%` : '')}
                >
                  {scamBreakdown.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#0d1f35', border: '1px solid #1e3a5f', borderRadius: 8 }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-slate-500 text-sm">
              <div className="text-center">
                <Shield className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p>No alerts generated yet</p>
                <p className="text-xs mt-1">Log in as a user and perform actions to trigger rules</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top risk users */}
      <div className="bg-[#0d1f35] border border-slate-700/40 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Top 5 Highest Risk Users</h3>
        {topRiskUsers.every(u => u.score === 0) ? (
          <p className="text-slate-500 text-sm">No risk events recorded yet. Trigger actions to see scores here.</p>
        ) : (
          <div className="space-y-3">
            {topRiskUsers.map(({ user, score }) => {
              const sev = getSeverity(score);
              return (
                <div key={user.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-600 to-blue-700 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-white">{user.fullName.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-white truncate">{user.fullName}</span>
                      <span className={cn('text-xs font-bold px-2 py-0.5 rounded border ml-2 flex-shrink-0', getSeverityBg(sev))}>
                        {score}
                      </span>
                    </div>
                    <div className="w-full bg-slate-700/50 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${score}%`, backgroundColor: getSeverityColor(sev) }}
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-slate-500">{user.role}</span>
                      <span className="text-[10px] text-slate-600">·</span>
                      <span className="text-[10px] text-slate-500">{user.department}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
