import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/lib/store';
import { formatDate, cn, generateId } from '@/lib/utils';
import {
  Phone, Mail, Clock, CheckCircle, XCircle, AlertTriangle,
  RefreshCw, User, ShieldAlert, Info, FileText,
} from 'lucide-react';
import { toast } from 'sonner';

interface RequestedFields {
  mobile?: string;
  email?: string;
  [key: string]: string | undefined;
}

interface ChangeRequest {
  id: string;
  customerId: string;
  customerName: string;
  currentMobile: string;
  currentEmail: string;
  requestedFields: RequestedFields;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  tellerNotes?: string;
}

export default function ChangeRequestsPanel() {
  const { state, logAction, updateCustomer } = useApp();
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null);
  const [tellerNotes, setTellerNotes] = useState('');

  const user = state.currentUser;

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('change_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to load change requests:', error);
      setLoading(false);
      return;
    }
    if (!data) { setLoading(false); return; }

    // Batch-fetch all unique customer IDs
    const customerIds = [...new Set(data.map(r => r.customer_id as string))];
    const { data: customers } = await supabase
      .from('customers')
      .select('id, full_name, mobile, email')
      .in('id', customerIds);

    const custMap: Record<string, { full_name: string; mobile: string; email: string }> = {};
    for (const c of customers ?? []) {
      custMap[c.id] = c;
    }

    const enriched: ChangeRequest[] = data.map(row => {
      const cust = custMap[row.customer_id];
      const fields: RequestedFields = (row.requested_fields as RequestedFields) ?? {};
      return {
        id: row.id as string,
        customerId: row.customer_id as string,
        customerName: cust?.full_name ?? 'Unknown',
        currentMobile: cust?.mobile ?? '',
        currentEmail: cust?.email ?? '',
        requestedFields: fields,
        status: row.status as 'pending' | 'approved' | 'rejected',
        createdAt: row.created_at as string,
        reviewedBy: row.reviewed_by as string | undefined,
        reviewedByName: row.reviewed_by_name as string | undefined,
        reviewedAt: row.reviewed_at as string | undefined,
        tellerNotes: row.teller_notes as string | undefined,
      };
    });

    setRequests(enriched);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const sub = supabase
      .channel('change-requests-panel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'change_requests' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [load]);

  const handleApprove = async (req: ChangeRequest) => {
    setProcessing(req.id);
    const now = new Date().toISOString();
    const fields = Object.keys(req.requestedFields).filter(k => req.requestedFields[k]);

    // Build update payload for customers table
    const updates: Record<string, string> = {};
    if (req.requestedFields.mobile) updates.mobile = req.requestedFields.mobile;
    if (req.requestedFields.email) updates.email = req.requestedFields.email;

    // Apply change to customers
    const { error: custErr } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', req.customerId);

    if (custErr) {
      toast.error('Failed to apply changes. Please try again.');
      setProcessing(null);
      return;
    }

    // Update customer_auth email if changed
    if (req.requestedFields.email) {
      await supabase
        .from('customer_auth')
        .update({ email: req.requestedFields.email })
        .eq('customer_id', req.customerId);
    }

    // Mark request as approved
    const { error: reqErr } = await supabase
      .from('change_requests')
      .update({
        status: 'approved',
        reviewed_by: user?.id ?? null,
        reviewed_by_name: user?.fullName ?? null,
        reviewed_at: now,
        teller_notes: null,
      })
      .eq('id', req.id);

    if (reqErr) {
      toast.error('Failed to update request status.');
      setProcessing(null);
      return;
    }

    // Refresh customer in local state
    const { data: updatedCust } = await supabase
      .from('customers')
      .select('*')
      .eq('id', req.customerId)
      .single();

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

    // Fraud logging — legitimate change (has approved request)
    logAction('APPLY_CONTACT_CHANGE', 'Core Banking', req.customerId, {
      fields,
      requestId: req.id,
      hasApprovedRequest: true,
      newMobile: req.requestedFields.mobile ?? null,
      newEmail: req.requestedFields.email ?? null,
    });

    // Notify customer
    const msgParts: string[] = [];
    if (req.requestedFields.mobile) msgParts.push(`Mobile updated to ${req.requestedFields.mobile}`);
    if (req.requestedFields.email) msgParts.push(`Email updated to ${req.requestedFields.email}`);

    await supabase.from('notifications').insert({
      id: generateId('NT'),
      customer_id: req.customerId,
      title: 'Contact Details Updated',
      message: `Your change request has been approved. ${msgParts.join('. ')}. If you did not request this, contact your branch immediately.`,
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

    const { error } = await supabase
      .from('change_requests')
      .update({
        status: 'rejected',
        reviewed_by: user?.id ?? null,
        reviewed_by_name: user?.fullName ?? null,
        reviewed_at: now,
        teller_notes: tellerNotes.trim() || null,
      })
      .eq('id', rejectModal.id);

    if (error) {
      toast.error('Failed to reject request.');
      setProcessing(null);
      return;
    }

    // Notify customer of rejection
    await supabase.from('notifications').insert({
      id: generateId('NT'),
      customer_id: req.customerId,
      title: 'Contact Change Request Declined',
      message: `Your request to update contact details was reviewed and declined.${tellerNotes ? ' Note from teller: ' + tellerNotes : ' Please visit your branch for assistance.'}`,
      type: 'warning',
      is_read: false,
      created_at: now,
    });

    logAction('REJECT_CONTACT_CHANGE', 'Core Banking', req.customerId, {
      requestId: rejectModal.id,
      tellerNotes: tellerNotes.trim(),
    });

    toast.success(`Request declined for ${req.customerName}`);
    setRejectModal(null);
    setTellerNotes('');
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
              <span className="ml-1 bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Review and apply customer-initiated contact detail change requests
          </p>
        </div>
        <button
          onClick={load}
          className="p-2 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Info banner */}
      <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-3 flex items-start gap-3">
        <ShieldAlert className="w-4 h-4 text-sky-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-sky-300">
          Only apply changes from this queue. Modifying customer contact details outside this workflow
          automatically triggers a fraud risk alert (Rule R070).
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all border',
              filter === f
                ? f === 'pending'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : f === 'approved'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : f === 'rejected'
                  ? 'bg-red-500/20 text-red-300 border-red-500/30'
                  : 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                : 'text-slate-400 bg-slate-800/40 border-slate-700/30 hover:text-slate-200'
            )}
          >
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
          <p className="text-sm text-slate-500">
            No {filter !== 'all' ? filter : ''} change requests
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => {
            const reqMobile = req.requestedFields.mobile;
            const reqEmail = req.requestedFields.email;
            const otherFields = Object.entries(req.requestedFields)
              .filter(([k]) => k !== 'mobile' && k !== 'email' && req.requestedFields[k]);

            return (
              <div
                key={req.id}
                className={cn(
                  'bg-[#0d1f35] border rounded-xl p-4',
                  req.status === 'pending'
                    ? 'border-amber-500/20'
                    : req.status === 'approved'
                    ? 'border-emerald-500/20'
                    : 'border-red-500/20'
                )}
              >
                {/* Top row: customer info + status/actions */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                        req.status === 'pending'
                          ? 'bg-amber-500/15'
                          : req.status === 'approved'
                          ? 'bg-emerald-500/15'
                          : 'bg-red-500/15'
                      )}
                    >
                      <User
                        className={cn(
                          'w-5 h-5',
                          req.status === 'pending'
                            ? 'text-amber-400'
                            : req.status === 'approved'
                            ? 'text-emerald-400'
                            : 'text-red-400'
                        )}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{req.customerName}</p>
                      <p className="text-xs text-slate-400">{req.customerId}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <span
                      className={cn(
                        'flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border',
                        req.status === 'pending'
                          ? 'text-amber-300 bg-amber-500/10 border-amber-500/30'
                          : req.status === 'approved'
                          ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
                          : 'text-red-300 bg-red-500/10 border-red-500/30'
                      )}
                    >
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
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          {processing === req.id ? 'Applying…' : 'Apply'}
                        </button>
                        <button
                          disabled={processing === req.id}
                          onClick={() => { setRejectModal({ id: req.id }); setTellerNotes(''); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Decline
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Change diff */}
                <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {reqMobile && (
                    <div className="bg-[#060e1a] rounded-lg p-3 border border-slate-700/30">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                          Mobile Change
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-500">Current</span>
                          <span className="text-xs text-slate-300 font-mono">{req.currentMobile || '—'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-500">Requested</span>
                          <span className="text-xs text-amber-300 font-mono font-semibold">{reqMobile}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {reqEmail && (
                    <div className="bg-[#060e1a] rounded-lg p-3 border border-slate-700/30">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                          Email Change
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-500">Current</span>
                          <span className="text-xs text-slate-300 truncate max-w-[140px]">
                            {req.currentEmail || '—'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-500">Requested</span>
                          <span className="text-xs text-amber-300 truncate max-w-[140px] font-semibold">
                            {reqEmail}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Render any other jsonb fields */}
                  {otherFields.map(([key, val]) => (
                    <div key={key} className="bg-[#060e1a] rounded-lg p-3 border border-slate-700/30">
                      <div className="flex items-center gap-1.5 mb-2">
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                          {key} Change
                        </span>
                      </div>
                      <p className="text-xs text-amber-300 font-medium">{val}</p>
                    </div>
                  ))}
                </div>

                {/* Meta footer */}
                <div className="mt-3 pt-3 border-t border-slate-700/30 flex flex-wrap gap-4 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />Submitted: {formatDate(req.createdAt)}
                  </span>
                  {req.reviewedByName && (
                    <span>Reviewed by: <span className="text-slate-400">{req.reviewedByName}</span></span>
                  )}
                  {req.reviewedAt && (
                    <span>At: {formatDate(req.reviewedAt)}</span>
                  )}
                  {req.tellerNotes && (
                    <span className="text-amber-400/80">Note: {req.tellerNotes}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Decline modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setRejectModal(null)} />
          <div className="relative bg-[#0a1628] border border-slate-700/50 rounded-xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <h3 className="text-base font-bold text-white">Decline Change Request</h3>
            </div>
            <p className="text-sm text-slate-400 mb-4">
              The customer will receive a notification with your teller notes.
            </p>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Teller Notes (optional)
              </label>
              <textarea
                value={tellerNotes}
                onChange={e => setTellerNotes(e.target.value)}
                rows={3}
                placeholder="e.g. Customer must visit branch with ID proof"
                className="w-full bg-[#060e1a] border border-slate-700/40 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-red-500/50 resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setRejectModal(null)}
                className="flex-1 py-2.5 text-sm text-slate-300 bg-slate-700/40 hover:bg-slate-700/60 rounded-lg font-medium transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!!processing}
                className="flex-1 py-2.5 text-sm text-white bg-red-600 hover:bg-red-500 font-semibold rounded-lg transition-all disabled:opacity-50"
              >
                {processing ? 'Processing…' : 'Decline Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
