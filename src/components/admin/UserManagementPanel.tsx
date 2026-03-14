import { useState } from 'react';
import { Plus, Edit, ChevronRight, Search, Shield, UserCheck, UserX } from 'lucide-react';
import { useApp } from '@/lib/store';
import { cn, formatDate, getSeverityBg, getSeverity } from '@/lib/utils';
import { ROLES, SYSTEMS } from '@/constants';
import type { AppUser, Role, SystemAccess } from '@/types';
import { toast } from 'sonner';
import { generateId, subtractDays } from '@/lib/utils';

interface UserFormData {
  loginId: string;
  password: string;
  fullName: string;
  role: Role;
  department: string;
  systemAccess: SystemAccess;
  isAdmin: boolean;
}

const DEFAULT_FORM: UserFormData = {
  loginId: '',
  password: '',
  fullName: '',
  role: 'Teller',
  department: '',
  systemAccess: 'Core Banking',
  isAdmin: false,
};

export default function UserManagementPanel() {
  const { state, addUser, updateUser, logAction } = useApp();
  const { users, sessions, activityLogs } = state;
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [form, setForm] = useState<UserFormData>(DEFAULT_FORM);
  const [viewLogsFor, setViewLogsFor] = useState<AppUser | null>(null);
  const [tab, setTab] = useState<'users' | 'logs'>('users');

  const filtered = users.filter(u =>
    u.fullName.toLowerCase().includes(search.toLowerCase()) ||
    u.loginId.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditingUser(null);
    setForm(DEFAULT_FORM);
    setShowForm(true);
  };

  const openEdit = (user: AppUser) => {
    setEditingUser(user);
    setForm({
      loginId: user.loginId,
      password: user.password,
      fullName: user.fullName,
      role: user.role,
      department: user.department,
      systemAccess: user.systemAccess,
      isAdmin: user.isAdmin,
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      const updated: AppUser = { ...editingUser, ...form };
      updateUser(updated);
      logAction('EDIT_USER', 'All Systems', undefined, { targetUserId: editingUser.id });
      toast.success(`${form.fullName}'s account updated`);
    } else {
      const newUser: AppUser = {
        id: generateId('USR'),
        ...form,
        status: 'active',
        createdAt: new Date().toISOString(),
      };
      addUser(newUser);
      logAction('CREATE_USER', 'All Systems', undefined, { newUserId: newUser.id });
      toast.success(`Account created for ${form.fullName}`);
    }
    setShowForm(false);
  };

  const handleDeactivate = (user: AppUser) => {
    const newStatus = user.status === 'active' ? 'suspended' : 'active';
    updateUser({ ...user, status: newStatus });
    logAction('DEACTIVATE_USER', 'All Systems', undefined, { targetUserId: user.id, newStatus });
    toast.success(`${user.fullName} is now ${newStatus}`);
  };

  const handlePromote = (user: AppUser) => {
    updateUser({ ...user, isAdmin: !user.isAdmin });
    logAction('PROMOTE_USER', 'All Systems', undefined, { targetUserId: user.id });
    toast.success(`${user.fullName} ${user.isAdmin ? 'demoted from' : 'promoted to'} Admin`);
  };

  const userLogs = viewLogsFor
    ? activityLogs.filter(l => l.userId === viewLogsFor.id)
    : [];

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">User Management</h2>
          <p className="text-xs text-slate-400">{users.length} total accounts</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-sm font-semibold transition-all shadow-lg shadow-sky-900/30"
        >
          <Plus className="w-4 h-4" />
          New User
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search users..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-[#0d1f35] border border-slate-700/40 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
        />
      </div>

      {/* Users Table */}
      <div className="bg-[#0d1f35] border border-slate-700/40 rounded-xl overflow-hidden">
        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700/40 bg-[#060e1a]/50">
                {['User', 'Role', 'Department', 'System Access', 'Status', 'Risk', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(user => {
                const score = sessions[user.id]?.riskScore || 0;
                const sev = getSeverity(score);
                return (
                  <tr key={user.id} className="border-b border-slate-700/20 hover:bg-slate-700/10 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-600 to-blue-700 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-white">{user.fullName.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white flex items-center gap-1.5">
                            {user.fullName}
                            {user.isAdmin && <Shield className="w-3 h-3 text-sky-400" />}
                          </p>
                          <p className="text-xs text-slate-400">{user.loginId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">{user.role}</td>
                    <td className="px-4 py-3 text-xs text-slate-300">{user.department}</td>
                    <td className="px-4 py-3 text-xs text-slate-300">{user.systemAccess}</td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs font-medium px-2 py-1 rounded-full",
                        user.status === 'active' ? 'text-emerald-400 bg-emerald-400/10' :
                        user.status === 'suspended' ? 'text-amber-400 bg-amber-400/10' :
                        'text-slate-400 bg-slate-400/10'
                      )}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {score > 0 ? (
                        <span className={cn("text-xs font-bold px-2 py-1 rounded border", getSeverityBg(sev))}>
                          {score}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(user)}
                          className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-sky-400/10 rounded-lg transition-all"
                          title="Edit user"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeactivate(user)}
                          className={cn("p-1.5 rounded-lg transition-all",
                            user.status === 'active'
                              ? "text-slate-400 hover:text-amber-400 hover:bg-amber-400/10"
                              : "text-amber-400 hover:bg-amber-400/10"
                          )}
                          title={user.status === 'active' ? 'Suspend' : 'Activate'}
                        >
                          {user.status === 'active' ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => handlePromote(user)}
                          className="p-1.5 text-slate-400 hover:text-purple-400 hover:bg-purple-400/10 rounded-lg transition-all"
                          title={user.isAdmin ? 'Remove Admin' : 'Promote to Admin'}
                        >
                          <Shield className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setViewLogsFor(user)}
                          className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-all"
                          title="View logs"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile card list */}
        <div className="sm:hidden divide-y divide-slate-700/30">
          {filtered.map(user => {
            const score = sessions[user.id]?.riskScore || 0;
            const sev = getSeverity(score);
            return (
              <div key={user.id} className="p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-600 to-blue-700 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-white">{user.fullName.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate flex items-center gap-1">
                    {user.fullName}
                    {user.isAdmin && <Shield className="w-3 h-3 text-sky-400 flex-shrink-0" />}
                  </p>
                  <p className="text-[10px] text-slate-400">{user.role} · {user.department}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                      user.status === 'active' ? 'text-emerald-400 bg-emerald-400/10' :
                      user.status === 'suspended' ? 'text-amber-400 bg-amber-400/10' :
                      'text-slate-400 bg-slate-400/10'
                    )}>{user.status}</span>
                    {score > 0 && (
                      <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", getSeverityBg(sev))}>{score}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button onClick={() => openEdit(user)} className="p-2 text-slate-400 hover:text-sky-400 rounded-lg transition-all" title="Edit">
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDeactivate(user)} className={cn("p-2 rounded-lg transition-all", user.status === 'active' ? 'text-slate-400 hover:text-amber-400' : 'text-amber-400')} title={user.status === 'active' ? 'Suspend' : 'Activate'}>
                    {user.status === 'active' ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => setViewLogsFor(user)} className="p-2 text-slate-400 hover:text-emerald-400 rounded-lg transition-all" title="Logs">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative bg-[#0d1f35] border border-slate-700/50 rounded-2xl w-full max-w-lg p-4 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-base sm:text-lg font-bold text-white mb-4 sm:mb-5">
              {editingUser ? `Edit ${editingUser.fullName}` : 'Create New User'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Full Name</label>
                  <input
                    value={form.fullName}
                    onChange={e => setForm({ ...form, fullName: e.target.value })}
                    className="w-full bg-[#060e1a] border border-slate-700/40 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Login ID</label>
                  <input
                    value={form.loginId}
                    onChange={e => setForm({ ...form, loginId: e.target.value })}
                    className="w-full bg-[#060e1a] border border-slate-700/40 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50"
                    required
                    disabled={!!editingUser}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    className="w-full bg-[#060e1a] border border-slate-700/40 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Department</label>
                  <input
                    value={form.department}
                    onChange={e => setForm({ ...form, department: e.target.value })}
                    className="w-full bg-[#060e1a] border border-slate-700/40 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Role</label>
                  <select
                    value={form.role}
                    onChange={e => setForm({ ...form, role: e.target.value as Role })}
                    className="w-full bg-[#060e1a] border border-slate-700/40 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50"
                  >
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">System Access</label>
                  <select
                    value={form.systemAccess}
                    onChange={e => setForm({ ...form, systemAccess: e.target.value as SystemAccess })}
                    className="w-full bg-[#060e1a] border border-slate-700/40 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50"
                  >
                    {SYSTEMS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isAdmin}
                  onChange={e => setForm({ ...form, isAdmin: e.target.checked })}
                  className="rounded border-slate-600"
                />
                <span className="text-sm text-slate-300">Grant Administrator Access</span>
              </label>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2.5 text-sm text-slate-300 bg-slate-700/40 hover:bg-slate-700/60 rounded-lg font-medium transition-all border border-slate-600/40">
                  Cancel
                </button>
                <button type="submit"
                  className="flex-1 px-4 py-2.5 text-sm text-white bg-sky-600 hover:bg-sky-500 rounded-lg font-semibold transition-all">
                  {editingUser ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Logs Modal */}
      {viewLogsFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setViewLogsFor(null)} />
          <div className="relative bg-[#0d1f35] border border-slate-700/50 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">
              <h3 className="font-bold text-white">Activity Log — {viewLogsFor.fullName}</h3>
              <button onClick={() => setViewLogsFor(null)} className="text-slate-400 hover:text-white p-1">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-2">
              {userLogs.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-8">No activity recorded</p>
              ) : userLogs.map(log => (
                <div key={log.id} className="flex items-start gap-3 p-3 bg-[#060e1a] rounded-lg border border-slate-700/30">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-sky-400">{log.actionType}</span>
                      <span className="text-xs text-slate-400">{log.system}</span>
                      {log.customerName && <span className="text-xs text-slate-500">→ {log.customerName} ({log.customerId})</span>}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{formatDate(log.timestamp)} · {log.ip}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
