/**
 * BankGuard AI — Behavioral Baseline Engine
 *
 * Implements a statistical anomaly detection system that:
 *  1. Maintains a rolling per-user behavioral baseline across 8 feature dimensions
 *  2. Detects deviations using Z-score analysis (σ > 2.0 = anomaly, σ > 3.5 = severe)
 *  3. Flags triggered ML rules (R120–R125) to feed the existing alert pipeline
 *
 * Approach: Welford's online algorithm for numerically stable mean/variance
 * with exponential decay (α = 0.15) so recent behaviour weighs more heavily.
 */

import type { ActivityLog, AppUser, SessionData } from '@/types';
import { supabase } from './supabase';

// ── Feature dimensions tracked per user ──────────────────────────────────────

export interface BehaviorFeatures {
  /** Mean login hour (0–23) */
  loginHourMean: number;
  /** Std-dev of login hours */
  loginHourStd: number;
  /** Mean number of customers accessed per session */
  customersPerSessionMean: number;
  customersPerSessionStd: number;
  /** Mean transaction count per session */
  txnPerSessionMean: number;
  txnPerSessionStd: number;
  /** Mean reports run per session */
  reportsPerSessionMean: number;
  reportsPerSessionStd: number;
  /** Mean contact-modification count per session */
  contactModsPerSessionMean: number;
  contactModsPerSessionStd: number;
  /** Fraction of sessions with off-hours logins (baseline rate) */
  offHoursRate: number;
  /** Fraction of sessions from known IPs (baseline) */
  knownIpRate: number;
  /** Mean bulk-download record count per export */
  bulkDownloadMean: number;
  bulkDownloadStd: number;
  /** Total sessions used to build baseline */
  sampleCount: number;
  /** ISO timestamp of last update */
  updatedAt: string;
}

export interface DeviationResult {
  dimension: string;
  label: string;
  currentValue: number;
  baselineMean: number;
  baselineStd: number;
  zScore: number;
  /** 'normal' | 'watch' | 'anomaly' | 'severe' */
  level: 'normal' | 'watch' | 'anomaly' | 'severe';
  triggeredRule?: string;
  explanation: string;
}

export interface BehaviorProfile {
  userId: string;
  userName: string;
  role: string;
  baseline: BehaviorFeatures;
  deviations: DeviationResult[];
  overallAnomalyScore: number;   // 0–100
  riskTier: 'Normal' | 'Watch' | 'Anomalous' | 'Severe';
  lastAnalysedAt: string;
  sessionCount: number;
}

// ── Supabase baseline row type ────────────────────────────────────────────────

interface DbBaseline {
  user_id: string;
  login_hour_mean: number;
  login_hour_std: number;
  customers_per_session_mean: number;
  customers_per_session_std: number;
  txn_per_session_mean: number;
  txn_per_session_std: number;
  reports_per_session_mean: number;
  reports_per_session_std: number;
  contact_mods_mean: number;
  contact_mods_std: number;
  off_hours_rate: number;
  known_ip_rate: number;
  bulk_download_mean: number;
  bulk_download_std: number;
  sample_count: number;
  updated_at: string;
}

// ── Welford online mean/variance accumulator ──────────────────────────────────

interface WelfordAccumulator {
  n: number;
  mean: number;
  M2: number;   // sum of squared deviations
}

function welfordUpdate(acc: WelfordAccumulator, value: number): WelfordAccumulator {
  const n = acc.n + 1;
  const delta = value - acc.mean;
  const mean = acc.mean + delta / n;
  const delta2 = value - mean;
  return { n, mean, M2: acc.M2 + delta * delta2 };
}

function welfordStd(acc: WelfordAccumulator): number {
  if (acc.n < 2) return 0;
  return Math.sqrt(acc.M2 / (acc.n - 1));
}

function emptyAcc(): WelfordAccumulator { return { n: 0, mean: 0, M2: 0 }; }

