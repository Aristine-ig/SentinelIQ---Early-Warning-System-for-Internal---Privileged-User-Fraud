import { useState, useMemo } from 'react';
import { Search, AlertTriangle, ShieldAlert, CheckCircle, Info, RefreshCw, TrendingUp, Users, XCircle } from 'lucide-react';
import { useApp } from '@/lib/store';
import { cn, formatCurrency, formatDateShort } from '@/lib/utils';
import { RULE_DEFINITIONS } from '@/constants';
import type { Customer } from '@/types';
import { toast } from 'sonner';

// ── Mule indicator rules ────────────────────────────────────────────────────
const MULE_RULES = ['R100', 'R101', 'R102', 'R103', 'R104', 'R105', 'R106', 'R107', 'R108', 'R109', 'R110'] as const;
type MuleRule = typeof MULE_RULES[number];

interface MuleSignal {
  ruleId: MuleRule;
  triggered: boolean;
  detail?: string;
}

interface MuleProfile {
  customer: Customer;
  score: number;
  signals: MuleSignal[];
  riskTier: 'Safe' | 'Watch' | 'Suspicious' | 'High Risk' | 'Confirmed Mule';
  flagged: boolean;
}

// ── Heuristic engine (client-side, uses customer data) ─────────────────────
function computeMuleProfile(customer: Customer, allCustomers: Customer[]): MuleProfile {
  const signals: MuleSignal[] = [];
  let score = 0;

  const now = new Date();
  const openedAt = new Date(customer.dateOpened);
  const lastTxnAt = new Date(customer.lastTransactionDate);
  const accountAgeDays = Math.floor((now.getTime() - openedAt.getTime()) / 86400000);
  const daysSinceLastTxn = Math.floor((now.getTime() - lastTxnAt.getTime()) / 86400000);

  // R100 — new account (<30 days) with high balance indicating large txn
  const isNew = accountAgeDays < 30;
  const highBalance = customer.balance > 100000;
  const r100 = isNew && highBalance;
  signals.push({
    ruleId: 'R100', triggered: r100,
    detail: r100 ? `Account only ${accountAgeDays}d old, balance ${formatCurrency(customer.balance)}` : undefined,
  });
  if (r100) score += RULE_DEFINITIONS.R100.score;

  // R101 — pass-through: was active recently but balance now near zero (credits drained)
  const r101 = daysSinceLastTxn <= 1 && customer.balance < 500 && !isNew;
  signals.push({
    ruleId: 'R101', triggered: r101,
    detail: r101 ? `Last txn ${daysSinceLastTxn}d ago, balance near zero (${formatCurrency(customer.balance)})` : undefined,
  });
  if (r101) score += RULE_DEFINITIONS.R101.score;

  // R102 — round-number structuring: balance is exact multiple of 10,000
  const r102 = customer.balance > 0 && customer.balance % 10000 === 0 && customer.balance >= 50000;
  signals.push({
    ruleId: 'R102', triggered: r102,
    detail: r102 ? `Balance is exact ₹${(customer.balance / 10000).toFixed(0)}×10,000 (structuring pattern)` : undefined,
  });
  if (r102) score += RULE_DEFINITIONS.R102.score;

  // R103 — duplicate identity: same mobile or email as another customer
  const duplicateMobile = allCustomers.filter(c => c.id !== customer.id && c.mobile === customer.mobile && customer.mobile !== '');
  const duplicateEmail  = allCustomers.filter(c => c.id !== customer.id && c.email  === customer.email  && customer.email  !== '');
  const r103 = duplicateMobile.length > 0 || duplicateEmail.length > 0;
  signals.push({
    ruleId: 'R103', triggered: r103,
    detail: r103
      ? `Mobile shared with ${duplicateMobile.length} account(s), email shared with ${duplicateEmail.length} account(s)`
      : undefined,
  });
  if (r103) score += RULE_DEFINITIONS.R103.score;

  // R104 — dormant-to-active: dormant account with high balance (reactivated mule)
  const r104 = customer.accountStatus === 'Dormant' && customer.balance > 500000;
  signals.push({
    ruleId: 'R104', triggered: r104,
    detail: r104 ? `Dormant account with large balance ${formatCurrency(customer.balance)}` : undefined,
  });
  if (r104) score += RULE_DEFINITIONS.R104.score;

  // R105 — no organic activity: inactive/dormant account, balance near zero, KYC not fresh
  const r105 = customer.accountStatus !== 'Active' && customer.balance < 1000 && customer.kycStatus !== 'Verified';
  signals.push({
    ruleId: 'R105', triggered: r105,
    detail: r105 ? `${customer.accountStatus} account, balance ${formatCurrency(customer.balance)}, KYC: ${customer.kycStatus}` : undefined,
  });
  if (r105) score += RULE_DEFINITIONS.R105.score;

  // R106 — beneficiaries added same day as opening (proxied by: account < 7d old and has any transactions)
  const r106 = accountAgeDays < 7 && daysSinceLastTxn < 7 && customer.accountType === 'Savings';
  signals.push({
    ruleId: 'R106', triggered: r106,
    detail: r106 ? `Account ${accountAgeDays}d old with transaction activity already` : undefined,
  });
  if (r106) score += RULE_DEFINITIONS.R106.score;

  // R107 — high velocity (proxied: last transaction very recent on a new account)
  const r107 = accountAgeDays < 60 && daysSinceLastTxn === 0;
  signals.push({
    ruleId: 'R107', triggered: r107,
    detail: r107 ? `Transaction activity today on ${accountAgeDays}d-old account` : undefined,
  });
  if (r107) score += RULE_DEFINITIONS.R107.score;

  // R108 — sub-threshold structuring: balance between ₹1.8L–₹1.99L
  const r108 = customer.balance >= 180000 && customer.balance < 200000;
  signals.push({
    ruleId: 'R108', triggered: r108,
    detail: r108 ? `Balance ${formatCurrency(customer.balance)} — just below ₹2L CTR threshold` : undefined,
  });
  if (r108) score += RULE_DEFINITIONS.R108.score;

  // R109 — KYC non-compliant with active transactions
  const r109 = customer.kycStatus !== 'Verified' && customer.accountStatus === 'Active' && customer.balance > 50000;
  signals.push({
    ruleId: 'R109', triggered: r109,
    detail: r109 ? `KYC ${customer.kycStatus}, balance ${formatCurrency(customer.balance)} — regulatory risk` : undefined,
  });
  if (r109) score += RULE_DEFINITIONS.R109.score;

  // R110 — consistent near-zero balance (balance < ₹100 on an active account older than 6 months)
  const r110 = customer.balance < 100 && accountAgeDays > 180 && customer.accountStatus === 'Active';
  signals.push({
    ruleId: 'R110', triggered: r110,
    detail: r110 ? `₹${customer.balance} balance on ${accountAgeDays}d-old active account — pure pass-through` : undefined,
  });
  if (r110) score += RULE_DEFINITIONS.R110.score;

  // Derive risk tier
  let riskTier: MuleProfile['riskTier'] = 'Safe';
  if (score >= 200) riskTier = 'Confirmed Mule';
  else if (score >= 130) riskTier = 'High Risk';
  else if (score >= 80) riskTier = 'Suspicious';
  else if (score >= 40) riskTier = 'Watch';

  return {
    customer,
    score,
    signals,
    riskTier,
    flagged: false,
  };
}

