import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import { generateId, formatCurrency } from './utils';
import type { Customer } from '@/types';

// ─── Customer portal types ────────────────────────────────────────────────────

export interface CustomerAuth {
  id: string;
  customerId: string;
  email: string;
  password: string;
  mobile: string;
  isActive: boolean;
  createdAt: string;
}

export interface BankTransaction {
  id: string;
  customerId: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  category: string;
  beneficiaryName?: string;
  beneficiaryAccount?: string;
  referenceNumber: string;
  status: 'completed' | 'pending' | 'failed';
  timestamp: string;
}

export interface Beneficiary {
  id: string;
  customerId: string;
  name: string;
  accountNumber: string;
  bankName: string;
  ifscCode: string;
  nickname?: string;
  createdAt: string;
}

export interface FixedDeposit {
  id: string;
  customerId: string;
  principal: number;
  interestRate: number;
  tenureMonths: number;
  maturityDate: string;
  maturityAmount: number;
  status: 'active' | 'matured' | 'broken';
  createdAt: string;
}

export interface LoanApplication {
  id: string;
  customerId: string;
  loanType: string;
  amount: number;
  tenureMonths: number;
  purpose?: string;
  status: 'pending' | 'under_review' | 'pending_approval' | 'approved' | 'rejected' | 'disbursed';
  emi?: number;
  interestRate?: number;
  createdAt: string;
}

export interface CustomerNotification {
  id: string;
  customerId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'alert';
  isRead: boolean;
  createdAt: string;
}

// ─── DB row shapes ────────────────────────────────────────────────────────────

