import type {
  User, Alert, ActivityEvent, BehaviorDataPoint,
  RiskTrendPoint, SystemStats, DashboardMetrics, Case
} from '@/types';

export const MOCK_USERS: User[] = [
  {
    id: 'u001',
    name: 'James Thornton',
    email: 'j.thornton@bank.internal',
    role: 'trader',
    department: 'Treasury Trading',
    riskScore: 94,
    riskLevel: 'critical',
    lastActivity: '2026-03-07T02:43:00Z',
    baselineEstablished: true,
    alertCount: 12,
    openCases: 2,
    joinDate: '2021-03-15',
    avatar: 'JT',
    privilegeLevel: 3,
    systems: ['treasury', 'core_banking', 'swift'],
  },
  {
    id: 'u002',
    name: 'Priya Mehta',
    email: 'p.mehta@bank.internal',
    role: 'it_staff',
    department: 'IT Infrastructure',
    riskScore: 81,
    riskLevel: 'high',
    lastActivity: '2026-03-06T23:15:00Z',
    baselineEstablished: true,
    alertCount: 7,
    openCases: 1,
    joinDate: '2019-08-20',
    avatar: 'PM',
    privilegeLevel: 5,
    systems: ['active_directory', 'core_banking', 'customer_db'],
  },
  {
    id: 'u003',
    name: 'Robert Ashby',
    email: 'r.ashby@bank.internal',
    role: 'loan_officer',
    department: 'Retail Lending',
    riskScore: 67,
    riskLevel: 'medium',
    lastActivity: '2026-03-07T08:22:00Z',
    baselineEstablished: true,
    alertCount: 4,
    openCases: 1,
    joinDate: '2020-11-10',
    avatar: 'RA',
    privilegeLevel: 2,
    systems: ['loan_origination', 'core_banking', 'customer_db'],
  },
  {
    id: 'u004',
    name: 'Fatima Al-Rashid',
    email: 'f.alrashid@bank.internal',
    role: 'admin',
    department: 'System Administration',
    riskScore: 88,
    riskLevel: 'high',
    lastActivity: '2026-03-07T01:08:00Z',
    baselineEstablished: true,
    alertCount: 9,
    openCases: 1,
    joinDate: '2018-05-01',
    avatar: 'FA',
    privilegeLevel: 5,
    systems: ['core_banking', 'active_directory', 'customer_db', 'loan_origination'],
  },
  {
    id: 'u005',
    name: 'Marcus Chen',
    email: 'm.chen@bank.internal',
    role: 'teller',
    department: 'Branch Operations',
    riskScore: 42,
    riskLevel: 'medium',
    lastActivity: '2026-03-07T09:05:00Z',
    baselineEstablished: true,
    alertCount: 2,
    openCases: 0,
    joinDate: '2022-07-18',
    avatar: 'MC',
    privilegeLevel: 1,
    systems: ['core_banking'],
  },
  {
    id: 'u006',
    name: 'Sarah Kowalski',
    email: 's.kowalski@bank.internal',
    role: 'auditor',
    department: 'Internal Audit',
    riskScore: 18,
    riskLevel: 'low',
    lastActivity: '2026-03-07T08:45:00Z',
    baselineEstablished: true,
    alertCount: 0,
    openCases: 0,
    joinDate: '2020-02-12',
    avatar: 'SK',
    privilegeLevel: 2,
    systems: ['core_banking', 'loan_origination', 'treasury'],
  },
  {
    id: 'u007',
    name: 'Daniel Okonkwo',
    email: 'd.okonkwo@bank.internal',
    role: 'manager',
    department: 'Commercial Banking',
    riskScore: 55,
    riskLevel: 'medium',
    lastActivity: '2026-03-07T07:30:00Z',
    baselineEstablished: false,
    alertCount: 3,
    openCases: 0,
    joinDate: '2025-11-01',
    avatar: 'DO',
    privilegeLevel: 3,
    systems: ['core_banking', 'loan_origination', 'customer_db'],
  },
];

