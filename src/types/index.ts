export type Role =
  | 'Teller'
  | 'Loan Officer'
  | 'Treasury Analyst'
  | 'DB Administrator'
  | 'Branch Manager'
  | 'IT Admin'
  | 'Compliance Officer'
  | 'Trade Finance Analyst';

export type SystemAccess =
  | 'Core Banking'
  | 'Treasury'
  | 'Loan Origination'
  | 'Customer Database'
  | 'All Systems';

export type UserStatus = 'active' | 'suspended' | 'deactivated';

export interface AppUser {
  id: string;
  loginId: string;
  password: string;
  fullName: string;
  role: Role;
  department: string;
  systemAccess: SystemAccess;
  isAdmin: boolean;
  status: UserStatus;
  createdAt: string;
}

export type AccountType = 'Savings' | 'Current' | 'Fixed Deposit';
export type AccountStatus = 'Active' | 'Inactive' | 'Dormant';
export type KYCStatus = 'Verified' | 'Pending' | 'Expired';

export interface Customer {
  id: string;
  fullName: string;
  aadhaar: string;
  pan: string;
  accountNumber: string;
  accountType: AccountType;
  balance: number;
  accountStatus: AccountStatus;
  lastTransactionDate: string;
  dateOpened: string;
  mobile: string;
  email: string;
  branch: string;
  kycStatus: KYCStatus;
  bankName: string;
  ifscCode: string;
}

export type ActionType =
  | 'LOGIN'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'VIEW_ACCOUNT'
  | 'MODIFY_CONTACT'
  | 'INITIATE_TRANSACTION'
  | 'INITIATE_TRANSFER'
  | 'APPROVE_TRANSACTION'
  | 'RUN_REPORT'
  | 'TRIGGER_OTP'
  | 'APPROVE_LOAN'
  | 'CREATE_USER'
  | 'EDIT_USER'
  | 'DEACTIVATE_USER'
  | 'PROMOTE_USER'
  | 'VIEW_AUDIT_LOG'
  | 'DELETE_AUDIT_LOG_ATTEMPT'
  | 'APPLY_CONTACT_CHANGE'
  | 'REJECT_CONTACT_CHANGE';

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  actionType: ActionType;
  system: string;
  customerId?: string;
  customerName?: string;
  timestamp: string;
  ip: string;
  metadata: Record<string, unknown>;
}

export type Severity = 'Low' | 'Medium' | 'High' | 'Critical' | 'Severe';

export interface TriggeredRule {
  ruleId: string;
  description: string;
  score: number;
}

export type ScamType =
  | 'Dormant Account Draining'
  | 'Full Drain Sequence'
  | 'Data Exfiltration for Sale'
  | 'Salami Slicing'
  | 'Loan Fraud'
  | 'Collusion Fraud'
  | 'Privilege Escalation'
  | 'After-Hours Exfiltration'
  | 'Unauthorized Contact Modification'
  | 'Maker-Checker Bypass'
  | 'Maker-Checker Collusion'
  | 'Mule Account'
  | 'Behavioral Anomaly'
  | 'General Suspicious Activity';

export type ConfidenceLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type AlertStatus = 'open' | 'escalated' | 'closed' | 'false_positive';

export interface Alert {
  id: string;
  userId: string;
  userName: string;
  role: string;
  department: string;
  system: string;
  triggeredRules: TriggeredRule[];
  totalScore: number;
  severity: Severity;
  scamType: ScamType;
  confidence: ConfidenceLevel;
  explanation: string;
  recommendedAction: string;
  timestamp: string;
  status: AlertStatus;
}

export interface SessionData {
  userId: string;
  ip: string;
  loginTime: string;
  riskScore: number;
  triggeredRuleIds: string[];
  dormantAccountsAccessed: string[];
  transactionCount: number;
  reportCount: number;
  accessedCustomers: string[];
  contactModifications: { customerId: string; timestamp: string; fields: string[] }[];
  otpTriggers: { customerId: string; timestamp: string }[];
  transactions: { customerId: string; amount: number; timestamp: string; beneficiary: string }[];
  isOffHours: boolean;
  isWeekend: boolean;
  failedLoginAttempts: number;
  loanForwardCount: number;
  loanApprovalCount: number;
  loanActions: Array<{ type: string; loanId: string; amount: number; kycStatus?: string; salary?: number; timestamp: string }>;
  // Maker-Checker tracking
  transactionApprovalCount: number;
  makerCheckerActions: Array<{
    txId: string;
    makerId: string;
    makerName: string;
    makerIp: string;
    makerDevice: string;
    checkerId?: string;
    checkerName?: string;
    checkerIp?: string;
    checkerDevice?: string;
    amount: number;
    initiatedAt: string;
    approvedAt?: string;
    status: 'pending' | 'approved' | 'rejected';
    customerId: string;
    beneficiary: string;
    isOffPremises?: boolean;
  }>;
}

export interface RiskHistory {
  userId: string;
  timestamp: string;
  score: number;
}