interface DbCustomerAuth {
  id: string; customer_id: string; email: string; password: string;
  mobile: string; is_active: boolean; created_at: string;
}
interface DbTransaction {
  id: string; customer_id: string; type: string; amount: number; description: string;
  category: string; beneficiary_name?: string; beneficiary_account?: string;
  reference_number: string; status: string; timestamp: string;
}
interface DbBeneficiary {
  id: string; customer_id: string; name: string; account_number: string;
  bank_name: string; ifsc_code: string; nickname?: string; created_at: string;
}
interface DbFD {
  id: string; customer_id: string; principal: number; interest_rate: number;
  tenure_months: number; maturity_date: string; maturity_amount: number;
  status: string; created_at: string;
}
interface DbLoan {
  id: string; customer_id: string; loan_type: string; amount: number;
  tenure_months: number; purpose?: string; status: string; emi?: number;
  interest_rate?: number; created_at: string;
}
interface DbNotification {
  id: string; customer_id: string; title: string; message: string;
  type: string; is_read: boolean; created_at: string;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

const mapAuth = (r: DbCustomerAuth): CustomerAuth => ({
  id: r.id, customerId: r.customer_id, email: r.email, password: r.password,
  mobile: r.mobile, isActive: r.is_active, createdAt: r.created_at,
});
const mapTx = (r: DbTransaction): BankTransaction => ({
  id: r.id, customerId: r.customer_id, type: r.type as 'credit' | 'debit',
  amount: r.amount, description: r.description, category: r.category,
  beneficiaryName: r.beneficiary_name, beneficiaryAccount: r.beneficiary_account,
  referenceNumber: r.reference_number, status: r.status as BankTransaction['status'],
  timestamp: r.timestamp,
});
const mapBen = (r: DbBeneficiary): Beneficiary => ({
  id: r.id, customerId: r.customer_id, name: r.name, accountNumber: r.account_number,
  bankName: r.bank_name, ifscCode: r.ifsc_code, nickname: r.nickname, createdAt: r.created_at,
});
const mapFD = (r: DbFD): FixedDeposit => ({
  id: r.id, customerId: r.customer_id, principal: r.principal,
  interestRate: r.interest_rate, tenureMonths: r.tenure_months,
  maturityDate: r.maturity_date, maturityAmount: r.maturity_amount,
  status: r.status as FixedDeposit['status'], createdAt: r.created_at,
});
const mapLoan = (r: DbLoan): LoanApplication => ({
  id: r.id, customerId: r.customer_id, loanType: r.loan_type, amount: r.amount,
  tenureMonths: r.tenure_months, purpose: r.purpose,
  status: r.status as LoanApplication['status'], emi: r.emi,
  interestRate: r.interest_rate, createdAt: r.created_at,
});
const mapNotif = (r: DbNotification): CustomerNotification => ({
  id: r.id, customerId: r.customer_id, title: r.title, message: r.message,
  type: r.type as CustomerNotification['type'], isRead: r.is_read, createdAt: r.created_at,
});

// ─── Seed helpers ─────────────────────────────────────────────────────────────

function generateRefNumber(): string {
  return 'REF' + Math.random().toString(36).substr(2, 9).toUpperCase();
}

function subtractDays(days: number, from?: Date): Date {
  const d = from ? new Date(from) : new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function seedTransactions(customerId: string, balance: number): Omit<DbTransaction, 'id'>[] {
  const categories = ['Food & Dining', 'Shopping', 'Utilities', 'Transfer', 'EMI', 'ATM Withdrawal', 'Salary', 'Interest'];
  const descs = [
    { desc: 'Zomato Order', cat: 'Food & Dining', type: 'debit', range: [200, 800] },
    { desc: 'Amazon Purchase', cat: 'Shopping', type: 'debit', range: [500, 5000] },
    { desc: 'Electricity Bill', cat: 'Utilities', type: 'debit', range: [800, 3000] },
    { desc: 'NEFT Transfer', cat: 'Transfer', type: 'debit', range: [1000, 50000] },
    { desc: 'Home Loan EMI', cat: 'EMI', type: 'debit', range: [5000, 25000] },
    { desc: 'ATM Cash Withdrawal', cat: 'ATM Withdrawal', type: 'debit', range: [2000, 20000] },
    { desc: 'Salary Credit', cat: 'Salary', type: 'credit', range: [25000, 120000] },
    { desc: 'Interest Credit', cat: 'Interest', type: 'credit', range: [100, 2000] },
    { desc: 'UPI Payment', cat: 'Shopping', type: 'debit', range: [50, 2000] },
    { desc: 'Mobile Recharge', cat: 'Utilities', type: 'debit', range: [99, 599] },
  ];

  const txns: Omit<DbTransaction, 'id'>[] = [];
  for (let i = 0; i < 20; i++) {
    const d = descs[Math.floor(Math.random() * descs.length)];
    const amt = Math.floor(Math.random() * (d.range[1] - d.range[0]) + d.range[0]);
    const daysAgo = Math.floor(Math.random() * 90);
    txns.push({
      customer_id: customerId,
      type: d.type as 'credit' | 'debit',
      amount: amt,
      description: d.desc,
      category: d.cat,
      reference_number: generateRefNumber(),
      status: 'completed',
      timestamp: subtractDays(daysAgo).toISOString(),
    });
  }
  return txns;
}

function seedBeneficiaries(customerId: string): Omit<DbBeneficiary, 'id'>[] {
  const banks = ['HDFC Bank', 'ICICI Bank', 'SBI', 'Axis Bank', 'Kotak Bank'];
  const names = ['Rahul Sharma', 'Priya Mehta', 'Amit Verma', 'Sunita Singh'];
  return names.slice(0, 2 + Math.floor(Math.random() * 3)).map(name => ({
    customer_id: customerId,
    name,
    account_number: Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join(''),
    bank_name: banks[Math.floor(Math.random() * banks.length)],
    ifsc_code: 'HDFC0001234',
    nickname: name.split(' ')[0],
    created_at: subtractDays(Math.floor(Math.random() * 180)).toISOString(),
  }));
}

function seedFDs(customerId: string): Omit<DbFD, 'id'>[] {
  const rate = 6.5 + Math.random() * 2;
  const principal = Math.floor(Math.random() * 200000 + 50000);
  const tenure = [6, 12, 24, 36][Math.floor(Math.random() * 4)];
  const maturityAmount = principal * (1 + (rate / 100) * (tenure / 12));
  const maturityDate = new Date();
  maturityDate.setMonth(maturityDate.getMonth() + tenure - Math.floor(Math.random() * 6));
  return [{
    customer_id: customerId,
    principal,
    interest_rate: parseFloat(rate.toFixed(2)),
    tenure_months: tenure,
    maturity_date: maturityDate.toISOString(),
    maturity_amount: Math.floor(maturityAmount),
    status: 'active',
    created_at: subtractDays(Math.floor(Math.random() * 180)).toISOString(),
  }];
}

function seedNotifications(customerId: string): Omit<DbNotification, 'id'>[] {
  return [
    {
      customer_id: customerId, title: 'Welcome to NetBanking',
      message: 'Your net banking account is now active. Explore all features.',
      type: 'success', is_read: true, created_at: subtractDays(30).toISOString(),
    },
    {
      customer_id: customerId, title: 'Security Alert',
      message: 'A new login was detected from a new device. If this was not you, please change your password.',
      type: 'alert', is_read: false, created_at: subtractDays(2).toISOString(),
    },
    {
      customer_id: customerId, title: 'FD Maturity Reminder',
      message: 'Your Fixed Deposit is maturing soon. Please visit the FD section for renewal options.',
      type: 'warning', is_read: false, created_at: subtractDays(1).toISOString(),
    },
  ];
}

// ─── State ────────────────────────────────────────────────────────────────────

interface CustomerState {
  currentAuth: CustomerAuth | null;
  currentCustomer: Customer | null;
  transactions: BankTransaction[];
  beneficiaries: Beneficiary[];
  fixedDeposits: FixedDeposit[];
  loans: LoanApplication[];
  notifications: CustomerNotification[];
  loading: boolean;
  dataLoading: boolean;
}

type CustomerAction =
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_DATA_LOADING'; loading: boolean }
  | { type: 'LOGIN'; auth: CustomerAuth; customer: Customer }
  | { type: 'LOGOUT' }
  | { type: 'SET_CUSTOMER_DATA'; transactions: BankTransaction[]; beneficiaries: Beneficiary[]; fds: FixedDeposit[]; loans: LoanApplication[]; notifications: CustomerNotification[] }
  | { type: 'ADD_TRANSACTION'; tx: BankTransaction }
  | { type: 'ADD_BENEFICIARY'; ben: Beneficiary }
  | { type: 'REMOVE_BENEFICIARY'; id: string }
  | { type: 'ADD_FD'; fd: FixedDeposit }
  | { type: 'ADD_LOAN'; loan: LoanApplication }
  | { type: 'UPDATE_CUSTOMER'; customer: Customer }
  | { type: 'MARK_NOTIFICATION_READ'; id: string }
  | { type: 'ADD_NOTIFICATION'; notif: CustomerNotification };

const initialState: CustomerState = {
  currentAuth: null, currentCustomer: null, transactions: [], beneficiaries: [],
  fixedDeposits: [], loans: [], notifications: [], loading: false, dataLoading: false,
};

function reducer(state: CustomerState, action: CustomerAction): CustomerState {
  switch (action.type) {
    case 'SET_LOADING': return { ...state, loading: action.loading };
    case 'SET_DATA_LOADING': return { ...state, dataLoading: action.loading };
    case 'LOGIN': return { ...state, currentAuth: action.auth, currentCustomer: action.customer };
    case 'LOGOUT': return { ...initialState };
    case 'SET_CUSTOMER_DATA':
      return { ...state, transactions: action.transactions, beneficiaries: action.beneficiaries, fixedDeposits: action.fds, loans: action.loans, notifications: action.notifications };
    case 'ADD_TRANSACTION': return { ...state, transactions: [action.tx, ...state.transactions] };
    case 'ADD_BENEFICIARY': return { ...state, beneficiaries: [...state.beneficiaries, action.ben] };
    case 'REMOVE_BENEFICIARY': return { ...state, beneficiaries: state.beneficiaries.filter(b => b.id !== action.id) };
    case 'ADD_FD': return { ...state, fixedDeposits: [...state.fixedDeposits, action.fd] };
    case 'ADD_LOAN': return { ...state, loans: [...state.loans, action.loan] };
    case 'UPDATE_CUSTOMER':
      return { ...state, currentCustomer: state.currentCustomer?.id === action.customer.id ? action.customer : state.currentCustomer };
    case 'MARK_NOTIFICATION_READ':
      return { ...state, notifications: state.notifications.map(n => n.id === action.id ? { ...n, isRead: true } : n) };
    case 'ADD_NOTIFICATION': return { ...state, notifications: [action.notif, ...state.notifications] };
    default: return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface CustomerContextType {
  state: CustomerState;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, mobile: string, fullName: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  transferFunds: (amount: number, beneficiaryId: string, description: string) => Promise<boolean>;
  addBeneficiary: (ben: Omit<Beneficiary, 'id' | 'customerId' | 'createdAt'>) => Promise<boolean>;
  removeBeneficiary: (id: string) => Promise<boolean>;
  openFD: (principal: number, tenureMonths: number) => Promise<boolean>;
  applyLoan: (loanType: string, amount: number, tenure: number, purpose: string) => Promise<boolean>;
  markNotificationRead: (id: string) => void;
  updateProfile: (mobile: string, email: string) => Promise<boolean>;
  initiateKYC: () => Promise<{ success: boolean; error?: string }>;
}

const CustomerContext = createContext<CustomerContextType | null>(null);

export function CustomerProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  // ── initiateKYC ─────────────────────────────────────────────────────────
  const initiateKYC = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    const s = stateRef.current;
    if (!s.currentCustomer) return { success: false, error: 'Not logged in' };

    // Check if a pending request already exists
    const { data: existing } = await supabase
      .from('kyc_requests')
      .select('id, status')
      .eq('customer_id', s.currentCustomer.id)
      .eq('status', 'pending')
      .limit(1);

    if (existing && existing.length > 0) {
      return { success: false, error: 'A KYC request is already pending review.' };
    }

    const { error } = await supabase.from('kyc_requests').insert({
      id: generateId('KYC'),
      customer_id: s.currentCustomer.id,
      status: 'pending',
      initiated_at: new Date().toISOString(),
    });

    if (error) return { success: false, error: 'Failed to submit KYC request. Please try again.' };

    // Add a notification for the customer
    const notif: DbNotification = {
      id: generateId('NT'),
      customer_id: s.currentCustomer.id,
      title: 'KYC Request Submitted',
      message: 'Your KYC request has been submitted and is pending review by our team. You will be notified once processed.',
      type: 'info',
      is_read: false,
      created_at: new Date().toISOString(),
    };
    await supabase.from('notifications').insert(notif);
    dispatch({ type: 'ADD_NOTIFICATION', notif: mapNotif(notif) });

    return { success: true };
  }, []);

  // ── Seed customer auth on first load ──────────────────────────────────────
  useEffect(() => {
    async function ensureSeeded() {
      const { data: existing } = await supabase.from('customer_auth').select('id').limit(1);
      if (existing && existing.length > 0) return;

      // Seed 5 demo customer accounts (linked to CUST0001–CUST0005)
      const demos = [
        { id: generateId('CA'), customer_id: 'CUST0001', email: 'demo1@bank.com', password: 'Customer@1', mobile: '9876543210', is_active: true, created_at: new Date().toISOString() },
        { id: generateId('CA'), customer_id: 'CUST0002', email: 'demo2@bank.com', password: 'Customer@1', mobile: '9876543211', is_active: true, created_at: new Date().toISOString() },
        { id: generateId('CA'), customer_id: 'CUST0003', email: 'demo3@bank.com', password: 'Customer@1', mobile: '9876543212', is_active: true, created_at: new Date().toISOString() },
        { id: generateId('CA'), customer_id: 'CUST0004', email: 'demo4@bank.com', password: 'Customer@1', mobile: '9876543213', is_active: true, created_at: new Date().toISOString() },
        { id: generateId('CA'), customer_id: 'CUST0005', email: 'demo5@bank.com', password: 'Customer@1', mobile: '9876543214', is_active: true, created_at: new Date().toISOString() },
      ];
      await supabase.from('customer_auth').insert(demos);
    }
    ensureSeeded();
  }, []);

  // ── Load customer data after login ────────────────────────────────────────
  const loadCustomerData = useCallback(async (customerId: string, isNewCustomer = false) => {
    dispatch({ type: 'SET_DATA_LOADING', loading: true });

    // Check if data exists — only seed for existing (non-new) customers
    const { data: txns } = await supabase.from('bank_transactions').select('*').eq('customer_id', customerId).order('timestamp', { ascending: false });

    if (!isNewCustomer && (!txns || txns.length === 0)) {
      // Seed transaction data for pre-existing demo customers only
      const { data: customer } = await supabase.from('customers').select('balance').eq('id', customerId).single();
      const txnSeed = seedTransactions(customerId, customer?.balance || 50000);
      const txnWithIds = txnSeed.map(t => ({ ...t, id: generateId('TX') }));
      await supabase.from('bank_transactions').insert(txnWithIds);

      const benSeed = seedBeneficiaries(customerId).map(b => ({ ...b, id: generateId('BN') }));
      await supabase.from('beneficiaries').insert(benSeed);

      const fdSeed = seedFDs(customerId).map(f => ({ ...f, id: generateId('FD') }));
      await supabase.from('fixed_deposits').insert(fdSeed);

      const notifSeed = seedNotifications(customerId).map(n => ({ ...n, id: generateId('NT') }));
      await supabase.from('notifications').insert(notifSeed);
    }

    const [txR, benR, fdR, loanR, notifR] = await Promise.all([
      supabase.from('bank_transactions').select('*').eq('customer_id', customerId).order('timestamp', { ascending: false }),
      supabase.from('beneficiaries').select('*').eq('customer_id', customerId),
      supabase.from('fixed_deposits').select('*').eq('customer_id', customerId),
      supabase.from('loan_applications').select('*').eq('customer_id', customerId).order('created_at', { ascending: false }),
      supabase.from('notifications').select('*').eq('customer_id', customerId).order('created_at', { ascending: false }),
    ]);

    dispatch({
      type: 'SET_CUSTOMER_DATA',
      transactions: (txR.data ?? []).map(mapTx),
      beneficiaries: (benR.data ?? []).map(mapBen),
      fds: (fdR.data ?? []).map(mapFD),
      loans: (loanR.data ?? []).map(mapLoan),
      notifications: (notifR.data ?? []).map(mapNotif),
    });
    dispatch({ type: 'SET_DATA_LOADING', loading: false });
  }, []);

  // ── login ─────────────────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string) => {
    dispatch({ type: 'SET_LOADING', loading: true });
    const { data: auths } = await supabase.from('customer_auth').select('*').eq('email', email);
    const authRow = auths?.[0] as DbCustomerAuth | undefined;

    if (!authRow || authRow.password !== password) {
      dispatch({ type: 'SET_LOADING', loading: false });
      return { success: false, error: 'Invalid email or password' };
    }
    if (!authRow.is_active) {
      dispatch({ type: 'SET_LOADING', loading: false });
      return { success: false, error: 'Account is inactive. Please contact support.' };
    }

    const { data: custRow } = await supabase.from('customers').select('*').eq('id', authRow.customer_id).single();
    if (!custRow) {
      dispatch({ type: 'SET_LOADING', loading: false });
      return { success: false, error: 'Customer record not found' };
    }

    const auth = mapAuth(authRow);
    const customer: Customer = {
      id: custRow.id, fullName: custRow.full_name, aadhaar: custRow.aadhaar, pan: custRow.pan,
      accountNumber: custRow.account_number, accountType: custRow.account_type as Customer['accountType'],
      balance: custRow.balance, accountStatus: custRow.account_status as Customer['accountStatus'],
      lastTransactionDate: custRow.last_transaction_date, dateOpened: custRow.date_opened,
      mobile: custRow.mobile, email: custRow.email, branch: custRow.branch,
      kycStatus: custRow.kyc_status as Customer['kycStatus'],
      bankName: custRow.bank_name ?? 'SecureBank Ltd.',
      ifscCode: custRow.ifsc_code ?? 'SCBK0000001',
    };

    dispatch({ type: 'LOGIN', auth, customer });
    dispatch({ type: 'SET_LOADING', loading: false });
    // For demo accounts (aadhaar set), seed data; for new users (empty aadhaar), skip seeding
    const isNew = !custRow.aadhaar || custRow.aadhaar === '';
    await loadCustomerData(customer.id, isNew);
    return { success: true };
  }, [loadCustomerData]);

  // ── signup ────────────────────────────────────────────────────────────────
  const signup = useCallback(async (email: string, password: string, mobile: string, fullName: string) => {
    dispatch({ type: 'SET_LOADING', loading: true });

    // Check if email already registered
    const { data: existing } = await supabase.from('customer_auth').select('id').eq('email', email);
    if (existing && existing.length > 0) {
      dispatch({ type: 'SET_LOADING', loading: false });
      return { success: false, error: 'Email is already registered' };
    }

    // Auto-generate unique Customer ID
    const { data: lastCustomer } = await supabase
      .from('customers')
      .select('id')
      .order('id', { ascending: false })
      .limit(1);
    let nextNum = 61;
    if (lastCustomer && lastCustomer.length > 0) {
      const lastId = lastCustomer[0].id as string;
      const parsed = parseInt(lastId.replace('CUST', ''));
      if (!isNaN(parsed)) nextNum = parsed + 1;
    }
    const newCustomerId = `CUST${String(nextNum).padStart(4, '0')}`;

    // Generate account details
    const accountNumber = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('');
    const branch = 'Mumbai Main Branch';
    const now = new Date().toISOString();

    // Create customer record
    const newCustomerRow = {
      id: newCustomerId,
      full_name: fullName,
      aadhaar: '',
      pan: '',
      account_number: accountNumber,
      account_type: 'Savings',
      balance: 0,
      account_status: 'Active',
      last_transaction_date: now,
      date_opened: now,
      mobile,
      email,
      branch,
      kyc_status: 'Pending',
      bank_name: 'SecureBank Ltd.',
      ifsc_code: 'SCBK0001001',
    };

    const { error: custError } = await supabase.from('customers').insert(newCustomerRow);
    if (custError) {
      dispatch({ type: 'SET_LOADING', loading: false });
      return { success: false, error: 'Failed to create customer record. Please try again.' };
    }

    // Create auth record
    const newAuth: DbCustomerAuth = {
      id: generateId('CA'), customer_id: newCustomerId, email, password,
      mobile, is_active: true, created_at: now,
    };
    const { error: authError } = await supabase.from('customer_auth').insert(newAuth);
    if (authError) {
      // Rollback customer record
      await supabase.from('customers').delete().eq('id', newCustomerId);
      dispatch({ type: 'SET_LOADING', loading: false });
      return { success: false, error: 'Registration failed. Please try again.' };
    }

    const auth = mapAuth(newAuth);
    const customer: Customer = {
      id: newCustomerId, fullName, aadhaar: '', pan: '',
      accountNumber, accountType: 'Savings',
      balance: 0, accountStatus: 'Active',
      lastTransactionDate: now, dateOpened: now,
      mobile, email, branch,
      kycStatus: 'Pending',
      bankName: 'SecureBank Ltd.',
      ifscCode: 'SCBK0001001',
    };

    dispatch({ type: 'LOGIN', auth, customer });
    dispatch({ type: 'SET_LOADING', loading: false });
    // New customer — skip dummy data seeding
    await loadCustomerData(customer.id, true);
    return { success: true };
  }, [loadCustomerData]);

  // ── logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(() => { dispatch({ type: 'LOGOUT' }); }, []);

  // ── transferFunds ─────────────────────────────────────────────────────────
  const transferFunds = useCallback(async (amount: number, beneficiaryId: string, description: string): Promise<boolean> => {
    const s = stateRef.current;
    if (!s.currentCustomer || !s.currentAuth) return false;
    const ben = s.beneficiaries.find(b => b.id === beneficiaryId);
    if (!ben) return false;

    const newBalance = s.currentCustomer.balance - amount;
    if (newBalance < 0) return false;

    const tx: DbTransaction = {
      id: generateId('TX'), customer_id: s.currentCustomer.id, type: 'debit',
      amount, description: description || `Transfer to ${ben.name}`,
      category: 'Transfer', beneficiary_name: ben.name, beneficiary_account: ben.accountNumber,
      reference_number: generateRefNumber(), status: 'completed',
      timestamp: new Date().toISOString(),
    };

    const { error } = await supabase.from('bank_transactions').insert(tx);
    if (error) return false;

    await supabase.from('customers').update({ balance: newBalance, last_transaction_date: new Date().toISOString() }).eq('id', s.currentCustomer.id);

    dispatch({ type: 'ADD_TRANSACTION', tx: mapTx(tx) });
    dispatch({ type: 'UPDATE_CUSTOMER', customer: { ...s.currentCustomer, balance: newBalance, lastTransactionDate: new Date().toISOString() } });

    // Add success notification
    const notif: DbNotification = {
      id: generateId('NT'), customer_id: s.currentCustomer.id,
      title: 'Transfer Successful',
      message: `₹${amount.toLocaleString('en-IN')} transferred to ${ben.name} successfully. Ref: ${tx.reference_number}`,
      type: 'success', is_read: false, created_at: new Date().toISOString(),
    };
    await supabase.from('notifications').insert(notif);
    dispatch({ type: 'ADD_NOTIFICATION', notif: mapNotif(notif) });
    return true;
  }, []);

  // ── addBeneficiary ────────────────────────────────────────────────────────
  const addBeneficiary = useCallback(async (ben: Omit<Beneficiary, 'id' | 'customerId' | 'createdAt'>): Promise<boolean> => {
    const s = stateRef.current;
    if (!s.currentCustomer) return false;
    const row: DbBeneficiary = {
      id: generateId('BN'), customer_id: s.currentCustomer.id, name: ben.name,
      account_number: ben.accountNumber, bank_name: ben.bankName,
      ifsc_code: ben.ifscCode, nickname: ben.nickname,
      created_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('beneficiaries').insert(row);
    if (error) return false;
    dispatch({ type: 'ADD_BENEFICIARY', ben: mapBen(row) });
    return true;
  }, []);

  // ── removeBeneficiary ─────────────────────────────────────────────────────
  const removeBeneficiary = useCallback(async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('beneficiaries').delete().eq('id', id);
    if (error) return false;
    dispatch({ type: 'REMOVE_BENEFICIARY', id });
    return true;
  }, []);

  // ── openFD ────────────────────────────────────────────────────────────────
  const openFD = useCallback(async (principal: number, tenureMonths: number): Promise<boolean> => {
    const s = stateRef.current;
    if (!s.currentCustomer || s.currentCustomer.balance < principal) return false;

    const rate = 6.5 + Math.random() * 2;
    const maturityAmount = principal * (1 + (rate / 100) * (tenureMonths / 12));
    const maturityDate = new Date();
    maturityDate.setMonth(maturityDate.getMonth() + tenureMonths);

    const row: DbFD = {
      id: generateId('FD'), customer_id: s.currentCustomer.id,
      principal, interest_rate: parseFloat(rate.toFixed(2)),
      tenure_months: tenureMonths, maturity_date: maturityDate.toISOString(),
      maturity_amount: Math.floor(maturityAmount), status: 'active',
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('fixed_deposits').insert(row);
    if (error) return false;

    const newBalance = s.currentCustomer.balance - principal;
    await supabase.from('customers').update({ balance: newBalance }).eq('id', s.currentCustomer.id);

    const tx: DbTransaction = {
      id: generateId('TX'), customer_id: s.currentCustomer.id, type: 'debit',
      amount: principal, description: `Fixed Deposit Created (${tenureMonths}M @ ${rate.toFixed(2)}%)`,
      category: 'Investment', reference_number: generateRefNumber(), status: 'completed',
      timestamp: new Date().toISOString(),
    };
    await supabase.from('bank_transactions').insert(tx);

    dispatch({ type: 'ADD_FD', fd: mapFD(row) });
    dispatch({ type: 'ADD_TRANSACTION', tx: mapTx(tx) });
    dispatch({ type: 'UPDATE_CUSTOMER', customer: { ...s.currentCustomer, balance: newBalance } });
    return true;
  }, []);

  // ── applyLoan ─────────────────────────────────────────────────────────────
  const applyLoan = useCallback(async (loanType: string, amount: number, tenure: number, purpose: string): Promise<boolean> => {
    const s = stateRef.current;
    if (!s.currentCustomer) return false;

    const rate = 8.5 + Math.random() * 4;
    const emi = (amount * (rate / 1200) * Math.pow(1 + rate / 1200, tenure)) / (Math.pow(1 + rate / 1200, tenure) - 1);

    const row: DbLoan = {
      id: generateId('LN'), customer_id: s.currentCustomer.id, loan_type: loanType,
      amount, tenure_months: tenure, purpose, status: 'pending',
      emi: Math.round(emi), interest_rate: parseFloat(rate.toFixed(2)),
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('loan_applications').insert(row);
    if (error) return false;

    dispatch({ type: 'ADD_LOAN', loan: mapLoan(row) });

    const notif: DbNotification = {
      id: generateId('NT'), customer_id: s.currentCustomer.id,
      title: 'Loan Application Received',
      message: `Your ${loanType} application for ${formatCurrency(amount)} has been received. We will process it within 3-5 business days.`,
      type: 'info', is_read: false, created_at: new Date().toISOString(),
    };
    await supabase.from('notifications').insert(notif);
    dispatch({ type: 'ADD_NOTIFICATION', notif: mapNotif(notif) });
    return true;
  }, []);

  // ── markNotificationRead ──────────────────────────────────────────────────
  const markNotificationRead = useCallback((id: string) => {
    dispatch({ type: 'MARK_NOTIFICATION_READ', id });
    supabase.from('notifications').update({ is_read: true }).eq('id', id);
  }, []);

  // ── updateProfile ─────────────────────────────────────────────────────────
  const updateProfile = useCallback(async (mobile: string, email: string): Promise<boolean> => {
    const s = stateRef.current;
    if (!s.currentCustomer || !s.currentAuth) return false;
    await supabase.from('customer_auth').update({ mobile, email }).eq('id', s.currentAuth.id);
    await supabase.from('customers').update({ mobile, email }).eq('id', s.currentCustomer.id);
    dispatch({ type: 'UPDATE_CUSTOMER', customer: { ...s.currentCustomer, mobile, email } });
    return true;
  }, []);

  return (
    <CustomerContext.Provider value={{
      state, login, signup, logout, transferFunds, addBeneficiary,
      removeBeneficiary, openFD, applyLoan, markNotificationRead, updateProfile, initiateKYC,
    }}>
      {children}
    </CustomerContext.Provider>
  );
}

export function useCustomer() {
  const ctx = useContext(CustomerContext);
  if (!ctx) throw new Error('useCustomer must be used within CustomerProvider');
  return ctx;
}