export const MOCK_ALERTS: Alert[] = [
  {
    id: 'a001',
    userId: 'u001',
    userName: 'James Thornton',
    userRole: 'trader',
    department: 'Treasury Trading',
    riskScore: 97,
    riskLevel: 'critical',
    anomalyType: 'off_hours_access',
    title: 'Off-Hours SWIFT Access with Unauthorized Transaction',
    description: 'User accessed SWIFT messaging system at 02:43 AM and initiated a wire transfer of $4.2M to an unverified correspondent bank account outside normal trading hours.',
    aiExplanation: 'Behavioral baseline shows 99.2% of this user\'s SWIFT activity occurs between 07:00–18:00. The access pattern at 02:43 AM deviates 3.8σ from baseline. Combined with an unverified beneficiary and unusually large single transaction (top 0.1% of user\'s historical volume), the ML ensemble assigns a critical fraud probability of 97%.',
    system: 'swift',
    timestamp: '2026-03-07T02:43:00Z',
    status: 'open',
    ipAddress: '10.14.52.88',
    location: 'Trading Floor — Workstation TF-024',
    transactionAmount: 4200000,
    tags: ['off-hours', 'swift', 'wire-transfer', 'unverified-beneficiary'],
  },
  {
    id: 'a002',
    userId: 'u002',
    userName: 'Priya Mehta',
    userRole: 'it_staff',
    department: 'IT Infrastructure',
    riskScore: 89,
    riskLevel: 'high',
    anomalyType: 'bulk_data_download',
    title: 'Mass Customer PII Export — 47,000 Records',
    description: 'IT staff member executed 14 sequential database queries extracting full customer PII records including SSNs, account numbers, and contact details. Total of 47,382 records exported to external USB device.',
    aiExplanation: 'User\'s largest prior data export was 312 records. This event is a 151x deviation from the 30-day moving average export volume. The sequential query pattern (14 queries in 8 minutes) matches known data exfiltration signatures in the ML training set. USB device fingerprint is unregistered in the asset registry.',
    system: 'customer_db',
    timestamp: '2026-03-06T23:15:00Z',
    status: 'investigating',
    ipAddress: '10.22.17.43',
    location: 'Data Center — Server Room 2B',
    affectedRecords: 47382,
    assignedTo: 'Chen Wei (Lead Investigator)',
    tags: ['data-exfiltration', 'pii', 'bulk-export', 'usb-device'],
  },
  {
    id: 'a003',
    userId: 'u004',
    userName: 'Fatima Al-Rashid',
    userRole: 'admin',
    department: 'System Administration',
    riskScore: 84,
    riskLevel: 'high',
    anomalyType: 'privilege_escalation',
    title: 'Unauthorized Privilege Escalation in Active Directory',
    description: 'System admin elevated 3 user accounts to Domain Admin level without corresponding change request tickets. Affected accounts are not in IT management roles.',
    aiExplanation: 'Historical pattern shows all prior privilege changes by this user are accompanied by linked JIRA tickets (100% compliance over 847 events). This event has no associated ticket and affects non-IT personnel. The timing (01:08 AM) falls in the top 0.5% of off-hours activity for this user. Cross-correlating with recent terminated employee records shows one of the elevated accounts belongs to an employee who resigned 3 weeks ago.',
    system: 'active_directory',
    timestamp: '2026-03-07T01:08:00Z',
    status: 'open',
    ipAddress: '10.5.1.200',
    location: 'Remote VPN — Home Network (ISP: Comcast)',
    affectedRecords: 3,
    tags: ['privilege-escalation', 'active-directory', 'off-hours', 'no-ticket', 'terminated-user'],
  },
  {
    id: 'a004',
    userId: 'u003',
    userName: 'Robert Ashby',
    userRole: 'loan_officer',
    department: 'Retail Lending',
    riskScore: 72,
    riskLevel: 'high',
    anomalyType: 'unauthorized_modification',
    title: 'Unauthorized Loan Approval — Relationship Override',
    description: 'Loan officer approved a $380,000 mortgage application that failed automated credit scoring, manually overriding risk flags. Applicant shares surname with user and is located at same residential address.',
    aiExplanation: 'Manual override rate for this user is 2.1% historically. This override involved a failed credit score, debt-to-income ratio breach, and employment verification gap — three simultaneous triggers. Graph analysis identifies a possible family relationship between the user and applicant. Comparable cases in the training data have a 78% confirmed fraud rate.',
    system: 'loan_origination',
    timestamp: '2026-03-07T08:22:00Z',
    status: 'open',
    ipAddress: '10.31.14.55',
    location: 'Branch Office — Desk L-204',
    transactionAmount: 380000,
    affectedRecords: 1,
    tags: ['loan-fraud', 'self-dealing', 'manual-override', 'relationship-flag'],
  },
  {
    id: 'a005',
    userId: 'u001',
    userName: 'James Thornton',
    userRole: 'trader',
    department: 'Treasury Trading',
    riskScore: 78,
    riskLevel: 'high',
    anomalyType: 'velocity_breach',
    title: 'Transaction Velocity Anomaly — 340% Above Daily Limit',
    description: 'Trader executed 47 FX transactions totaling $18.7M within 90 minutes, exceeding the approved daily risk limit of $5M by 340%.',
    aiExplanation: 'The transaction count (47 in 90 min) is 8.2x the user\'s median daily count. Total notional value exceeds the desk\'s approved risk limit. Trades were executed across 6 different currency pairs simultaneously — a pattern not observed in 14 months of baseline data. No pre-trade approval was obtained for limit breach as required by policy.',
    system: 'treasury',
    timestamp: '2026-03-06T14:22:00Z',
    status: 'resolved',
    ipAddress: '10.14.52.88',
    location: 'Trading Floor — Workstation TF-024',
    transactionAmount: 18700000,
    tags: ['velocity-breach', 'fx-trading', 'limit-breach', 'treasury'],
  },
  {
    id: 'a006',
    userId: 'u002',
    userName: 'Priya Mehta',
    userRole: 'it_staff',
    department: 'IT Infrastructure',
    riskScore: 61,
    riskLevel: 'medium',
    anomalyType: 'multiple_failed_auth',
    title: 'Repeated Authentication Failures on Production Core Banking',
    description: '23 failed authentication attempts on core banking production database root account over 4 minutes, followed by successful login from the same workstation.',
    aiExplanation: 'Failed auth attempts on production DB accounts are a known precursor to credential theft attacks. The immediate successful login after failure pattern suggests a password-cracking tool was used. The root account targeted has elevated privileges beyond this user\'s normal operational scope.',
    system: 'core_banking',
    timestamp: '2026-03-05T22:08:00Z',
    status: 'false_positive',
    ipAddress: '10.22.17.43',
    location: 'Data Center — Server Room 2B',
    tags: ['auth-failure', 'brute-force', 'core-banking', 'root-account'],
  },
  {
    id: 'a007',
    userId: 'u007',
    userName: 'Daniel Okonkwo',
    userRole: 'manager',
    department: 'Commercial Banking',
    riskScore: 55,
    riskLevel: 'medium',
    anomalyType: 'dormant_account_access',
    title: 'Access to Dormant High-Value Accounts',
    description: 'Commercial banking manager accessed 12 dormant accounts (inactive 2+ years) with aggregate balance of $7.4M within a single session.',
    aiExplanation: 'New user with baseline established only 4 months ago. Dormant high-value account access without a corresponding customer service request or compliance review is atypical. The peer group (commercial managers) accesses dormant accounts at a rate of 0.3 per month on average; this session accessed 12. Elevated monitoring recommended pending baseline maturation.',
    system: 'core_banking',
    timestamp: '2026-03-07T07:30:00Z',
    status: 'open',
    ipAddress: '10.9.33.12',
    location: 'Commercial Banking Floor — Desk CB-118',
    affectedRecords: 12,
    tags: ['dormant-accounts', 'high-value', 'new-employee', 'baseline-incomplete'],
  },
];

