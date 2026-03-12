import type { SessionData, TriggeredRule, ScamType, ConfidenceLevel, Alert, AppUser, Customer } from '@/types';
import { RULE_DEFINITIONS } from '@/constants';
import { generateAlertId, getSeverity, minutesDiff } from './utils';

export function evaluateRules(session: SessionData, customers: Customer[]): { 
  triggeredRules: TriggeredRule[]; 
  totalScore: number; 
} {
  const triggered: TriggeredRule[] = [];
  const addRule = (id: string) => {
    if (!session.triggeredRuleIds.includes(id)) {
      const def = RULE_DEFINITIONS[id];
      if (def) {
        triggered.push({ ruleId: id, description: def.description, score: def.score });
      }
    }
  };

  // Category 1 — Off-Hours
  if (session.isOffHours) addRule('R001');
  if (session.isWeekend) addRule('R002');
  if (session.failedLoginAttempts >= 3) addRule('R004');

  // Category 2 — Dormant
  const dormantAccessed = session.dormantAccountsAccessed.length;
  if (dormantAccessed >= 1) {
    addRule('R010');
    addRule('R011'); // No service request (simulated — always true)
  }
  if (dormantAccessed >= 3) addRule('R015');
  if (dormantAccessed >= 5) addRule('R016');

  // Check contact modifications on dormant accounts
  const dormantMods = session.contactModifications.filter(m => {
    const cust = customers.find(c => c.id === m.customerId);
    return cust?.accountStatus === 'Dormant';
  });

  const hasMobileMod = dormantMods.some(m => m.fields.includes('mobile'));
  const hasEmailMod = dormantMods.some(m => m.fields.includes('email'));
  if (hasMobileMod) addRule('R012');
  if (hasEmailMod) addRule('R013');
  if (hasMobileMod && hasEmailMod) addRule('R014');

  // R017 — OTP within 10 min of contact modification on dormant
  for (const otp of session.otpTriggers) {
    const cust = customers.find(c => c.id === otp.customerId);
    if (cust?.accountStatus === 'Dormant') {
      const recentMod = dormantMods.find(m => 
        m.customerId === otp.customerId && 
        minutesDiff(m.timestamp, otp.timestamp) <= 10
      );
      if (recentMod) {
        addRule('R017');
        break;
      }
    }
  }

  // R018 — Transaction on dormant within 30 min of contact update
  for (const tx of session.transactions) {
    const cust = customers.find(c => c.id === tx.customerId);
    if (cust?.accountStatus === 'Dormant') {
      const recentMod = dormantMods.find(m =>
        m.customerId === tx.customerId &&
        minutesDiff(m.timestamp, tx.timestamp) <= 30
      );
      if (recentMod) {
        addRule('R018');
        break;
      }
    }
  }

  // Category 3 — Data Exfiltration
  if (session.reportCount >= 3) addRule('R025');

  // Category 5 — Loan Fraud (Officer & Manager rules)
  if ((session.loanForwardCount ?? 0) >= 3) addRule('R055');
  if ((session.loanApprovalCount ?? 0) >= 3) addRule('R057');
  // R056 — forwarded with unverified KYC
  if ((session.loanActions ?? []).some(a => a.type === 'forward' && a.kycStatus && a.kycStatus !== 'Verified')) addRule('R056');
  // R058 — high-value loan approved within 10 min of forwarding
  const recentHighValueApproval = (session.loanActions ?? []).some(a => {
    if (a.type === 'approve' && a.amount > 1000000) {
      const forwardAction = (session.loanActions ?? []).find(f => f.type === 'forward' && f.loanId === a.loanId);
      if (forwardAction) {
        const minutesBetween = (new Date(a.timestamp).getTime() - new Date(forwardAction.timestamp).getTime()) / 60000;
        return minutesBetween < 10;
      }
    }
    return false;
  });
  if (recentHighValueApproval) addRule('R058');
  // R059 — loan forwarded exceeding salary × 60 eligibility
  if ((session.loanActions ?? []).some(a => a.type === 'forward' && a.salary && a.salary > 0 && a.amount > a.salary * 60)) addRule('R059');

  // Category 4 — Transactions
  if (session.transactionCount > 10) addRule('R030');
  if (session.transactionCount > 20) addRule('R031');
  if (session.transactionCount > 50) addRule('R037');

  for (const tx of session.transactions) {
    if (tx.amount > 5000000) addRule('R033');
    else if (tx.amount > 1000000) addRule('R032');
  }

  // Category 6 — Unauthorized Modification
  // These are injected directly via extraRules from logAction
  // (R070, R071, R072, R073) — no additional session checks needed here

  // Calculate base score from triggered rules
  const allTriggeredIds = [
    ...session.triggeredRuleIds,
    ...triggered.map(r => r.ruleId),
  ];

  const allTriggered = [
    ...triggered,
    ...session.triggeredRuleIds
      .filter(id => RULE_DEFINITIONS[id])
      .map(id => ({ ruleId: id, description: RULE_DEFINITIONS[id].description, score: RULE_DEFINITIONS[id].score })),
  ];

  // R019 — Full drain chain
  const hasR010 = allTriggeredIds.includes('R010');
  const hasR014 = allTriggeredIds.includes('R014');
  const hasR017 = allTriggeredIds.includes('R017');
  const hasR018 = allTriggeredIds.includes('R018');
  if (hasR010 && hasR014 && hasR017 && hasR018) {
    if (!allTriggeredIds.includes('R019')) {
      triggered.push({ ruleId: 'R019', description: RULE_DEFINITIONS['R019'].description, score: 0 });
    }
  }

  // Calculate score with multipliers
  let dormantScore = 0;
  let exfilScore = 0;
  let txScore = 0;
  let otherScore = 0;

  for (const r of allTriggered) {
    const cat = RULE_DEFINITIONS[r.ruleId]?.category || '';
    if (cat === 'Dormant Account Fraud') dormantScore += r.score;
    else if (cat === 'Data Exfiltration') exfilScore += r.score;
    else if (cat === 'Unusual Transactions' || cat === 'Collusion') txScore += r.score;
    else otherScore += r.score;
  }

  // Apply multipliers
  const hasR001 = allTriggeredIds.includes('R001') || triggered.some(r => r.ruleId === 'R001');
  const hasExfil = allTriggeredIds.some(id => ['R020','R021','R022','R023','R024','R025','R026','R027'].includes(id));
  const hasDormant = allTriggeredIds.includes('R010') || triggered.some(r => r.ruleId === 'R010');
  const hasR060 = allTriggeredIds.includes('R060');
  const hasR033 = allTriggeredIds.includes('R033') || triggered.some(r => r.ruleId === 'R033');

  if (hasR001 && hasExfil) exfilScore = Math.round(exfilScore * 1.5);
  if (hasDormant && hasR001) dormantScore = Math.round(dormantScore * 1.4);
  if (hasR060 && hasR033) txScore = Math.round(txScore * 1.6);

  // R019 sets score to 100
  const hasR019 = allTriggeredIds.includes('R019') || triggered.some(r => r.ruleId === 'R019');
  let totalScore = hasR019 ? 100 : Math.min(100, dormantScore + exfilScore + txScore + otherScore);

  // Deduplicate triggered rules
  const seen = new Set<string>();
  const uniqueTriggered = triggered.filter(r => {
    if (seen.has(r.ruleId)) return false;
    seen.add(r.ruleId);
    return true;
  });

  return { triggeredRules: uniqueTriggered, totalScore };
}

