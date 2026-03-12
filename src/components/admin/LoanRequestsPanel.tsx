import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/lib/store';
import { formatCurrency, formatDateShort, cn } from '@/lib/utils';
import {
  CreditCard, Clock, CheckCircle, XCircle, ChevronRight,
  RefreshCw, User, Send, AlertTriangle, Briefcase, Info,
} from 'lucide-react';
import { toast } from 'sonner';

interface LoanRequest {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  kycStatus: string;
  loanType: string;
  amount: number;
  tenureMonths: number;
  purpose: string;
  status: string;
  emi: number | null;
  interestRate: number | null;
  createdAt: string;
  officerId: string | null;
  officerName: string | null;
  officerNotes: string | null;
  forwardedAt: string | null;
  managerId: string | null;
  managerName: string | null;
  managerNotes: string | null;
  managerReviewedAt: string | null;
  applicantSalary: number | null;
  applicantEmployment: string | null;
}

type FilterStatus = 'all' | 'pending' | 'under_review' | 'pending_approval' | 'approved' | 'rejected';

export default function LoanRequestsPanel() {
  const { state, logAction } = useApp();
  const [loans, setLoans] = useState<LoanRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [selected, setSelected] = useState<LoanRequest | null>(null);
  const [actionModal, setActionModal] = useState<{ loan: LoanRequest; type: 'forward' | 'approve' | 'reject' } | null>(null);
  const [salary, setSalary] = useState('');
  const [employment, setEmployment] = useState('');
  const [officerNotes, setOfficerNotes] = useState('');
  const [managerNotes, setManagerNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  const user = state.currentUser;
  const role = user?.role ?? '';
  const isAdmin = user?.isAdmin === true;
  const isLoanOfficer = role === 'Loan Officer';
  const isBranchManager = role === 'Branch Manager';

  const loadLoans = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('loan_applications')
      .select('*, customers(full_name, email, kyc_status)')
      .order('created_at', { ascending: false });

    if (!data) { setLoading(false); return; }

    const mapped: LoanRequest[] = data.map((r: any) => ({
      id: r.id,
      customerId: r.customer_id,
      customerName: r.customers?.full_name ?? 'Unknown',
      customerEmail: r.customers?.email ?? '',
      kycStatus: r.customers?.kyc_status ?? 'Unknown',
      loanType: r.loan_type,
      amount: r.amount,
      tenureMonths: r.tenure_months,
      purpose: r.purpose ?? '',
      status: r.status,
      emi: r.emi,
      interestRate: r.interest_rate,
      createdAt: r.created_at,
      officerId: r.officer_id,
      officerName: r.officer_name,
      officerNotes: r.officer_notes,
      forwardedAt: r.forwarded_at,
      managerId: r.manager_id,
      managerName: r.manager_name,
      managerNotes: r.manager_notes,
      managerReviewedAt: r.manager_reviewed_at,
      applicantSalary: r.applicant_salary,
      applicantEmployment: r.applicant_employment,
    }));
    setLoans(mapped);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadLoans();
    const sub = supabase
      .channel('loan-requests-panel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loan_applications' }, () => loadLoans())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [loadLoans]);

  // Filter loans based on role
  const getVisibleLoans = () => {
    let list = loans;
    // Loan officers see pending + under_review (their own) + all for admin
    // Branch managers see pending_approval + all for admin
    if (isLoanOfficer && !isAdmin) {
      list = list.filter(l =>
        l.status === 'pending' ||
        (l.status === 'under_review' && (l.officerId === user?.id || !l.officerId))
      );
    } else if (isBranchManager && !isAdmin) {
      list = list.filter(l => l.status === 'pending_approval');
    }
    if (filter !== 'all') list = list.filter(l => l.status === filter);
    return list;
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      pending: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      under_review: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
      pending_approval: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
      approved: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      rejected: 'bg-red-500/15 text-red-300 border-red-500/30',
      disbursed: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    };
    return map[s] || 'bg-slate-500/15 text-slate-300 border-slate-500/30';
  };

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      pending: 'Pending Review',
      under_review: 'Under Review',
      pending_approval: 'Awaiting Approval',
      approved: 'Approved',
      rejected: 'Rejected',
      disbursed: 'Disbursed',
    };
    return map[s] || s;
  };

  // ── Loan Officer: forward to branch manager ───────────────────────────────
  const handleForward = async () => {
    if (!actionModal) return;
    const loan = actionModal.loan;
    setProcessing(true);

    if (loan.kycStatus !== 'Verified') {
      toast.error('Cannot forward — Customer KYC is not verified.');
      setProcessing(false);
      return;
    }

    const parsedSalary = parseFloat(salary);
    if (!salary || isNaN(parsedSalary) || parsedSalary <= 0) {
      toast.error('Please enter a valid monthly salary.');
      setProcessing(false);
      return;
    }
    if (!employment.trim()) {
      toast.error('Please enter applicant employment type.');
      setProcessing(false);
      return;
    }

    const now = new Date().toISOString();
    const { error } = await supabase.from('loan_applications').update({
      status: 'pending_approval',
      officer_id: user?.id,
      officer_name: user?.fullName,
      officer_notes: officerNotes.trim() || null,
      forwarded_at: now,
      applicant_salary: parsedSalary,
      applicant_employment: employment.trim(),
    }).eq('id', loan.id);

    if (error) {
      toast.error('Failed to forward application.');
    } else {
      // Log action for risk scoring
      logAction('APPROVE_LOAN', user?.systemAccess || 'Loan Origination', loan.customerId, {
        action: 'forward',
        loanId: loan.id,
        amount: loan.amount,
        kycStatus: loan.kycStatus,
        salary: parsedSalary,
        loanType: loan.loanType,
      });
      toast.success(`Loan forwarded to Branch Manager for approval.`);
      setActionModal(null);
      setSalary(''); setEmployment(''); setOfficerNotes('');
      setSelected(null);
      loadLoans();
    }
    setProcessing(false);
  };

  // ── Branch Manager: approve or reject ─────────────────────────────────────
  const handleManagerDecision = async (decision: 'approved' | 'rejected') => {
    if (!actionModal) return;
    const loan = actionModal.loan;
    setProcessing(true);

    const now = new Date().toISOString();
    const { error } = await supabase.from('loan_applications').update({
      status: decision,
      manager_id: user?.id,
      manager_name: user?.fullName,
      manager_notes: managerNotes.trim() || null,
      manager_reviewed_at: now,
    }).eq('id', loan.id);

    if (!error) {
      // Log action for risk scoring
      if (decision === 'approved') {
        logAction('APPROVE_LOAN', user?.systemAccess || 'Loan Origination', loan.customerId, {
          action: 'approve',
          loanId: loan.id,
          amount: loan.amount,
          loanType: loan.loanType,
          forwardedAt: loan.forwardedAt,
        });
      }

      // Notify customer
      const message = decision === 'approved'
        ? `Your ${loan.loanType} application for ${formatCurrency(loan.amount)} has been APPROVED by the Branch Manager. Disbursement will be processed within 2-3 business days.`
        : `Your ${loan.loanType} application for ${formatCurrency(loan.amount)} has been reviewed. ${managerNotes ? 'Remarks: ' + managerNotes : 'Unfortunately, it has been rejected at this time.'}`;

      await supabase.from('notifications').insert({
        id: `NT${Date.now()}`,
        customer_id: loan.customerId,
        title: decision === 'approved' ? 'Loan Application Approved!' : 'Loan Application Update',
        message,
        type: decision === 'approved' ? 'success' : 'warning',
        is_read: false,
        created_at: now,
      });

      toast.success(`Loan application ${decision} successfully.`);
    } else {
      toast.error('Failed to update loan status.');
    }

    setActionModal(null);
    setManagerNotes('');
    setSelected(null);
    loadLoans();
    setProcessing(false);
  };

  const visible = getVisibleLoans();
  const pendingCount = loans.filter(l => {
    if (isLoanOfficer && !isAdmin) return l.status === 'pending';
    if (isBranchManager && !isAdmin) return l.status === 'pending_approval';
    return l.status === 'pending' || l.status === 'pending_approval';
  }).length;

  const filterOptions: FilterStatus[] = isLoanOfficer && !isAdmin
    ? ['all', 'pending', 'under_review']
    : isBranchManager && !isAdmin
    ? ['all', 'pending_approval', 'approved', 'rejected']
    : ['all', 'pending', 'under_review', 'pending_approval', 'approved', 'rejected'];

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-violet-400" />
            Loan Requests
            {pendingCount > 0 && (
              <span className="ml-1 bg-violet-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pendingCount}</span>
            )}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isLoanOfficer ? 'Review applications and forward to Branch Manager' :
             isBranchManager ? 'Approve or reject forwarded loan applications' :
             'Monitor all loan requests across the workflow'}
          </p>
        </div>
        <button onClick={loadLoans} className="p-2 text-slate-400 hover:text-violet-400 hover:bg-violet-500/10 rounded-lg transition-all">
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {filterOptions.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all border",
              filter === f
                ? 'bg-violet-500/20 text-violet-300 border-violet-500/30'
                : 'text-slate-400 bg-slate-800/40 border-slate-700/30 hover:text-slate-200'
            )}>
            {f === 'all' ? 'All' : statusLabel(f)}
            {f !== 'all' && ` (${loans.filter(l => l.status === f).length})`}
          </button>
        ))}
      </div>

      {/* Loan list */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3">
          <CreditCard className="w-8 h-8 text-slate-600" />
          <p className="text-sm text-slate-500">No loan requests found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(loan => (
            <div key={loan.id}
              className="bg-[#0d1f35] border border-violet-900/30 rounded-xl p-4 hover:border-violet-700/40 transition-all cursor-pointer"
              onClick={() => setSelected(selected?.id === loan.id ? null : loan)}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-violet-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{loan.customerName}</p>
                    <p className="text-xs text-slate-400">{loan.customerId} · {loan.loanType}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                        loan.kycStatus === 'Verified' ? 'text-emerald-300 bg-emerald-500/10' : 'text-amber-300 bg-amber-500/10'
                      )}>KYC: {loan.kycStatus}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <p className="text-lg font-bold text-white">{formatCurrency(loan.amount)}</p>
                  <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full border", statusBadge(loan.status))}>
                    {statusLabel(loan.status)}
                  </span>
                </div>
              </div>

              {/* Meta row */}
              <div className="mt-3 flex items-center gap-4 text-[10px] text-slate-500">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Applied: {formatDateShort(loan.createdAt)}</span>
                {loan.tenureMonths >= 12
                  ? <span>Tenure: {loan.tenureMonths / 12}Y</span>
                  : <span>Tenure: {loan.tenureMonths}M</span>}
                {loan.emi && <span className="text-violet-400">EMI: {formatCurrency(loan.emi)}/mo</span>}
                {loan.officerName && <span>Officer: {loan.officerName}</span>}
              </div>

              {/* Expanded details */}
              {selected?.id === loan.id && (
                <div className="mt-4 pt-4 border-t border-slate-700/30 space-y-3">
                  {loan.purpose && (
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Purpose</p>
                      <p className="text-sm text-slate-300 mt-0.5">{loan.purpose}</p>
                    </div>
                  )}

                  {/* Officer info */}
                  {loan.officerName && (
                    <div className="bg-sky-900/20 border border-sky-800/30 rounded-lg p-3 space-y-1">
                      <p className="text-[10px] text-sky-400 font-semibold uppercase tracking-wider">Loan Officer Review</p>
                      <p className="text-xs text-slate-300">Officer: {loan.officerName}</p>
                      {loan.applicantSalary && <p className="text-xs text-slate-300">Salary: {formatCurrency(loan.applicantSalary)}/mo</p>}
                      {loan.applicantEmployment && <p className="text-xs text-slate-300">Employment: {loan.applicantEmployment}</p>}
                      {loan.officerNotes && <p className="text-xs text-slate-400">Notes: {loan.officerNotes}</p>}
                      {loan.forwardedAt && <p className="text-[10px] text-slate-500">Forwarded: {formatDateShort(loan.forwardedAt)}</p>}
                    </div>
                  )}

                  {/* Manager info */}
                  {loan.managerName && (
                    <div className="bg-violet-900/20 border border-violet-800/30 rounded-lg p-3 space-y-1">
                      <p className="text-[10px] text-violet-400 font-semibold uppercase tracking-wider">Branch Manager Decision</p>
                      <p className="text-xs text-slate-300">Manager: {loan.managerName}</p>
                      {loan.managerNotes && <p className="text-xs text-slate-400">Notes: {loan.managerNotes}</p>}
                      {loan.managerReviewedAt && <p className="text-[10px] text-slate-500">Reviewed: {formatDateShort(loan.managerReviewedAt)}</p>}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2 flex-wrap">
                    {/* Loan Officer can forward pending loans */}
                    {(isLoanOfficer || isAdmin) && loan.status === 'pending' && (
                      <button
                        onClick={e => { e.stopPropagation(); setActionModal({ loan, type: 'forward' }); setSalary(''); setEmployment(''); setOfficerNotes(''); }}
                        className="flex items-center gap-2 px-4 py-2 bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/30 text-sky-300 rounded-lg text-xs font-semibold transition-all">
                        <Send className="w-3.5 h-3.5" /> Forward to Manager
                      </button>
                    )}
                    {/* Branch Manager / Admin can approve or reject pending_approval */}
                    {(isBranchManager || isAdmin) && loan.status === 'pending_approval' && (
                      <>
                        <button
                          onClick={e => { e.stopPropagation(); setActionModal({ loan, type: 'approve' }); setManagerNotes(''); }}
                          className="flex items-center gap-2 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 rounded-lg text-xs font-semibold transition-all">
                          <CheckCircle className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); setActionModal({ loan, type: 'reject' }); setManagerNotes(''); }}
                          className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 rounded-lg text-xs font-semibold transition-all">
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
              <div className="mt-2 flex justify-end">
                <ChevronRight className={cn("w-4 h-4 text-slate-600 transition-transform", selected?.id === loan.id && "rotate-90")} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Forward Modal (Loan Officer) ────────────────────────────────────── */}
      {actionModal?.type === 'forward' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setActionModal(null)} />
          <div className="relative bg-[#0a1628] border border-slate-700/50 rounded-xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <Send className="w-5 h-5 text-sky-400" />
              <h3 className="text-base font-bold text-white">Forward to Branch Manager</h3>
            </div>

            {/* KYC Warning */}
            {actionModal.loan.kycStatus !== 'Verified' && (
              <div className="mb-4 flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-red-300">Customer KYC is not Verified. You must not forward this application until KYC is complete.</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">Monthly Salary (₹) *</label>
                <input type="number" value={salary} onChange={e => setSalary(e.target.value)} placeholder="e.g. 75000"
                  className="w-full bg-[#060e1a] border border-slate-700/40 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500/50" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">Employment Type *</label>
                <select value={employment} onChange={e => setEmployment(e.target.value)}
                  className="w-full bg-[#060e1a] border border-slate-700/40 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500/50">
                  <option value="">Select employment type</option>
                  {['Salaried', 'Self-Employed', 'Business Owner', 'Government Employee', 'Retired', 'Freelancer'].map(e => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">Officer Notes</label>
                <textarea value={officerNotes} onChange={e => setOfficerNotes(e.target.value)} rows={2}
                  placeholder="e.g. KYC verified, income proof submitted, creditworthy"
                  className="w-full bg-[#060e1a] border border-slate-700/40 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500/50 resize-none" />
              </div>

              {/* Eligibility summary */}
              {salary && parseFloat(salary) > 0 && (
                <div className="bg-sky-900/20 border border-sky-800/30 rounded-lg p-3">
                  <p className="text-[10px] text-sky-400 font-semibold uppercase tracking-wider mb-1">Eligibility Check</p>
                  <div className="flex items-center gap-2 text-xs">
                    {parseFloat(salary) * 60 >= actionModal.loan.amount
                      ? <><CheckCircle className="w-3.5 h-3.5 text-emerald-400" /><span className="text-emerald-300">Loan amount within eligible range (salary × 60)</span></>
                      : <><AlertTriangle className="w-3.5 h-3.5 text-amber-400" /><span className="text-amber-300">Loan amount exceeds typical eligibility (salary × 60)</span></>}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setActionModal(null)} className="flex-1 py-2.5 text-sm text-slate-300 bg-slate-700/40 hover:bg-slate-700/60 rounded-lg font-medium transition-all">
                Cancel
              </button>
              <button onClick={handleForward} disabled={processing}
                className="flex-1 py-2.5 text-sm text-white bg-sky-600 hover:bg-sky-500 font-semibold rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {processing ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Forwarding...</> : <><Send className="w-3.5 h-3.5" />Forward</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Approve / Reject Modal (Branch Manager) ──────────────────────────── */}
      {(actionModal?.type === 'approve' || actionModal?.type === 'reject') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setActionModal(null)} />
          <div className="relative bg-[#0a1628] border border-slate-700/50 rounded-xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              {actionModal.type === 'approve'
                ? <CheckCircle className="w-5 h-5 text-emerald-400" />
                : <XCircle className="w-5 h-5 text-red-400" />}
              <h3 className="text-base font-bold text-white">
                {actionModal.type === 'approve' ? 'Approve Loan' : 'Reject Loan'}
              </h3>
            </div>

            {/* Loan summary */}
            <div className="mb-4 bg-violet-900/20 border border-violet-800/30 rounded-lg p-3 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Applicant</span>
                <span className="text-white font-medium">{actionModal.loan.customerName}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Loan Type</span>
                <span className="text-white font-medium">{actionModal.loan.loanType}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Amount</span>
                <span className="text-white font-bold">{formatCurrency(actionModal.loan.amount)}</span>
              </div>
              {actionModal.loan.applicantSalary && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Monthly Salary</span>
                  <span className="text-emerald-300">{formatCurrency(actionModal.loan.applicantSalary)}/mo</span>
                </div>
              )}
              {actionModal.loan.applicantEmployment && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Employment</span>
                  <span className="text-white">{actionModal.loan.applicantEmployment}</span>
                </div>
              )}
              {actionModal.loan.officerNotes && (
                <div className="pt-1 border-t border-violet-800/20">
                  <p className="text-[10px] text-slate-500">Officer Notes: {actionModal.loan.officerNotes}</p>
                </div>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">Manager Remarks</label>
              <textarea value={managerNotes} onChange={e => setManagerNotes(e.target.value)} rows={3}
                placeholder={actionModal.type === 'approve' ? 'e.g. All criteria met, approved' : 'e.g. Insufficient income documentation'}
                className="w-full bg-[#060e1a] border border-slate-700/40 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/50 resize-none" />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setActionModal(null)} className="flex-1 py-2.5 text-sm text-slate-300 bg-slate-700/40 hover:bg-slate-700/60 rounded-lg font-medium transition-all">Cancel</button>
              <button
                onClick={() => handleManagerDecision(actionModal.type === 'approve' ? 'approved' : 'rejected')}
                disabled={processing}
                className={cn(
                  "flex-1 py-2.5 text-sm text-white font-semibold rounded-lg transition-all disabled:opacity-50",
                  actionModal.type === 'approve' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'
                )}>
                {processing ? 'Processing...' : actionModal.type === 'approve' ? 'Approve Loan' : 'Reject Application'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
