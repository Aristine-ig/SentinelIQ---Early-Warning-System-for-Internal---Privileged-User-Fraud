import { useState } from 'react';
import { X, Eye, Phone, Mail, DollarSign, FileText, Zap, CreditCard, AlertTriangle, ShieldAlert } from 'lucide-react';
import { useApp } from '@/lib/store';
import { cn, maskAadhaar, maskPAN, formatCurrency, formatDateShort, formatDate, generateId } from '@/lib/utils';
import type { Customer } from '@/types';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface Props {
  customer: Customer;
  onClose: () => void;
}

type ActionModal = 'none' | 'modify_contact' | 'transaction' | 'report' | 'loan';

export default function CustomerProfile({ customer, onClose }: Props) {
  const { logAction, updateCustomer, state } = useApp();
  const [actionModal, setActionModal] = useState<ActionModal>('none');

  // Modify Contact Form
  const [newMobile, setNewMobile] = useState(customer.mobile);
  const [newEmail, setNewEmail] = useState(customer.email);

  // Transaction Form
  const [txAmount, setTxAmount] = useState('');
  const [txBeneficiary, setTxBeneficiary] = useState('');

  // Report Form
  const [reportFields, setReportFields] = useState<string[]>(['Name', 'Account Number']);
  const [reportCount, setReportCount] = useState('60');

  // Loan Form
  const [loanAmount, setLoanAmount] = useState('');
  const [kycChecks, setKycChecks] = useState({ identity: false, income: false, address: false });
  const [sameOfficer, setSameOfficer] = useState(false);
  const [noIncomeVerif, setNoIncomeVerif] = useState(false);

  const isDormant = customer.accountStatus === 'Dormant';
  const { currentUser } = state;

  const handleViewAccount = () => {
    logAction('VIEW_ACCOUNT', currentUser?.systemAccess || 'Core Banking', customer.id, {});
    toast.success(`Viewing account ${customer.id}`);
  };

  const handleModifyContact = (e: React.FormEvent) => {
    e.preventDefault();
    const fields: string[] = [];
    if (newMobile !== customer.mobile) fields.push('mobile');
    if (newEmail !== customer.email) fields.push('email');
    if (fields.length === 0) {
      toast.info('No changes detected');
      return;
    }

    // Fire MODIFY_CONTACT with no_request flag → triggers R070–R073
    logAction('MODIFY_CONTACT', 'Core Banking', customer.id, {
      fields,
      newMobile,
      newEmail,
      previousMobile: customer.mobile,
      previousEmail: customer.email,
      hasApprovedRequest: false,   // ← triggers fraud rules
    },
      [
        'R070',  // unauthorized modification
        ...(isDormant && fields.includes('mobile') ? ['R071'] : []),
        ...(isDormant && fields.includes('email')  ? ['R072'] : []),
        ...(fields.includes('mobile') && fields.includes('email') ? ['R073'] : []),
      ]
    );

    updateCustomer({ ...customer, mobile: newMobile, email: newEmail });

    // Notify the affected customer so they see it in their notification panel
    const changedParts: string[] = [];
    if (fields.includes('mobile')) changedParts.push(`mobile number changed to ${newMobile}`);
    if (fields.includes('email')) changedParts.push(`email address changed to ${newEmail}`);
    const now = new Date().toISOString();
    supabase.from('notifications').insert({
      id: generateId('NT'),
      customer_id: customer.id,
      title: '⚠️ Contact Details Changed Without Your Request',
      message: `Your account contact details were modified by bank staff without any verified request from you: ${changedParts.join(', ')}. If you did NOT authorise this change, please contact your branch immediately or call our fraud helpline.`,
      type: 'alert',
      is_read: false,
      created_at: now,
    }).then(({ error }) => {
      if (error) console.error('Notification insert error:', error);
    });

    toast.warning('Contact details forcefully updated — FRAUD RULES TRIGGERED (R070+)', { duration: 5000 });
    setActionModal('none');
  };

  const handleTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(txAmount);
    logAction('INITIATE_TRANSACTION', currentUser?.systemAccess || 'Core Banking', customer.id, {
      amount,
      beneficiary: txBeneficiary,
    });
    toast.success(`Transaction of ${formatCurrency(amount)} initiated to ${txBeneficiary}`);
    setActionModal('none');
    setTxAmount('');
    setTxBeneficiary('');

    if (isDormant) toast.warning('⚠️ Transaction on Dormant account flagged', { duration: 4000 });
  };

  const handleReport = (e: React.FormEvent) => {
    e.preventDefault();
    const count = parseInt(reportCount);
    logAction('RUN_REPORT', currentUser?.systemAccess || 'Core Banking', customer.id, {
      recordCount: count,
      fields: reportFields,
    });
    toast.success(`Report generated with ${count} records (${reportFields.join(', ')})`);
    setActionModal('none');
  };

  const handleOTP = () => {
    logAction('TRIGGER_OTP', 'Core Banking', customer.id, {});
    toast.success(`OTP sent to ${customer.mobile}`);
    if (isDormant) toast.warning('⚠️ OTP triggered on Dormant account — checking timing', { duration: 4000 });
  };

  const handleLoan = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(loanAmount);
    const allChecked = kycChecks.identity && kycChecks.income && kycChecks.address;
    logAction('APPROVE_LOAN', 'Loan Origination', customer.id, {
      amount,
      sameOfficer,
      incompleteKYC: !allChecked,
      noIncomeVerification: noIncomeVerif,
      newBorrower: Math.random() < 0.3,
    }, ['R062', 'R063'].filter(() => Math.random() < 0.2));
    toast.success(`Loan of ${formatCurrency(amount)} processed`);
    setActionModal('none');
  };

  const REPORT_FIELD_OPTIONS = ['Name', 'Account Number', 'Balance', 'PAN', 'Aadhaar', 'Mobile', 'Email'];

  const toggleReportField = (field: string) => {
    setReportFields(prev =>
      prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#0d1f35] border border-slate-700/50 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-[#0d1f35] border-b border-slate-700/50 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            {isDormant && <AlertTriangle className="w-5 h-5 text-red-400 animate-pulse" />}
            <div>
              <h2 className="text-base font-bold text-white">{customer.fullName}</h2>
              <p className="text-xs text-slate-400">{customer.id}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Dormant Warning */}
          {isDormant && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-300">DORMANT ACCOUNT</p>
                <p className="text-xs text-red-300/70 mt-0.5">
                  This account has been dormant for {Math.round((new Date().getTime() - new Date(customer.lastTransactionDate).getTime()) / (1000 * 60 * 60 * 24 * 30))} months.
                  All actions on this account are monitored.
                </p>
              </div>
            </div>
          )}

          {/* Customer Details */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Account Number', value: customer.accountNumber },
              { label: 'Account Type', value: customer.accountType },
              { label: 'Balance', value: formatCurrency(customer.balance) },
              { label: 'Account Status', value: customer.accountStatus },
              { label: 'Aadhaar', value: maskAadhaar(customer.aadhaar) },
              { label: 'PAN', value: maskPAN(customer.pan) },
              { label: 'Mobile', value: customer.mobile },
              { label: 'Email', value: customer.email },
              { label: 'Branch', value: customer.branch },
              { label: 'KYC Status', value: customer.kycStatus },
              { label: 'Date Opened', value: formatDateShort(customer.dateOpened) },
              { label: 'Last Transaction', value: formatDateShort(customer.lastTransactionDate) },
            ].map(f => (
              <div key={f.label} className="bg-[#060e1a] rounded-lg p-3 border border-slate-700/30">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">{f.label}</p>
                <p className={cn("text-sm font-medium mt-0.5",
                  f.label === 'Account Status' && customer.accountStatus === 'Dormant' ? 'text-red-400' :
                  f.label === 'Account Status' && customer.accountStatus === 'Inactive' ? 'text-amber-400' :
                  f.label === 'Balance' ? 'text-emerald-400 font-bold' : 'text-white'
                )}>
                  {f.value}
                </p>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <button
              onClick={() => { handleViewAccount(); }}
              className="flex items-center gap-2 px-4 py-3 bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/30 text-sky-300 rounded-xl text-sm font-medium transition-all"
            >
              <Eye className="w-4 h-4" /> View Account
            </button>
            <button
              onClick={() => setActionModal('modify_contact')}
              className={cn(
                'flex items-center gap-2 px-4 py-3 border rounded-xl text-sm font-medium transition-all',
                'bg-red-500/10 hover:bg-red-500/20 border-red-500/30 text-red-300'
              )}
            >
              <ShieldAlert className="w-4 h-4" /> Force Modify Contact ⚠️
            </button>
            <button
              onClick={() => setActionModal('transaction')}
              className="flex items-center gap-2 px-4 py-3 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 rounded-xl text-sm font-medium transition-all"
            >
              <DollarSign className="w-4 h-4" /> Initiate Transaction
            </button>
            <button
              onClick={() => setActionModal('report')}
              className="flex items-center gap-2 px-4 py-3 bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/30 text-purple-300 rounded-xl text-sm font-medium transition-all"
            >
              <FileText className="w-4 h-4" /> Run Report
            </button>
            <button
              onClick={handleOTP}
              className={cn(
                "flex items-center gap-2 px-4 py-3 border rounded-xl text-sm font-medium transition-all",
                isDormant
                  ? "bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-300"
                  : "bg-slate-700/20 hover:bg-slate-700/40 border-slate-600/30 text-slate-300"
              )}
            >
              <Zap className="w-4 h-4" /> Trigger OTP
            </button>
            {(currentUser?.role === 'Loan Officer' || currentUser?.isAdmin) && (
              <button
                onClick={() => setActionModal('loan')}
                className="flex items-center gap-2 px-4 py-3 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 rounded-xl text-sm font-medium transition-all"
              >
                <CreditCard className="w-4 h-4" /> Approve Loan
              </button>
            )}
          </div>
        </div>

        {/* Modals */}
        {actionModal !== 'none' && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setActionModal('none')} />
            <div className="relative bg-[#0a1628] border border-slate-700/50 rounded-xl w-full max-w-md p-6 shadow-2xl">

              {actionModal === 'modify_contact' && (
                <form onSubmit={handleModifyContact}>
                  <h3 className="text-base font-bold text-white mb-2">Force Modify Contact Details</h3>
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
                    <p className="text-xs text-red-300 font-semibold flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5" /> WARNING — No customer request on file</p>
                    <p className="text-xs text-red-300/70 mt-1">Modifying contact without a verified customer request will automatically trigger fraud rules R070–R073 and add risk to your session score.</p>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Mobile Number</label>
                      <input value={newMobile} onChange={e => setNewMobile(e.target.value)}
                        className="w-full bg-[#060e1a] border border-slate-700/40 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
                      <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                        className="w-full bg-[#060e1a] border border-slate-700/40 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50" />
                    </div>
                  </div>
                  <div className="flex gap-3 mt-5">
                    <button type="button" onClick={() => setActionModal('none')}
                      className="flex-1 py-2 text-sm text-slate-300 bg-slate-700/40 hover:bg-slate-700/60 rounded-lg font-medium transition-all">Cancel</button>
                    <button type="submit"
                      className="flex-1 py-2 text-sm text-white bg-sky-600 hover:bg-sky-500 rounded-lg font-semibold transition-all">Save Changes</button>
                  </div>
                </form>
              )}

              {actionModal === 'transaction' && (
                <form onSubmit={handleTransaction}>
                  <h3 className="text-base font-bold text-white mb-4">Initiate Transaction</h3>
                  {isDormant && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
                      <p className="text-xs text-red-300 font-semibold">⚠️ Transaction on Dormant account will be flagged</p>
                    </div>
                  )}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Amount (₹)</label>
                      <input type="number" value={txAmount} onChange={e => setTxAmount(e.target.value)}
                        min="1" required
                        className="w-full bg-[#060e1a] border border-slate-700/40 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50"
                        placeholder="e.g. 50000" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Beneficiary Account</label>
                      <input value={txBeneficiary} onChange={e => setTxBeneficiary(e.target.value)}
                        required
                        className="w-full bg-[#060e1a] border border-slate-700/40 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50"
                        placeholder="Account number or name" />
                    </div>
                  </div>
                  <div className="flex gap-3 mt-5">
                    <button type="button" onClick={() => setActionModal('none')}
                      className="flex-1 py-2 text-sm text-slate-300 bg-slate-700/40 rounded-lg font-medium">Cancel</button>
                    <button type="submit"
                      className="flex-1 py-2 text-sm text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg font-semibold transition-all">Initiate</button>
                  </div>
                </form>
              )}

              {actionModal === 'report' && (
                <form onSubmit={handleReport}>
                  <h3 className="text-base font-bold text-white mb-4">Run Report</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-2">Fields to Include</label>
                      <div className="flex flex-wrap gap-2">
                        {REPORT_FIELD_OPTIONS.map(f => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => toggleReportField(f)}
                            className={cn(
                              "px-2.5 py-1 text-xs rounded-lg border transition-all font-medium",
                              reportFields.includes(f)
                                ? (f === 'PAN' || f === 'Aadhaar' ? "bg-red-500/20 border-red-500/40 text-red-300" : "bg-sky-600/20 border-sky-500/30 text-sky-300")
                                : "bg-slate-700/20 border-slate-600/30 text-slate-400 hover:text-white"
                            )}
                          >
                            {f}
                            {(f === 'PAN' || f === 'Aadhaar') && ' ⚠️'}
                          </button>
                        ))}
                      </div>
                      {(reportFields.includes('PAN') || reportFields.includes('Aadhaar')) && (
                        <p className="text-xs text-red-300 mt-1">Including sensitive PII fields will trigger fraud rules</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Number of Records</label>
                      <input type="number" value={reportCount} onChange={e => setReportCount(e.target.value)}
                        min="1" max="60" required
                        className="w-full bg-[#060e1a] border border-slate-700/40 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50" />
                      <p className="text-xs text-slate-500 mt-1">Max: 60 records in this system</p>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-5">
                    <button type="button" onClick={() => setActionModal('none')}
                      className="flex-1 py-2 text-sm text-slate-300 bg-slate-700/40 rounded-lg font-medium">Cancel</button>
                    <button type="submit"
                      className="flex-1 py-2 text-sm text-white bg-purple-600 hover:bg-purple-500 rounded-lg font-semibold transition-all">Generate Report</button>
                  </div>
                </form>
              )}

              {actionModal === 'loan' && (
                <form onSubmit={handleLoan}>
                  <h3 className="text-base font-bold text-white mb-4">Loan Approval</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Loan Amount (₹)</label>
                      <input type="number" value={loanAmount} onChange={e => setLoanAmount(e.target.value)}
                        min="10000" required
                        className="w-full bg-[#060e1a] border border-slate-700/40 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50"
                        placeholder="e.g. 500000" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-300 mb-2">KYC Checklist</p>
                      {[
                        { key: 'identity', label: 'Identity Verified' },
                        { key: 'income', label: 'Income Documents Submitted' },
                        { key: 'address', label: 'Address Proof Verified' },
                      ].map(item => (
                        <label key={item.key} className="flex items-center gap-2 py-1.5 cursor-pointer">
                          <input type="checkbox"
                            checked={kycChecks[item.key as keyof typeof kycChecks]}
                            onChange={e => setKycChecks({ ...kycChecks, [item.key]: e.target.checked })}
                            className="rounded" />
                          <span className="text-sm text-slate-300">{item.label}</span>
                        </label>
                      ))}
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                      <input type="checkbox" checked={sameOfficer} onChange={e => setSameOfficer(e.target.checked)} className="rounded" />
                      <span className="text-xs text-red-300">I am both originating and approving this loan ⚠️</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                      <input type="checkbox" checked={noIncomeVerif} onChange={e => setNoIncomeVerif(e.target.checked)} className="rounded" />
                      <span className="text-xs text-amber-300">Approve without income verification ⚠️</span>
                    </label>
                  </div>
                  <div className="flex gap-3 mt-5">
                    <button type="button" onClick={() => setActionModal('none')}
                      className="flex-1 py-2 text-sm text-slate-300 bg-slate-700/40 rounded-lg font-medium">Cancel</button>
                    <button type="submit"
                      className="flex-1 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg font-semibold transition-all">Approve Loan</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