export function predictScamType(allRuleIds: string[]): { scamType: ScamType; confidence: ConfidenceLevel } {
  const has = (id: string) => allRuleIds.includes(id);

  // Check each scam pattern
  const patterns: { type: ScamType; rules: string[][]; }[] = [
    {
      type: 'Full Drain Sequence',
      rules: [['R019']],
    },
    {
      type: 'Dormant Account Draining',
      rules: [['R010', 'R011'], ['R012', 'R013'], ['R017', 'R018']],
    },
    {
      type: 'Data Exfiltration for Sale',
      rules: [['R021', 'R022'], ['R023', 'R024'], ['R027']],
    },
    {
      type: 'Salami Slicing',
      rules: [['R037'], ['R030', 'R031']],
    },
    {
      type: 'Loan Fraud',
      rules: [['R050'], ['R051', 'R052'], ['R055', 'R056'], ['R057', 'R058', 'R059']],
    },
    {
      type: 'Collusion Fraud',
      rules: [['R060'], ['R062', 'R063']],
    },
    {
      type: 'Privilege Escalation',
      rules: [['R041'], ['R040']],
    },
    {
      type: 'Unauthorized Contact Modification',
      rules: [['R070'], ['R071', 'R072'], ['R073']],
    },
    {
      type: 'Maker-Checker Collusion',
      rules: [['R063','R090'], ['R060','R093'], ['R094'], ['R095','R096'], ['R097']],
    },
    {
      type: 'Maker-Checker Bypass',
      rules: [['R080'], ['R081'], ['R082'], ['R083']],
    },
    {
      type: 'After-Hours Exfiltration',
      rules: [['R001'], ['R020', 'R021'], ['R026']],
    },
  ];

  for (const p of patterns) {
    const matchedGroups = p.rules.filter(group => group.some(r => has(r)));
    if (p.type === 'Full Drain Sequence' && matchedGroups.length >= 1) {
      return { scamType: p.type, confidence: 'HIGH' };
    }
    if (matchedGroups.length >= 3) return { scamType: p.type, confidence: 'HIGH' };
    if (matchedGroups.length === 2) return { scamType: p.type, confidence: 'MEDIUM' };
    if (matchedGroups.length === 1) return { scamType: p.type, confidence: 'LOW' };
  }

  return { scamType: 'General Suspicious Activity', confidence: 'LOW' };
}