const TIER_STYLE: Record<MuleProfile['riskTier'], string> = {
  'Safe':           'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  'Watch':          'text-amber-300  bg-amber-500/10  border-amber-500/30',
  'Suspicious':     'text-orange-300 bg-orange-500/10 border-orange-500/30',
  'High Risk':      'text-red-300    bg-red-500/10    border-red-500/30',
  'Confirmed Mule': 'text-rose-200   bg-rose-500/20   border-rose-400/50',
};

const TIER_ORDER: MuleProfile['riskTier'][] = ['Confirmed Mule', 'High Risk', 'Suspicious', 'Watch', 'Safe'];

export default function MuleDetectionPanel() {
  const { state, logAction } = useApp();
  const { customers } = state;

  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<'All' | MuleProfile['riskTier']>('All');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [showSafeAccounts, setShowSafeAccounts] = useState(false);

  const profiles = useMemo(() => {
    return customers
      .map(c => computeMuleProfile(c, customers))
      .map(p => ({ ...p, flagged: flagged.has(p.customer.id) }))
      .sort((a, b) => b.score - a.score);
  }, [customers, flagged]);

  const filtered = useMemo(() => {
    return profiles.filter(p => {
      if (!showSafeAccounts && p.riskTier === 'Safe') return false;
      const searchOk = !search ||
        p.customer.fullName.toLowerCase().includes(search.toLowerCase()) ||
        p.customer.id.toLowerCase().includes(search.toLowerCase()) ||
        p.customer.accountNumber.includes(search);
      const tierOk = tierFilter === 'All' || p.riskTier === tierFilter;
      return searchOk && tierOk;
    });
  }, [profiles, search, tierFilter, showSafeAccounts]);

  // Stats
  const confirmedMule = profiles.filter(p => p.riskTier === 'Confirmed Mule').length;
  const highRisk      = profiles.filter(p => p.riskTier === 'High Risk').length;
  const suspicious    = profiles.filter(p => p.riskTier === 'Suspicious').length;
  const watchList     = profiles.filter(p => p.riskTier === 'Watch').length;

  const handleFlag = (profile: MuleProfile) => {
    setFlagged(prev => {
      const next = new Set(prev);
      if (next.has(profile.customer.id)) {
        next.delete(profile.customer.id);
        toast.success(`${profile.customer.fullName} removed from investigation list`);
      } else {
        next.add(profile.customer.id);
        logAction('VIEW_ACCOUNT', 'Customer Database', profile.customer.id, {
          action: 'flag_mule_investigation',
          riskTier: profile.riskTier,
          muleScore: profile.score,
        });
        toast.success(`${profile.customer.fullName} flagged for investigation (score: ${profile.score})`);
      }
      return next;
    });
  };

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-rose-400" />
          Mule &amp; Dummy Account Detection
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          AI-assisted heuristic scoring across {MULE_RULES.length} behavioural rules — updated on each analysis run
        </p>
      </div>

      {/* Info banner */}
      <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex items-start gap-3">
        <Info className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-rose-300/90">
          Mule accounts are used by fraudsters to receive and quickly move stolen funds. These accounts often show synthetic identities,
          rapid credit-withdrawal cycles, sub-threshold structuring, and duplicate contact details across multiple accounts.
          Scores above 130 should be investigated immediately.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Confirmed Mule', value: confirmedMule, style: 'text-rose-300 bg-rose-500/20 border-rose-400/30', icon: XCircle },
          { label: 'High Risk',      value: highRisk,      style: 'text-red-300   bg-red-500/15   border-red-400/30',  icon: AlertTriangle },
          { label: 'Suspicious',     value: suspicious,    style: 'text-orange-300 bg-orange-500/15 border-orange-400/30', icon: TrendingUp },
          { label: 'Watch List',     value: watchList,     style: 'text-amber-300 bg-amber-500/15 border-amber-400/30', icon: Users },
        ].map(card => (
          <div key={card.label} className={cn('border rounded-xl p-4', card.style)}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider opacity-70">{card.label}</span>
              <card.icon className="w-4 h-4 opacity-70" />
            </div>
            <p className="text-2xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search customer name, ID, account..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#0d1f35] border border-slate-700/40 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500/50"
          />
        </div>
        <div className="flex gap-1 bg-[#0d1f35] border border-slate-700/40 rounded-lg p-1 overflow-x-auto flex-nowrap">
          {(['All', ...TIER_ORDER] as const).map(tier => (
            <button
              key={tier}
              onClick={() => setTierFilter(tier)}
              className={cn(
                'px-2.5 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap flex-shrink-0',
                tierFilter === tier ? 'bg-rose-600/80 text-white' : 'text-slate-400 hover:text-white'
              )}
            >
              {tier}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowSafeAccounts(v => !v)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all',
            showSafeAccounts
              ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
              : 'text-slate-400 border-slate-700/40 bg-[#0d1f35] hover:text-white'
          )}
        >
          <CheckCircle className="w-3.5 h-3.5" />
          {showSafeAccounts ? 'Hiding Safe' : 'Show Safe'}
        </button>
      </div>

      {/* Account list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <ShieldAlert className="w-12 h-12 mb-3 opacity-20" />
          <p className="font-medium">No accounts match the current filters</p>
          <p className="text-sm mt-1">Try enabling "Show Safe" or clearing filters</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(profile => {
            const isExpanded = expanded === profile.customer.id;
            const triggeredSignals = profile.signals.filter(s => s.triggered);

            return (
              <div
                key={profile.customer.id}
                className={cn(
                  'bg-[#0d1f35] border rounded-xl overflow-hidden transition-all',
                  profile.riskTier === 'Confirmed Mule' ? 'border-rose-500/40 ring-1 ring-rose-500/20' :
                  profile.riskTier === 'High Risk'      ? 'border-red-500/30'  :
                  profile.riskTier === 'Suspicious'     ? 'border-orange-500/20' :
                  profile.riskTier === 'Watch'          ? 'border-amber-500/20'  :
                  'border-slate-700/30'
                )}
              >
                {/* Summary row */}
                <button
                  className="w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-slate-700/10 transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : profile.customer.id)}
                >
                  {/* Avatar */}
                  <div className={cn(
                    'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold',
                    profile.riskTier === 'Confirmed Mule' ? 'bg-rose-500/30 text-rose-200' :
                    profile.riskTier === 'High Risk'      ? 'bg-red-500/20   text-red-200'  :
                    profile.riskTier === 'Suspicious'     ? 'bg-orange-500/20 text-orange-200' :
                    profile.riskTier === 'Watch'          ? 'bg-amber-500/20 text-amber-200' :
                    'bg-slate-700/40 text-slate-300'
                  )}>
                    {profile.customer.fullName.charAt(0)}
                  </div>

                  {/* Name + ID */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white">{profile.customer.fullName}</span>
                      {profile.flagged && (
                        <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-1.5 py-0.5 rounded font-bold">
                          FLAGGED
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[10px] font-mono text-slate-500">{profile.customer.id}</span>
                      <span className="text-[10px] text-slate-500">·</span>
                      <span className="text-[10px] text-slate-400">{profile.customer.accountType}</span>
                      <span className="text-[10px] text-slate-500">·</span>
                      <span className="text-[10px] text-slate-400">{profile.customer.branch}</span>
                    </div>
                  </div>

                  {/* Triggered rule count */}
                  <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
                    {triggeredSignals.length > 0 && (
                      <span className="text-[10px] text-slate-400">
                        {triggeredSignals.length} rule{triggeredSignals.length !== 1 ? 's' : ''} triggered
                      </span>
                    )}
                  </div>

                  {/* Score */}
                  <div className="flex-shrink-0 text-right mr-2">
                    <p className={cn(
                      'text-base font-bold',
                      profile.riskTier === 'Confirmed Mule' ? 'text-rose-300' :
                      profile.riskTier === 'High Risk'      ? 'text-red-300'  :
                      profile.riskTier === 'Suspicious'     ? 'text-orange-300' :
                      profile.riskTier === 'Watch'          ? 'text-amber-300'  :
                      'text-slate-400'
                    )}>{profile.score}</p>
                    <p className="text-[10px] text-slate-500">/ {MULE_RULES.reduce((s, r) => s + RULE_DEFINITIONS[r].score, 0)}</p>
                  </div>

                  {/* Tier badge */}
                  <span className={cn(
                    'flex-shrink-0 text-[10px] font-bold px-2 py-1 rounded-full border whitespace-nowrap',
                    TIER_STYLE[profile.riskTier]
                  )}>
                    {profile.riskTier}
                  </span>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-slate-700/30 pt-4 space-y-4">
                    {/* Account context */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { label: 'Balance', value: formatCurrency(profile.customer.balance) },
                        { label: 'Account Status', value: profile.customer.accountStatus },
                        { label: 'KYC', value: profile.customer.kycStatus },
                        { label: 'Opened', value: formatDateShort(profile.customer.dateOpened) },
                      ].map(f => (
                        <div key={f.label} className="bg-[#060e1a] rounded-lg p-2.5 border border-slate-700/30">
                          <p className="text-[10px] text-slate-500 uppercase">{f.label}</p>
                          <p className="text-xs font-semibold text-white mt-0.5">{f.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Signals grid */}
                    <div>
                      <p className="text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                        Detection Signals
                      </p>
                      <div className="space-y-1.5">
                        {profile.signals.map(signal => (
                          <div
                            key={signal.ruleId}
                            className={cn(
                              'flex items-start gap-3 rounded-lg px-3 py-2.5 border',
                              signal.triggered
                                ? 'bg-rose-500/10 border-rose-500/20'
                                : 'bg-slate-800/30 border-slate-700/20'
                            )}
                          >
                            <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                              {signal.triggered
                                ? <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                                : <CheckCircle className="w-3.5 h-3.5 text-slate-600" />
                              }
                              <span className={cn(
                                'text-[10px] font-bold font-mono',
                                signal.triggered ? 'text-rose-400' : 'text-slate-600'
                              )}>
                                {signal.ruleId}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                'text-xs',
                                signal.triggered ? 'text-white font-medium' : 'text-slate-500'
                              )}>
                                {RULE_DEFINITIONS[signal.ruleId].description}
                              </p>
                              {signal.detail && (
                                <p className="text-[10px] text-rose-300/80 mt-0.5">{signal.detail}</p>
                              )}
                            </div>
                            {signal.triggered && (
                              <span className="flex-shrink-0 text-[10px] font-bold text-rose-400">
                                +{RULE_DEFINITIONS[signal.ruleId].score}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Score bar */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider">Mule Risk Score</span>
                        <span className={cn(
                          'text-xs font-bold',
                          profile.riskTier === 'Confirmed Mule' ? 'text-rose-300' :
                          profile.riskTier === 'High Risk'      ? 'text-red-300'  :
                          profile.riskTier === 'Suspicious'     ? 'text-orange-300' :
                          profile.riskTier === 'Watch'          ? 'text-amber-300'  :
                          'text-slate-400'
                        )}>
                          {profile.score} / {MULE_RULES.reduce((s, r) => s + RULE_DEFINITIONS[r].score, 0)}
                        </span>
                      </div>
                      <div className="w-full bg-slate-700/40 rounded-full h-2">
                        <div
                          className={cn(
                            'h-2 rounded-full transition-all duration-500',
                            profile.riskTier === 'Confirmed Mule' ? 'bg-rose-500' :
                            profile.riskTier === 'High Risk'      ? 'bg-red-500'  :
                            profile.riskTier === 'Suspicious'     ? 'bg-orange-500' :
                            profile.riskTier === 'Watch'          ? 'bg-amber-500'  :
                            'bg-emerald-500'
                          )}
                          style={{ width: `${Math.min(100, (profile.score / MULE_RULES.reduce((s, r) => s + RULE_DEFINITIONS[r].score, 0)) * 100)}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-500">
                        <span className="text-emerald-400">0 = Safe</span>
                        <span>·</span>
                        <span className="text-amber-400">40+ = Watch</span>
                        <span>·</span>
                        <span className="text-orange-400">80+ = Suspicious</span>
                        <span>·</span>
                        <span className="text-red-400">130+ = High Risk</span>
                        <span>·</span>
                        <span className="text-rose-300">200+ = Confirmed</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleFlag(profile)}
                        className={cn(
                          'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-all',
                          profile.flagged
                            ? 'bg-slate-700/40 text-slate-300 border-slate-600/40 hover:border-slate-500/60'
                            : 'bg-rose-600/20 text-rose-300 border-rose-500/30 hover:bg-rose-600/30'
                        )}
                      >
                        {profile.flagged
                          ? <><RefreshCw className="w-3.5 h-3.5" /> Remove Flag</>
                          : <><AlertTriangle className="w-3.5 h-3.5" /> Flag for Investigation</>
                        }
                      </button>
                      {profile.riskTier !== 'Safe' && (
                        <p className="text-[10px] text-slate-500">
                          {profile.riskTier === 'Confirmed Mule'
                            ? 'Recommend: Freeze account & escalate to fraud team'
                            : profile.riskTier === 'High Risk'
                            ? 'Recommend: Enhanced due diligence required'
                            : profile.riskTier === 'Suspicious'
                            ? 'Recommend: Request source of funds documentation'
                            : 'Recommend: Continue monitoring for 30 days'}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="bg-[#0d1f35] border border-slate-700/30 rounded-xl p-4">
        <p className="text-xs font-semibold text-slate-300 mb-3 uppercase tracking-wider">Detection Rules Reference</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {MULE_RULES.map(ruleId => (
            <div key={ruleId} className="flex items-start gap-2">
              <span className="text-[10px] font-bold font-mono text-rose-400 flex-shrink-0 mt-0.5">{ruleId}</span>
              <p className="text-[10px] text-slate-500 leading-relaxed">{RULE_DEFINITIONS[ruleId].description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