export const MOCK_ACTIVITIES: ActivityEvent[] = [
  { id: 'ev001', userId: 'u001', userName: 'James Thornton', userRole: 'trader', action: 'SWIFT Wire Initiated', system: 'swift', timestamp: '2026-03-07T02:43:00Z', ipAddress: '10.14.52.88', location: 'TF-024', riskScore: 97, anomalyFlag: true, anomalyType: 'off_hours_access', details: 'Transfer $4.2M to account XK05-2300-0001-3502-0257 (unverified)' },
  { id: 'ev002', userId: 'u004', userName: 'Fatima Al-Rashid', userRole: 'admin', action: 'AD Group Membership Modified', system: 'active_directory', timestamp: '2026-03-07T01:08:00Z', ipAddress: '10.5.1.200', location: 'VPN-Home', riskScore: 84, anomalyFlag: true, anomalyType: 'privilege_escalation', details: 'Added user jsmith@bank.internal to Domain Admins' },
  { id: 'ev003', userId: 'u002', userName: 'Priya Mehta', userRole: 'it_staff', action: 'Database Export Executed', system: 'customer_db', timestamp: '2026-03-06T23:15:00Z', ipAddress: '10.22.17.43', location: 'ServerRoom-2B', riskScore: 89, anomalyFlag: true, anomalyType: 'bulk_data_download', details: 'SELECT * FROM customers LIMIT 50000 — exported to /dev/sdb1' },
  { id: 'ev004', userId: 'u003', userName: 'Robert Ashby', userRole: 'loan_officer', action: 'Loan Application Approved', system: 'loan_origination', timestamp: '2026-03-07T08:22:00Z', ipAddress: '10.31.14.55', location: 'Branch-L204', riskScore: 72, anomalyFlag: true, anomalyType: 'unauthorized_modification', details: 'Manual override: LN-20260307-4421 ($380K) — credit score 541 below threshold' },
  { id: 'ev005', userId: 'u007', userName: 'Daniel Okonkwo', userRole: 'manager', action: 'Account Records Accessed', system: 'core_banking', timestamp: '2026-03-07T07:30:00Z', ipAddress: '10.9.33.12', location: 'CB-118', riskScore: 55, anomalyFlag: true, anomalyType: 'dormant_account_access', details: 'Viewed 12 dormant accounts with combined balance $7.4M' },
  { id: 'ev006', userId: 'u005', userName: 'Marcus Chen', userRole: 'teller', action: 'Customer Deposit Posted', system: 'core_banking', timestamp: '2026-03-07T09:05:00Z', ipAddress: '10.44.21.7', location: 'Teller-Station-4', riskScore: 12, anomalyFlag: false, details: 'Cash deposit $1,200 — Account AC-00234891' },
  { id: 'ev007', userId: 'u006', userName: 'Sarah Kowalski', userRole: 'auditor', action: 'Audit Report Generated', system: 'core_banking', timestamp: '2026-03-07T08:45:00Z', ipAddress: '10.18.5.44', location: 'Audit-Desk-A3', riskScore: 8, anomalyFlag: false, details: 'Q1 2026 Transaction Audit Report — 4,312 records reviewed' },
  { id: 'ev008', userId: 'u001', userName: 'James Thornton', userRole: 'trader', action: 'FX Position Opened', system: 'treasury', timestamp: '2026-03-06T14:22:00Z', ipAddress: '10.14.52.88', location: 'TF-024', riskScore: 78, anomalyFlag: true, anomalyType: 'velocity_breach', details: '47 FX trades: EUR/USD, GBP/USD, USD/JPY — total notional $18.7M' },
  { id: 'ev009', userId: 'u004', userName: 'Fatima Al-Rashid', userRole: 'admin', action: 'System Configuration Changed', system: 'core_banking', timestamp: '2026-03-06T11:30:00Z', ipAddress: '10.5.1.12', location: 'Admin-Office', riskScore: 22, anomalyFlag: false, details: 'Updated session timeout policy — approved CR-2026-0412' },
  { id: 'ev010', userId: 'u002', userName: 'Priya Mehta', userRole: 'it_staff', action: 'Failed Authentication x23', system: 'core_banking', timestamp: '2026-03-05T22:08:00Z', ipAddress: '10.22.17.43', location: 'ServerRoom-2B', riskScore: 61, anomalyFlag: true, anomalyType: 'multiple_failed_auth', details: 'Root account brute-force pattern detected on CBS-PROD-01' },
];