export function generateExplanation(
  user: AppUser,
  session: SessionData,
  triggeredRules: TriggeredRule[],
  customers: Customer[]
): string {
  const parts: string[] = [];
  const allIds = [...session.triggeredRuleIds, ...triggeredRules.map(r => r.ruleId)];
  const has = (id: string) => allIds.includes(id);

  if (has('R001')) parts.push('logged in during off-hours');
  if (has('R002')) parts.push('logged in on a weekend');
  if (has('R003')) parts.push('accessed from an unrecognised IP address');
  if (has('R004')) parts.push(`had ${session.failedLoginAttempts} failed login attempts`);

  if (session.dormantAccountsAccessed.length > 0) {
    const names = session.dormantAccountsAccessed
      .slice(0, 3)
      .map(id => {
        const c = customers.find(cu => cu.id === id);
        return c ? `${id} (${c.fullName})` : id;
      })
      .join(', ');
    parts.push(`accessed ${session.dormantAccountsAccessed.length} dormant account(s) — ${names}`);
  }

  if (has('R012')) parts.push('modified the mobile number on a dormant account');
  if (has('R013')) parts.push('modified the email address on a dormant account');
  if (has('R014')) parts.push('changed both mobile and email on a dormant account in the same session');
  if (has('R017')) parts.push('triggered OTP within 10 minutes of contact modification');
  if (has('R018')) {
    const dormantTx = session.transactions.find(tx => {
      const c = customers.find(cu => cu.id === tx.customerId);
      return c?.accountStatus === 'Dormant';
    });
    if (dormantTx) {
      parts.push(`initiated a ₹${dormantTx.amount.toLocaleString('en-IN')} transaction on a dormant account within 30 minutes of contact update`);
    }
  }
  if (has('R019')) parts.push('completed the full dormant account drain chain (R010 → R014 → R017 → R018)');

  if (session.reportCount >= 3) parts.push(`ran ${session.reportCount} reports in one session`);
  if (session.transactionCount > 10) parts.push(`performed ${session.transactionCount} transactions in one session`);

  if (has('R050')) parts.push('originated and approved a loan as the same officer');
  if (has('R051')) parts.push('approved a loan with an incomplete KYC checklist');
  if (has('R055')) parts.push(`forwarded ${session.loanForwardCount} loan applications in one session (bulk forwarding)`);
  if (has('R056')) parts.push('forwarded a loan application for a customer with unverified KYC');
  if (has('R057')) parts.push(`approved ${session.loanApprovalCount} loan applications in one session (bulk approval)`);
  if (has('R058')) parts.push('approved a high-value loan (>₹10L) within 10 minutes of it being forwarded');
  if (has('R059')) parts.push('forwarded a loan application where the amount exceeds the applicant\'s salary eligibility (salary × 60)');

  if (has('R070')) parts.push('modified customer contact details without a verified customer change request');
  if (has('R071')) parts.push('changed mobile number on a Dormant account without any approved customer request');
  if (has('R072')) parts.push('changed email on a Dormant account without any approved customer request');
  if (has('R073')) parts.push('changed both mobile and email without any approved customer request on file');

  if (has('R080')) parts.push('approved a loan they personally forwarded — bypassing the maker-checker control (R080: Maker = Checker)');
  if (has('R081')) parts.push('is part of a confirmed collusion ring — the same Loan Officer → Branch Manager pair has approved 3 or more loans together (R081)');
  if (has('R082')) parts.push('approved 3 or more loans this session without any review remarks — pattern consistent with rubber-stamp fraud (R082)');
  if (has('R083')) parts.push('attempted to self-approve a loan they originated as Loan Officer, violating cross-role separation of duties (R083)');

  // Maker-Checker Collusion rules
  if (has('R060')) parts.push('is part of a maker-checker pair that has collaborated more than 10 times this month (R060: frequency threshold exceeded)');
  if (has('R062')) parts.push('approved a transaction within 2 minutes of initiation — insufficient review time suggests pre-coordination (R062)');
  if (has('R063')) parts.push('the Maker and Checker share the same IP address — possible same terminal or session hijack (R063)');
  if (has('R090')) parts.push('the Maker and Checker are using the same device fingerprint simultaneously — device sharing or cloning detected (R090)');
  if (has('R091')) parts.push('a transaction was approved on a bank holiday or weekend — off-schedule approval bypasses normal oversight (R091)');
  if (has('R092')) parts.push('a transaction was initiated in the final 10 minutes before system closure — end-of-day blind spot exploitation (R092)');
  if (has('R093')) parts.push('the same maker-checker pair jointly approved over ₹50 lakh in transactions this month — volume threshold exceeded (R093)');
  if (has('R094')) parts.push('the Maker and Checker share the same registered home address — familial or residential collusion suspected (R094)');
  if (has('R095')) parts.push('the Checker has a 0% rejection rate for this Maker — never rejected a single transaction, suggesting rubber-stamp collusion (R095)');
  if (has('R096')) parts.push('the Maker routes 100% of their transactions exclusively to this single Checker — exclusive routing pattern detected (R096)');
  if (has('R097')) parts.push('both the Maker and Checker are logged in simultaneously from outside bank-registered premises (R097)');

  if (parts.length === 0) parts.push('performed multiple suspicious actions triggering risk rules');

  const timeRef = session.isOffHours ? ' — all within an off-hours session' 
    : session.isWeekend ? ' — all within a weekend session' 
    : '';

  return `${user.fullName} (${user.role}, ${user.department}) ${parts.join(', ')}${timeRef}.`;
}

