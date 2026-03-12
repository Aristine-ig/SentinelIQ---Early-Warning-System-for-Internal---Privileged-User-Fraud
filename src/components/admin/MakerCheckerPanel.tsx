import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/lib/store';
import { formatCurrency, formatDateShort, cn } from '@/lib/utils';
import {
  ShieldAlert, RefreshCw, Users, AlertTriangle, CheckCircle,
  XCircle, Clock, Wifi, Fingerprint, Home, TrendingUp,
  MapPin, Repeat, Activity, Eye,
} from 'lucide-react';
import { RULE_DEFINITIONS, SEVERITY_COLORS } from '@/constants';
import { getSeverity } from '@/lib/utils';

interface MCTransaction {
  id: string;
  txId: string;
  makerId: string;
  makerName: string;
  makerIp: string;
  makerDevice: string;
  checkerId: string;
  checkerName: string;
  checkerIp: string;
  checkerDevice: string;
  amount: number;
  customerId: string | null;
  initiatedAt: string;
  approvedAt: string;
  status: 'approved' | 'rejected';
  collusionRules: string[];
  isOffPremisesMaker: boolean;
  isOffPremisesChecker: boolean;
}

interface PairStats {
  pairKey: string;
  makerName: string;
  checkerName: string;
  count: number;
  totalAmount: number;
  rejections: number;
  avgMinutes: number;
  collusionRuleSet: Set<string>;
  transactions: MCTransaction[];
}

const COLLUSION_RULES = ['R060','R062','R063','R090','R091','R092','R093','R094','R095','R096','R097'];

const RULE_ICONS: Record<string, React.ElementType> = {
  R060: Repeat,
  R062: Clock,
  R063: Wifi,
  R090: Fingerprint,
  R091: AlertTriangle,
  R092: Clock,
  R093: TrendingUp,
  R094: Home,
  R095: Eye,
  R096: MapPin,
  R097: MapPin,
};

const RULE_COLORS: Record<string, string> = {
  R060: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  R062: 'text-orange-300 bg-orange-500/10 border-orange-500/30',
  R063: 'text-red-300 bg-red-500/10 border-red-500/30',
  R090: 'text-rose-300 bg-rose-500/10 border-rose-500/30',
  R091: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  R092: 'text-orange-300 bg-orange-500/10 border-orange-500/30',
  R093: 'text-red-300 bg-red-500/10 border-red-500/30',
  R094: 'text-rose-300 bg-rose-500/20 border-rose-500/40',
  R095: 'text-purple-300 bg-purple-500/10 border-purple-500/30',
  R096: 'text-violet-300 bg-violet-500/10 border-violet-500/30',
  R097: 'text-red-300 bg-red-600/20 border-red-500/40',
};

function ruleScore(rules: string[]): number {
  return rules.reduce((sum, id) => sum + (RULE_DEFINITIONS[id]?.score ?? 0), 0);
}