export const BEHAVIOR_DATA: BehaviorDataPoint[] = Array.from({ length: 24 }, (_, i) => {
  const isWorkHour = i >= 7 && i <= 18;
  const baseline = isWorkHour ? Math.round(15 + Math.random() * 20) : Math.round(Math.random() * 3);
  const isAnomaly = i === 2 || i === 23;
  const actual = isAnomaly ? Math.round(baseline + 40 + Math.random() * 30) : Math.round(baseline * (0.8 + Math.random() * 0.4));
  return { hour: i, baseline, actual, anomaly: isAnomaly };
});

export const RISK_TREND: RiskTrendPoint[] = [
  { date: 'Feb 22', score: 34, alerts: 2 },
  { date: 'Feb 23', score: 41, alerts: 3 },
  { date: 'Feb 24', score: 38, alerts: 2 },
  { date: 'Feb 25', score: 45, alerts: 4 },
  { date: 'Feb 26', score: 52, alerts: 5 },
  { date: 'Feb 27', score: 48, alerts: 3 },
  { date: 'Feb 28', score: 61, alerts: 6 },
  { date: 'Mar 01', score: 58, alerts: 5 },
  { date: 'Mar 02', score: 67, alerts: 7 },
  { date: 'Mar 03', score: 72, alerts: 8 },
  { date: 'Mar 04', score: 69, alerts: 6 },
  { date: 'Mar 05', score: 78, alerts: 9 },
  { date: 'Mar 06', score: 85, alerts: 11 },
  { date: 'Mar 07', score: 91, alerts: 14 },
];