export function getRecommendedAction(score: number): string {
  if (score < 30) return 'Watch';
  if (score < 50) return 'Investigate';
  if (score < 75) return 'Suspend Session';
  if (score < 90) return 'Escalate to Compliance';
  return 'Terminate Access';
}

export function buildAlert(
  user: AppUser,
  session: SessionData,
  newRules: TriggeredRule[],
  totalScore: number,
  customers: Customer[]
): Alert {
  const allRuleIds = [...session.triggeredRuleIds, ...newRules.map(r => r.ruleId)];
  const allRules = [
    ...newRules,
    ...session.triggeredRuleIds
      .filter(id => RULE_DEFINITIONS[id])
      .map(id => ({ ruleId: id, description: RULE_DEFINITIONS[id].description, score: RULE_DEFINITIONS[id].score })),
  ];
  const seen = new Set<string>();
  const uniqueRules = allRules.filter(r => {
    if (seen.has(r.ruleId)) return false;
    seen.add(r.ruleId);
    return true;
  });

  const { scamType, confidence } = predictScamType(allRuleIds);
  const explanation = generateExplanation(user, session, newRules, customers);
  const severity = getSeverity(totalScore);

  return {
    id: generateAlertId(),
    userId: user.id,
    userName: user.fullName,
    role: user.role,
    department: user.department,
    system: user.systemAccess,
    triggeredRules: uniqueRules,
    totalScore,
    severity,
    scamType,
    confidence,
    explanation,
    recommendedAction: getRecommendedAction(totalScore),
    timestamp: new Date().toISOString(),
    status: 'open',
  };
}
