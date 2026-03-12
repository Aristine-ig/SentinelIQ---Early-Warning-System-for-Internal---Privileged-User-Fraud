import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import type { AppUser, Customer, ActivityLog, Alert, SessionData, RiskHistory } from '@/types';
import type { ActionType } from '@/types';
import { ADMIN_USER, seedCustomers, seedUsers } from './dataSeeder';
import { generateLogId, simulateIP, isOffHours, isWeekend } from './utils';
import { evaluateRules, buildAlert } from './ruleEngine';
import { RULE_DEFINITIONS } from '@/constants';
import { supabase } from './supabase';
import type { DbAppUser, DbCustomer, DbActivityLog, DbAlert, DbSession } from './supabase';

// ─── Mappers: DB row → App type ───────────────────────────────────────────────

function mapUser(r: DbAppUser): AppUser {
  return {
    id: r.id,
    loginId: r.login_id,
    password: r.password,
    fullName: r.full_name,
    role: r.role as AppUser['role'],
    department: r.department,
    systemAccess: r.system_access as AppUser['systemAccess'],
    isAdmin: r.is_admin,
    status: r.status as AppUser['status'],
    createdAt: r.created_at,
  };
}

function mapCustomer(r: DbCustomer): Customer {
  return {
    id: r.id,
    fullName: r.full_name,
    aadhaar: r.aadhaar,
    pan: r.pan,
    accountNumber: r.account_number,
    accountType: r.account_type as Customer['accountType'],
    balance: r.balance,
    accountStatus: r.account_status as Customer['accountStatus'],
    lastTransactionDate: r.last_transaction_date,
    dateOpened: r.date_opened,
    mobile: r.mobile,
    email: r.email,
    branch: r.branch,
    kycStatus: r.kyc_status as Customer['kycStatus'],
    bankName: r.bank_name ?? 'SecureBank Ltd.',
    ifscCode: r.ifsc_code ?? 'SCBK0000001',
  };
}

function mapLog(r: DbActivityLog): ActivityLog {
  return {
    id: r.id,
    userId: r.user_id,
    userName: r.user_name,
    actionType: r.action_type as ActionType,
    system: r.system,
    customerId: r.customer_id ?? undefined,
    customerName: r.customer_name ?? undefined,
    timestamp: r.timestamp,
    ip: r.ip,
    metadata: r.metadata,
  };
}

function mapAlert(r: DbAlert): Alert {
  return {
    id: r.id,
    userId: r.user_id,
    userName: r.user_name,
    role: r.role,
    department: r.department,
    system: r.system,
    triggeredRules: r.triggered_rules,
    totalScore: r.total_score,
    severity: r.severity as Alert['severity'],
    scamType: r.scam_type as Alert['scamType'],
    confidence: r.confidence as Alert['confidence'],
    explanation: r.explanation,
    recommendedAction: r.recommended_action,
    timestamp: r.timestamp,
    status: r.status as Alert['status'],
  };
}

function mapSession(r: DbSession): SessionData {
  return {
    userId: r.user_id,
    ip: r.ip,
    loginTime: r.login_time,
    riskScore: r.risk_score,
    triggeredRuleIds: r.triggered_rule_ids,
    dormantAccountsAccessed: r.dormant_accounts_accessed,
    transactionCount: r.transaction_count,
    reportCount: r.report_count,
    accessedCustomers: r.accessed_customers,
    contactModifications: r.contact_modifications,
    otpTriggers: r.otp_triggers,
    transactions: r.transactions,
    isOffHours: r.is_off_hours,
    isWeekend: r.is_weekend,
    failedLoginAttempts: r.failed_login_attempts,
    loanForwardCount: r.loan_forward_count ?? 0,
    loanApprovalCount: r.loan_approval_count ?? 0,
    loanActions: r.loan_actions ?? [],
  };
}

// ─── Mappers: App type → DB row ───────────────────────────────────────────────

function userToDb(u: AppUser): DbAppUser {
  return {
    id: u.id,
    login_id: u.loginId,
    password: u.password,
    full_name: u.fullName,
    role: u.role,
    department: u.department,
    system_access: u.systemAccess,
    is_admin: u.isAdmin,
    status: u.status,
    created_at: u.createdAt,
  };
}

