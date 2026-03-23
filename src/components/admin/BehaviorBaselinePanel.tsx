import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Brain, RefreshCw, TrendingUp, AlertTriangle, CheckCircle,
  Activity, User, ChevronDown, ChevronUp, Clock, BarChart2,
  Shield, Zap, Info, Database, Eye,
} from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from 'recharts';
import { useApp } from '@/lib/store';
import { cn, formatDateShort } from '@/lib/utils';
import {
  buildBehaviorProfile, saveBehaviorSnapshot, saveBaseline, buildBaselineFromLogs,
  type BehaviorProfile, type DeviationResult,
} from '@/lib/behaviorEngine';
import { RULE_DEFINITIONS } from '@/constants';
import { supabase } from '@/lib/supabase';

// ── Constants ─────────────────────────────────────────────────────────────────

const TIER_STYLE: Record<BehaviorProfile['riskTier'], string> = {
  Normal:    'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  Watch:     'text-amber-300  bg-amber-500/10  border-amber-500/30',
  Anomalous: 'text-orange-300 bg-orange-500/10 border-orange-500/30',
  Severe:    'text-rose-200   bg-rose-500/20   border-rose-400/50',
};

const TIER_BAR: Record<BehaviorProfile['riskTier'], string> = {
  Normal:    'bg-emerald-500',
  Watch:     'bg-amber-500',
  Anomalous: 'bg-orange-500',
  Severe:    'bg-rose-500',
};

const LEVEL_STYLE: Record<DeviationResult['level'], string> = {
  normal:  'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  watch:   'text-amber-300  bg-amber-500/10  border-amber-500/20',
  anomaly: 'text-orange-300 bg-orange-500/10 border-orange-500/20',
  severe:  'text-rose-300   bg-rose-500/20   border-rose-400/30',
};

const LEVEL_ICON: Record<DeviationResult['level'], React.ElementType> = {
  normal:  CheckCircle,
  watch:   Eye,
  anomaly: AlertTriangle,
  severe:  Zap,
};

// ── Z-score gauge colour ──────────────────────────────────────────────────────

function zColor(z: number): string {
  if (z < 1.5) return '#10b981';
  if (z < 2.0) return '#f59e0b';
  if (z < 3.5) return '#f97316';
  return '#fb7185';
}

// ── Snapshot chart types ──────────────────────────────────────────────────────

