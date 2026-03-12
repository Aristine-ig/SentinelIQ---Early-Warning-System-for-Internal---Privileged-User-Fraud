import { useState } from 'react';
import { useCustomer } from '@/lib/customerStore';
import { formatDateShort, maskAadhaar, maskPAN, cn } from '@/lib/utils';
import { User, Phone, Mail, MapPin, Shield, Edit2, CheckCircle, Building2, Hash, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function CustomerProfileView() {
  const { state, updateProfile, initiateKYC } = useCustomer();
  const [editing, setEditing] = useState(false);
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [kycLoading, setKycLoading] = useState(false);

  const { currentCustomer, currentAuth } = state;
  if (!currentCustomer) return null;

  const startEdit = () => { setMobile(currentCustomer.mobile); setEmail(currentAuth?.email || ''); setEditing(true); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const ok = await updateProfile(mobile, email);
    setLoading(false);
    if (ok) { toast.success('Profile updated successfully'); setEditing(false); }
    else toast.error('Failed to update profile');
  };

  const handleInitiateKYC = async () => {
    setKycLoading(true);
    const result = await initiateKYC();
    setKycLoading(false);
    if (result.success) toast.success('KYC request submitted! Our team will review it shortly.');
    else toast.error(result.error || 'Failed to submit KYC request');
  };

  const kycColor = currentCustomer.kycStatus === 'Verified' ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30' :
    currentCustomer.kycStatus === 'Pending' ? 'text-amber-400 bg-amber-500/15 border-amber-500/30' :
    'text-red-400 bg-red-500/15 border-red-500/30';

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
            <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1", kycColor)}>
              <Shield className="w-3 h-3" />{currentCustomer.kycStatus}
            </span>
            <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full border",
              currentCustomer.accountStatus === 'Active' ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' :
              'text-amber-300 bg-amber-500/10 border-amber-500/20'
            )}>
              {currentCustomer.accountStatus}
            </span>
          </div>
        </div>
        {!editing && (
          <button onClick={startEdit} className="p-2.5 text-slate-400 hover:text-emerald-300 hover:bg-emerald-900/20 rounded-xl transition-all">
            <Edit2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* KYC action banner */}
      {currentCustomer.kycStatus !== 'Verified' && (
        <div className={cn(
          "border rounded-2xl p-4 flex items-start gap-4",
          currentCustomer.kycStatus === 'Pending' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-red-500/10 border-red-500/30'
        )}>
          <AlertTriangle className={cn("w-5 h-5 mt-0.5 flex-shrink-0",
            currentCustomer.kycStatus === 'Pending' ? 'text-amber-400' : 'text-red-400'
          )} />
          <div className="flex-1">
            <p className={cn("text-sm font-bold",
              currentCustomer.kycStatus === 'Pending' ? 'text-amber-300' : 'text-red-300'
            )}>
              KYC Verification Required
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Submit your KYC to unlock all banking features and fully activate your account.
              Our team will review and verify your details within 1-2 business days.
            </p>
          </div>
          <button
            onClick={handleInitiateKYC}
            disabled={kycLoading}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs rounded-lg transition-all flex-shrink-0 disabled:opacity-60 whitespace-nowrap">
            {kycLoading
              ? <><Clock className="w-3.5 h-3.5 animate-spin" /> Submitting...</>
              : <><Shield className="w-3.5 h-3.5" /> Initiate KYC</>}
          </button>
        </div>
      )}

      {/* Edit form */}
      {editing ? (
        <form onSubmit={handleSave} className="bg-[#061a10] border border-emerald-700/30 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-emerald-300">Edit Contact Details</h3>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">Mobile Number</label>
            <input value={mobile} onChange={e => setMobile(e.target.value)}
              className="w-full bg-[#040d08] border border-emerald-900/40 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-600 transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full bg-[#040d08] border border-emerald-900/40 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-600 transition-colors" />
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={loading}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50">
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
            <button type="button" onClick={() => setEditing(false)}
              className="px-4 py-2.5 text-slate-400 hover:text-white bg-slate-700/30 hover:bg-slate-700/60 rounded-lg transition-colors">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
