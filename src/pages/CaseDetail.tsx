import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, User, Bell, MessageSquare, CheckCircle, AlertTriangle } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import Header from '@/components/layout/Header';
import AlertCard from '@/components/features/AlertCard';
import { MOCK_CASES, MOCK_ALERTS, getRiskBadgeClasses, getStatusBadgeClasses } from '@/constants/mockData';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function CaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [note, setNote] = useState('');
  const caseData = MOCK_CASES.find(c => c.id === id);

  if (!caseData) {
    return (
      <div className="flex flex-col h-full overflow-auto">
        <Header title="Case Not Found" />
        <div className="flex-1 flex items-center justify-center text-slate-500">Case not found</div>
      </div>
    );
  }

  const linkedAlerts = MOCK_ALERTS.filter(a => caseData.alertIds.includes(a.id));

  const handleAddNote = () => {
    if (!note.trim()) return;
    toast.success('Note added to case timeline');
    setNote('');
  };

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header title="Case Investigation" subtitle={`Case ${caseData.id.toUpperCase()} · ${caseData.userName}`} />

      <div className="flex-1 p-6">
        <button
          onClick={() => navigate('/cases')}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-cyan-400 mb-5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Cases
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Main */}
          <div className="lg:col-span-2 space-y-4">
            {/* Case Header */}
            <div className="bg-[hsl(220,25%,11%)] border border-[hsl(220,20%,18%)] rounded-xl p-5">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-lg border uppercase tracking-wide', getRiskBadgeClasses(caseData.priority))}>
                  {caseData.priority} Priority
                </span>
                <span className={cn('text-xs px-2.5 py-1 rounded-lg border capitalize', getStatusBadgeClasses(caseData.status))}>
                  {caseData.status.replace('_', ' ')}
                </span>
                <span className="text-xs text-slate-500 font-mono bg-slate-500/10 border border-slate-500/20 px-2 py-0.5 rounded">
                  {caseData.id.toUpperCase()}
                </span>
              </div>

              <h2 className="text-base font-bold text-white mb-2">{caseData.title}</h2>
              <p className="text-sm text-slate-400 leading-relaxed">{caseData.description}</p>

              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-[hsl(220,20%,16%)]">
                <div>
                  <div className="text-[10px] text-slate-600 uppercase tracking-wide mb-1">Subject</div>
                  <div className="text-sm text-slate-200 font-medium">{caseData.userName}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-600 uppercase tracking-wide mb-1">Assigned To</div>
                  <div className={cn('text-sm font-medium', caseData.assignedTo === 'Unassigned' ? 'text-yellow-400' : 'text-cyan-400')}>
                    {caseData.assignedTo}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-600 uppercase tracking-wide mb-1">Created</div>
                  <div className="text-sm text-slate-400">{format(new Date(caseData.createdAt), 'MMM dd, yyyy HH:mm')}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-600 uppercase tracking-wide mb-1">Last Updated</div>
                  <div className="text-sm text-slate-400">{formatDistanceToNow(new Date(caseData.updatedAt), { addSuffix: true })}</div>
                </div>
                {caseData.estimatedLoss && (
                  <div className="col-span-2">
                    <div className="text-[10px] text-slate-600 uppercase tracking-wide mb-1">Estimated Financial Risk</div>
                    <div className="text-lg font-bold text-orange-400 font-mono">${caseData.estimatedLoss.toLocaleString()}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Linked Alerts */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Bell className="w-4 h-4 text-slate-500" />
                <div className="text-sm font-semibold text-slate-200">Linked Alerts ({linkedAlerts.length})</div>
              </div>
              <div className="space-y-3">
                {linkedAlerts.map(alert => (
                  <AlertCard key={alert.id} alert={alert} />
                ))}
              </div>
            </div>

            {/* Add Note */}
            <div className="bg-[hsl(220,25%,11%)] border border-[hsl(220,20%,18%)] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4 text-slate-500" />
                <div className="text-sm font-semibold text-slate-200">Add Investigation Note</div>
              </div>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Document your findings, actions taken, or next steps..."
                rows={3}
                className="w-full px-3 py-2.5 text-sm bg-[hsl(220,20%,15%)] border border-[hsl(220,20%,20%)] rounded-lg text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40 resize-none"
              />
              <button
                onClick={handleAddNote}
                className="mt-2 px-4 h-8 text-xs font-medium bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors"
              >
                Add Note
              </button>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Actions */}
            <div className="bg-[hsl(220,25%,11%)] border border-[hsl(220,20%,18%)] rounded-xl p-4">
              <div className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wide">Case Actions</div>
              <div className="space-y-2">
                <button
                  onClick={() => toast.success('Assigned to Chen Wei')}
                  className="w-full flex items-center justify-center gap-2 h-9 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 text-xs font-medium hover:bg-cyan-500/25 transition-colors"
                >
                  <User className="w-3.5 h-3.5" />
                  Assign to Me
                </button>
                <button
                  onClick={() => toast.success('Case escalated to CISO and Legal')}
                  className="w-full flex items-center justify-center gap-2 h-9 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-400 text-xs font-medium hover:bg-purple-500/25 transition-colors"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Escalate Case
                </button>
                <button
                  onClick={() => toast.success('Case marked as resolved')}
                  className="w-full flex items-center justify-center gap-2 h-9 rounded-lg bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-medium hover:bg-green-500/25 transition-colors"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Close Case
                </button>
              </div>
            </div>

            {/* Investigation Timeline */}
            <div className="bg-[hsl(220,25%,11%)] border border-[hsl(220,20%,18%)] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Investigation Timeline</div>
              </div>
              <div className="space-y-3">
                {caseData.notes.map((note, idx) => (
                  <div key={idx} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-cyan-500/60 flex-shrink-0 mt-0.5"></div>
                      {idx < caseData.notes.length - 1 && (
                        <div className="w-px flex-1 bg-[hsl(220,20%,20%)] mt-1 min-h-[20px]"></div>
                      )}
                    </div>
                    <div className="pb-3">
                      <p className="text-xs text-slate-400 leading-relaxed">{note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
