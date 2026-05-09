import clsx from 'clsx';
import { BellRing, CalendarClock, CheckCircle2, Circle, Clock3, FileCheck2 } from 'lucide-react';
import { useChildLayout } from './ChildLayout';

function formatDateLabel(iso?: string | null) {
  if (!iso) return 'No date';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function ChildPlanner() {
  const { events, reminders, tasks, mutedTextClass, panelClass } = useChildLayout();

  const completedTasks = tasks.filter((item) => item.log?.status === 'completed');
  const pendingTasks = tasks.filter((item) => item.log?.status !== 'completed');
  const examEvents = events
    .filter((event) => event.type.toLowerCase().includes('exam'))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const otherEvents = events
    .filter((event) => !event.type.toLowerCase().includes('exam'))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const cardClass = 'border-white/10 bg-white/[0.04]';

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-display font-bold">Planner</h2>
          <p className={mutedTextClass}>Everything in one place: tasks, exam plan, reminders, and family events.</p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className={clsx('rounded-[1.75rem] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]', panelClass)}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-2xl font-display font-bold">Tasks</h3>
            <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-black text-white/85">
              {completedTasks.length}/{tasks.length} done
            </span>
          </div>
          <div className="space-y-2">
            {tasks.length === 0 ? <p className={mutedTextClass}>No tasks assigned yet.</p> : null}
            {pendingTasks.map(({ task }) => (
              <div key={task.id} className={clsx('flex items-center justify-between rounded-2xl border px-4 py-3', cardClass)}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{task.title}</p>
                  <p className={clsx('text-xs', mutedTextClass)}>{task.category} • {task.priority} priority</p>
                </div>
                <Circle size={18} className="text-amber-400" />
              </div>
            ))}
            {completedTasks.map(({ task }) => (
              <div key={task.id} className={clsx('flex items-center justify-between rounded-2xl border px-4 py-3 opacity-75', cardClass)}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{task.title}</p>
                  <p className={clsx('text-xs', mutedTextClass)}>Completed</p>
                </div>
                <CheckCircle2 size={18} className="text-emerald-400" />
              </div>
            ))}
          </div>
        </section>

        <section className={clsx('rounded-[1.75rem] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]', panelClass)}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-2xl font-display font-bold">Exams</h3>
            <FileCheck2 className="text-fuchsia-400" size={20} />
          </div>
          <div className="space-y-2">
            {examEvents.length === 0 ? <p className={mutedTextClass}>No exam events yet.</p> : null}
            {examEvents.map((event) => (
              <div key={event.id} className={clsx('rounded-2xl border px-4 py-3', cardClass)}>
                <p className="text-sm font-bold">{event.title}</p>
                <p className={clsx('mt-1 text-xs', mutedTextClass)}>{formatDateLabel(event.date)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={clsx('rounded-[1.75rem] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]', panelClass)}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-2xl font-display font-bold">Reminders</h3>
            <BellRing className="text-sky-400" size={20} />
          </div>
          <div className="space-y-2">
            {reminders.length === 0 ? <p className={mutedTextClass}>No reminders configured yet.</p> : null}
            {reminders.map((reminder) => (
              <div key={reminder.id} className={clsx('rounded-2xl border px-4 py-3', cardClass)}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold">{reminder.title}</p>
                  <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-black uppercase', reminder.is_enabled ? 'bg-emerald-400/20 text-emerald-300' : 'bg-rose-400/20 text-rose-300')}>
                    {reminder.is_enabled ? 'Active' : 'Off'}
                  </span>
                </div>
                <p className={clsx('mt-1 text-xs', mutedTextClass)}>{reminder.message}</p>
                <p className={clsx('mt-1 text-xs', mutedTextClass)}>{reminder.schedule_time || 'No time'} • {reminder.frequency}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={clsx('rounded-[1.75rem] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]', panelClass)}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-2xl font-display font-bold">Events</h3>
            <CalendarClock className="text-amber-400" size={20} />
          </div>
          <div className="space-y-2">
            {otherEvents.length === 0 ? <p className={mutedTextClass}>No upcoming non-exam events.</p> : null}
            {otherEvents.map((event) => (
              <div key={event.id} className={clsx('rounded-2xl border px-4 py-3', cardClass)}>
                <p className="text-sm font-bold">{event.title}</p>
                <p className={clsx('mt-1 text-xs', mutedTextClass)}>{event.type} • {formatDateLabel(event.date)}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="rounded-[1.5rem] border border-white/12 bg-white/[0.04] px-4 py-3 text-sm text-white/80 shadow-[0_10px_28px_rgba(0,0,0,0.14)]">
        <div className="flex items-center gap-2 font-semibold">
          <Clock3 size={15} />
          Tip: open Inbox to ask your parent questions directly about any task or exam.
        </div>
      </div>
    </div>
  );
}
