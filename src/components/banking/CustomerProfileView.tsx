import { useState, useEffect } from 'react';
import { useCustomer } from '@/lib/customerStore';
import { formatDateShort, maskAadhaar, maskPAN, cn, generateId } from '@/lib/utils';
import { User, Phone, Mail, MapPin, Shield, CheckCircle, Building2, Hash, Clock, AlertTriangle, Send, FileSearch } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface PendingRequest {
  id: string;
  requestedFields: { mobile?: string; email?: string };
  status: string;
  createdAt: string;
}

export default function CustomerProfileView() {
  const { state, initiateKYC } = useCustomer();
  const [showForm, setShowForm] = useState(false);
  const [requestMobile, setRequestMobile] = useState('');
  const [requestEmail, setRequestEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [kycLoading, setKycLoading] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const { currentCustomer, currentAuth } = state;

  // Load existing pending request on mount
  useEffect(() => {
    if (!currentCustomer) return;
    const fetchPending = async () => {
      setLoadingStatus(true);
      const { data } = await supabase
        .from('change_requests')
        .select('id, requested_fields, status, created_at')
        .eq('customer_id', currentCustomer.id)
        .in('status', ['pending', 'approved'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        const row = data[0];
        setPendingRequest({
          id: row.id as string,
          requestedFields: (row.requested_fields as { mobile?: string; email?: string }) ?? {},
          status: row.status as string,
          createdAt: row.created_at as string,
        });
      } else {
        setPendingRequest(null);
      }
      setLoadingStatus(false);
    };
    fetchPending();
  }, [currentCustomer]);

  if (!currentCustomer) return null;

  const kycColor =
    currentCustomer.kycStatus === 'Verified'
      ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30'
      : currentCustomer.kycStatus === 'Pending'
      ? 'text-amber-400 bg-amber-500/15 border-amber-500/30'
      : 'text-red-400 bg-red-500/15 border-red-500/30';

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestMobile.trim() && !requestEmail.trim()) {
      toast.error('Please enter at least one change (mobile or email)');
      return;
    }
    setLoading(true);

    // Check for existing pending request
    const { data: existing } = await supabase
      .from('change_requests')
      .select('id')
      .eq('customer_id', currentCustomer.id)
      .eq('status', 'pending')
      .limit(1);

    if (existing && existing.length > 0) {
      toast.error('You already have a pending change request. Please wait for it to be reviewed.');
      setLoading(false);
      return;
    }

    // Build requested_fields jsonb — only include fields that were actually filled
    const requestedFields: Record<string, string> = {};
    if (requestMobile.trim()) requestedFields.mobile = requestMobile.trim();
    if (requestEmail.trim()) requestedFields.email = requestEmail.trim();

    const newId = generateId('CR');
    const { error } = await supabase.from('change_requests').insert({
      id: newId,
      customer_id: currentCustomer.id,
      requested_fields: requestedFields,
      status: 'pending',
    });

    if (error) {
      console.error('Change request insert error:', error);
      toast.error('Failed to submit request. Please try again.');
      setLoading(false);
      return;
    }

    // Notify customer
    await supabase.from('notifications').insert({
      id: generateId('NT'),
      customer_id: currentCustomer.id,
      title: 'Contact Change Request Submitted',
      message: 'Your request to update contact details has been submitted. Our team will review and apply the changes within 1–2 business days.',
      type: 'info',
      is_read: false,
      created_at: new Date().toISOString(),
    });

    setPendingRequest({
      id: newId,
      requestedFields,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    toast.success('Change request submitted! Our team will verify and apply it shortly.');
    setShowForm(false);
    setRequestMobile('');
    setRequestEmail('');
    setLoading(false);
  };

  const handleInitiateKYC = async () => {
    setKycLoading(true);
    const result = await initiateKYC();
    setKycLoading(false);
    if (result.success) toast.success('KYC request submitted! Our team will review it shortly.');
    else toast.error(result.error || 'Failed to submit KYC request');
  };

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-5">
      {/* Profile header */}
      <div className="bg-gradient-to-br from-emerald-800/30 to-teal-900/20 border border-emerald-700/30 rounded-2xl p-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-900/40">
          <span className="text-2xl font-bold text-white">{currentCustomer.fullName.charAt(0)}</span>
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-white">{currentCustomer.fullName}</h2>
          <p className="text-emerald-400/70 text-sm">{currentCustomer.id} · {currentCustomer.accountType}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1', kycColor)}>
              <Shield className="w-3 h-3" />{currentCustomer.kycStatus}
            </span>
            <span className={cn(
              'text-xs font-semibold px-2.5 py-1 rounded-full border',
              currentCustomer.accountStatus === 'Active'
                ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
                : 'text-amber-300 bg-amber-500/10 border-amber-500/20'
            )}>
              {currentCustomer.accountStatus}
            </span>
          </div>
        </div>
      </div>

      {/* KYC action banner */}
      {currentCustomer.kycStatus !== 'Verified' && (
        <div className={cn(
          'border rounded-2xl p-4 flex items-start gap-4',
          currentCustomer.kycStatus === 'Pending' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-red-500/10 border-red-500/30'
        )}>
          <AlertTriangle className={cn('w-5 h-5 mt-0.5 flex-shrink-0',
            currentCustomer.kycStatus === 'Pending' ? 'text-amber-400' : 'text-red-400'
          )} />
          <div className="flex-1">
            <p className={cn('text-sm font-bold',
              currentCustomer.kycStatus === 'Pending' ? 'text-amber-300' : 'text-red-300'
            )}>KYC Verification Required</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Submit your KYC to unlock all banking features and fully activate your account.
            </p>
          </div>
          <button
            onClick={handleInitiateKYC}
            disabled={kycLoading}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs rounded-lg transition-all flex-shrink-0 disabled:opacity-60 whitespace-nowrap"
          >
            {kycLoading
              ? <><Clock className="w-3.5 h-3.5 animate-spin" /> Submitting...</>
              : <><Shield className="w-3.5 h-3.5" /> Initiate KYC</>
            }
          </button>
        </div>
      )}

      {/* Request Contact Change */}
      <div className="bg-[#061a10] border border-emerald-900/40 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <Phone className="w-4 h-4 text-emerald-400" />Request Contact Change
          </h3>
          {!pendingRequest && !loadingStatus && (
            <button
              onClick={() => setShowForm(f => !f)}
              className="text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-700/40 px-3 py-1.5 rounded-lg transition-all"
            >
              {showForm ? 'Cancel' : 'Request Change'}
            </button>
          )}
        </div>

        {loadingStatus ? (
          <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
            <Clock className="w-3.5 h-3.5 animate-spin" /> Checking request status…
          </div>
        ) : pendingRequest ? (
          /* Show existing request status */
          <div className={cn(
            'border rounded-xl p-4',
            pendingRequest.status === 'pending'
              ? 'bg-amber-500/10 border-amber-500/20'
              : 'bg-emerald-500/10 border-emerald-500/20'
          )}>
            <div className="flex items-center gap-2 mb-2">
              <FileSearch className={cn('w-4 h-4', pendingRequest.status === 'pending' ? 'text-amber-400' : 'text-emerald-400')} />
              <span className={cn('text-xs font-bold uppercase',
                pendingRequest.status === 'pending' ? 'text-amber-300' : 'text-emerald-300'
              )}>
                {pendingRequest.status === 'pending' ? 'Request Under Review' : 'Request Approved'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              {pendingRequest.status === 'pending'
                ? 'Your change request is being reviewed by our team. You will be notified once it is processed.'
                : 'Your contact details have been updated successfully.'}
            </p>
            <div className="space-y-1">
              {pendingRequest.requestedFields.mobile && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">New Mobile</span>
                  <span className="text-white font-mono">{pendingRequest.requestedFields.mobile}</span>
                </div>
              )}
              {pendingRequest.requestedFields.email && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">New Email</span>
                  <span className="text-white">{pendingRequest.requestedFields.email}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs mt-1 pt-1 border-t border-slate-700/30">
                <span className="text-slate-500">Submitted</span>
                <span className="text-slate-400">{formatDateShort(pendingRequest.createdAt)}</span>
              </div>
            </div>
          </div>
        ) : !showForm ? (
          <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-3 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-sky-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-sky-300">
              To update your mobile number or email address, submit a change request.
              A bank representative will verify and apply the change within 1–2 business days.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmitRequest} className="space-y-4 mt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                New Mobile Number
              </label>
              <input
                value={requestMobile}
                onChange={e => setRequestMobile(e.target.value)}
                placeholder={`Current: ${currentCustomer.mobile}`}
                className="w-full bg-[#040d08] border border-emerald-900/40 rounded-lg px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-600 transition-colors"
              />
              <p className="text-[10px] text-slate-500 mt-1">Leave blank if not changing</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                New Email Address
              </label>
              <input
                type="email"
                value={requestEmail}
                onChange={e => setRequestEmail(e.target.value)}
                placeholder={`Current: ${currentAuth?.email || currentCustomer.email}`}
                className="w-full bg-[#040d08] border border-emerald-900/40 rounded-lg px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-600 transition-colors"
              />
              <p className="text-[10px] text-slate-500 mt-1">Leave blank if not changing</p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading
                ? <><Clock className="w-4 h-4 animate-spin" /> Submitting...</>
                : <><Send className="w-4 h-4" /> Submit Change Request</>
              }
            </button>
          </form>
        )}
      </div>

      {/* Personal info */}
      <div className="bg-[#061a10] border border-emerald-900/40 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
          <User className="w-4 h-4 text-emerald-400" />Personal Information
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[
            { label: 'Full Name', value: currentCustomer.fullName },
            { label: 'Customer ID', value: currentCustomer.id },
            { label: 'Aadhaar', value: maskAadhaar(currentCustomer.aadhaar) },
            { label: 'PAN', value: maskPAN(currentCustomer.pan) },
            { label: 'Date of Account Opening', value: formatDateShort(currentCustomer.dateOpened) },
            { label: 'Branch', value: currentCustomer.branch },
            { label: 'Account Number', value: currentCustomer.accountNumber },
            { label: 'Account Type', value: currentCustomer.accountType },
            { label: 'Bank Name', value: currentCustomer.bankName },
            { label: 'IFSC Code', value: currentCustomer.ifscCode },
          ].map(f => (
            <div key={f.label}>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">{f.label}</p>
              <p className="text-sm text-white mt-0.5 font-medium">{f.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Contact info */}
      <div className="bg-[#061a10] border border-emerald-900/40 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
          <Phone className="w-4 h-4 text-emerald-400" />Contact Details
          <span className="ml-auto text-[10px] text-slate-500 italic">(To update, use Request Change above)</span>
        </h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Phone className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-slate-500">Mobile</p>
              <p className="text-sm text-white">{currentCustomer.mobile}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Mail className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-slate-500">Email</p>
              <p className="text-sm text-white">{currentAuth?.email || currentCustomer.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <MapPin className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-slate-500">Branch</p>
              <p className="text-sm text-white">{currentCustomer.branch}</p>
            </div>
          </div>
          <div className="border-t border-emerald-900/30 pt-3 mt-3 space-y-3">
            <div className="flex items-center gap-3">
              <Building2 className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <div>
                <p className="text-[10px] text-slate-500">Bank Name</p>
                <p className="text-sm text-white">{currentCustomer.bankName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Hash className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <div>
                <p className="text-[10px] text-slate-500">Account Number</p>
                <p className="text-sm text-white font-mono tracking-wider">{currentCustomer.accountNumber}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Hash className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <div>
                <p className="text-[10px] text-slate-500">IFSC Code</p>
                <p className="text-sm text-white font-mono">{currentCustomer.ifscCode}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="bg-[#061a10] border border-emerald-900/40 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400" />Security
        </h3>
        <div className="space-y-2">
          {[
            { label: '2-Factor Authentication', status: true },
            { label: 'SMS Alerts', status: true },
            { label: 'Email Notifications', status: true },
          ].map(s => (
            <div key={s.label} className="flex items-center justify-between py-2">
              <span className="text-sm text-slate-300">{s.label}</span>
              <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium">
                <CheckCircle className="w-3.5 h-3.5" />Active
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
