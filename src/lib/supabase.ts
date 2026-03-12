import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── Row shapes (snake_case from Supabase) ───────────────────────────────────

export interface DbAppUser {
  id: string;
  login_id: string;
  password: string;
  full_name: string;
  role: string;
  department: string;
  system_access: string;
  is_admin: boolean;
  status: string;
  created_at: string;
}

export interface DbCustomer {
  id: string;
  full_name: string;
  aadhaar: string;
  pan: string;
  account_number: string;
  account_type: string;
  balance: number;
  account_status: string;
  last_transaction_date: string;
  date_opened: string;
  mobile: string;
  email: string;
  branch: string;
  kyc_status: string;
  bank_name?: string;
  ifsc_code?: string;
}

export interface DbActivityLog {
  id: string;
  user_id: string;
  user_name: string;
  action_type: string;
  system: string;
  customer_id: string | null;
  customer_name: string | null;
  timestamp: string;
  ip: string;
  metadata: Record<string, unknown>;
}

export interface DbAlert {
  id: string;
  user_id: string;
  user_name: string;
  role: string;
  department: string;
  system: string;
  triggered_rules: Array<{ ruleId: string; description: string; score: number }>;
  total_score: number;
  severity: string;
  scam_type: string;
  confidence: string;
  explanation: string;
  recommended_action: string;
  timestamp: string;
  status: string;
}

export interface DbSession {
  user_id: string;
  ip: string;
  login_time: string;
  risk_score: number;
  triggered_rule_ids: string[];
  dormant_accounts_accessed: string[];
  transaction_count: number;
  report_count: number;
  accessed_customers: string[];
  contact_modifications: Array<{ customerId: string; timestamp: string; fields: string[] }>;
  otp_triggers: Array<{ customerId: string; timestamp: string }>;
  transactions: Array<{ customerId: string; amount: number; timestamp: string; beneficiary: string }>;
  is_off_hours: boolean;
  is_weekend: boolean;
  failed_login_attempts: number;
  updated_at: string;
  loan_forward_count: number;
  loan_approval_count: number;
  loan_actions: Array<{ type: string; loanId: string; amount: number; kycStatus?: string; salary?: number; timestamp: string }>;
}

export interface DbRiskHistory {
  id: number;
  user_id: string;
  timestamp: string;
  score: number;
}

export interface DbContactChangeRequest {
  id: string;
  customer_id: string;
  requested_mobile: string | null;
  requested_email: string | null;
  reason: string | null;
  status: string;
  requested_at: string;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
}
