import { useMemo, useState } from 'react';
import { X, Mail, CheckCircle2, Send } from 'lucide-react';
import clsx from 'clsx';
import { useMessages } from '../../hooks/useData';

interface Props {
  childId: string;
  parentId: string;
  isDark: boolean;
  onClose: () => void;
}

export default function InboxPanel({ childId, parentId, isDark, onClose }: Props) {
  const { messages, markAsRead, sendMessage } = useMessages(childId, 'child');
  const [activeId, setActiveId] = useState<string>('');
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const unreadCount = messages.filter((m) => !m.is_read).length;
  const activeMessage = useMemo(
    () => messages.find((m) => m.id === activeId) || messages[0] || null,
    [activeId, messages]
  );

  const handleReply = async () => {
    if (!reply.trim() || !parentId) return;
    setSending(true);
    try {
      await sendMessage(childId, parentId, reply.trim(), 'child', childId);
      setReply('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div
        className={clsx(
          'ml-auto h-full w-full max-w-5xl border-l shadow-2xl p-4 md:p-6 animate-in slide-in-from-right duration-300',
          isDark ? 'bg-[#100f24] text-white border-white/10' : 'bg-white text-slate-900 border-indigo-100'
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black font-display flex items-center gap-2">
              <Mail className="text-sky-500" /> Inbox
            </h2>
            <p className="text-xs opacity-70 font-bold tracking-widest uppercase mt-1">
              {unreadCount} unread
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-slate-500/20 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="grid h-[calc(100%-4.8rem)] gap-4 md:grid-cols-[340px_minmax(0,1fr)]">
          <div className={clsx('overflow-y-auto rounded-2xl border p-3 space-y-2', isDark ? 'border-white/10 bg-white/5' : 'border-indigo-100 bg-slate-50')}>
            {messages.length === 0 ? (
              <div className="py-10 text-center opacity-60 font-bold">No messages yet.</div>
            ) : (
              messages.map((msg) => {
                const selected = (activeMessage?.id || '') === msg.id;
                const fromParent = (msg.sender_role || 'parent') === 'parent';
                return (
                  <button
                    key={msg.id}
                    onClick={() => {
                      setActiveId(msg.id);
                      if (!msg.is_read) {
                        void markAsRead(msg.id);
                      }
                    }}
                    className={clsx(
                      'w-full rounded-xl border px-3 py-3 text-left transition',
                      selected
                        ? isDark
                          ? 'border-sky-300/35 bg-sky-500/12'
                          : 'border-sky-300 bg-sky-50'
                        : isDark
                          ? 'border-white/10 bg-white/5 hover:bg-white/10'
                          : 'border-indigo-100 bg-white hover:bg-slate-100'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-black uppercase tracking-[0.14em] opacity-70">
                        {fromParent ? 'Parent' : 'You'}
                      </p>
                      {!msg.is_read ? <span className="h-2 w-2 rounded-full bg-rose-500" /> : null}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm font-semibold">{msg.content}</p>
                    {msg.subject ? <p className="mt-1 text-[10px] font-bold uppercase tracking-wide opacity-70">Subject: {msg.subject}</p> : null}
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-wider opacity-50">
                      {new Date(msg.timestamp).toLocaleString()}
                    </p>
                  </button>
                );
              })
            )}
          </div>

          <div className={clsx('flex min-h-0 flex-col rounded-2xl border p-4', isDark ? 'border-white/10 bg-white/5' : 'border-indigo-100 bg-white')}>
            {activeMessage ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-[0.16em] opacity-70">
                    {(activeMessage.sender_role || 'parent') === 'parent' ? 'Message from parent' : 'Your message'}
                  </p>
                  {!activeMessage.is_read ? (
                    <button onClick={() => void markAsRead(activeMessage.id)} className="inline-flex items-center gap-1 text-xs font-bold text-sky-500">
                      <CheckCircle2 size={14} /> Mark read
                    </button>
                  ) : null}
                </div>
                <div className={clsx('mt-3 flex-1 overflow-y-auto rounded-xl border p-4 text-sm leading-7 whitespace-pre-wrap', isDark ? 'border-white/10 bg-black/20' : 'border-slate-200 bg-slate-50')}>
                  {activeMessage.subject ? (
                    <p className="mb-2 text-[11px] font-black uppercase tracking-[0.14em] opacity-70">
                      Subject: {activeMessage.subject}
                    </p>
                  ) : null}
                  {activeMessage.content}
                </div>
                <p className="mt-2 text-[10px] font-bold uppercase tracking-wider opacity-50">
                  {new Date(activeMessage.timestamp).toLocaleString()}
                </p>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center opacity-60">Pick a message to read.</div>
            )}

            <div className="mt-4 border-t pt-4 border-dashed border-slate-300/30">
              <p className="text-xs font-black uppercase tracking-[0.14em] opacity-70">Reply to parent</p>
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Type your reply here..."
                className={clsx(
                  'mt-2 w-full min-h-[96px] rounded-xl border px-3 py-3 text-sm outline-none',
                  isDark
                    ? 'border-white/10 bg-white/6 text-white placeholder:text-white/40'
                    : 'border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400'
                )}
              />
              <button
                onClick={() => void handleReply()}
                disabled={!reply.trim() || sending || !parentId}
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-black text-white transition hover:bg-sky-600 disabled:opacity-50"
              >
                <Send size={14} /> {sending ? 'Sending...' : 'Send reply'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
