import { useState } from 'react';
import { useCustomer } from '@/lib/customerStore';
import type { Beneficiary } from '@/lib/customerStore';
import { cn } from '@/lib/utils';
import { Plus, Trash2, Building, CheckCircle, X, Info } from 'lucide-react';
import { toast } from 'sonner';

const BANKS = ['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank', 'Kotak Mahindra Bank', 'Punjab National Bank', 'Bank of Baroda', 'Canara Bank', 'Union Bank', 'IDFC First Bank'];

export default function BeneficiaryManager() {
  const { state, addBeneficiary, removeBeneficiary } = useCustomer();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', accountNumber: '', confirmAccount: '', bankName: '', ifscCode: '', nickname: '' });
  const [loading, setLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.accountNumber !== form.confirmAccount) { toast.error('Account numbers do not match'); return; }
    setLoading(true);
    const ok = await addBeneficiary({
      name: form.name, accountNumber: form.accountNumber,
      bankName: form.bankName, ifscCode: form.ifscCode, nickname: form.nickname,
    });
    setLoading(false);
    if (ok) {
      toast.success(`${form.name} added as beneficiary`);
      setForm({ name: '', accountNumber: '', confirmAccount: '', bankName: '', ifscCode: '', nickname: '' });
      setShowForm(false);
    } else {
      toast.error('Failed to add beneficiary');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const ok = await removeBeneficiary(id);
    if (ok) { toast.success(`${name} removed`); setDeleteId(null); }
    else toast.error('Failed to remove beneficiary');
  };

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Beneficiaries</h2>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'Add Beneficiary'}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-[#061a10] border border-emerald-700/30 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-emerald-300">New Beneficiary</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BI label="Full Name" value={form.name} onChange={set('name')} placeholder="Recipient's full name" />
            <BI label="Nickname (optional)" value={form.nickname} onChange={set('nickname')} placeholder="e.g. Mom" />
            <BI label="Account Number" value={form.accountNumber} onChange={set('accountNumber')} placeholder="12-digit account number" />
            <BI label="Confirm Account Number" value={form.confirmAccount} onChange={set('confirmAccount')} placeholder="Re-enter account number" />
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">Bank Name</label>
              <select value={form.bankName} onChange={e => set('bankName')(e.target.value)} required
                className="w-full bg-[#040d08] border border-emerald-900/40 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-600 transition-colors">
                <option value="">Select bank...</option>
                {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <BI label="IFSC Code" value={form.ifscCode} onChange={set('ifscCode')} placeholder="e.g. HDFC0001234" />
          </div>
          {form.accountNumber && form.confirmAccount && form.accountNumber !== form.confirmAccount && (
            <p className="text-xs text-red-400">Account numbers do not match</p>
          )}
          <button type="submit" disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50">
            {loading ? 'Adding...' : 'Add Beneficiary'}
          </button>
        </form>
      )}

      {/* List */}
      {state.beneficiaries.length === 0 ? (
        <div className="bg-[#061a10] border border-emerald-900/40 rounded-xl p-8 text-center">
          <Info className="w-8 h-8 text-slate-500 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">No beneficiaries added yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {state.beneficiaries.map(ben => (
            <div key={ben.id} className="bg-[#061a10] border border-emerald-900/40 rounded-xl p-4 flex items-center gap-4 hover:border-emerald-700/40 transition-colors">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center flex-shrink-0 font-bold text-white text-lg">
                {ben.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white">{ben.name}</p>
                  {ben.nickname && <span className="text-xs text-emerald-400/70 bg-emerald-900/30 px-1.5 py-0.5 rounded">{ben.nickname}</span>}
                </div>
                <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                  <Building className="w-3 h-3" />{ben.bankName}
                </p>
                <p className="text-xs text-slate-500 font-mono mt-0.5">···· ···· {ben.accountNumber.slice(-4)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-slate-500 bg-slate-700/30 px-2 py-1 rounded hidden lg:block">{ben.ifscCode}</span>
                {deleteId === ben.id ? (
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleDelete(ben.id, ben.name)}
                      className="text-xs text-red-400 hover:text-red-300 bg-red-900/20 border border-red-700/30 px-2 py-1 rounded-lg transition-colors">
                      Confirm
                    </button>
                    <button onClick={() => setDeleteId(null)} className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setDeleteId(ben.id)} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-900/10 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BI({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-[#040d08] border border-emerald-900/40 rounded-lg px-3 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-600 transition-colors" />
    </div>
  );
}
