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
    transactionApprovalCount: (r as any).transaction_approval_count ?? 0,
    makerCheckerActions: (r as any).maker_checker_actions ?? [],
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
    transaction_approval_count: s.transactionApprovalCount ?? 0,
    maker_checker_actions: s.makerCheckerActions ?? [],
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
    transactionApprovalCount: 0,
    makerCheckerActions: [],
  };
}

// ─── LocalStorage persistence helpers ────────────────────────────────────────
const LS_USER_KEY = 'sentineliq_user';
const LS_SESSION_KEY = 'sentineliq_session';

function persistAuth(user: AppUser | null, session: SessionData | null) {
  if (user && session) {
    localStorage.setItem(LS_USER_KEY, JSON.stringify(user));
    localStorage.setItem(LS_SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(LS_USER_KEY);
    localStorage.removeItem(LS_SESSION_KEY);
  }
}

function loadPersistedAuth(): { user: AppUser | null; session: SessionData | null } {
  try {
    const user = localStorage.getItem(LS_USER_KEY);
    const session = localStorage.getItem(LS_SESSION_KEY);
    if (user && session) {
      return { user: JSON.parse(user) as AppUser, session: JSON.parse(session) as SessionData };
    }
  } catch {
    localStorage.removeItem(LS_USER_KEY);
    localStorage.removeItem(LS_SESSION_KEY);
  }
  return { user: null, session: null };
}

const persisted = loadPersistedAuth();

const initialState: AppState = {
  currentUser: persisted.user,
  currentSession: persisted.session,
  users: [],
  customers: [],
  activityLogs: [],
  alerts: [],
  riskHistory: [],
  sessions: persisted.session ? { [persisted.session.userId]: persisted.session } : {},
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
    case 'LOGIN': {
      persistAuth(action.user, action.session);
      return {
        ...state,
        currentUser: action.user,
        currentSession: action.session,
        sessions: { ...state.sessions, [action.user.id]: action.session },
        failedAttempts: { ...state.failedAttempts, [action.user.loginId]: 0 },
      };
    }
    case 'LOGOUT':
      persistAuth(null, null);
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
      // Keep localStorage in sync with latest session
      if (state.currentUser && action.session.userId === state.currentUser.id) {
        persistAuth(state.currentUser, action.session);
      }
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

      // If we have a persisted user, refresh their session from DB
      const { user: persistedUser } = loadPersistedAuth();
      if (persistedUser && sessions[persistedUser.id]) {
        const freshSession = sessions[persistedUser.id];
        persistAuth(persistedUser, freshSession);
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
    // Build TriggeredRule objects for the extra rules BEFORE adding to triggeredRuleIds
    // so evaluateRules doesn't skip them (it skips ids already in triggeredRuleIds)
    const extraTriggeredRules: import('@/types').TriggeredRule[] = extraRules
      .filter(id => RULE_DEFINITIONS[id] && !session.triggeredRuleIds.includes(id))
      .map(id => ({ ruleId: id, description: RULE_DEFINITIONS[id].description, score: RULE_DEFINITIONS[id].score }));

    const newSession = { ...session };
    for (const ruleId of extraRules) {
      if (!newSession.triggeredRuleIds.includes(ruleId) && RULE_DEFINITIONS[ruleId]) {
        newSession.triggeredRuleIds = [...newSession.triggeredRuleIds, ruleId];
      }
    }

    const { triggeredRules: sessionTriggeredRules, totalScore: sessionScore } = evaluateRules(newSession, customers);

    // Merge extra rules with session-evaluated rules (deduplicate)
    const allNewRuleIds = new Set([...sessionTriggeredRules.map(r => r.ruleId), ...extraTriggeredRules.map(r => r.ruleId)]);
    const mergedTriggeredRules = [
      ...sessionTriggeredRules,
      ...extraTriggeredRules.filter(r => !sessionTriggeredRules.some(s => s.ruleId === r.ruleId)),
    ];

    // Recalculate total score including extra rule scores
    const extraScore = extraTriggeredRules.reduce((sum, r) => sum + r.score, 0);
    const totalScore = Math.min(100, sessionScore + extraScore);
    void allNewRuleIds; // used via mergedTriggeredRules

    const updatedSession: SessionData = {
      ...newSession,
      riskScore: totalScore,
      triggeredRuleIds: [
        ...newSession.triggeredRuleIds,
        ...sessionTriggeredRules.map(r => r.ruleId).filter(id => !newSession.triggeredRuleIds.includes(id)),
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

    // Generate alert if score >= 30 and there are newly triggered rules
    if (totalScore >= 30 && mergedTriggeredRules.length > 0) {
      const alert = buildAlert(user, updatedSession, mergedTriggeredRules, totalScore, customers);
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

    if (actionType === 'INITIATE_TRANSACTION' || actionType === 'INITIATE_TRANSFER') {
      updatedSession.transactionCount = updatedSession.transactionCount + 1;
      const amount = (metadata.amount as number) || 0;
      const beneficiary = (metadata.beneficiary as string) || '';
      updatedSession.transactions = [
        ...updatedSession.transactions,
        { customerId: customerId || '', amount, timestamp: new Date().toISOString(), beneficiary },
      ];
      if (Math.random() < 0.3) mutableExtraRules = [...mutableExtraRules, 'R034'];

      // Create a real pending maker-checker record in the database
      const txId = (metadata.txId as string) || `TX${Date.now()}`;
      const makerDevice = (metadata.deviceFingerprint as string) || `DEV-${updatedSession.ip.replace(/\./g, '')}${Math.floor(Math.random() * 1000)}`;
      const isOffPremises = (metadata.isOffPremises as boolean) || false;
      const nowTs = new Date().toISOString();

      updatedSession.makerCheckerActions = [
        ...(updatedSession.makerCheckerActions ?? []),
        {
          txId,
          makerId: s.currentUser!.id,
          makerName: s.currentUser!.fullName,
          makerIp: updatedSession.ip,
          makerDevice,
          amount,
          initiatedAt: nowTs,
          status: 'pending',
          customerId: customerId || '',
          beneficiary,
          isOffPremises,
        },
      ];

      // Write pending record to DB — Checker will see this in MakerCheckerPanel
      supabase.from('maker_checker_transactions').insert({
        id:                    `MCT${Date.now()}`,
        tx_id:                 txId,
        maker_id:              s.currentUser!.id,
        maker_name:            s.currentUser!.fullName,
        maker_ip:              updatedSession.ip,
        maker_device:          makerDevice,
        amount,
        customer_id:           customerId || null,
        beneficiary,
        initiated_at:          nowTs,
        status:                'pending',
        collusion_rules:       [],
        is_off_premises_maker: isOffPremises,
      }).then(({ error }) => { if (error) console.error('MCT pending insert error:', error); });

      // R092: Transaction initiated within 10 min of system close (5:50 PM–6:00 PM)
      const nowHour = new Date().getHours();
      const nowMin = new Date().getMinutes();
      if (nowHour === 17 && nowMin >= 50) mutableExtraRules = [...mutableExtraRules, 'R092'];
    }

    if (actionType === 'APPROVE_TRANSACTION') {
      const txId = metadata.txId as string;
      const makerIp = metadata.makerIp as string || '';
      const makerDevice = metadata.makerDevice as string || '';
      const checkerDevice = metadata.checkerDevice as string || `DEV-${updatedSession.ip.replace(/\./g, '')}${Math.floor(Math.random() * 1000)}`;
      const decision = metadata.decision as 'approved' | 'rejected';
      const initiatedAt = metadata.initiatedAt as string;
      const amount = (metadata.amount as number) || 0;
      const makerId = metadata.makerId as string || '';
      const isOffPremises = metadata.isOffPremises as boolean || false;
      const checkerIsOffPremises = metadata.checkerIsOffPremises as boolean || (Math.random() < 0.2);
      const homeAddressMatch = metadata.homeAddressMatch as boolean || false;
      const pairApprovalCount = (metadata.pairApprovalCount as number) || 0;
      const pairTotalAmount = (metadata.pairTotalAmount as number) || 0;
      const checkerRejectionRate = (metadata.checkerRejectionRate as number) ?? 1;
      const makerExclusivity = (metadata.makerExclusivity as number) ?? 0;
      const now = new Date();

      if (decision === 'approved') {
        updatedSession.transactionApprovalCount = (updatedSession.transactionApprovalCount ?? 0) + 1;

        // Update the corresponding maker action
        updatedSession.makerCheckerActions = (updatedSession.makerCheckerActions ?? []).map(a =>
          a.txId === txId ? { ...a, checkerId: s.currentUser!.id, checkerName: s.currentUser!.fullName, checkerIp: updatedSession.ip, checkerDevice, approvedAt: now.toISOString(), status: 'approved' } : a
        );

        // R063: Same IP
        if (makerIp && makerIp === updatedSession.ip) mutableExtraRules = [...mutableExtraRules, 'R063'];
        // R090: Same device fingerprint
        if (makerDevice && makerDevice === checkerDevice) mutableExtraRules = [...mutableExtraRules, 'R090'];
        // R091: Approval on holiday/weekend
        if (isWeekend(now)) mutableExtraRules = [...mutableExtraRules, 'R091'];
        // R062: Approved within 2 minutes
        if (initiatedAt) {
          const minsDiff = (now.getTime() - new Date(initiatedAt).getTime()) / 60000;
          if (minsDiff < 2) mutableExtraRules = [...mutableExtraRules, 'R062'];
        }
        // R093: Pair volume > ₹50L
        if (pairTotalAmount + amount > 5000000) mutableExtraRules = [...mutableExtraRules, 'R093'];
        // R060: Pair count > 10
        if (pairApprovalCount >= 10) mutableExtraRules = [...mutableExtraRules, 'R060'];
        // R094: Shared home address
        if (homeAddressMatch) mutableExtraRules = [...mutableExtraRules, 'R094'];
        // R095: Zero rejection rate
        if (checkerRejectionRate === 0) mutableExtraRules = [...mutableExtraRules, 'R095'];
        // R096: Maker exclusivity (100% to same checker)
        if (makerExclusivity >= 1) mutableExtraRules = [...mutableExtraRules, 'R096'];
        // R097: Both off-premises
        if (isOffPremises && checkerIsOffPremises) mutableExtraRules = [...mutableExtraRules, 'R097'];

        const collusionRules = mutableExtraRules.filter(r =>
          ['R060','R062','R063','R090','R091','R092','R093','R094','R095','R096','R097'].includes(r)
        );

        // Try to UPDATE the existing pending row first (if customer initiated via FundTransfer)
        // then fall back to INSERT a new completed row (for teller-initiated transactions)
        supabase
          .from('maker_checker_transactions')
          .update({
            checker_id:              s.currentUser!.id,
            checker_name:            s.currentUser!.fullName,
            checker_ip:              updatedSession.ip,
            checker_device:          checkerDevice,
            approved_at:             now.toISOString(),
            status:                  decision,
            collusion_rules:         collusionRules,
            is_off_premises_checker: checkerIsOffPremises,
          })
          .eq('tx_id', txId)
          .eq('status', 'pending')
          .then(async ({ error, data }) => {
            if (error) console.error('MCT update error:', error);
            // If no pending row existed, insert a completed record directly
            const updatedCount = Array.isArray(data) ? data.length : 0;
            if (!error && updatedCount === 0) {
              await supabase.from('maker_checker_transactions').insert({
                id:                      `MCT${Date.now()}`,
                tx_id:                   txId,
                maker_id:                makerId,
                maker_name:              (metadata.makerName as string) || '',
                maker_ip:                makerIp,
                maker_device:            makerDevice,
                checker_id:              s.currentUser!.id,
                checker_name:            s.currentUser!.fullName,
                checker_ip:              updatedSession.ip,
                checker_device:          checkerDevice,
                amount,
                customer_id:             customerId || null,
                beneficiary:             (metadata.beneficiary as string) || '',
                initiated_at:            initiatedAt,
                approved_at:             now.toISOString(),
                status:                  decision,
                collusion_rules:         collusionRules,
                is_off_premises_maker:   isOffPremises,
                is_off_premises_checker: checkerIsOffPremises,
              }).then(({ error: e2 }) => { if (e2) console.error('MCT insert error:', e2); });
            }
          });

        // Real DB home-address check for R094
        supabase
          .from('employee_profiles')
          .select('user_id, home_address, home_pincode, registered_ips')
          .in('user_id', [makerId, s.currentUser!.id])
          .then(({ data: profiles }) => {
            if (profiles && profiles.length === 2) {
              const makerProf   = profiles.find((p: any) => p.user_id === makerId);
              const checkerProf = profiles.find((p: any) => p.user_id === s.currentUser!.id);
              if (
                makerProf && checkerProf &&
                makerProf.home_address && checkerProf.home_address &&
                makerProf.home_address.trim().toLowerCase() ===
                checkerProf.home_address.trim().toLowerCase()
              ) {
                // Patch collusion_rules with R094
                supabase
                  .from('maker_checker_transactions')
                  .update({ collusion_rules: [...new Set([...collusionRules, 'R094'])] })
                  .eq('tx_id', txId)
                  .then(({ error }) => { if (error) console.error('R094 patch error:', error); });
                // Also trigger rule in current session
                triggerRuleCheck(
                  { ...updatedSession },
                  s.customers, s.currentUser!,
                  ['R094']
                );
              }
              // Real off-premises check for checker (R097)
              if (
                checkerProf?.registered_ips &&
                !checkerProf.registered_ips.includes(updatedSession.ip) &&
                isOffPremises
              ) {
                // Both maker and checker are off-premises — R097 already flagged
                console.log('[R097] Confirmed: both Maker and Checker off bank premises');
              }
            }
          });
      } else {
        // Rejected — update action status
        updatedSession.makerCheckerActions = (updatedSession.makerCheckerActions ?? []).map(a =>
          a.txId === txId ? { ...a, checkerId: s.currentUser!.id, checkerName: s.currentUser!.fullName, approvedAt: now.toISOString(), status: 'rejected' } : a
        );
      }
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