export const SYSTEM_STATS: SystemStats[] = [
  { system: 'core_banking', label: 'Core Banking', alertCount: 8, riskScore: 62, monitoredUsers: 247 },
  { system: 'treasury', label: 'Treasury', alertCount: 6, riskScore: 84, monitoredUsers: 23 },
  { system: 'swift', label: 'SWIFT', alertCount: 3, riskScore: 91, monitoredUsers: 18 },
  { system: 'customer_db', label: 'Customer DB', alertCount: 5, riskScore: 73, monitoredUsers: 89 },
  { system: 'loan_origination', label: 'Loan Origination', alertCount: 4, riskScore: 58, monitoredUsers: 64 },
  { system: 'active_directory', label: 'Active Directory', alertCount: 7, riskScore: 79, monitoredUsers: 412 },
];

export const DASHBOARD_METRICS: DashboardMetrics = {
  totalAlerts: 37,
  criticalAlerts: 4,
  openCases: 8,
  monitoredUsers: 412,
  avgRiskScore: 68,
  alertsToday: 14,
  resolvedToday: 3,
  falsePositiveRate: 12.4,
};

export const MOCK_CASES: Case[] = [
  {
    id: 'c001',
    alertIds: ['a001', 'a005'],
    userId: 'u001',
    userName: 'James Thornton',
    title: 'Treasury Trader — Suspected Rogue Trading & SWIFT Fraud',
    description: 'Pattern of limit breaches culminating in unauthorized off-hours SWIFT transfer. Cross-alert correlation indicates coordinated insider fraud.',
    status: 'escalated',
    priority: 'critical',
    assignedTo: 'Chen Wei',
    createdAt: '2026-03-06T15:00:00Z',
    updatedAt: '2026-03-07T03:00:00Z',
    notes: [
      'Mar 06 15:00 — Case opened after velocity breach alert. Assigned to Chen Wei.',
      'Mar 07 03:15 — Second alert (SWIFT off-hours) triggered. Case escalated to CISO.',
      'Mar 07 08:00 — HR and Legal notified. Account access suspended pending investigation.',
    ],
    estimatedLoss: 4200000,
    confirmed: false,
  },
  {
    id: 'c002',
    alertIds: ['a002'],
    userId: 'u002',
    userName: 'Priya Mehta',
    title: 'IT Staff — Mass Customer PII Exfiltration',
    description: 'Bulk export of 47,382 customer records to unregistered USB device after hours. Potential data breach with regulatory implications.',
    status: 'in_progress',
    priority: 'high',
    assignedTo: 'Chen Wei',
    createdAt: '2026-03-06T23:30:00Z',
    updatedAt: '2026-03-07T07:00:00Z',
    notes: [
      'Mar 06 23:30 — DLP system triggered alert. USB device quarantine initiated.',
      'Mar 07 07:00 — Digital forensics engaged. Device image captured.',
    ],
    estimatedLoss: undefined,
    confirmed: false,
  },
  {
    id: 'c003',
    alertIds: ['a003'],
    userId: 'u004',
    userName: 'Fatima Al-Rashid',
    title: 'Sysadmin — Unauthorized Privilege Escalation',
    description: 'Unauthorized Domain Admin grants including to terminated employee account. Possible credential sharing or account takeover.',
    status: 'open',
    priority: 'high',
    assignedTo: 'Unassigned',
    createdAt: '2026-03-07T01:30:00Z',
    updatedAt: '2026-03-07T01:30:00Z',
    notes: ['Mar 07 01:30 — Automated case creation from alert a003.'],
    confirmed: false,
  },
  {
    id: 'c004',
    alertIds: ['a004'],
    userId: 'u003',
    userName: 'Robert Ashby',
    title: 'Loan Officer — Self-Dealing Mortgage Approval',
    description: 'Suspicious manual override of failed mortgage application with apparent family relationship to applicant.',
    status: 'open',
    priority: 'high',
    assignedTo: 'Unassigned',
    createdAt: '2026-03-07T08:40:00Z',
    updatedAt: '2026-03-07T08:40:00Z',
    notes: ['Mar 07 08:40 — Automated case creation. Identity verification of applicant pending.'],
    estimatedLoss: 380000,
    confirmed: false,
  },
];

