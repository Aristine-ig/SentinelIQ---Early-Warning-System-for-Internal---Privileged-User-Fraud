import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Shield, Activity } from 'lucide-react';
import Header from '@/components/layout/Header';
import RiskScoreBadge from '@/components/features/RiskScoreBadge';
import { MOCK_USERS, getRiskBadgeClasses, formatSystemLabel } from '@/constants/mockData';
import type { RiskLevel, UserRole } from '@/types';
import { cn } from '@/lib/utils';

const roleLabels: Record<UserRole, string> = {
  admin: 'Admin',
  trader: 'Trader',
  loan_officer: 'Loan Officer',
  teller: 'Teller',
  it_staff: 'IT Staff',
  auditor: 'Auditor',
  manager: 'Manager',
};

export default function UserProfiles() {
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<RiskLevel | 'all'>('all');
  const navigate = useNavigate();

  const filtered = MOCK_USERS.filter(user => {
    const matchSearch = !search ||
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.department.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase());
    const matchRisk = riskFilter === 'all' || user.riskLevel === riskFilter;
    return matchSearch && matchRisk;
  }).sort((a, b) => b.riskScore - a.riskScore);

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header title="User Risk Profiles" subtitle="Behavioral baselines and risk scores for all monitored users" />

      <div className="flex-1 p-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search users by name, email, or department..."
              className="w-full h-9 pl-9 pr-3 text-sm bg-[hsl(220,25%,11%)] border border-[hsl(220,20%,18%)] rounded-lg text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40"
            />
          </div>
          <div className="flex items-center gap-1">
            {(['all', 'critical', 'high', 'medium', 'low'] as const).map(level => (
              <button
                key={level}
                onClick={() => setRiskFilter(level)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border capitalize',
                  riskFilter === level
                    ? level === 'all' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                      : level === 'critical' ? 'bg-red-500/20 text-red-400 border-red-500/30'
                      : level === 'high' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                      : level === 'medium' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                      : 'bg-green-500/20 text-green-400 border-green-500/30'
                    : 'bg-transparent text-slate-500 border-transparent hover:text-slate-300'
                )}
              >
                {level === 'all' ? 'All' : level}
              </button>
            ))}
          </div>
        </div>

        {/* User Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(user => (
            <div
              key={user.id}
              onClick={() => navigate(`/users/${user.id}`)}
              className="bg-[hsl(220,25%,11%)] border border-[hsl(220,20%,18%)] rounded-xl p-4 cursor-pointer hover:border-cyan-500/25 hover:bg-[hsl(220,25%,13%)] transition-all group"
            >
              {/* User Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold border',
                    user.riskLevel === 'critical' ? 'bg-red-500/20 border-red-500/30 text-red-400'
                      : user.riskLevel === 'high' ? 'bg-orange-500/20 border-orange-500/30 text-orange-400'
                      : user.riskLevel === 'medium' ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400'
                      : 'bg-green-500/20 border-green-500/30 text-green-400'
                  )}>
                    {user.avatar}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-100 group-hover:text-white">{user.name}</div>
                    <div className="text-xs text-slate-500">{roleLabels[user.role]} · {user.department}</div>
                  </div>
                </div>
                <RiskScoreBadge score={user.riskScore} size="sm" showLabel={false} />
              </div>

              {/* Risk Bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-slate-600 uppercase tracking-wide">Risk Score</span>
                  <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', getRiskBadgeClasses(user.riskLevel))}>
                    {user.riskLevel.toUpperCase()}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-white/5">
                  <div
                    className={cn('h-1.5 rounded-full',
                      user.riskLevel === 'critical' ? 'bg-red-500'
                        : user.riskLevel === 'high' ? 'bg-orange-500'
                        : user.riskLevel === 'medium' ? 'bg-yellow-500'
                        : 'bg-green-500'
                    )}
                    style={{ width: `${user.riskScore}%` }}
                  />
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="text-center">
                  <div className="text-sm font-bold text-slate-200">{user.alertCount}</div>
                  <div className="text-[10px] text-slate-600">Alerts</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-slate-200">{user.openCases}</div>
                  <div className="text-[10px] text-slate-600">Cases</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-slate-200">L{user.privilegeLevel}</div>
                  <div className="text-[10px] text-slate-600">Privilege</div>
                </div>
              </div>

              {/* Systems */}
              <div className="flex flex-wrap gap-1">
                {user.systems.slice(0, 3).map(sys => (
                  <span key={sys} className="text-[10px] text-slate-500 bg-slate-500/10 border border-slate-500/15 px-1.5 py-0.5 rounded font-mono">
                    {formatSystemLabel(sys)}
                  </span>
                ))}
                {user.systems.length > 3 && (
                  <span className="text-[10px] text-slate-600 px-1.5 py-0.5">+{user.systems.length - 3}</span>
                )}
              </div>

              {/* Baseline Status */}
              <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-[hsl(220,20%,16%)]">
                <Shield className={cn('w-3 h-3', user.baselineEstablished ? 'text-green-400' : 'text-yellow-400')} />
                <span className={cn('text-[10px]', user.baselineEstablished ? 'text-green-400' : 'text-yellow-400')}>
                  {user.baselineEstablished ? 'Baseline established' : 'Baseline in progress'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
