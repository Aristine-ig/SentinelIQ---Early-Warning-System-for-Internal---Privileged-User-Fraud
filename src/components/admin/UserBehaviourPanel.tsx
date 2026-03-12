import { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts';
import { useApp } from '@/lib/store';
import { cn, getSeverityBg, getSeverity } from '@/lib/utils';

export default function UserBehaviourPanel() {
  const { state } = useApp();
  const { users, sessions, riskHistory, activityLogs, alerts } = state;
  const [selectedUserId, setSelectedUserId] = useState<string>(
    users.find(u => !u.isAdmin)?.id || ''
  );

  const nonAdminUsers = users.filter(u => !u.isAdmin);
  const selectedUser = users.find(u => u.id === selectedUserId);
  const session = sessions[selectedUserId];

  // Risk history for this user
  const userRiskHistory = useMemo(() => {
    return riskHistory
      .filter(h => h.userId === selectedUserId)
      .slice(-20)
      .map((h, i) => ({
        index: i + 1,
        score: h.score,
        time: new Date(h.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      }));
  }, [riskHistory, selectedUserId]);

  // Login hour heatmap
  const loginHeatmap = useMemo(() => {
    const hourCounts = new Array(24).fill(0);
    activityLogs
      .filter(l => l.userId === selectedUserId && l.actionType === 'LOGIN')
      .forEach(l => {
        const h = new Date(l.timestamp).getHours();
        hourCounts[h]++;
      });
    return hourCounts.map((count, hour) => ({
      hour: `${hour.toString().padStart(2, '0')}h`,
      count,
      isOffHours: hour >= 22 || hour < 6,
    }));
  }, [activityLogs, selectedUserId]);

  // Most accessed customers
  const accessedCustomers = useMemo(() => {
    const counts: Record<string, { name: string; count: number }> = {};
    activityLogs
      .filter(l => l.userId === selectedUserId && l.customerId)
      .forEach(l => {
        const id = l.customerId!;
        if (!counts[id]) counts[id] = { name: l.customerName || id, count: 0 };
        counts[id].count++;
      });
    return Object.entries(counts)
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [activityLogs, selectedUserId]);

  // Peer comparison
  const peerComparison = useMemo(() => {
    if (!selectedUser) return [];
    const peers = nonAdminUsers.filter(u => u.role === selectedUser.role);
    return peers.map(u => ({
      name: u.fullName.split(' ')[0],
      score: sessions[u.id]?.riskScore || 0,
      isSelected: u.id === selectedUserId,
    }));
  }, [nonAdminUsers, sessions, selectedUser, selectedUserId]);

  const currentScore = session?.riskScore || 0;
  const severity = getSeverity(currentScore);

  return (
    <div className="p-6 space-y-6">
      {/* User Selector */}
      <div className="bg-[#0d1f35] border border-slate-700/40 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Select User to Analyse</h3>
        <div className="flex flex-wrap gap-2">
          {nonAdminUsers.map(u => {
            const score = sessions[u.id]?.riskScore || 0;
            const sev = getSeverity(score);
            return (
              <button
                key={u.id}
                onClick={() => setSelectedUserId(u.id)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm',
                  selectedUserId === u.id
                    ? 'bg-sky-600/20 border-sky-500/40 text-sky-300'
                    : 'bg-[#060e1a] border-slate-700/30 text-slate-400 hover:text-white hover:border-slate-600/50'
                )}
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-sky-600 to-blue-700 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-bold text-white">{u.fullName.charAt(0)}</span>
                </div>
                <span className="font-medium">{u.fullName.split(' ')[0]}</span>
                {score > 0 && (
                  <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded border', getSeverityBg(sev))}>
                    {score}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selectedUser && (
        <>
          {/* User Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Current Risk Score', value: `${currentScore}/100` },
              { label: 'Severity Level', value: severity },
              { label: 'Customers Accessed', value: String(session?.accessedCustomers.length || 0) },
              { label: 'Alerts Generated', value: String(alerts.filter(a => a.userId === selectedUserId).length) },
            ].map(stat => (
              <div key={stat.label} className="bg-[#0d1f35] border border-slate-700/40 rounded-xl p-4">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">{stat.label}</p>
                {stat.label === 'Severity Level' ? (
                  <span className={cn('px-2 py-0.5 rounded border text-sm font-bold', getSeverityBg(severity))}>
                    {stat.value}
                  </span>
                ) : (
                  <p className="text-xl font-bold text-white">{stat.value}</p>
                )}
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Risk History Chart */}
            <div className="bg-[#0d1f35] border border-slate-700/40 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Risk Score History</h3>
              {userRiskHistory.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-slate-500 text-sm text-center">
                  <p>No risk events recorded.<br />Perform actions as this user to see history.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={userRiskHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                    <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ background: '#0d1f35', border: '1px solid #1e3a5f', borderRadius: 8 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#f97316"
                      strokeWidth={2}
                      dot={{ fill: '#f97316', r: 3 }}
                      name="Risk Score"
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Login hour heatmap */}
            <div className="bg-[#0d1f35] border border-slate-700/40 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Login Activity by Hour</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={loginHeatmap} barSize={8}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                  <XAxis dataKey="hour" tick={{ fill: '#64748b', fontSize: 9 }} interval={3} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ background: '#0d1f35', border: '1px solid #1e3a5f', borderRadius: 8 }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Bar dataKey="count" name="Logins" radius={[2, 2, 0, 0]}>
                    {loginHeatmap.map((entry, i) => (
                      <Cell key={i} fill={entry.isOffHours ? '#ef4444' : '#38bdf8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm bg-sky-400 inline-block" /> Normal hours
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm bg-red-500 inline-block" /> Off-hours (10PM–6AM)
                </span>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Most Accessed Customers */}
            <div className="bg-[#0d1f35] border border-slate-700/40 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Most Accessed Customers</h3>
              {accessedCustomers.length === 0 ? (
                <p className="text-slate-500 text-sm">No customer access recorded yet</p>
              ) : (
                <div className="space-y-2">
                  {accessedCustomers.map(c => (
                    <div key={c.id} className="flex items-center gap-3">
                      <span className="text-xs font-mono text-slate-400 w-20">{c.id}</span>
                      <div className="flex-1 bg-slate-700/50 rounded-full h-1.5">
                        <div
                          className="bg-sky-500 h-1.5 rounded-full"
                          style={{ width: `${Math.min(100, c.count * 25)}%` }}
                        />
                      </div>
                      <span className="text-xs text-white font-bold w-8 text-right">{c.count}x</span>
                      <span className="text-xs text-slate-400 truncate max-w-[100px]">{c.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Peer Comparison */}
            <div className="bg-[#0d1f35] border border-slate-700/40 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-1">Peer Comparison</h3>
              <p className="text-xs text-slate-400 mb-4">Risk score vs. peers with same role ({selectedUser.role})</p>
              {peerComparison.length <= 1 ? (
                <p className="text-slate-500 text-sm">No peers with the same role found</p>
              ) : (
                <div className="space-y-3">
                  {peerComparison.map(peer => (
                    <div key={peer.name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={cn('text-xs font-medium', peer.isSelected ? 'text-sky-300' : 'text-slate-300')}>
                          {peer.name} {peer.isSelected ? '(selected)' : ''}
                        </span>
                        <span className="text-xs font-bold text-white">{peer.score}</span>
                      </div>
                      <div className="w-full bg-slate-700/50 rounded-full h-1.5">
                        <div
                          className={cn('h-1.5 rounded-full', peer.isSelected ? 'bg-sky-500' : 'bg-slate-500')}
                          style={{ width: `${peer.score}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
