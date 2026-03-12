import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Shield, Activity, Clock } from 'lucide-react';
import { format } from 'date-fns';
import Header from '@/components/layout/Header';
import RiskScoreBadge from '@/components/features/RiskScoreBadge';
import BehaviorChart from '@/components/features/BehaviorChart';
import AlertCard from '@/components/features/AlertCard';
import { MOCK_USERS, MOCK_ALERTS, BEHAVIOR_DATA, getRiskBadgeClasses, formatSystemLabel } from '@/constants/mockData';
import { cn } from '@/lib/utils';

const roleLabels: Record<string, string> = {
  admin: 'System Administrator',
  trader: 'Treasury Trader',
  loan_officer: 'Loan Officer',
  teller: 'Branch Teller',
  it_staff: 'IT Staff',
  auditor: 'Internal Auditor',
  manager: 'Commercial Manager',
};

export default function UserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = MOCK_USERS.find(u => u.id === id);

  if (!user) {
    return (
      <div className="flex flex-col h-full overflow-auto">
        <Header title="User Not Found" />
        <div className="flex-1 flex items-center justify-center text-slate-500">User not found</div>
      </div>
    );
  }

  const userAlerts = MOCK_ALERTS.filter(a => a.userId === user.id);

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header title="User Risk Profile" subtitle={`Behavioral analysis for ${user.name}`} />

      <div className="flex-1 p-6">
        <button
          onClick={() => navigate('/users')}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-cyan-400 mb-5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to User Profiles
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left: Profile + Stats */}
          <div className="space-y-4">
            {/* Profile Card */}
            <div className="bg-[hsl(220,25%,11%)] border border-[hsl(220,20%,18%)] rounded-xl p-5">
              <div className="flex items-center gap-4 mb-4">
                <div className={cn(
                  'w-14 h-14 rounded-xl flex items-center justify-center text-lg font-bold border',
                  user.riskLevel === 'critical' ? 'bg-red-500/20 border-red-500/30 text-red-400'
                    : user.riskLevel === 'high' ? 'bg-orange-500/20 border-orange-500/30 text-orange-400'
                    : user.riskLevel === 'medium' ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400'
                    : 'bg-green-500/20 border-green-500/30 text-green-400'
                )}>
                  {user.avatar}
                </div>
                <div>
                  <div className="text-base font-bold text-white">{user.name}</div>
                  <div className="text-sm text-slate-400">{roleLabels[user.role]}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{user.department}</div>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-slate-400">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-xs font-mono">{user.email}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <Shield className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-xs">Privilege Level {user.privilegeLevel} / 5</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-xs">Joined {format(new Date(user.joinDate), 'MMM yyyy')}</span>
                </div>
              </div>
            </div>

            {/* Risk Score */}
            <RiskScoreBadge score={user.riskScore} size="lg" />

            {/* Alert Counts */}
            <div className="bg-[hsl(220,25%,11%)] border border-[hsl(220,20%,18%)] rounded-xl p-4">
              <div className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wide">Risk Summary</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[hsl(220,20%,15%)] rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-red-400">{user.alertCount}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Total Alerts</div>
                </div>
                <div className="bg-[hsl(220,20%,15%)] rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-orange-400">{user.openCases}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Open Cases</div>
                </div>
              </div>
            </div>

            {/* Systems Access */}
            <div className="bg-[hsl(220,25%,11%)] border border-[hsl(220,20%,18%)] rounded-xl p-4">
              <div className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wide">System Access</div>
              <div className="space-y-2">
                {user.systems.map(sys => (
                  <div key={sys} className="flex items-center justify-between">
                    <span className="text-xs text-slate-300">{formatSystemLabel(sys)}</span>
                    <Activity className="w-3 h-3 text-cyan-500" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Charts + Alerts */}
          <div className="lg:col-span-2 space-y-4">
            {/* Baseline Status */}
            <div className={cn(
              'rounded-xl border p-4 flex items-center gap-3',
              user.baselineEstablished
                ? 'bg-green-500/5 border-green-500/20'
                : 'bg-yellow-500/5 border-yellow-500/20'
            )}>
              <Shield className={cn('w-5 h-5', user.baselineEstablished ? 'text-green-400' : 'text-yellow-400')} />
              <div>
                <div className={cn('text-sm font-semibold', user.baselineEstablished ? 'text-green-400' : 'text-yellow-400')}>
                  {user.baselineEstablished ? 'Behavioral Baseline Established' : 'Baseline Learning in Progress'}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {user.baselineEstablished
                    ? 'ML model has sufficient data to detect anomalies with high confidence'
                    : 'Insufficient data — monitoring continues; elevated caution advised'}
                </div>
              </div>
            </div>

            {/* Behavior Chart */}
            <BehaviorChart data={BEHAVIOR_DATA} title={`${user.name.split(' ')[0]}'s Activity vs. Baseline — Today`} />

            {/* User Alerts */}
            {userAlerts.length > 0 && (
              <div>
                <div className="text-sm font-semibold text-slate-200 mb-3">Associated Alerts ({userAlerts.length})</div>
                <div className="space-y-3">
                  {userAlerts.map(alert => (
                    <AlertCard key={alert.id} alert={alert} />
                  ))}
                </div>
              </div>
            )}

            {userAlerts.length === 0 && (
              <div className="bg-[hsl(220,25%,11%)] border border-green-500/20 rounded-xl p-8 text-center">
                <div className="text-green-400 text-2xl mb-2">✓</div>
                <div className="text-sm text-green-400 font-medium">No Active Alerts</div>
                <div className="text-xs text-slate-500 mt-1">This user has no associated fraud alerts</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
