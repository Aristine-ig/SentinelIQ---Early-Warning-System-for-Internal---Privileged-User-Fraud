import { Bell, Users, AlertTriangle, Shield, Activity, FolderOpen } from 'lucide-react';
import Header from '@/components/layout/Header';
import MetricCard from '@/components/features/MetricCard';
import AlertCard from '@/components/features/AlertCard';
import BehaviorChart from '@/components/features/BehaviorChart';
import RiskTrendChart from '@/components/features/RiskTrendChart';
import SystemRiskBar from '@/components/features/SystemRiskBar';
import { DASHBOARD_METRICS, MOCK_ALERTS, BEHAVIOR_DATA, RISK_TREND, SYSTEM_STATS } from '@/constants/mockData';
import heroDashboard from '@/assets/hero-dashboard.jpg';

export default function Dashboard() {
  const criticalAlerts = MOCK_ALERTS.filter(a => a.riskLevel === 'critical' || a.riskLevel === 'high').slice(0, 4);

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header title="Security Operations Dashboard" subtitle="Real-time behavioral monitoring · 412 users · 6 systems" />

      <div className="flex-1 p-6 space-y-6">
        {/* Hero Banner */}
        <div className="relative rounded-2xl overflow-hidden border border-cyan-500/20 h-36 glow-cyan">
          <img src={heroDashboard} alt="Dashboard" className="w-full h-full object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-r from-[hsl(222,30%,7%)] via-[hsl(222,30%,7%)]/70 to-transparent flex items-center px-8">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="relative w-2 h-2">
                  <div className="w-2 h-2 rounded-full bg-red-400"></div>
                  <div className="absolute inset-0 w-2 h-2 rounded-full bg-red-400 animate-ping opacity-60"></div>
                </div>
                <span className="text-xs text-red-400 font-semibold uppercase tracking-widest">Active Threat Detected</span>
              </div>
              <div className="text-xl font-bold text-white">4 Critical Alerts Require Immediate Attention</div>
              <div className="text-sm text-slate-400 mt-1">Enterprise risk score elevated to 91 — 57-point increase over 14 days</div>
            </div>
          </div>
          <div className="absolute top-4 right-6 text-right">
            <div className="text-3xl font-bold text-red-400 font-mono">91</div>
            <div className="text-xs text-slate-500 uppercase tracking-widest">Risk Score</div>
          </div>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Total Alerts (30d)"
            value={DASHBOARD_METRICS.totalAlerts}
            subValue={`${DASHBOARD_METRICS.alertsToday} today`}
            icon={Bell}
            trend="up"
            trendValue="27%"
            variant="warning"
          />
          <MetricCard
            label="Critical Alerts Open"
            value={DASHBOARD_METRICS.criticalAlerts}
            subValue="Requires immediate action"
            icon={AlertTriangle}
            variant="critical"
          />
          <MetricCard
            label="Open Cases"
            value={DASHBOARD_METRICS.openCases}
            subValue={`${DASHBOARD_METRICS.resolvedToday} resolved today`}
            icon={FolderOpen}
            trend="up"
            trendValue="3 new"
            variant="warning"
          />
          <MetricCard
            label="Monitored Users"
            value={DASHBOARD_METRICS.monitoredUsers}
            subValue="Across 6 banking systems"
            icon={Users}
            variant="info"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <BehaviorChart data={BEHAVIOR_DATA} title="Today's Activity vs. Behavioral Baseline" />
          </div>
          <div>
            <div className="grid grid-cols-1 gap-4">
              <MetricCard label="Avg Risk Score" value={`${DASHBOARD_METRICS.avgRiskScore}/100`} icon={Shield} variant="warning" />
              <MetricCard label="False Positive Rate" value={`${DASHBOARD_METRICS.falsePositiveRate}%`} subValue="Last 30 days" icon={Activity} trend="down" trendValue="2.1%" variant="success" />
            </div>
          </div>
        </div>

        {/* Risk Trend + System Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RiskTrendChart data={RISK_TREND} />
          <SystemRiskBar systems={SYSTEM_STATS} />
        </div>

        {/* Active Alerts Feed */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold text-slate-200">High-Priority Alert Feed</div>
              <div className="text-xs text-slate-500 mt-0.5">Critical & high severity alerts requiring triage</div>
            </div>
            <a href="/alerts" className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors">View all alerts →</a>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {criticalAlerts.map(alert => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