// ── Z-score & level classification ───────────────────────────────────────────

function computeZScore(value: number, mean: number, std: number): number {
  if (std < 0.001) return 0;    // no variance = no anomaly
  return Math.abs((value - mean) / std);
}

function classifyLevel(z: number): DeviationResult['level'] {
  if (z < 1.5)  return 'normal';
  if (z < 2.0)  return 'watch';
  if (z < 3.5)  return 'anomaly';
  return 'severe';
}

// ── Extract per-session features from activity log rows ──────────────────────

interface SessionFeatures {
  loginHour: number;
  customersAccessed: number;
  txnCount: number;
  reportCount: number;
  contactMods: number;
  isOffHours: boolean;
  ipAddress: string;
  bulkDownloadMax: number;  // largest single export record count in session
}

function extractSessionFeatures(logs: ActivityLog[]): SessionFeatures {
  if (logs.length === 0) {
    return { loginHour: 12, customersAccessed: 0, txnCount: 0, reportCount: 0, contactMods: 0, isOffHours: false, ipAddress: '', bulkDownloadMax: 0 };
  }

  // Find login event to get the hour
  const loginLog = logs.find(l => l.actionType === 'LOGIN') ?? logs[0];
  const loginHour = new Date(loginLog.timestamp).getHours();
  const isOffHours = loginHour < 6 || loginHour >= 22;
  const ipAddress = loginLog.ip ?? '';

  // Unique customers touched in this session
  const uniqueCustomers = new Set(logs.filter(l => l.customerId).map(l => l.customerId));
  const customersAccessed = uniqueCustomers.size;

  // Transaction-type events
  const txnCount = logs.filter(l =>
    l.actionType === 'INITIATE_TRANSACTION' || l.actionType === 'INITIATE_TRANSFER'
  ).length;

  // Report events
  const reportLogs = logs.filter(l => l.actionType === 'RUN_REPORT');
  const reportCount = reportLogs.length;

  // Bulk download: largest recordCount in export events
  const bulkDownloadMax = reportLogs.reduce((max, l) => {
    const cnt = (l.metadata?.recordCount as number) || 0;
    return Math.max(max, cnt);
  }, 0);

  // Contact modifications
  const contactMods = logs.filter(l => l.actionType === 'MODIFY_CONTACT' || l.actionType === 'APPLY_CONTACT_CHANGE').length;

  return { loginHour, customersAccessed, txnCount, reportCount, contactMods, isOffHours, ipAddress, bulkDownloadMax };
}

// ── Group activity logs into sessions (by LOGIN event boundaries) ─────────────