function customerToDb(c: Customer): DbCustomer {
  return {
    id: c.id,
    full_name: c.fullName,
    aadhaar: c.aadhaar,
    pan: c.pan,
    account_number: c.accountNumber,
    account_type: c.accountType,
    balance: c.balance,
    account_status: c.accountStatus,
    last_transaction_date: c.lastTransactionDate,
    date_opened: c.dateOpened,
    mobile: c.mobile,
    email: c.email,
    branch: c.branch,
    kyc_status: c.kycStatus,
    bank_name: c.bankName ?? 'SecureBank Ltd.',
    ifsc_code: c.ifscCode ?? 'SCBK0000001',
  };
}

function logToDb(l: ActivityLog): DbActivityLog {
  return {
    id: l.id,
    user_id: l.userId,
    user_name: l.userName,
    action_type: l.actionType,
    system: l.system,
    customer_id: l.customerId ?? null,
    customer_name: l.customerName ?? null,
    timestamp: l.timestamp,
    ip: l.ip,
    metadata: l.metadata,
  };
}

function alertToDb(a: Alert): DbAlert {
  return {
    id: a.id,
    user_id: a.userId,
    user_name: a.userName,
    role: a.role,
    department: a.department,
    system: a.system,
    triggered_rules: a.triggeredRules,
    total_score: a.totalScore,
    severity: a.severity,
    scam_type: a.scamType,
    confidence: a.confidence,
    explanation: a.explanation,
    recommended_action: a.recommendedAction,
    timestamp: a.timestamp,
    status: a.status,
  };
}

function sessionToDb(s: SessionData): DbSession {
  return {
    user_id: s.userId,
    ip: s.ip,
    login_time: s.loginTime,
    risk_score: s.riskScore,
    triggered_rule_ids: s.triggeredRuleIds,
    dormant_accounts_accessed: s.dormantAccountsAccessed,
    transaction_count: s.transactionCount,
    report_count: s.reportCount,
    accessed_customers: s.accessedCustomers,
    contact_modifications: s.contactModifications,
    otp_triggers: s.otpTriggers,
    transactions: s.transactions,
    is_off_hours: s.isOffHours,
    is_weekend: s.isWeekend,
    failed_login_attempts: s.failedLoginAttempts,
    loan_forward_count: s.loanForwardCount ?? 0,
    loan_approval_count: s.loanApprovalCount ?? 0,
    loan_actions: s.loanActions ?? [],
    updated_at: new Date().toISOString(),
  };
}

// ─── State ────────────────────────────────────────────────────────────────────

interface AppState {
  currentUser: AppUser | null;
  currentSession: SessionData | null;
  users: AppUser[];
  customers: Customer[];
  activityLogs: ActivityLog[];
  alerts: Alert[];
  riskHistory: RiskHistory[];
  sessions: Record<string, SessionData>;
  failedAttempts: Record<string, number>;
  loading: boolean;
}

type AppAction =
  | { type: 'SET_INITIAL_DATA'; users: AppUser[]; customers: Customer[]; logs: ActivityLog[]; alerts: Alert[]; sessions: Record<string, SessionData> }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'LOGIN'; user: AppUser; session: SessionData }
  | { type: 'LOGOUT' }
  | { type: 'ADD_LOG'; log: ActivityLog }
  | { type: 'ADD_ALERT'; alert: Alert }
  | { type: 'UPDATE_SESSION'; session: SessionData }
  | { type: 'ADD_USER'; user: AppUser }
  | { type: 'UPDATE_USER'; user: AppUser }
  | { type: 'UPDATE_CUSTOMER'; customer: Customer }
  | { type: 'UPDATE_ALERT'; alertId: string; changes: Partial<Alert> }
  | { type: 'ADD_RISK_HISTORY'; entry: RiskHistory }
  | { type: 'INCREMENT_FAILED'; loginId: string }
  | { type: 'RESET_FAILED'; loginId: string }
  | { type: 'REALTIME_ALERT'; alert: Alert }
  | { type: 'REALTIME_SESSION'; session: SessionData };

