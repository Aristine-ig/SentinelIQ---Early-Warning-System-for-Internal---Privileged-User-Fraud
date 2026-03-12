import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/lib/store';
import { cn, formatDate } from '@/lib/utils';
import {
  Shield, Clock, CheckCircle, XCircle, AlertTriangle,
  User, RefreshCw, FileCheck,
} from 'lucide-react';
import { toast } from 'sonner';

interface KycRequest {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerMobile: string;
  status: 'pending' | 'approved' | 'rejected';
  initiatedAt: string;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  notes?: string;
}

export default function KycRequestsPanel() {
  const { state } = useApp();
  const [requests, setRequests] = useState<KycRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [notesModal, setNotesModal] = useState<{ id: string; action: 'approved' | 'rejected' } | null>(null);
  const [notes, setNotes] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  const loadRequests = async () => {
    setLoading(true);
    const { data: kycData } = await supabase
      .from('kyc_requests')
      .select('*')
      .order('initiated_at', { ascending: false });

    if (!kycData) { setLoading(false); return; }

    // Enrich with customer info
    const enriched: KycRequest[] = [];
    for (const row of kycData) {
      const { data: cust } = await supabase
        .from('customers')
        .select('full_name, email, mobile')
        .eq('id', row.customer_id)
        .single();
      enriched.push({
        id: row.id,
        customerId: row.customer_id,
        customerName: cust?.full_name ?? 'Unknown',
        customerEmail: cust?.email ?? '',
        customerMobile: cust?.mobile ?? '',
        status: row.status as KycRequest['status'],
        initiatedAt: row.initiated_at,
        reviewedBy: row.reviewed_by,
        reviewedByName: row.reviewed_by_name,
        reviewedAt: row.reviewed_at,
        notes: row.notes,
      });
    }
    setRequests(enriched);
    setLoading(false);
  };

  useEffect(() => {
    loadRequests();

    // Real-time subscription
    const sub = supabase
      .channel('kyc-requests-panel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kyc_requests' }, () => {
        loadRequests();
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, []);

  const handleReview = async (action: 'approved' | 'rejected') => {
    if (!notesModal) return;
    const { id } = notesModal;
    setProcessing(id);

    const req = requests.find(r => r.id === id);
    if (!req) return;

    const now = new Date().toISOString();
    const reviewer = state.currentUser;

    // Update kyc_request
    await supabase.from('kyc_requests').update({
      status: action,
      reviewed_by: reviewer?.id,
      reviewed_by_name: reviewer?.fullName,
      reviewed_at: now,
      notes: notes.trim() || null,
    }).eq('id', id);

    // Update customer record
    const custUpdate: Record<string, string> = {
      kyc_status: action === 'approved' ? 'Verified' : 'Pending',
    };
    if (action === 'approved') {
      custUpdate.account_status = 'Active';
    }
    await supabase.from('customers').update(custUpdate).eq('id', req.customerId);

    // Send notification to customer
    const notifTitle = action === 'approved' ? 'KYC Verified Successfully' : 'KYC Verification Update';
    const notifMessage = action === 'approved'
      ? 'Your KYC has been verified. Your account is now fully active. Welcome to SecureBank!'
      : `Your KYC request requires additional information. ${notes ? 'Remarks: ' + notes : 'Please contact your branch.'}`;

    await supabase.from('notifications').insert({
      id: `NT${Date.now()}`,
      customer_id: req.customerId,
      title: notifTitle,
      message: notifMessage,
      type: action === 'approved' ? 'success' : 'warning',
      is_read: false,
      created_at: now,
    });

    toast.success(`KYC ${action === 'approved' ? 'approved' : 'rejected'} for ${req.customerName}`);
    setNotesModal(null);
    setNotes('');
    setProcessing(null);
    loadRequests();
  };

  const filtered = requests.filter(r => filter === 'all' || r.status === filter);
  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-sky-400" />
            KYC Requests
            {pendingCount > 0 && (
              <span className="ml-1 bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pendingCount}</span>
            )}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Review and process customer KYC verification requests</p>
        </div>
        <button onClick={loadRequests} className="p-2 text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 rounded-lg transition-all">
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all",
              filter === f
                ? f === 'pending' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : f === 'approved' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : f === 'rejected' ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                  : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                : 'text-slate-400 bg-slate-800/40 border border-slate-700/30 hover:text-slate-200'
            )}>
            {f}{f !== 'all' && ` (${requests.filter(r => r.status === f).length})`}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 gap-3">
          <Shield className="w-8 h-8 text-slate-600" />
          <p className="text-sm text-slate-500">No {filter !== 'all' ? filter : ''} KYC requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => (
            <div key={req.id}
              className={cn(
                "bg-[#0d1f35] border rounded-xl p-4",
                req.status === 'pending' ? 'border-amber-500/20' :
                req.status === 'approved' ? 'border-emerald-500/20' :
                'border-red-500/20'
              )}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                    req.status === 'pending' ? 'bg-amber-500/15' :
                    req.status === 'approved' ? 'bg-emerald-500/15' : 'bg-red-500/15'
                  )}>
                    <User className={cn("w-5 h-5",
                      req.status === 'pending' ? 'text-amber-400' :
                      req.status === 'approved' ? 'text-emerald-400' : 'text-red-400'
                    )} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{req.customerName}</p>
                    <p className="text-xs text-slate-400">{req.customerId}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-slate-500">{req.customerEmail}</span>
                      <span className="text-[10px] text-slate-500">{req.customerMobile}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  {/* Status badge */}
                  <span className={cn(
                    "flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border",
                    req.status === 'pending' ? 'text-amber-300 bg-amber-500/10 border-amber-500/30' :
                    req.status === 'approved' ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' :
                    'text-red-300 bg-red-500/10 border-red-500/30'
                  )}>
                    {req.status === 'pending' && <Clock className="w-3 h-3" />}
                    {req.status === 'approved' && <CheckCircle className="w-3 h-3" />}
                    {req.status === 'rejected' && <XCircle className="w-3 h-3" />}
                    {req.status.toUpperCase()}
                  </span>

                  {/* Action buttons for pending */}
                  {req.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        disabled={processing === req.id}
                        onClick={() => { setNotesModal({ id: req.id, action: 'approved' }); setNotes(''); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 rounded-lg text-xs font-semibold transition-all disabled:opacity-50">
                        <CheckCircle className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button
                        disabled={processing === req.id}
                        onClick={() => { setNotesModal({ id: req.id, action: 'rejected' }); setNotes(''); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 rounded-lg text-xs font-semibold transition-all disabled:opacity-50">
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Request meta */}
              <div className="mt-3 pt-3 border-t border-slate-700/30 flex flex-wrap items-center gap-4 text-[10px] text-slate-500">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Initiated: {formatDate(req.initiatedAt)}
                </span>
                {req.reviewedByName && (
                  <span className="flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    Reviewed by: {req.reviewedByName}
                  </span>
                )}
                {req.reviewedAt && (
                  <span>Reviewed: {formatDate(req.reviewedAt)}</span>
                )}
                {req.notes && (
                  <span className="text-slate-400">Notes: {req.notes}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Notes/Confirm modal */}
      {notesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setNotesModal(null)} />
          <div className="relative bg-[#0a1628] border border-slate-700/50 rounded-xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              {notesModal.action === 'approved'
                ? <CheckCircle className="w-5 h-5 text-emerald-400" />
                : <AlertTriangle className="w-5 h-5 text-red-400" />}
              <h3 className="text-base font-bold text-white">
                {notesModal.action === 'approved' ? 'Approve KYC' : 'Reject KYC'}
              </h3>
            </div>
            <p className="text-sm text-slate-400 mb-4">
              {notesModal.action === 'approved'
                ? "Customer's KYC will be marked as Verified and account activated."
                : "Customer will be notified to provide additional information."}
            </p>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Notes / Remarks (optional)
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder={notesModal.action === 'approved'
                  ? "e.g. All documents verified successfully"
                  : "e.g. Please submit income proof"}
                className="w-full bg-[#060e1a] border border-slate-700/40 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500/50 resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setNotesModal(null)}
                className="flex-1 py-2.5 text-sm text-slate-300 bg-slate-700/40 hover:bg-slate-700/60 rounded-lg font-medium transition-all">
                Cancel
              </button>
              <button onClick={() => handleReview(notesModal.action)} disabled={!!processing}
                className={cn(
                  "flex-1 py-2.5 text-sm text-white font-semibold rounded-lg transition-all disabled:opacity-50",
                  notesModal.action === 'approved'
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-red-600 hover:bg-red-500'
                )}>
                {processing ? 'Processing...' : notesModal.action === 'approved' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