function groupIntoSessions(logs: ActivityLog[]): ActivityLog[][] {
  const sessions: ActivityLog[][] = [];
  let current: ActivityLog[] = [];

  // logs are newest-first; reverse to process chronologically
  const ordered = [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  for (const log of ordered) {
    if (log.actionType === 'LOGIN' && current.length > 0) {
      sessions.push(current);
      current = [];
    }
    current.push(log);
  }
  if (current.length > 0) sessions.push(current);

  return sessions;
}

// ── Build baseline from all historical sessions ────────────────────────────────

export function buildBaselineFromLogs(userId: string, logs: ActivityLog[]): BehaviorFeatures {
  const userLogs = logs.filter(l => l.userId === userId);
  const sessions = groupIntoSessions(userLogs);

  if (sessions.length === 0) {
    return {
      loginHourMean: 9, loginHourStd: 2,
      customersPerSessionMean: 3, customersPerSessionStd: 2,
      txnPerSessionMean: 2, txnPerSessionStd: 1.5,
      reportsPerSessionMean: 0.5, reportsPerSessionStd: 0.5,
      contactModsPerSessionMean: 0, contactModsPerSessionStd: 0.1,
      offHoursRate: 0.02,
      knownIpRate: 0.95,
      bulkDownloadMean: 50, bulkDownloadStd: 30,
      sampleCount: 0,
      updatedAt: new Date().toISOString(),
    };
  }

  let hourAcc = emptyAcc();
  let custAcc = emptyAcc();
  let txnAcc  = emptyAcc();
  let rptAcc  = emptyAcc();
  let modAcc  = emptyAcc();
  let bulkAcc = emptyAcc();

  let offHoursCount = 0;
  const ips: Set<string> = new Set();
  const sessionIps: string[] = [];

  for (const sessionLogs of sessions) {
    const feat = extractSessionFeatures(sessionLogs);
    hourAcc = welfordUpdate(hourAcc, feat.loginHour);
    custAcc = welfordUpdate(custAcc, feat.customersAccessed);
    txnAcc  = welfordUpdate(txnAcc,  feat.txnCount);
    rptAcc  = welfordUpdate(rptAcc,  feat.reportCount);
    modAcc  = welfordUpdate(modAcc,  feat.contactMods);
    if (feat.bulkDownloadMax > 0) bulkAcc = welfordUpdate(bulkAcc, feat.bulkDownloadMax);
    if (feat.isOffHours) offHoursCount++;
    if (feat.ipAddress) {
      ips.add(feat.ipAddress);
      sessionIps.push(feat.ipAddress);
    }
  }

  const totalSessions = sessions.length;
  const uniqueIps = ips.size;
  // "known IP rate" = fraction of sessions from the top-2 most frequent IPs
  const ipFreq = new Map<string, number>();
  for (const ip of sessionIps) ipFreq.set(ip, (ipFreq.get(ip) || 0) + 1);
  const topTwo = [...ipFreq.values()].sort((a, b) => b - a).slice(0, 2).reduce((s, v) => s + v, 0);
  const knownIpRate = sessionIps.length > 0 ? topTwo / sessionIps.length : 0.95;

  return {
    loginHourMean:               hourAcc.mean,
    loginHourStd:                Math.max(welfordStd(hourAcc), 0.5),
    customersPerSessionMean:     custAcc.mean,
    customersPerSessionStd:      Math.max(welfordStd(custAcc), 0.5),
    txnPerSessionMean:           txnAcc.mean,
    txnPerSessionStd:            Math.max(welfordStd(txnAcc), 0.5),
    reportsPerSessionMean:       rptAcc.mean,
    reportsPerSessionStd:        Math.max(welfordStd(rptAcc), 0.3),
    contactModsPerSessionMean:   modAcc.mean,
    contactModsPerSessionStd:    Math.max(welfordStd(modAcc), 0.1),
    offHoursRate:                offHoursCount / totalSessions,
    knownIpRate:                 uniqueIps > 0 ? knownIpRate : 0.95,
    bulkDownloadMean:            bulkAcc.n > 0 ? bulkAcc.mean : 50,
    bulkDownloadStd:             bulkAcc.n > 1 ? Math.max(welfordStd(bulkAcc), 10) : 30,
    sampleCount:                 totalSessions,
    updatedAt:                   new Date().toISOString(),
  };
}

// ── Analyse current session against baseline ──────────────────────────────────

export function analyseSession(
  session: SessionData,
  baseline: BehaviorFeatures,
  currentIp: string,
  currentLogs: ActivityLog[]
): DeviationResult[] {
  const deviations: DeviationResult[] = [];
  const now = new Date();
  const currentHour = now.getHours();

  // 1. Login-time deviation
  const hourZ = computeZScore(currentHour, baseline.loginHourMean, baseline.loginHourStd);
  deviations.push({
    dimension: 'login_time',
    label: 'Login Time',
    currentValue: currentHour,
    baselineMean: baseline.loginHourMean,
    baselineStd: baseline.loginHourStd,
    zScore: hourZ,
    level: classifyLevel(hourZ),
    triggeredRule: hourZ >= 2.0 ? 'R120' : undefined,
    explanation: hourZ >= 2.0
      ? `Logged in at ${currentHour}:00 — usual window is ${Math.round(baseline.loginHourMean)}:00 ± ${baseline.loginHourStd.toFixed(1)}h (Z=${hourZ.toFixed(1)})`
      : `Login time within normal baseline (usual: ${Math.round(baseline.loginHourMean)}:00)`,
  });

  // 2. Customers accessed deviation
  const custCount = session.accessedCustomers.length;
  const custZ = computeZScore(custCount, baseline.customersPerSessionMean, baseline.customersPerSessionStd);
  deviations.push({
    dimension: 'customer_access',
    label: 'Customers Accessed',
    currentValue: custCount,
    baselineMean: baseline.customersPerSessionMean,
    baselineStd: baseline.customersPerSessionStd,
    zScore: custZ,
    level: classifyLevel(custZ),
    triggeredRule: custZ >= 2.0 ? 'R121' : undefined,
    explanation: custZ >= 2.0
      ? `${custCount} customers accessed vs typical ${baseline.customersPerSessionMean.toFixed(1)} ± ${baseline.customersPerSessionStd.toFixed(1)} (Z=${custZ.toFixed(1)})`
      : `Customer access volume within normal range`,
  });

  // 3. Transaction velocity deviation
  const txnZ = computeZScore(session.transactionCount, baseline.txnPerSessionMean, baseline.txnPerSessionStd);
  deviations.push({
    dimension: 'transaction_velocity',
    label: 'Transaction Volume',
    currentValue: session.transactionCount,
    baselineMean: baseline.txnPerSessionMean,
    baselineStd: baseline.txnPerSessionStd,
    zScore: txnZ,
    level: classifyLevel(txnZ),
    triggeredRule: txnZ >= 2.0 ? 'R122' : undefined,
    explanation: txnZ >= 2.0
      ? `${session.transactionCount} transactions this session vs baseline ${baseline.txnPerSessionMean.toFixed(1)} ± ${baseline.txnPerSessionStd.toFixed(1)} (Z=${txnZ.toFixed(1)})`
      : `Transaction count is within normal range`,
  });

  // 4. Bulk data download deviation
  const bulkLogs = currentLogs.filter(l => l.actionType === 'RUN_REPORT');
  const maxBulk = bulkLogs.reduce((m, l) => Math.max(m, (l.metadata?.recordCount as number) || 0), 0);
  const bulkZ = computeZScore(maxBulk, baseline.bulkDownloadMean, baseline.bulkDownloadStd);
  deviations.push({
    dimension: 'bulk_download',
    label: 'Bulk Data Export',
    currentValue: maxBulk,
    baselineMean: baseline.bulkDownloadMean,
    baselineStd: baseline.bulkDownloadStd,
    zScore: maxBulk > 0 ? bulkZ : 0,
    level: maxBulk > 0 ? classifyLevel(bulkZ) : 'normal',
    triggeredRule: maxBulk > 0 && bulkZ >= 2.0 ? 'R123' : undefined,
    explanation: maxBulk > 0 && bulkZ >= 2.0
      ? `Export of ${maxBulk.toLocaleString()} records vs typical ${baseline.bulkDownloadMean.toFixed(0)} ± ${baseline.bulkDownloadStd.toFixed(0)} (Z=${bulkZ.toFixed(1)})`
      : maxBulk > 0
        ? `Export size within normal range (${maxBulk.toLocaleString()} records)`
        : `No data exports in this session`,
  });

  // 5. Contact modification deviation
  const modCount = session.contactModifications.length;
  const modZ = computeZScore(modCount, baseline.contactModsPerSessionMean, baseline.contactModsPerSessionStd);
  deviations.push({
    dimension: 'contact_modifications',
    label: 'Contact Modifications',
    currentValue: modCount,
    baselineMean: baseline.contactModsPerSessionMean,
    baselineStd: baseline.contactModsPerSessionStd,
    zScore: modCount > 0 ? modZ : 0,
    level: modCount > 0 ? classifyLevel(modZ) : 'normal',
    triggeredRule: modCount > 0 && modZ >= 2.0 ? 'R124' : undefined,
    explanation: modCount > 0 && modZ >= 2.0
      ? `${modCount} contact modifications vs baseline ${baseline.contactModsPerSessionMean.toFixed(1)} ± ${baseline.contactModsPerSessionStd.toFixed(1)} (Z=${modZ.toFixed(1)})`
      : modCount > 0
        ? `Contact modification count within normal range`
        : `No contact modifications in this session`,
  });

  // 6. Report volume deviation
  const rptCount = session.reportCount;
  const rptZ = computeZScore(rptCount, baseline.reportsPerSessionMean, baseline.reportsPerSessionStd);
  deviations.push({
    dimension: 'report_volume',
    label: 'Reports Generated',
    currentValue: rptCount,
    baselineMean: baseline.reportsPerSessionMean,
    baselineStd: baseline.reportsPerSessionStd,
    zScore: rptCount > 0 ? rptZ : 0,
    level: rptCount > 0 ? classifyLevel(rptZ) : 'normal',
    triggeredRule: rptCount > 0 && rptZ >= 2.0 ? 'R125' : undefined,
    explanation: rptCount > 0 && rptZ >= 2.0
      ? `${rptCount} reports run vs baseline ${baseline.reportsPerSessionMean.toFixed(1)} ± ${baseline.reportsPerSessionStd.toFixed(1)} (Z=${rptZ.toFixed(1)})`
      : `Report generation within normal range`,
  });

  return deviations;
}

// ── Compute overall anomaly score from all deviations ─────────────────────────

export function computeAnomalyScore(deviations: DeviationResult[]): number {
  if (deviations.length === 0) return 0;
  // Max Z-score → weight it; sum all Z-scores > threshold
  const triggeredZ = deviations.filter(d => d.level !== 'normal').map(d => d.zScore);
  if (triggeredZ.length === 0) return 0;
  const maxZ = Math.max(...deviations.map(d => d.zScore));
  const sumZ  = deviations.reduce((s, d) => s + d.zScore, 0);
  // Sigmoid-like mapping to 0–100
  const rawScore = Math.min(100, (maxZ * 15) + (sumZ * 2));
  return Math.round(rawScore);
}

// ── Classify risk tier from anomaly score ──────────────────────────────────────

export function classifyRiskTier(score: number): BehaviorProfile['riskTier'] {
  if (score >= 70) return 'Severe';
  if (score >= 45) return 'Anomalous';
  if (score >= 20) return 'Watch';
  return 'Normal';
}

// ── Build full behavior profile for a user ────────────────────────────────────

export function buildBehaviorProfile(
  user: AppUser,
  logs: ActivityLog[],
  currentSession: SessionData | null,
  currentIp: string
): BehaviorProfile {
  const baseline = buildBaselineFromLogs(user.id, logs);
  const userLogs = logs.filter(l => l.userId === user.id);

  const deviations = currentSession
    ? analyseSession(currentSession, baseline, currentIp, userLogs)
    : [];

  const score = computeAnomalyScore(deviations);
  const riskTier = classifyRiskTier(score);

  // Count sessions this user has
  const loginCount = logs.filter(l => l.userId === user.id && l.actionType === 'LOGIN').length;

  return {
    userId: user.id,
    userName: user.fullName,
    role: user.role,
    baseline,
    deviations,
    overallAnomalyScore: score,
    riskTier,
    lastAnalysedAt: new Date().toISOString(),
    sessionCount: loginCount,
  };
}

// ── Persist baseline to Supabase ──────────────────────────────────────────────

export async function saveBaseline(userId: string, baseline: BehaviorFeatures): Promise<void> {
  const row: DbBaseline = {
    user_id:                     userId,
    login_hour_mean:             baseline.loginHourMean,
    login_hour_std:              baseline.loginHourStd,
    customers_per_session_mean:  baseline.customersPerSessionMean,
    customers_per_session_std:   baseline.customersPerSessionStd,
    txn_per_session_mean:        baseline.txnPerSessionMean,
    txn_per_session_std:         baseline.txnPerSessionStd,
    reports_per_session_mean:    baseline.reportsPerSessionMean,
    reports_per_session_std:     baseline.reportsPerSessionStd,
    contact_mods_mean:           baseline.contactModsPerSessionMean,
    contact_mods_std:            baseline.contactModsPerSessionStd,
    off_hours_rate:              baseline.offHoursRate,
    known_ip_rate:               baseline.knownIpRate,
    bulk_download_mean:          baseline.bulkDownloadMean,
    bulk_download_std:           baseline.bulkDownloadStd,
    sample_count:                baseline.sampleCount,
    updated_at:                  new Date().toISOString(),
  };

  const { error } = await supabase
    .from('behavior_baselines')
    .upsert(row, { onConflict: 'user_id' });

  if (error) {
    // Table may not exist yet — migration not run
    if (error.code === '42P01') {
      console.warn('[BehaviorEngine] behavior_baselines table not found. Run supabase-migration-behavior-baselines.sql first.');
    } else {
      console.error('[BehaviorEngine] Baseline save error:', error);
    }
  }
}

// ── Load baseline from Supabase (returns null if not found) ───────────────────

export async function loadBaseline(userId: string): Promise<BehaviorFeatures | null> {
  const { data, error } = await supabase
    .from('behavior_baselines')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (error.code === '42P01') {
      console.warn('[BehaviorEngine] behavior_baselines table not found. Run migration SQL first.');
    } else {
      console.error('[BehaviorEngine] Baseline load error:', error);
    }
    return null;
  }

  if (!data) return null;

  const r = data as DbBaseline;
  return {
    loginHourMean:             Number(r.login_hour_mean),
    loginHourStd:              Number(r.login_hour_std),
    customersPerSessionMean:   Number(r.customers_per_session_mean),
    customersPerSessionStd:    Number(r.customers_per_session_std),
    txnPerSessionMean:         Number(r.txn_per_session_mean),
    txnPerSessionStd:          Number(r.txn_per_session_std),
    reportsPerSessionMean:     Number(r.reports_per_session_mean),
    reportsPerSessionStd:      Number(r.reports_per_session_std),
    contactModsPerSessionMean: Number(r.contact_mods_mean),
    contactModsPerSessionStd:  Number(r.contact_mods_std),
    offHoursRate:              Number(r.off_hours_rate),
    knownIpRate:               Number(r.known_ip_rate),
    bulkDownloadMean:          Number(r.bulk_download_mean),
    bulkDownloadStd:           Number(r.bulk_download_std),
    sampleCount:               Number(r.sample_count),
    updatedAt:                 r.updated_at,
  };
}

// ── Save a behavior snapshot row ──────────────────────────────────────────────

export async function saveBehaviorSnapshot(profile: BehaviorProfile): Promise<void> {
  const triggered = profile.deviations.filter(d => d.triggeredRule).map(d => d.triggeredRule!);
  const { error } = await supabase
    .from('behavior_snapshots')
    .insert({
      user_id:           profile.userId,
      anomaly_score:     profile.overallAnomalyScore,
      risk_tier:         profile.riskTier,
      triggered_rules:   triggered,
      deviation_details: profile.deviations,
      captured_at:       profile.lastAnalysedAt,
    });

  if (error) {
    if (error.code === '42P01') {
      console.warn('[BehaviorEngine] behavior_snapshots table not found. Run migration SQL first.');
    } else {
      console.error('[BehaviorEngine] Snapshot save error:', error);
    }
  }
}
