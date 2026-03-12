import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/lib/store';
import { formatDate, cn } from '@/lib/utils';
import {
  Phone, Mail, Clock, CheckCircle, XCircle, AlertTriangle,
  RefreshCw, User, ShieldAlert, Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { generateId } from '@/lib/utils';

interface ChangeRequest {
  id: string;
  customerId: string;
  customerName: string;
  currentMobile: string;
  currentEmail: string;
  requestedMobile: string | null;
  requestedEmail: string | null;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

export default function ChangeRequestsPanel() {
  const { state, logAction, updateCustomer } = useApp();
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const user = state.currentUser;

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('contact_change_requests')
      .select('*')
      .order('requested_at', { ascending: false });

    if (!data) { setLoading(false); return; }

    const enriched: ChangeRequest[] = [];
    for (const row of data) {
      const { data: cust } = await supabase
        .from('customers')
        .select('full_name, mobile, email')
        .eq('id', row.customer_id)
        .single();
      enriched.push({
        id: row.id,
        customerId: row.customer_id,
        customerName: cust?.full_name ?? 'Unknown',
        currentMobile: cust?.mobile ?? '',
        currentEmail: cust?.email ?? '',
        requestedMobile: row.requested_mobile,
        requestedEmail: row.requested_email,
        reason: row.reason ?? '',
        status: row.status,
        requestedAt: row.requested_at,
        reviewedBy: row.reviewed_by,
        reviewedByName: row.reviewed_by_name,
        reviewedAt: row.reviewed_at,
        rejectionReason: row.rejection_reason,
      });
    }
    setRequests(enriched);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const sub = supabase
      .channel('change-requests-panel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_change_requests' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [load]);

  const handleApprove = async (req: ChangeRequest) => {
    setProcessing(req.id);
    const now = new Date().toISOString();
    const fields: string[] = [];
    if (req.requestedMobile && req.requestedMobile !== req.currentMobile) fields.push('mobile');
    if (req.requestedEmail && req.requestedEmail !== req.currentEmail) fields.push('email');

    // Apply the actual change to the customer
    const updates: Record<string, string> = {};
    if (req.requestedMobile) updates.mobile = req.requestedMobile;
    if (req.requestedEmail) updates.email = req.requestedEmail;

    await supabase.from('customers').update(updates).eq('id', req.customerId);
    await supabase.from('customer_auth').update(
      req.requestedEmail ? { email: req.requestedEmail } : {}
    ).eq('customer_id', req.customerId);

    // Update request status
    await supabase.from('contact_change_requests').update({
      status: 'approved',
      reviewed_by: user?.id,
      reviewed_by_name: user?.fullName,
      reviewed_at: now,
    }).eq('id', req.id);

    // Update local customer state
    const { data: updatedCust } = await supabase.from('customers').select('*').eq('id', req.customerId).single();
    if (updatedCust) {
      updateCustomer({
        id: updatedCust.id,
        fullName: updatedCust.full_name,
        aadhaar: updatedCust.aadhaar,
        pan: updatedCust.pan,
        accountNumber: updatedCust.account_number,
        accountType: updatedCust.account_type,
        balance: updatedCust.balance,
        accountStatus: updatedCust.account_status,
        lastTransactionDate: updatedCust.last_transaction_date,
        dateOpened: updatedCust.date_opened,
        mobile: updatedCust.mobile,
        email: updatedCust.email,
        branch: updatedCust.branch,
        kycStatus: updatedCust.kyc_status,
        bankName: updatedCust.bank_name ?? 'SecureBank Ltd.',
        ifscCode: updatedCust.ifsc_code ?? 'SCBK0000001',
      });
    }

    // Log with "has_request" flag (legitimate — no extra risk)
    logAction('APPLY_CONTACT_CHANGE', 'Core Banking', req.customerId, {
      fields,
      requestId: req.id,
      hasApprovedRequest: true,
      newMobile: req.requestedMobile,
      newEmail: req.requestedEmail,
    });

    // Send notification to customer
    await supabase.from('notifications').insert({
      id: generateId('NT'),
      customer_id: req.customerId,
      title: 'Contact Details Updated',
      message: `Your contact details have been successfully updated by our team.${fields.includes('mobile') ? ` New mobile: ${req.requestedMobile}.` : ''}${fields.includes('email') ? ` New email: ${req.requestedEmail}.` : ''} If you did not request this change, please contact us immediately.`,
      type: 'success',
      is_read: false,
      created_at: now,
    });

    toast.success(`Contact details updated for ${req.customerName}`);
    setProcessing(null);
    load();
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    const req = requests.find(r => r.id === rejectModal.id);
    if (!req) return;
    setProcessing(rejectModal.id);
    const now = new Date().toISOString();

    await supabase.from('contact_change_requests').update({
      status: 'rejected',
      reviewed_by: user?.id,
      reviewed_by_name: user?.fullName,
      reviewed_at: now,
      rejection_reason: rejectReason.trim() || null,
    }).eq('id', rejectModal.id);

    // Notify customer of rejection
    await supabase.from('notifications').insert({
      id: generateId('NT'),
      customer_id: req.customerId,
      title: 'Contact Change Request Declined',
      message: `Your request to update contact details has been reviewed. ${rejectReason ? 'Reason: ' + rejectReason : 'Please visit your branch for assistance.'}`,
      type: 'warning',
      is_read: false,
      created_at: now,
    });

    logAction('REJECT_CONTACT_CHANGE', 'Core Banking', req.customerId, {
      requestId: rejectModal.id,
      reason: rejectReason,
    });

    toast.success(`Request rejected for ${req.customerName}`);
    setRejectModal(null);
    setRejectReason('');
    setProcessing(null);
    load();
  };

  const filtered = requests.filter(r => filter === 'all' || r.status === filter);
  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Phone className="w-5 h-5 text-amber-400" />
            Contact Change Requests
            {pendingCount > 0 && (
              <span className="ml-1 bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pendingCount}</span>
            )}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Review and apply customer-initiated contact detail change requests</p>
        </div>
        <button onClick={load} className="p-2 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all">
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Info banner */}
      <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-3 flex items-start gap-3">
        <ShieldAlert className="w-4 h-4 text-sky-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-sky-300">
          Only apply changes from this queue. Modifying customer contact details outside this workflow will trigger a fraud risk alert automatically.
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all border',
              filter === f
                ? f === 'pending' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : f === 'approved' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : f === 'rejected' ? 'bg-red-500/20 text-red-300 border-red-500/30'
                  : 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                : 'text-slate-400 bg-slate-800/40 border-slate-700/30 hover:text-slate-200'
            )}>
            {f}{f !== 'all' && ` (${requests.filter(r => r.status === f).length})`}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 gap-3">
          <Info className="w-8 h-8 text-slate-600" />
          <p className="text-sm text-slate-500">No {filter !== 'all' ? filter : ''} change requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => (
            <div key={req.id}
              className={cn(
                'bg-[#0d1f35] border rounded-xl p-4',
                req.status === 'pending' ? 'border-amber-500/20' :
                req.status === 'approved' ? 'border-emerald-500/20' : 'border-red-500/20'
              )}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                {/* Customer info */}
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                    req.status === 'pending' ? 'bg-amber-500/15' :
                    req.status === 'approved' ? 'bg-emerald-500/15' : 'bg-red-500/15'
                  )}>
                    <User className={cn('w-5 h-5',
                      req.status === 'pending' ? 'text-amber-400' :
                      req.status === 'approved' ? 'text-emerald-400' : 'text-red-400'
                    )} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{req.customerName}</p>
                    <p className="text-xs text-slate-400">{req.customerId}</p>
                    {req.reason && (
                      <p className="text-xs text-slate-500 mt-0.5 italic">"{req.reason}"</p>
                    )}
                  </div>
                </div>

                {/* Status + actions */}
                <div className="flex flex-col items-end gap-2">
                  <span className={cn(
                    'flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border',
                    req.status === 'pending' ? 'text-amber-300 bg-amber-500/10 border-amber-500/30' :
                    req.status === 'approved' ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' :
                    'text-red-300 bg-red-500/10 border-red-500/30'
                  )}>
                    {req.status === 'pending' && <Clock className="w-3 h-3" />}
                    {req.status === 'approved' && <CheckCircle className="w-3 h-3" />}
                    {req.status === 'rejected' && <XCircle className="w-3 h-3" />}
                    {req.status.toUpperCase()}
                  </span>
                  {req.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        disabled={processing === req.id}
                        onClick={() => handleApprove(req)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 rounded-lg text-xs font-semibold transition-all disabled:opacity-50">
                        <CheckCircle className="w-3.5 h-3.5" /> Apply
                      </button>
                      <button
                        disabled={processing === req.id}
                        onClick={() => { setRejectModal({ id: req.id }); setRejectReason(''); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 rounded-lg text-xs font-semibold transition-all disabled:opacity-50">
                        <XCircle className="w-3.5 h-3.5" /> Decline
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Change diff */}
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* Mobile change */}
                {req.requestedMobile && (
                  <div className="bg-[#060e1a] rounded-lg p-3 border border-slate-700/30">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Mobile Change</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-500">Current</span>
                        <span className="text-xs text-slate-300 font-mono">{req.currentMobile}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-500">Requested</span>
                        <span className="text-xs text-amber-300 font-mono font-semibold">{req.requestedMobile}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Email change */}
                {req.requestedEmail && (
                  <div className="bg-[#060e1a] rounded-lg p-3 border border-slate-700/30">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Email Change</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-500">Current</span>
                        <span className="text-xs text-slate-300 truncate max-w-[140px]">{req.currentEmail}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-500">Requested</span>
                        <span className="text-xs text-amber-300 truncate max-w-[140px] font-semibold">{req.requestedEmail}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Meta */}
              <div className="mt-3 pt-3 border-t border-slate-700/30 flex flex-wrap gap-4 text-[10px] text-slate-500">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Requested: {formatDate(req.requestedAt)}</span>
                {req.reviewedByName && <span>Reviewed by: {req.reviewedByName}</span>}
                {req.reviewedAt && <span>At: {formatDate(req.reviewedAt)}</span>}
                {req.rejectionReason && <span className="text-red-400">Reason: {req.rejectionReason}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setRejectModal(null)} />
          <div className="relative bg-[#0a1628] border border-slate-700/50 rounded-xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <h3 className="text-base font-bold text-white">Decline Change Request</h3>
            </div>
            <p className="text-sm text-slate-400 mb-4">The customer will be notified with your reason.</p>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Reason (optional)</label>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3}
                placeholder="e.g. Insufficient documentation provided"
                className="w-full bg-[#060e1a] border border-slate-700/40 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-red-500/50 resize-none" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setRejectModal(null)}
                className="flex-1 py-2.5 text-sm text-slate-300 bg-slate-700/40 hover:bg-slate-700/60 rounded-lg font-medium transition-all">Cancel</button>
              <button onClick={handleReject} disabled={!!processing}
                className="flex-1 py-2.5 text-sm text-white bg-red-600 hover:bg-red-500 font-semibold rounded-lg transition-all disabled:opacity-50">
                {processing ? 'Processing...' : 'Decline Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