export default function MakerCheckerPanel() {
  const { state, logAction } = useApp();
  const [transactions, setTransactions] = useState<MCTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPair, setSelectedPair] = useState<PairStats | null>(null);
  const [activeTab, setActiveTab] = useState<'pairs' | 'transactions' | 'approve'>('pairs');

  // For the approve-transaction workflow
  const [pendingTxs, setPendingTxs] = useState<{
    txId: string; makerName: string; makerIp: string; makerDevice: string;
    makerId: string; amount: number; beneficiary: string; customerId: string;
    initiatedAt: string; isOffPremises: boolean;
  }[]>([]);
  const [approveModal, setApproveModal] = useState<typeof pendingTxs[0] | null>(null);
  const [processing, setProcessing] = useState(false);

  const user = state.currentUser;

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('maker_checker_transactions')
      .select('*')
      .order('initiated_at', { ascending: false })
      .limit(300);

    if (data) {
      setTransactions(data.map((r: any) => ({
        id: r.id,
        txId: r.tx_id,
        makerId: r.maker_id,
        makerName: r.maker_name,
        makerIp: r.maker_ip,
        makerDevice: r.maker_device,
        checkerId: r.checker_id,
        checkerName: r.checker_name,
        checkerIp: r.checker_ip,
        checkerDevice: r.checker_device,
        amount: r.amount,
        customerId: r.customer_id,
        initiatedAt: r.initiated_at,
        approvedAt: r.approved_at,
        status: r.status,
        collusionRules: r.collusion_rules ?? [],
        isOffPremisesMaker: r.is_off_premises_maker ?? false,
        isOffPremisesChecker: r.is_off_premises_checker ?? false,
      })));
    }

    // Load pending maker-checker actions from current session
    const pending = (state.currentSession?.makerCheckerActions ?? [])
      .filter(a => a.status === 'pending' && a.makerId !== user?.id);
    setPendingTxs(pending.map(a => ({
      txId: a.txId,
      makerName: a.makerName,
      makerIp: a.makerIp,
      makerDevice: a.makerDevice,
      makerId: a.makerId,
      amount: a.amount,
      beneficiary: a.beneficiary,
      customerId: a.customerId,
      initiatedAt: a.initiatedAt,
      isOffPremises: a.isOffPremises ?? false,
    })));

    setLoading(false);
  }, [state.currentSession, user?.id]);

  useEffect(() => {
    loadTransactions();
    const sub = supabase
      .channel('mct-panel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maker_checker_transactions' }, loadTransactions)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [loadTransactions]);

  // ── Aggregate pair statistics ──────────────────────────────────────────────
  const pairMap = new Map<string, PairStats>();
  for (const tx of transactions) {
    if (!tx.checkerId) continue;
    const key = `${tx.makerId}::${tx.checkerId}`;
    if (!pairMap.has(key)) {
      pairMap.set(key, {
        pairKey: key,
        makerName: tx.makerName,
        checkerName: tx.checkerName,
        count: 0,
        totalAmount: 0,
        rejections: 0,
        avgMinutes: 0,
        collusionRuleSet: new Set(),
        transactions: [],
      });
    }
    const p = pairMap.get(key)!;
    p.count += 1;
    if (tx.status === 'approved') p.totalAmount += tx.amount;
    if (tx.status === 'rejected') p.rejections += 1;
    if (tx.approvedAt && tx.initiatedAt) {
      const mins = (new Date(tx.approvedAt).getTime() - new Date(tx.initiatedAt).getTime()) / 60000;
      p.avgMinutes = (p.avgMinutes * (p.count - 1) + mins) / p.count;
    }
    tx.collusionRules.forEach(r => p.collusionRuleSet.add(r));
    p.transactions.push(tx);
  }

  const pairs = Array.from(pairMap.values()).sort((a, b) => {
    const scoreA = ruleScore(Array.from(a.collusionRuleSet));
    const scoreB = ruleScore(Array.from(b.collusionRuleSet));
    return scoreB - scoreA;
  });

  const flaggedPairs = pairs.filter(p => p.collusionRuleSet.size > 0);
  const totalFlaggedAmount = flaggedPairs.reduce((s, p) => s + p.totalAmount, 0);

  // ── Approve/Reject handler ─────────────────────────────────────────────────
  const handleDecision = async (decision: 'approved' | 'rejected') => {
    if (!approveModal || !user) return;
    setProcessing(true);

    // Gather pair stats for collusion checks
    const pairKey = `${approveModal.makerId}::${user.id}`;
    const existingPair = pairMap.get(pairKey);
    const pairApprovalCount = existingPair?.count ?? 0;
    const pairTotalAmount = existingPair?.totalAmount ?? 0;
    const rejectionCount = existingPair?.rejections ?? 0;
    const checkerRejectionRate = pairApprovalCount > 0
      ? rejectionCount / pairApprovalCount
      : rejectionCount > 0 ? 0 : -1; // -1 means no history

    // Maker exclusivity: how many distinct checkers has this maker used?
    const makerTxs = transactions.filter(t => t.makerId === approveModal.makerId);
    const distinctCheckers = new Set(makerTxs.map(t => t.checkerId)).size;
    const makerExclusivity = distinctCheckers <= 1 && makerTxs.length >= 3 ? 1 : 0;

    // Simulate home address match (real impl would query DB)
    const homeAddressMatch = Math.random() < 0.05;
    const checkerIsOffPremises = Math.random() < 0.2;

    logAction(
      'APPROVE_TRANSACTION',
      user.systemAccess,
      approveModal.customerId,
      {
        txId: approveModal.txId,
        decision,
        makerId: approveModal.makerId,
        makerName: approveModal.makerName,
        makerIp: approveModal.makerIp,
        makerDevice: approveModal.makerDevice,
        checkerDevice: `DEV-${Date.now()}`,
        amount: approveModal.amount,
        initiatedAt: approveModal.initiatedAt,
        isOffPremises: approveModal.isOffPremises,
        checkerIsOffPremises,
        homeAddressMatch,
        pairApprovalCount,
        pairTotalAmount,
        checkerRejectionRate: checkerRejectionRate === -1 ? 0 : checkerRejectionRate,
        makerExclusivity,
      }
    );

    setApproveModal(null);
    setProcessing(false);
    setTimeout(loadTransactions, 1000);
  };

  const tabs = [
    { id: 'pairs', label: 'Pair Intelligence', count: pairs.length },
    { id: 'transactions', label: 'Transaction Log', count: transactions.length },
    { id: 'approve', label: 'Pending Approval', count: pendingTxs.length },
  ] as const;

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-400" />
            Maker-Checker Collusion Detection
            {flaggedPairs.length > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                {flaggedPairs.length} flagged
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Real-time monitoring of transaction pair patterns for insider collusion</p>
        </div>
        <button onClick={loadTransactions} className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </button>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Unique Pairs', value: pairs.length, icon: Users, color: 'text-sky-400' },
          { label: 'Flagged Pairs', value: flaggedPairs.length, icon: AlertTriangle, color: 'text-red-400' },
          { label: 'Flagged Volume', value: formatCurrency(totalFlaggedAmount), icon: TrendingUp, color: 'text-rose-400' },
          { label: 'Total Transactions', value: transactions.length, icon: Activity, color: 'text-violet-400' },
        ].map(m => (
          <div key={m.label} className="bg-[#0d1f35] border border-slate-700/30 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <m.icon className={cn("w-3.5 h-3.5", m.color)} />
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">{m.label}</p>
            </div>
            <p className={cn("text-lg font-bold", m.color)}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Detection rules legend */}
      <div className="bg-[#0a1628] border border-slate-700/30 rounded-xl p-4">
        <p className="text-xs font-semibold text-slate-300 mb-3 uppercase tracking-wider">Active Detection Rules</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {COLLUSION_RULES.map(rId => {
            const def = RULE_DEFINITIONS[rId];
            if (!def) return null;
            const Icon = RULE_ICONS[rId] || AlertTriangle;
            return (
              <div key={rId} className={cn("flex items-start gap-2 px-2.5 py-2 rounded-lg border text-[11px]", RULE_COLORS[rId] || 'text-slate-300 bg-slate-700/20 border-slate-600/30')}>
                <Icon className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span><span className="font-bold">{rId}</span> · {def.description}</span>
                <span className="ml-auto font-bold flex-shrink-0">+{def.score}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700/30 pb-0">
        {tabs.map(t => (
          <button key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "px-4 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all flex items-center gap-2",
              activeTab === t.id
                ? 'text-red-300 border-red-400'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            )}>
            {t.label}
            {t.count > 0 && (
              <span className={cn("px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                t.id === 'approve' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-700/60 text-slate-400'
              )}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── Pair Intelligence ──────────────────────────────────────────────── */}
          {activeTab === 'pairs' && (
            <div className="space-y-3">
              {pairs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3">
                  <Users className="w-8 h-8 text-slate-600" />
                  <p className="text-sm text-slate-500">No maker-checker pairs recorded yet</p>
                </div>
              ) : pairs.map(pair => {
                const rules = Array.from(pair.collusionRuleSet);
                const score = Math.min(100, ruleScore(rules));
                const severity = score > 0 ? getSeverity(score) : 'Low';
                const rejRate = pair.count > 0 ? Math.round((pair.rejections / pair.count) * 100) : 100;
                const isFlagged = rules.length > 0;

                return (
                  <div key={pair.pairKey}
                    className={cn(
                      "bg-[#0d1f35] border rounded-xl overflow-hidden transition-all cursor-pointer",
                      isFlagged ? "border-red-500/40 ring-1 ring-red-500/10" : "border-slate-700/30 hover:border-slate-600/40"
                    )}
                    onClick={() => setSelectedPair(selectedPair?.pairKey === pair.pairKey ? null : pair)}>

                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
                            isFlagged ? "bg-red-500/15" : "bg-slate-700/30"
                          )}>
                            <Users className={cn("w-4 h-4", isFlagged ? "text-red-400" : "text-slate-400")} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {pair.makerName} <span className="text-slate-500 text-xs">→</span> {pair.checkerName}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {pair.count} transactions · {formatCurrency(pair.totalAmount)} approved · Avg {Math.round(pair.avgMinutes)}m review
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          {isFlagged ? (
                            <>
                              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", SEVERITY_COLORS[severity])}>
                                {severity} · {score} pts
                              </span>
                              <span className="text-[10px] text-red-400 font-semibold">{rules.length} rule{rules.length !== 1 ? 's' : ''} triggered</span>
                            </>
                          ) : (
                            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-semibold">Clean</span>
                          )}
                        </div>
                      </div>

                      {/* Mini metrics */}
                      <div className="mt-3 flex gap-4 flex-wrap">
                        <div className="flex items-center gap-1.5 text-xs">
                          <div className={cn("w-2 h-2 rounded-full", rejRate === 0 ? "bg-red-400" : rejRate < 20 ? "bg-amber-400" : "bg-emerald-400")} />
                          <span className="text-slate-400">Rejection rate:</span>
                          <span className={cn("font-semibold", rejRate === 0 ? "text-red-400" : "text-slate-300")}>{rejRate}%</span>
                        </div>
                        {pair.avgMinutes < 2 && (
                          <div className="flex items-center gap-1 text-xs text-orange-300">
                            <Clock className="w-3 h-3" /> &lt;2min avg
                          </div>
                        )}
                        {pair.totalAmount > 5000000 && (
                          <div className="flex items-center gap-1 text-xs text-red-300">
                            <TrendingUp className="w-3 h-3" /> &gt;₹50L joint
                          </div>
                        )}
                      </div>

                      {/* Rule badges */}
                      {rules.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap mt-3">
                          {rules.map(rId => {
                            const Icon = RULE_ICONS[rId] || AlertTriangle;
                            return (
                              <span key={rId} className={cn("flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold", RULE_COLORS[rId])}>
                                <Icon className="w-2.5 h-2.5" />{rId}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Expanded detail */}
                    {selectedPair?.pairKey === pair.pairKey && (
                      <div className="border-t border-slate-700/30 bg-[#060e1a]/50 p-4 space-y-3">
                        <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Recent Transactions</p>
                        <div className="space-y-2">
                          {pair.transactions.slice(0, 8).map(tx => (
                            <div key={tx.id} className="flex items-center justify-between text-xs bg-[#0d1f35] border border-slate-700/20 rounded-lg px-3 py-2">
                              <div className="flex items-center gap-2">
                                {tx.status === 'approved'
                                  ? <CheckCircle className="w-3 h-3 text-emerald-400" />
                                  : <XCircle className="w-3 h-3 text-red-400" />}
                                <span className="text-slate-300 font-medium">{formatCurrency(tx.amount)}</span>
                                <span className="text-slate-500">{formatDateShort(tx.initiatedAt)}</span>
                              </div>
                              <div className="flex gap-1">
                                {tx.collusionRules.map(r => (
                                  <span key={r} className={cn("px-1.5 py-0.5 rounded border text-[9px] font-bold", RULE_COLORS[r])}>{r}</span>
                                ))}
                                {tx.isOffPremisesMaker && <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[9px]">OFF-SITE Maker</span>}
                                {tx.isOffPremisesChecker && <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[9px]">OFF-SITE Checker</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Transaction Log ────────────────────────────────────────────────── */}
          {activeTab === 'transactions' && (
            <div className="space-y-2">
              {transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3">
                  <Activity className="w-8 h-8 text-slate-600" />
                  <p className="text-sm text-slate-500">No transactions logged yet</p>
                </div>
              ) : transactions.slice(0, 50).map(tx => (
                <div key={tx.id}
                  className={cn(
                    "bg-[#0d1f35] border rounded-xl p-3.5 flex items-start justify-between gap-3",
                    tx.collusionRules.length > 0 ? "border-red-500/30" : "border-slate-700/30"
                  )}>
                  <div className="flex items-start gap-3">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5",
                      tx.status === 'approved' ? 'bg-emerald-500/10' : 'bg-red-500/10'
                    )}>
                      {tx.status === 'approved'
                        ? <CheckCircle className="w-4 h-4 text-emerald-400" />
                        : <XCircle className="w-4 h-4 text-red-400" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{formatCurrency(tx.amount)}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        <span className="text-sky-400">{tx.makerName}</span> → <span className="text-violet-400">{tx.checkerName}</span>
                      </p>
                      <div className="flex gap-1.5 flex-wrap mt-1.5">
                        {tx.collusionRules.map(r => (
                          <span key={r} className={cn("px-1.5 py-0.5 rounded border text-[9px] font-bold", RULE_COLORS[r])}>{r}</span>
                        ))}
                        {tx.makerIp === tx.checkerIp && <span className="text-[9px] bg-red-500/10 border border-red-500/20 text-red-300 px-1.5 py-0.5 rounded">Same IP</span>}
                        {tx.makerDevice === tx.checkerDevice && <span className="text-[9px] bg-rose-500/10 border border-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded">Same Device</span>}
                        {tx.isOffPremisesMaker && <span className="text-[9px] bg-amber-500/10 border border-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">Maker Off-Premises</span>}
                        {tx.isOffPremisesChecker && <span className="text-[9px] bg-amber-500/10 border border-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">Checker Off-Premises</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] text-slate-500">{formatDateShort(tx.initiatedAt)}</p>
                    {tx.approvedAt && (
                      <p className="text-[10px] text-slate-600 mt-0.5">
                        {Math.round((new Date(tx.approvedAt).getTime() - new Date(tx.initiatedAt).getTime()) / 60000)}m review
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Pending Approval Queue ─────────────────────────────────────────── */}
          {activeTab === 'approve' && (
            <div className="space-y-3">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-300">
                  <span className="font-semibold">Checker role.</span> Transactions initiated by other staff
                  are listed below for your review. All approvals are monitored for collusion signals in real time.
                </p>
              </div>

              {pendingTxs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3">
                  <CheckCircle className="w-8 h-8 text-slate-600" />
                  <p className="text-sm text-slate-500">No pending transactions to approve</p>
                  <p className="text-xs text-slate-600">Transactions initiated by Makers will appear here</p>
                </div>
              ) : pendingTxs.map(tx => (
                <div key={tx.txId} className="bg-[#0d1f35] border border-amber-500/20 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-white">{formatCurrency(tx.amount)}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Maker: <span className="text-sky-400 font-medium">{tx.makerName}</span></p>
                      <p className="text-xs text-slate-400">Beneficiary: {tx.beneficiary}</p>
                      <p className="text-xs text-slate-500 mt-1">Initiated: {formatDateShort(tx.initiatedAt)}</p>
                      {tx.isOffPremises && (
                        <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5">
                          <MapPin className="w-2.5 h-2.5" /> Maker initiated off-premises
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => setApproveModal(tx)}
                        className="px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 rounded-lg text-xs font-semibold transition-all flex items-center gap-2">
                        <CheckCircle className="w-3.5 h-3.5" /> Review
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Approve Modal ───────────────────────────────────────────────────── */}
      {approveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setApproveModal(null)} />
          <div className="relative bg-[#0a1628] border border-slate-700/50 rounded-xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-bold text-white">Review Transaction</h3>
            </div>

            <div className="bg-[#0d1f35] border border-slate-700/30 rounded-xl p-4 space-y-2 mb-4">
              {[
                { label: 'Amount', value: formatCurrency(approveModal.amount), bold: true },
                { label: 'Maker', value: approveModal.makerName },
                { label: 'Maker IP', value: approveModal.makerIp },
                { label: 'Beneficiary', value: approveModal.beneficiary },
                { label: 'Initiated', value: formatDateShort(approveModal.initiatedAt) },
              ].map(f => (
                <div key={f.label} className="flex justify-between text-xs">
                  <span className="text-slate-400">{f.label}</span>
                  <span className={cn("font-medium", f.bold ? "text-white font-bold" : "text-slate-300")}>{f.value}</span>
                </div>
              ))}
              {approveModal.makerIp === state.currentSession?.ip && (
                <div className="mt-2 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                  <p className="text-[11px] text-red-300 font-semibold">R063: Your IP matches the Maker's IP — approving will trigger a collusion alert.</p>
                </div>
              )}
              {approveModal.isOffPremises && (
                <div className="mt-2 flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
                  <MapPin className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  <p className="text-[11px] text-amber-300">Maker initiated this transaction from outside bank premises.</p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setApproveModal(null)} className="flex-1 py-2.5 text-sm text-slate-300 bg-slate-700/40 hover:bg-slate-700/60 rounded-lg font-medium">Cancel</button>
              <button onClick={() => handleDecision('rejected')} disabled={processing}
                className="flex-1 py-2.5 text-sm text-white bg-red-600/70 hover:bg-red-600 rounded-lg font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                <XCircle className="w-3.5 h-3.5" /> Reject
              </button>
              <button onClick={() => handleDecision('approved')} disabled={processing}
                className="flex-1 py-2.5 text-sm text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {processing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