function createSession(user: AppUser, failedAttempts: number): SessionData {
  const now = new Date();
  return {
    userId: user.id,
    ip: simulateIP(),
    loginTime: now.toISOString(),
    riskScore: 0,
    triggeredRuleIds: [],
    dormantAccountsAccessed: [],
    transactionCount: 0,
    reportCount: 0,
    accessedCustomers: [],
    contactModifications: [],
    otpTriggers: [],
    transactions: [],
    isOffHours: isOffHours(now),
    isWeekend: isWeekend(now),
    failedLoginAttempts: failedAttempts,
    loanForwardCount: 0,
    loanApprovalCount: 0,
    loanActions: [],
  };
}

const initialState: AppState = {
  currentUser: null,
  currentSession: null,
  users: [],
  customers: [],
  activityLogs: [],
  alerts: [],
  riskHistory: [],
  sessions: {},
  failedAttempts: {},
  loading: true,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_INITIAL_DATA':
      return {
        ...state,
        users: action.users,
        customers: action.customers,
        activityLogs: action.logs,
        alerts: action.alerts,
        sessions: action.sessions,
        loading: false,
      };
    case 'SET_LOADING':
      return { ...state, loading: action.loading };
    case 'LOGIN':
      return {
        ...state,
        currentUser: action.user,
        currentSession: action.session,
        sessions: { ...state.sessions, [action.user.id]: action.session },
        failedAttempts: { ...state.failedAttempts, [action.user.loginId]: 0 },
      };
    case 'LOGOUT':
      return { ...state, currentUser: null, currentSession: null };
    case 'ADD_LOG':
      return { ...state, activityLogs: [action.log, ...state.activityLogs] };
    case 'ADD_ALERT':
    case 'REALTIME_ALERT': {
      const exists = state.alerts.some(a => a.id === action.alert.id);
      if (exists) return state;
      return { ...state, alerts: [action.alert, ...state.alerts] };
    }
    case 'UPDATE_SESSION':
    case 'REALTIME_SESSION': {
      const s = action.session;
      return {
        ...state,
        currentSession: state.currentUser?.id === s.userId ? s : state.currentSession,
        sessions: { ...state.sessions, [s.userId]: s },
      };
    }
    case 'ADD_USER':
      return { ...state, users: [...state.users, action.user] };
    case 'UPDATE_USER':
      return {
        ...state,
        users: state.users.map(u => u.id === action.user.id ? action.user : u),
        currentUser: state.currentUser?.id === action.user.id ? action.user : state.currentUser,
      };
    case 'UPDATE_CUSTOMER':
      return {
        ...state,
        customers: state.customers.map(c => c.id === action.customer.id ? action.customer : c),
      };
    case 'UPDATE_ALERT':
      return {
        ...state,
        alerts: state.alerts.map(a => a.id === action.alertId ? { ...a, ...action.changes } : a),
      };
    case 'ADD_RISK_HISTORY':
      return { ...state, riskHistory: [...state.riskHistory, action.entry] };
    case 'INCREMENT_FAILED':
      return {
        ...state,
        failedAttempts: { ...state.failedAttempts, [action.loginId]: (state.failedAttempts[action.loginId] || 0) + 1 },
      };
    case 'RESET_FAILED':
      return { ...state, failedAttempts: { ...state.failedAttempts, [action.loginId]: 0 } };
    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface AppContextType {
  state: AppState;
  login: (loginId: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  logAction: (
    actionType: ActionType,
    system: string,
    customerId?: string,
    metadata?: Record<string, unknown>,
    extraRules?: string[]
  ) => void;
  updateCustomer: (customer: Customer) => void;
  addUser: (user: AppUser) => void;
  updateUser: (user: AppUser) => void;
  updateAlert: (alertId: string, changes: Partial<Alert>) => void;
  getSessionForUser: (userId: string) => SessionData | null;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  // Use refs to always access latest state in callbacks
  const stateRef = useRef(state);
  stateRef.current = state;

  // ── Bootstrap: load or seed data ──────────────────────────────────────────
  useEffect(() => {
    async function bootstrap() {
      // Load users
      const { data: dbUsers } = await supabase.from('app_users').select('*');
      let users: AppUser[] = (dbUsers ?? []).map(mapUser);

      if (users.length === 0) {
        // Seed users
        const toSeed = [ADMIN_USER, ...seedUsers()];
        const { data: seeded } = await supabase
          .from('app_users')
          .upsert(toSeed.map(userToDb), { onConflict: 'id' })
          .select();
        users = (seeded ?? toSeed).map(mapUser);
      }

      // Load customers
      const { data: dbCustomers } = await supabase.from('customers').select('*');
      let customers: Customer[] = (dbCustomers ?? []).map(mapCustomer);

      if (customers.length === 0) {
        // Seed customers
        const toSeed = seedCustomers();
        const { data: seeded } = await supabase
          .from('customers')
          .upsert(toSeed.map(customerToDb), { onConflict: 'id' })
          .select();
        customers = (seeded ?? toSeed).map(mapCustomer);
      }

      // Load activity logs (latest 500)
      const { data: dbLogs } = await supabase
        .from('activity_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(500);
      const logs: ActivityLog[] = (dbLogs ?? []).map(mapLog);

      // Load alerts
      const { data: dbAlerts } = await supabase
        .from('alerts')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(200);
      const alerts: Alert[] = (dbAlerts ?? []).map(mapAlert);

      // Load active sessions
      const { data: dbSessions } = await supabase.from('sessions').select('*');
      const sessions: Record<string, SessionData> = {};
      for (const s of (dbSessions ?? [])) {
        sessions[s.user_id] = mapSession(s as DbSession);
      }

      dispatch({ type: 'SET_INITIAL_DATA', users, customers, logs, alerts, sessions });
    }

    bootstrap();
  }, []);

  // ── Real-time subscriptions ────────────────────────────────────────────────
  useEffect(() => {
    const alertSub = supabase
      .channel('realtime-alerts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alerts' },
        (payload) => {
          const alert = mapAlert(payload.new as DbAlert);
          dispatch({ type: 'REALTIME_ALERT', alert });
        }
      )
      .subscribe();

    const sessionSub = supabase
      .channel('realtime-sessions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sessions' },
        (payload) => {
          if (payload.new && Object.keys(payload.new).length > 0) {
            const session = mapSession(payload.new as DbSession);
            dispatch({ type: 'REALTIME_SESSION', session });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(alertSub);
      supabase.removeChannel(sessionSub);
    };
  }, []);

  // ── triggerRuleCheck ───────────────────────────────────────────────────────
  const triggerRuleCheck = useCallback(async (
    session: SessionData,
    customers: Customer[],
    user: AppUser,
    extraRules: string[] = []
  ) => {
    const newSession = { ...session };
    for (const ruleId of extraRules) {
      if (!newSession.triggeredRuleIds.includes(ruleId) && RULE_DEFINITIONS[ruleId]) {
        newSession.triggeredRuleIds = [...newSession.triggeredRuleIds, ruleId];
      }
    }

    const { triggeredRules, totalScore } = evaluateRules(newSession, customers);

    const updatedSession: SessionData = {
      ...newSession,
      riskScore: totalScore,
      triggeredRuleIds: [
        ...newSession.triggeredRuleIds,
        ...triggeredRules.map(r => r.ruleId).filter(id => !newSession.triggeredRuleIds.includes(id)),
      ],
    };

    dispatch({ type: 'UPDATE_SESSION', session: updatedSession });

    // Persist session to Supabase
    supabase
      .from('sessions')
      .upsert(sessionToDb(updatedSession), { onConflict: 'user_id' })
      .then(({ error }) => { if (error) console.error('Session upsert error:', error); });

    // Persist risk history
    const historyEntry: RiskHistory = { userId: user.id, timestamp: new Date().toISOString(), score: totalScore };
    dispatch({ type: 'ADD_RISK_HISTORY', entry: historyEntry });
    supabase
      .from('risk_history')
      .insert({ user_id: user.id, score: totalScore })
      .then(({ error }) => { if (error) console.error('Risk history insert error:', error); });

    // Generate alert if score >= 30
    if (totalScore >= 30 && triggeredRules.length > 0) {
      const alert = buildAlert(user, updatedSession, triggeredRules, totalScore, customers);
      dispatch({ type: 'ADD_ALERT', alert });
      supabase
        .from('alerts')
        .insert(alertToDb(alert))
        .then(({ error }) => { if (error) console.error('Alert insert error:', error); });
    }

    return updatedSession;
  }, []);

  // ── login ──────────────────────────────────────────────────────────────────
  const login = useCallback(async (loginId: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const { state: s } = { state: stateRef.current };
    const user = s.users.find(u => u.loginId === loginId);

    if (!user || user.password !== password) {
      dispatch({ type: 'INCREMENT_FAILED', loginId });
      return { success: false, error: 'Invalid credentials' };
    }
    if (user.status === 'suspended') return { success: false, error: 'Account suspended. Contact administrator.' };
    if (user.status === 'deactivated') return { success: false, error: 'Account deactivated. Contact administrator.' };

    const failedAttempts = s.failedAttempts[loginId] || 0;
    const session = createSession(user, failedAttempts);
    dispatch({ type: 'LOGIN', user, session });
    dispatch({ type: 'RESET_FAILED', loginId });

    const log: ActivityLog = {
      id: generateLogId(),
      userId: user.id,
      userName: user.fullName,
      actionType: 'LOGIN',
      system: user.systemAccess,
      timestamp: new Date().toISOString(),
      ip: session.ip,
      metadata: { isOffHours: session.isOffHours, isWeekend: session.isWeekend, failedAttempts },
    };
    dispatch({ type: 'ADD_LOG', log });
    supabase.from('activity_logs').insert(logToDb(log)).then(({ error }) => {
      if (error) console.error('Log insert error:', error);
    });

    // Persist session
    supabase.from('sessions').upsert(sessionToDb(session), { onConflict: 'user_id' }).then(({ error }) => {
      if (error) console.error('Session upsert error:', error);
    });

    const extraRules: string[] = [];
    if (Math.random() < 0.2) extraRules.push('R003');

    await triggerRuleCheck(session, s.customers, user, extraRules);
    return { success: true };
  }, [triggerRuleCheck]);

  // ── logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    const s = stateRef.current;
    if (s.currentUser) {
      const log: ActivityLog = {
        id: generateLogId(),
        userId: s.currentUser.id,
        userName: s.currentUser.fullName,
        actionType: 'LOGOUT',
        system: s.currentUser.systemAccess,
        timestamp: new Date().toISOString(),
        ip: s.currentSession?.ip || '0.0.0.0',
        metadata: {},
      };
      dispatch({ type: 'ADD_LOG', log });
      supabase.from('activity_logs').insert(logToDb(log)).then(({ error }) => {
        if (error) console.error('Logout log error:', error);
      });
      // Delete session from DB on logout
      supabase.from('sessions').delete().eq('user_id', s.currentUser.id).then(({ error }) => {
        if (error) console.error('Session delete error:', error);
      });
    }
    dispatch({ type: 'LOGOUT' });
  }, []);

  // ── logAction ──────────────────────────────────────────────────────────────
  const logAction = useCallback((
    actionType: ActionType,
    system: string,
    customerId?: string,
    metadata: Record<string, unknown> = {},
    extraRules: string[] = []
  ) => {
    const s = stateRef.current;
    if (!s.currentUser || !s.currentSession) return;

    const customer = customerId ? s.customers.find(c => c.id === customerId) : undefined;

    const log: ActivityLog = {
      id: generateLogId(),
      userId: s.currentUser.id,
      userName: s.currentUser.fullName,
      actionType,
      system,
      customerId,
      customerName: customer?.fullName,
      timestamp: new Date().toISOString(),
      ip: s.currentSession.ip,
      metadata,
    };
    dispatch({ type: 'ADD_LOG', log });
    supabase.from('activity_logs').insert(logToDb(log)).then(({ error }) => {
      if (error) console.error('Log insert error:', error);
    });

    let updatedSession = { ...s.currentSession };
    let mutableExtraRules = [...extraRules];

    if (customerId && !updatedSession.accessedCustomers.includes(customerId)) {
      updatedSession.accessedCustomers = [...updatedSession.accessedCustomers, customerId];
    }

    if (customer?.accountStatus === 'Dormant' && customerId) {
      if (!updatedSession.dormantAccountsAccessed.includes(customerId)) {
        updatedSession.dormantAccountsAccessed = [...updatedSession.dormantAccountsAccessed, customerId];
      }
    }

    if (actionType === 'MODIFY_CONTACT' && customerId) {
      const fields = (metadata.fields as string[]) || [];
      updatedSession.contactModifications = [
        ...updatedSession.contactModifications,
        { customerId, timestamp: new Date().toISOString(), fields },
      ];
      if (metadata.newEmail && typeof metadata.newEmail === 'string') {
        const domain = metadata.newEmail.split('@')[1] || '';
        const internalDomains = ['bankinternal.com', 'bankmail.in'];
        if (!internalDomains.includes(domain)) mutableExtraRules = [...mutableExtraRules, 'R027'];
      }
    }

    if (actionType === 'TRIGGER_OTP' && customerId) {
      updatedSession.otpTriggers = [
        ...updatedSession.otpTriggers,
        { customerId, timestamp: new Date().toISOString() },
      ];
    }

    if (actionType === 'INITIATE_TRANSACTION') {
      updatedSession.transactionCount = updatedSession.transactionCount + 1;
      const amount = (metadata.amount as number) || 0;
      const beneficiary = (metadata.beneficiary as string) || '';
      updatedSession.transactions = [
        ...updatedSession.transactions,
        { customerId: customerId || '', amount, timestamp: new Date().toISOString(), beneficiary },
      ];
      if (Math.random() < 0.3) mutableExtraRules = [...mutableExtraRules, 'R034'];
    }

    if (actionType === 'RUN_REPORT') {
      updatedSession.reportCount = updatedSession.reportCount + 1;
      const count = (metadata.recordCount as number) || 0;
      const fields = (metadata.fields as string[]) || [];
      if (count > 1000) mutableExtraRules = [...mutableExtraRules, 'R022'];
      else if (count > 500) mutableExtraRules = [...mutableExtraRules, 'R021'];
      else if (count > 100) mutableExtraRules = [...mutableExtraRules, 'R020'];
      if (fields.includes('PAN') || fields.includes('Aadhaar')) mutableExtraRules = [...mutableExtraRules, 'R023'];
      if (fields.includes('PAN') && fields.includes('Aadhaar') && fields.includes('Account Number')) {
        mutableExtraRules = [...mutableExtraRules, 'R024'];
      }
      if (updatedSession.isOffHours) mutableExtraRules = [...mutableExtraRules, 'R026'];
    }

    if (actionType === 'APPROVE_LOAN') {
      const sameOfficer = metadata.sameOfficer as boolean;
      const incompleteKYC = metadata.incompleteKYC as boolean;
      const amount = (metadata.amount as number) || 0;
      const noIncomeVerification = metadata.noIncomeVerification as boolean;
      const newBorrower = metadata.newBorrower as boolean;
      const action = metadata.action as string | undefined;
      const kycStatus = metadata.kycStatus as string | undefined;
      const salary = metadata.salary as number | undefined;
      const loanId = (metadata.loanId as string) || '';
      const forwardedAt = metadata.forwardedAt as string | undefined;

      if (sameOfficer) mutableExtraRules = [...mutableExtraRules, 'R050'];
      if (incompleteKYC) mutableExtraRules = [...mutableExtraRules, 'R051'];
      if (amount > 500000 && noIncomeVerification) mutableExtraRules = [...mutableExtraRules, 'R052'];
      if (newBorrower) mutableExtraRules = [...mutableExtraRules, 'R054'];

      // Track loan forwards (Loan Officer)
      if (action === 'forward') {
        updatedSession.loanForwardCount = (updatedSession.loanForwardCount ?? 0) + 1;
        updatedSession.loanActions = [
          ...(updatedSession.loanActions ?? []),
          { type: 'forward', loanId, amount, kycStatus, salary, timestamp: new Date().toISOString() },
        ];
        if (updatedSession.loanForwardCount >= 3) mutableExtraRules = [...mutableExtraRules, 'R055'];
        if (kycStatus && kycStatus !== 'Verified') mutableExtraRules = [...mutableExtraRules, 'R056'];
        if (salary && salary > 0 && amount > salary * 60) mutableExtraRules = [...mutableExtraRules, 'R059'];
      }

      // Track loan approvals (Branch Manager)
      if (action === 'approve') {
        updatedSession.loanApprovalCount = (updatedSession.loanApprovalCount ?? 0) + 1;
        updatedSession.loanActions = [
          ...(updatedSession.loanActions ?? []),
          { type: 'approve', loanId, amount, timestamp: new Date().toISOString() },
        ];
        if (updatedSession.loanApprovalCount >= 3) mutableExtraRules = [...mutableExtraRules, 'R057'];
        // R058: high-value loan approved quickly after forwarding
        if (amount > 1000000 && forwardedAt) {
          const minutesSinceForward = (Date.now() - new Date(forwardedAt).getTime()) / 60000;
          if (minutesSinceForward < 10) mutableExtraRules = [...mutableExtraRules, 'R058'];
        }
      }
    }

    if (actionType === 'DELETE_AUDIT_LOG_ATTEMPT') {
      mutableExtraRules = [...mutableExtraRules, 'R043'];
    }

    if (updatedSession.accessedCustomers.length > 20) {
      mutableExtraRules = [...mutableExtraRules, 'R045'];
    }

    triggerRuleCheck(updatedSession, s.customers, s.currentUser, mutableExtraRules);
  }, [triggerRuleCheck]);

  // ── updateCustomer ─────────────────────────────────────────────────────────
  const updateCustomer = useCallback((customer: Customer) => {
    dispatch({ type: 'UPDATE_CUSTOMER', customer });
    supabase
      .from('customers')
      .update(customerToDb(customer))
      .eq('id', customer.id)
      .then(({ error }) => { if (error) console.error('Customer update error:', error); });
  }, []);

  // ── addUser ────────────────────────────────────────────────────────────────
  const addUser = useCallback((user: AppUser) => {
    dispatch({ type: 'ADD_USER', user });
    supabase
      .from('app_users')
      .insert(userToDb(user))
      .then(({ error }) => { if (error) console.error('User insert error:', error); });
  }, []);

  // ── updateUser ─────────────────────────────────────────────────────────────
  const updateUser = useCallback((user: AppUser) => {
    dispatch({ type: 'UPDATE_USER', user });
    supabase
      .from('app_users')
      .update(userToDb(user))
      .eq('id', user.id)
      .then(({ error }) => { if (error) console.error('User update error:', error); });
  }, []);

  // ── updateAlert ────────────────────────────────────────────────────────────
  const updateAlert = useCallback((alertId: string, changes: Partial<Alert>) => {
    dispatch({ type: 'UPDATE_ALERT', alertId, changes });
    // Map camelCase changes to snake_case for Supabase
    const dbChanges: Record<string, unknown> = {};
    if (changes.status !== undefined) dbChanges.status = changes.status;
    if (changes.totalScore !== undefined) dbChanges.total_score = changes.totalScore;
    if (changes.severity !== undefined) dbChanges.severity = changes.severity;
    if (changes.recommendedAction !== undefined) dbChanges.recommended_action = changes.recommendedAction;
    supabase
      .from('alerts')
      .update(dbChanges)
      .eq('id', alertId)
      .then(({ error }) => { if (error) console.error('Alert update error:', error); });
  }, []);

  const getSessionForUser = useCallback((userId: string): SessionData | null => {
    return stateRef.current.sessions[userId] || null;
  }, []);

  return (
    <AppContext.Provider value={{
      state, login, logout, logAction, updateCustomer,
      addUser, updateUser, updateAlert, getSessionForUser,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
