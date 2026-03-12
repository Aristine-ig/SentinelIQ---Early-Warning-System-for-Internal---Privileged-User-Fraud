export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';
export type AlertStatus = 'open' | 'investigating' | 'resolved' | 'false_positive';
export type CaseStatus = 'open' | 'in_progress' | 'escalated' | 'closed';
export type UserRole = 'admin' | 'trader' | 'loan_officer' | 'teller' | 'it_staff' | 'auditor' | 'manager';
export type SystemType = 'core_banking' | 'treasury' | 'loan_origination' | 'customer_db' | 'active_directory' | 'swift';
export type AnomalyType =
  | 'off_hours_access'
  | 'bulk_data_download'
  | 'privilege_escalation'
  | 'unusual_transaction'
  | 'multiple_failed_auth'
  | 'unauthorized_modification'
  | 'geo_anomaly'
  | 'data_exfiltration'
  | 'dormant_account_access'
  | 'velocity_breach';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  riskScore: number;
  riskLevel: RiskLevel;
  lastActivity: string;
  baselineEstablished: boolean;
  alertCount: number;
  openCases: number;
  joinDate: string;
  avatar: string;
  privilegeLevel: number;
  systems: SystemType[];
}

export interface Alert {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  department: string;
  riskScore: number;
  riskLevel: RiskLevel;
  anomalyType: AnomalyType;
  title: string;
  description: string;
  aiExplanation: string;
  system: SystemType;
  timestamp: string;
  status: AlertStatus;
  ipAddress: string;
  location: string;
  affectedRecords?: number;
  transactionAmount?: number;
  assignedTo?: string;
  tags: string[];
}

export interface ActivityEvent {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  system: SystemType;
  timestamp: string;
  ipAddress: string;
  location: string;
  riskScore: number;
  anomalyFlag: boolean;
  anomalyType?: AnomalyType;
  details: string;
}

export interface BehaviorDataPoint {
  hour: number;
  baseline: number;
  actual: number;
  anomaly: boolean;
}

export interface RiskTrendPoint {
  date: string;
  score: number;
  alerts: number;
}

export interface SystemStats {
  system: SystemType;
  label: string;
  alertCount: number;
  riskScore: number;
  monitoredUsers: number;
}

export interface DashboardMetrics {
  totalAlerts: number;
  criticalAlerts: number;
  openCases: number;
  monitoredUsers: number;
  avgRiskScore: number;
  alertsToday: number;
  resolvedToday: number;
  falsePositiveRate: number;
}

export interface Case {
  id: string;
  alertIds: string[];
  userId: string;
  userName: string;
  title: string;
  description: string;
  status: CaseStatus;
  priority: RiskLevel;
  assignedTo: string;
  createdAt: string;
  updatedAt: string;
  notes: string[];
  estimatedLoss?: number;
  confirmed: boolean;
}