interface SnapshotRow {
  anomaly_score: number;
  risk_tier: string;
  captured_at: string;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BehaviorBaselinePanel() {
  const { state } = useApp();
  const { users, activityLogs, currentSession } = state;

  const [profiles, setProfiles] = useState<BehaviorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<Record<string, SnapshotRow[]>>({});

  // ── Build profiles from activity logs ──────────────────────────────────────
  const computeProfiles = useCallback(async () => {
    setRecomputing(true);
    const allUsers = users.filter(u => !u.isAdmin);   // skip admin for ML (too broad)
    const built: BehaviorProfile[] = [];

    for (const u of allUsers) {
      const currentIp = u.id === state.currentUser?.id ? (currentSession?.ip ?? '') : '';
      const sess = state.sessions[u.id] ?? null;
      const profile = buildBehaviorProfile(u, activityLogs, sess, currentIp);
      built.push(profile);

      // Persist baseline if enough samples
      if (profile.baseline.sampleCount >= 3) {
        await saveBaseline(u.id, profile.baseline);
      }

      // Save snapshot if there are active deviations
      if (profile.overallAnomalyScore > 0) {
        await saveBehaviorSnapshot(profile);
      }
    }

    // Sort: severe → anomalous → watch → normal
    const TIER_ORDER: Record<string, number> = { Severe: 0, Anomalous: 1, Watch: 2, Normal: 3 };
    built.sort((a, b) => (TIER_ORDER[a.riskTier] ?? 4) - (TIER_ORDER[b.riskTier] ?? 4));
    setProfiles(built);
    setRecomputing(false);
    setLoading(false);
  }, [users, activityLogs, currentSession, state.currentUser?.id, state.sessions]);

  useEffect(() => {
    computeProfiles();
  }, [computeProfiles]);

  // ── Load snapshots for expanded user ───────────────────────────────────────
  const loadSnapshots = useCallback(async (userId: string) => {
    if (snapshots[userId]) return;
    const { data } = await supabase
      .from('behavior_snapshots')
      .select('anomaly_score, risk_tier, captured_at')
      .eq('user_id', userId)
      .order('captured_at', { ascending: false })
      .limit(30);

    if (data) {
      setSnapshots(prev => ({ ...prev, [userId]: data as SnapshotRow[] }));
    }
  }, [snapshots]);

  // ── Summary stats ──────────────────────────────────────────────────────────
  const severeCount    = profiles.filter(p => p.riskTier === 'Severe').length;
  const anomalousCount = profiles.filter(p => p.riskTier === 'Anomalous').length;
  const watchCount     = profiles.filter(p => p.riskTier === 'Watch').length;
  const normalCount    = profiles.filter(p => p.riskTier === 'Normal').length;

  // Total rules triggered across all profiles
  const totalTriggers = profiles.reduce((s, p) =>
    s + p.deviations.filter(d => d.triggeredRule).length, 0
  );

  // ── Radar data for a profile ───────────────────────────────────────────────
  function radarData(profile: BehaviorProfile) {
    return profile.deviations.map(d => ({
      dimension: d.label,
      zScore: Math.round(d.zScore * 10) / 10,
      threshold: 2.0,
    }));
  }

  // ── Line chart data from snapshots ────────────────────────────────────────
  function lineData(userId: string) {
    const rows = snapshots[userId] ?? [];
    return [...rows]
      .sort((a, b) => new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime())
      .map((r, i) => ({
        idx: i + 1,
        score: r.anomaly_score,
        label: formatDateShort(r.captured_at),
      }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-400">Building behavioral baselines…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Brain className="w-5 h-5 text-violet-400" />
            Behavioral Baseline ML Engine
            {(severeCount + anomalousCount) > 0 && (
              <span className="ml-1 bg-rose-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                {severeCount + anomalousCount} alert{severeCount + anomalousCount !== 1 ? 's' : ''}
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Statistical Z-score anomaly detection across 6 behavioral dimensions per employee
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); computeProfiles(); }}
          disabled={recomputing}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
        >
          <RefreshCw className={cn("w-4 h-4", recomputing && "animate-spin")} />
          Recompute Baselines
        </button>
      </div>

      {/* Info banner */}
      <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-3 flex items-start gap-3">
        <Info className="w-4 h-4 text-violet-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-violet-300/90">
          Each employee's behavioral baseline is built using Welford's online algorithm across their historical sessions in <code className="text-violet-200">activity_logs</code>. 
          Deviations are scored via Z-score (σ ≥ 2.0 = Watch, σ ≥ 2.0 = Anomaly, σ ≥ 3.5 = Severe). 
          ML rules <span className="font-bold text-violet-200">R120–R125</span> are automatically fed into the existing alert pipeline when triggered.
          Run <code className="text-violet-200">supabase-migration-behavior-baselines.sql</code> to enable persistent baselines and snapshot history.
        </p>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Severe',    value: severeCount,    color: 'text-rose-300',    bg: 'bg-rose-500/20   border-rose-400/30'   },
          { label: 'Anomalous', value: anomalousCount, color: 'text-orange-300',  bg: 'bg-orange-500/15 border-orange-400/30' },
          { label: 'Watch',     value: watchCount,     color: 'text-amber-300',   bg: 'bg-amber-500/15  border-amber-400/30'  },
          { label: 'Normal',    value: normalCount,    color: 'text-emerald-300', bg: 'bg-emerald-500/10 border-emerald-400/30' },
          { label: 'ML Rules Triggered', value: totalTriggers, color: 'text-violet-300', bg: 'bg-violet-500/15 border-violet-400/30' },
        ].map(card => (
          <div key={card.label} className={cn('border rounded-xl p-3', card.bg)}>
            <p className={cn("text-[10px] uppercase tracking-wider opacity-70", card.color)}>{card.label}</p>
            <p className={cn("text-2xl font-bold mt-1", card.color)}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* ML rules legend */}
      <div className="bg-[#0a1628] border border-slate-700/30 rounded-xl p-4">
        <p className="text-xs font-semibold text-slate-300 mb-3 uppercase tracking-wider flex items-center gap-2">
          <Brain className="w-3.5 h-3.5 text-violet-400" />
          ML Detection Rules
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {['R120','R121','R122','R123','R124','R125'].map(rId => {
            const def = RULE_DEFINITIONS[rId];
            if (!def) return null;
            return (
              <div key={rId} className="flex items-start gap-2 px-2.5 py-2 rounded-lg border text-[11px] text-violet-300 bg-violet-500/10 border-violet-500/30">
                <Brain className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span><span className="font-bold">{rId}</span> · {def.description}</span>
                <span className="ml-auto font-bold flex-shrink-0">+{def.score}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* User profiles */}
      <div className="space-y-3">
        {profiles.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <Brain className="w-10 h-10 text-slate-700" />
            <p className="text-slate-500 text-sm">No employee sessions found to analyse yet</p>
          </div>
        )}

        {profiles.map(profile => {
          const isExpanded = expanded === profile.userId;
          const triggered  = profile.deviations.filter(d => d.triggeredRule);
          const hasAnomalies = profile.riskTier !== 'Normal';

          return (
            <div
              key={profile.userId}
              className={cn(
                'bg-[#0d1f35] border rounded-xl overflow-hidden transition-all',
                profile.riskTier === 'Severe'    ? 'border-rose-500/40 ring-1 ring-rose-500/10'    :
                profile.riskTier === 'Anomalous' ? 'border-orange-500/30'                           :
                profile.riskTier === 'Watch'     ? 'border-amber-500/20'                            :
                'border-slate-700/30'
              )}
            >
              {/* Summary row */}
              <button
                className="w-full text-left px-4 py-4 flex items-center gap-3 hover:bg-slate-700/10 transition-colors"
                onClick={() => {
                  setExpanded(isExpanded ? null : profile.userId);
                  if (!isExpanded) loadSnapshots(profile.userId);
                }}
              >
                {/* Avatar */}
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm',
                  profile.riskTier === 'Severe'    ? 'bg-rose-500/20 text-rose-200'    :
                  profile.riskTier === 'Anomalous' ? 'bg-orange-500/15 text-orange-200' :
                  profile.riskTier === 'Watch'     ? 'bg-amber-500/15 text-amber-200'  :
                  'bg-slate-700/40 text-slate-300'
                )}>
                  <User className="w-5 h-5" />
                </div>

                {/* User info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white">{profile.userName}</span>
                    <span className="text-[10px] font-mono text-slate-500">{profile.userId}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="text-xs text-slate-400">{profile.role}</span>
                    <span className="text-[10px] text-slate-600">·</span>
                    <span className="text-xs text-slate-500">{profile.sessionCount} session{profile.sessionCount !== 1 ? 's' : ''} analysed</span>
                    <span className="text-[10px] text-slate-600">·</span>
                    <span className="text-xs text-slate-500">{profile.baseline.sampleCount} baseline samples</span>
                  </div>
                </div>

                {/* Anomaly bars — compact dimension preview */}
                <div className="hidden lg:flex items-center gap-1 flex-shrink-0">
                  {profile.deviations.map(d => (
                    <div key={d.dimension} title={`${d.label}: Z=${d.zScore.toFixed(1)}`}
                      className="w-2 rounded-full transition-all"
                      style={{
                        height: `${Math.max(8, Math.min(32, d.zScore * 8))}px`,
                        background: zColor(d.zScore),
                        opacity: d.zScore > 0.3 ? 1 : 0.3,
                      }}
                    />
                  ))}
                </div>

                {/* Score + tier badge */}
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <span className={cn(
                    'text-xs font-bold px-2 py-0.5 rounded-full border',
                    TIER_STYLE[profile.riskTier]
                  )}>
                    {profile.riskTier}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-16 h-1.5 bg-slate-700/40 rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all", TIER_BAR[profile.riskTier])}
                        style={{ width: `${Math.min(100, profile.overallAnomalyScore)}%` }} />
                    </div>
                    <span className={cn(
                      "text-[11px] font-bold",
                      profile.riskTier === 'Severe'    ? 'text-rose-300'    :
                      profile.riskTier === 'Anomalous' ? 'text-orange-300'  :
                      profile.riskTier === 'Watch'     ? 'text-amber-300'   : 'text-slate-400'
                    )}>{profile.overallAnomalyScore}</span>
                  </div>
                </div>

                {/* Triggered rules */}
                {triggered.length > 0 && (
                  <div className="hidden sm:flex flex-wrap gap-1 flex-shrink-0 max-w-[120px]">
                    {triggered.map(d => (
                      <span key={d.triggeredRule} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
                        {d.triggeredRule}
                      </span>
                    ))}
                  </div>
                )}

                {isExpanded
                  ? <ChevronUp className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  : <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />
                }
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t border-slate-700/30 bg-[#060e1a]/40 p-4 space-y-5">

                  {/* Deviation grid */}
                  <div>
                    <p className="text-xs font-semibold text-slate-300 mb-3 uppercase tracking-wider flex items-center gap-2">
                      <Activity className="w-3.5 h-3.5 text-violet-400" />
                      Deviation Analysis (Current Session vs Baseline)
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {profile.deviations.map(d => {
                        const LevelIcon = LEVEL_ICON[d.level];
                        return (
                          <div key={d.dimension}
                            className={cn(
                              'rounded-xl border p-3.5 space-y-2',
                              LEVEL_STYLE[d.level]
                            )}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <LevelIcon className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="text-xs font-semibold">{d.label}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {d.triggeredRule && (
                                  <span className="text-[10px] font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30 px-1.5 py-0.5 rounded">
                                    {d.triggeredRule}
                                  </span>
                                )}
                                <span className="text-[11px] font-bold">
                                  Z={d.zScore.toFixed(1)}
                                </span>
                              </div>
                            </div>

                            {/* Z-score gauge */}
                            <div className="space-y-1">
                              <div className="w-full h-1.5 bg-black/20 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${Math.min(100, (d.zScore / 5) * 100)}%`,
                                    background: zColor(d.zScore),
                                  }}
                                />
                              </div>
                              <div className="flex justify-between text-[10px] opacity-60">
                                <span>σ=0</span>
                                <span className="text-amber-300">σ=2 watch</span>
                                <span className="text-rose-300">σ=3.5 severe</span>
                              </div>
                            </div>

                            {/* Values */}
                            <div className="grid grid-cols-3 gap-1 text-[10px]">
                              <div className="bg-black/20 rounded p-1.5 text-center">
                                <p className="opacity-60 mb-0.5">Current</p>
                                <p className="font-bold">
                                  {typeof d.currentValue === 'number' ? d.currentValue.toFixed(d.currentValue % 1 === 0 ? 0 : 1) : d.currentValue}
                                </p>
                              </div>
                              <div className="bg-black/20 rounded p-1.5 text-center">
                                <p className="opacity-60 mb-0.5">Baseline μ</p>
                                <p className="font-bold">{d.baselineMean.toFixed(1)}</p>
                              </div>
                              <div className="bg-black/20 rounded p-1.5 text-center">
                                <p className="opacity-60 mb-0.5">Baseline σ</p>
                                <p className="font-bold">{d.baselineStd.toFixed(1)}</p>
                              </div>
                            </div>

                            <p className="text-[10px] opacity-80">{d.explanation}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Radar chart + baseline stats side-by-side */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Radar */}
                    <div className="bg-[#0d1f35] border border-slate-700/30 rounded-xl p-4">
                      <p className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-2">
                        <BarChart2 className="w-3.5 h-3.5 text-violet-400" />
                        Anomaly Radar
                      </p>
                      <ResponsiveContainer width="100%" height={200}>
                        <RadarChart data={radarData(profile)} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                          <PolarGrid stroke="#334155" strokeOpacity={0.5} />
                          <PolarAngleAxis dataKey="dimension" tick={{ fill: '#94a3b8', fontSize: 9 }} />
                          <Radar name="Z-Score" dataKey="zScore" stroke="#a78bfa" fill="#7c3aed" fillOpacity={0.3} strokeWidth={2} />
                          <Radar name="Threshold" dataKey="threshold" stroke="#f59e0b" fill="none" strokeWidth={1} strokeDasharray="4 2" />
                        </RadarChart>
                      </ResponsiveContainer>
                      <p className="text-[10px] text-slate-500 text-center mt-1">
                        <span className="text-violet-400">Purple = Current</span> · <span className="text-amber-400">Dashed = Alert threshold (σ=2.0)</span>
                      </p>
                    </div>

                    {/* Baseline stats */}
                    <div className="bg-[#0d1f35] border border-slate-700/30 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                        <Database className="w-3.5 h-3.5 text-sky-400" />
                        Baseline Parameters
                      </p>
                      <div className="space-y-2">
                        {[
                          { label: 'Typical login hour', value: `${profile.baseline.loginHourMean.toFixed(0)}:00 ± ${profile.baseline.loginHourStd.toFixed(1)}h` },
                          { label: 'Customers/session',  value: `${profile.baseline.customersPerSessionMean.toFixed(1)} ± ${profile.baseline.customersPerSessionStd.toFixed(1)}` },
                          { label: 'Transactions/session', value: `${profile.baseline.txnPerSessionMean.toFixed(1)} ± ${profile.baseline.txnPerSessionStd.toFixed(1)}` },
                          { label: 'Reports/session',    value: `${profile.baseline.reportsPerSessionMean.toFixed(1)} ± ${profile.baseline.reportsPerSessionStd.toFixed(1)}` },
                          { label: 'Contact mods/session', value: `${profile.baseline.contactModsPerSessionMean.toFixed(1)} ± ${profile.baseline.contactModsPerSessionStd.toFixed(1)}` },
                          { label: 'Off-hours rate',     value: `${(profile.baseline.offHoursRate * 100).toFixed(0)}% of sessions` },
                          { label: 'Known IP rate',      value: `${(profile.baseline.knownIpRate * 100).toFixed(0)}% of sessions` },
                          { label: 'Bulk export (avg)',  value: `${profile.baseline.bulkDownloadMean.toFixed(0)} ± ${profile.baseline.bulkDownloadStd.toFixed(0)} records` },
                          { label: 'Baseline samples',   value: `${profile.baseline.sampleCount} sessions` },
                        ].map(f => (
                          <div key={f.label} className="flex justify-between text-[11px]">
                            <span className="text-slate-500">{f.label}</span>
                            <span className="text-slate-300 font-medium">{f.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Snapshot history chart */}
                  {(snapshots[profile.userId]?.length ?? 0) > 0 && (
                    <div className="bg-[#0d1f35] border border-slate-700/30 rounded-xl p-4">
                      <p className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-2">
                        <TrendingUp className="w-3.5 h-3.5 text-sky-400" />
                        Anomaly Score History
                      </p>
                      <ResponsiveContainer width="100%" height={140}>
                        <LineChart data={lineData(profile.userId)} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="idx" tick={{ fill: '#475569', fontSize: 9 }} />
                          <YAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 9 }} />
                          <Tooltip
                            contentStyle={{ background: '#0d1f35', border: '1px solid #334155', borderRadius: 8 }}
                            labelStyle={{ color: '#94a3b8', fontSize: 11 }}
                            itemStyle={{ color: '#a78bfa', fontSize: 11 }}
                            formatter={(v: number) => [`${v}`, 'Anomaly Score']}
                          />
                          <ReferenceLine y={20} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.6} />
                          <ReferenceLine y={45} stroke="#f97316" strokeDasharray="3 3" strokeOpacity={0.6} />
                          <ReferenceLine y={70} stroke="#fb7185" strokeDasharray="3 3" strokeOpacity={0.6} />
                          <Line type="monotone" dataKey="score" stroke="#a78bfa" strokeWidth={2} dot={{ fill: '#7c3aed', r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                      <div className="flex gap-4 text-[10px] text-slate-500 mt-1">
                        <span><span className="text-amber-400">—</span> Watch (20)</span>
                        <span><span className="text-orange-400">—</span> Anomalous (45)</span>
                        <span><span className="text-rose-400">—</span> Severe (70)</span>
                      </div>
                    </div>
                  )}

                  {/* Recommendation */}
                  {hasAnomalies && (
                    <div className={cn(
                      'rounded-xl border p-4 flex items-start gap-3',
                      profile.riskTier === 'Severe'    ? 'bg-rose-500/10   border-rose-500/20'    :
                      profile.riskTier === 'Anomalous' ? 'bg-orange-500/10 border-orange-500/20' :
                      'bg-amber-500/10 border-amber-500/20'
                    )}>
                      <Shield className={cn('w-4 h-4 mt-0.5 flex-shrink-0',
                        profile.riskTier === 'Severe' ? 'text-rose-400' :
                        profile.riskTier === 'Anomalous' ? 'text-orange-400' : 'text-amber-400'
                      )} />
                      <div className="text-xs">
                        <p className={cn('font-semibold mb-1',
                          profile.riskTier === 'Severe' ? 'text-rose-300' :
                          profile.riskTier === 'Anomalous' ? 'text-orange-300' : 'text-amber-300'
                        )}>
                          {profile.riskTier === 'Severe'
                            ? 'Immediate Review Required'
                            : profile.riskTier === 'Anomalous'
                            ? 'Enhanced Monitoring Recommended'
                            : 'Continue Passive Monitoring'}
                        </p>
                        <p className="text-slate-400">
                          {profile.riskTier === 'Severe'
                            ? `${profile.userName}'s current session shows severe behavioral deviations across ${triggered.length} ML rule${triggered.length !== 1 ? 's' : ''}. Consider suspending session, notifying compliance, and reviewing activity log immediately.`
                            : profile.riskTier === 'Anomalous'
                            ? `${profile.userName} shows significant deviation from established behavioral baseline. Increase review frequency and cross-reference with recent activity logs.`
                            : `${profile.userName}'s behavior is slightly outside normal range. Continue monitoring for the next 3 sessions before escalating.`}
                        </p>
                        {triggered.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {triggered.map(d => (
                              <span key={d.triggeredRule}
                                className="text-[10px] font-semibold bg-violet-500/20 text-violet-200 border border-violet-500/30 px-1.5 py-0.5 rounded">
                                {d.triggeredRule}: {RULE_DEFINITIONS[d.triggeredRule!]?.description ?? ''}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {!hasAnomalies && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-3">
                      <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <p className="text-xs text-emerald-300">
                        <span className="font-semibold">{profile.userName}</span> is currently operating within all established behavioral baselines. No anomalies detected.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Technical note */}
      <div className="bg-[#0a1628] border border-slate-700/30 rounded-xl p-4">
        <p className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-2">
          <Brain className="w-3.5 h-3.5 text-violet-400" />
          ML Model Technical Details
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-[11px] text-slate-500">
          {[
            { icon: Activity, label: 'Algorithm', value: 'Welford online mean/variance accumulator with Z-score anomaly scoring' },
            { icon: TrendingUp, label: 'Feature Dimensions', value: '6 dimensions: login time, customer access, transactions, exports, contact mods, reports' },
            { icon: Clock, label: 'Baseline Minimum', value: '≥ 3 sessions required for baseline confidence; seeded defaults used otherwise' },
            { icon: Zap, label: 'Anomaly Thresholds', value: 'σ < 1.5 Normal · σ 1.5–2.0 Watch · σ 2.0–3.5 Anomaly · σ ≥ 3.5 Severe' },
            { icon: Database, label: 'Persistence', value: 'Baselines saved to behavior_baselines; anomaly timeline in behavior_snapshots' },
            { icon: Shield, label: 'Alert Integration', value: 'Triggered ML rules (R120–R125) feed directly into the existing fraud alert pipeline' },
          ].map(f => (
            <div key={f.label} className="flex items-start gap-2">
              <f.icon className="w-3 h-3 text-violet-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-slate-400 font-semibold">{f.label}</p>
                <p className="mt-0.5">{f.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
