import { useState } from 'react';
import { useCustomer } from '@/lib/customerStore';
import { formatDate, cn } from '@/lib/utils';
import { Bell, CheckCircle, AlertTriangle, Info, X } from 'lucide-react';

export default function NotificationsView() {
  const { state, markNotificationRead } = useCustomer();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const notifications = state.notifications.filter(n => filter === 'all' || !n.isRead);

  const icon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'alert': return <AlertTriangle className="w-4 h-4 text-red-400" />;
      default: return <Info className="w-4 h-4 text-sky-400" />;
    }
  };

  const borderColor = (type: string) => {
    switch (type) {
      case 'success': return 'border-l-emerald-500';
      case 'warning': return 'border-l-amber-500';
      case 'alert': return 'border-l-red-500';
      default: return 'border-l-sky-500';
    }
  };

  const unreadCount = state.notifications.filter(n => !n.isRead).length;

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-white">Notifications</h2>
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {(['all', 'unread'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize",
                filter === f ? 'bg-emerald-600 text-white' : 'bg-[#061a10] border border-emerald-900/40 text-slate-400 hover:text-slate-200'
              )}>
              {f === 'unread' ? `Unread (${unreadCount})` : 'All'}
            </button>
          ))}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="bg-[#061a10] border border-emerald-900/40 rounded-xl p-8 text-center">
          <Bell className="w-8 h-8 text-slate-500 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">{filter === 'unread' ? 'No unread notifications' : 'No notifications'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map(n => (
            <div key={n.id}
              className={cn("bg-[#061a10] border border-emerald-900/30 border-l-4 rounded-xl p-4 transition-all",
                borderColor(n.type),
                !n.isRead && "bg-[#071d12]"
              )}>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0">{icon(n.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className={cn("text-sm font-semibold", !n.isRead ? 'text-white' : 'text-slate-300')}>{n.title}</p>
                    {!n.isRead && <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{n.message}</p>
                  <p className="text-[10px] text-slate-600 mt-2">{formatDate(n.createdAt)}</p>
                </div>
                {!n.isRead && (
                  <button onClick={() => markNotificationRead(n.id)}
                    className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-700/30 rounded-lg transition-colors flex-shrink-0" title="Mark as read">
                    <X className="w-3.5 h-3.5" />
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