export const getRiskColor = (level: string): string => {
  switch (level) {
    case 'critical': return 'hsl(0, 85%, 58%)';
    case 'high': return 'hsl(25, 95%, 55%)';
    case 'medium': return 'hsl(45, 95%, 55%)';
    case 'low': return 'hsl(142, 70%, 45%)';
    default: return 'hsl(215, 20%, 55%)';
  }
};

export const getRiskBadgeClasses = (level: string): string => {
  switch (level) {
    case 'critical': return 'bg-red-500/15 text-red-400 border border-red-500/30';
    case 'high': return 'bg-orange-500/15 text-orange-400 border border-orange-500/30';
    case 'medium': return 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30';
    case 'low': return 'bg-green-500/15 text-green-400 border border-green-500/30';
    default: return 'bg-slate-500/15 text-slate-400 border border-slate-500/30';
  }
};

export const getStatusBadgeClasses = (status: string): string => {
  switch (status) {
    case 'open': return 'bg-red-500/15 text-red-400 border border-red-500/30';
    case 'investigating': return 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30';
    case 'in_progress': return 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30';
    case 'escalated': return 'bg-purple-500/15 text-purple-400 border border-purple-500/30';
    case 'resolved': return 'bg-green-500/15 text-green-400 border border-green-500/30';
    case 'closed': return 'bg-slate-500/15 text-slate-400 border border-slate-500/30';
    case 'false_positive': return 'bg-slate-500/15 text-slate-300 border border-slate-500/30';
    default: return 'bg-slate-500/15 text-slate-400 border border-slate-500/30';
  }
};

export const formatSystemLabel = (system: string): string => {
  const map: Record<string, string> = {
    core_banking: 'Core Banking',
    treasury: 'Treasury',
    swift: 'SWIFT',
    customer_db: 'Customer DB',
    loan_origination: 'Loan Origination',
    active_directory: 'Active Directory',
  };
  return map[system] || system;
};

export const formatAnomalyType = (type: string): string => {
  const map: Record<string, string> = {
    off_hours_access: 'Off-Hours Access',
    bulk_data_download: 'Bulk Data Export',
    privilege_escalation: 'Privilege Escalation',
    unusual_transaction: 'Unusual Transaction',
    multiple_failed_auth: 'Auth Failures',
    unauthorized_modification: 'Unauthorized Modification',
    geo_anomaly: 'Geo Anomaly',
    data_exfiltration: 'Data Exfiltration',
    dormant_account_access: 'Dormant Account Access',
    velocity_breach: 'Velocity Breach',
  };
  return map[type] || type;
};
