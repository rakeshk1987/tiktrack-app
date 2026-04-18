import { X, Mail, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';
import type { InboxMessage } from '../../types/schema';
import { useMessages } from '../../hooks/useData';

interface Props {
  childId: string;
  isDark: boolean;
  onClose: () => void;
}

export default function InboxPanel({ childId, isDark, onClose }: Props) {
  const { messages, markAsRead } = useMessages(childId, 'child');

  const unreadCount = messages.filter((m) => !m.is_read).length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className={clsx(
        "w-full max-w-sm h-full shadow-2xl p-6 flex flex-col animate-in slide-in-from-right duration-300",
        isDark ? "bg-[#100f24] text-white border-l border-white/10" : "bg-white text-slate-900 border-l border-indigo-100"
      )}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-black font-display flex items-center gap-2">
              <Mail className="text-sky-500" /> Inbox
            </h2>
            <p className="text-sm opacity-60 font-bold tracking-widest uppercase mt-1">
              {unreadCount} Unread Messages
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-500/20 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {messages.length === 0 ? (
            <div className="text-center py-10 opacity-50 font-bold">
              <Mail size={48} className="mx-auto mb-4 opacity-30" />
              <p>Your inbox is empty right now.</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div 
                key={msg.id}
                className={clsx(
                  "p-4 rounded-2xl relative transition-all",
                  !msg.is_read ? (isDark ? "bg-sky-500/10 border border-sky-400/30" : "bg-sky-50 border border-sky-200") : "bg-black/5 border border-transparent",
                  msg.is_read ? "opacity-60" : "opacity-100"
                )}
              >
                {!msg.is_read && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
                  </span>
                )}
                <p className="text-sm font-semibold whitespace-pre-wrap">{msg.content}</p>
                <div className="flex justify-between items-end mt-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider opacity-50">
                    {new Date(msg.timestamp).toLocaleDateString()}
                  </p>
                  {!msg.is_read && (
                    <button 
                      onClick={() => markAsRead(msg.id)}
                      className="text-sky-500 hover:text-sky-600 transition"
                      title="Mark as read"
                    >
                      <CheckCircle2 size={18} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
