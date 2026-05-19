import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import clsx from 'clsx';
import { CheckCircle2, Flame, Star, Lock, Plus, X, Clock } from 'lucide-react';
import type { ChildLayoutContextValue } from './ChildLayout';
import { useRoutines, getTodayDayRange } from '../../hooks/useRoutines';
import { useToast } from '../../contexts/ToastContext';
import type { Routine, RoutineLog } from '../../types/schema';

/** Returns e.g. "07:30 AM" from "07:30" */
function fmtTime(t: string) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

const EMPTY_FORM = {
  title: '',
  startTime: '07:00',
  endTime: '08:00',
  points: '' as number | '',
  icon: '📝',
  dayRange: 'everyday' as Routine['day_range'],
};

export default function RoutinePage() {
  const { profile, childId, familyId, isDark } = useOutletContext<ChildLayoutContextValue>();
  const { routines, loading, logRoutine, getTodayLogs, createRoutine } = useRoutines(familyId, childId);
  const { addToast } = useToast();

  const [todayLogs, setTodayLogs] = useState<Record<string, RoutineLog>>({});
  const [loggingId, setLoggingId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const todayRange = getTodayDayRange();
  const dayLabel = todayRange === 'weekday' ? 'Weekday' : 'Weekend';
  const now = new Date();
  const isPastLockout = now.getHours() >= 22; // 10 PM lockout

  // Fetch today's logs
  useEffect(() => {
    if (!childId) return;
    getTodayLogs(childId).then(logs => {
      const logMap: Record<string, RoutineLog> = {};
      logs.forEach(log => { logMap[log.routine_id] = log; });
      setTodayLogs(logMap);
    }).catch(console.error);
  }, [childId, routines]);

  // Filter routines to today's day range
  const todayRoutines = routines.filter(r =>
    r.status === 'active' && (r.day_range === 'everyday' || r.day_range === todayRange)
  );

  // Build timeline: sort by start_time
  const timeline = [...todayRoutines].sort((a, b) =>
    (a.start_time || a.schedule_time || '').localeCompare(b.start_time || b.schedule_time || '')
  );

  const handleComplete = async (routineId: string) => {
    if (!childId) return;
    const routine = routines.find(r => r.id === routineId);
    if (!routine) return;

    if (isPastLockout) {
      addToast('⏰ It\'s past 10 PM — this routine is locked for today.', 'warning');
      return;
    }

    setLoggingId(routineId);
    try {
      await logRoutine(routine, childId, 'completed');
      const newLog: RoutineLog = {
        id: 'temp',
        routine_id: routine.id,
        family_id: familyId || '',
        child_id: childId,
        date: now.toISOString().slice(0, 10),
        status: 'completed',
      };
      setTodayLogs(prev => ({ ...prev, [routine.id]: newLog }));

      if (routine.requires_approval) {
        addToast(`✅ ${routine.title} submitted for parent approval!`, 'info');
      } else {
        addToast(`🌟 Awesome! ${routine.title} done — +${routine.points} stars!`, 'success');
      }
    } catch {
      addToast('Failed to log routine. Please try again.', 'error');
    } finally {
      setLoggingId(null);
    }
  };

  const handleAddRoutine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!familyId || !childId) return;
    if (!form.title || !form.startTime || !form.endTime || form.points === '') {
      addToast('Please fill all required fields.', 'error');
      return;
    }
    if (form.endTime <= form.startTime) {
      addToast('End time must be after start time.', 'error');
      return;
    }
    setSaving(true);
    try {
      await createRoutine({
        family_id: familyId,
        child_id: childId,
        title: form.title.trim(),
        start_time: form.startTime,
        end_time: form.endTime,
        day_range: form.dayRange,
        points: Number(form.points),
        icon: form.icon || '📝',
        requires_approval: true, // child-created always needs parent approval
        created_by: 'child',
        status: 'active',
      });
      addToast('Routine added! Your parent will review it.', 'success');
      setForm({ ...EMPTY_FORM });
      setShowAddModal(false);
    } catch {
      addToast('Failed to create routine.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className={clsx('animate-pulse font-bold text-sm', isDark ? 'text-white/60' : 'text-slate-400')}>
          Loading routines...
        </p>
      </div>
    );
  }

  const completedCount = timeline.filter(r => todayLogs[r.id]?.status === 'completed').length;
  const pendingCount = Math.max(timeline.length - completedCount, 0);

  return (
    <div className="mx-auto max-w-4xl pb-28 px-1">
      <div className={clsx('mb-5 rounded-2xl border p-4', isDark ? 'border-white/10 bg-white/[0.04]' : 'border-slate-200 bg-white')}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className={clsx('text-xs font-black uppercase tracking-widest mb-0.5', isDark ? 'text-cyan-400' : 'text-cyan-600')}>
              {dayLabel} Timeline
            </p>
            <h1 className={clsx('text-2xl font-black', isDark ? 'text-white' : 'text-slate-900')}>
              {now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </h1>
            <p className={clsx('mt-1 text-sm font-semibold', isDark ? 'text-white/50' : 'text-slate-500')}>
              Complete today&apos;s routine before 10:00 PM.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 md:min-w-[320px]">
            <div className={clsx('rounded-xl border px-3 py-2 text-center', isDark ? 'border-emerald-400/20 bg-emerald-400/10' : 'border-emerald-100 bg-emerald-50')}>
              <p className={clsx('text-xl font-black', isDark ? 'text-emerald-300' : 'text-emerald-600')}>{completedCount}</p>
              <p className={clsx('text-[10px] font-black uppercase tracking-wider', isDark ? 'text-white/45' : 'text-slate-500')}>Done</p>
            </div>
            <div className={clsx('rounded-xl border px-3 py-2 text-center', isDark ? 'border-amber-400/20 bg-amber-400/10' : 'border-amber-100 bg-amber-50')}>
              <p className={clsx('text-xl font-black', isDark ? 'text-amber-300' : 'text-amber-600')}>{pendingCount}</p>
              <p className={clsx('text-[10px] font-black uppercase tracking-wider', isDark ? 'text-white/45' : 'text-slate-500')}>Pending</p>
            </div>
            <div className={clsx('rounded-xl border px-3 py-2 text-center', isPastLockout ? (isDark ? 'border-rose-400/20 bg-rose-400/10' : 'border-rose-100 bg-rose-50') : (isDark ? 'border-cyan-400/20 bg-cyan-400/10' : 'border-cyan-100 bg-cyan-50'))}>
              <p className={clsx('text-xl font-black', isPastLockout ? (isDark ? 'text-rose-300' : 'text-rose-600') : (isDark ? 'text-cyan-300' : 'text-cyan-600'))}>{isPastLockout ? 'Locked' : '10 PM'}</p>
              <p className={clsx('text-[10px] font-black uppercase tracking-wider', isDark ? 'text-white/45' : 'text-slate-500')}>Deadline</p>
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 rounded-xl bg-cyan-500 px-3.5 py-2 text-sm font-bold text-white hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/30"
          >
            <Plus size={15} /> Add
          </button>
        </div>
      </div>

      {/* 10 PM lockout warning */}
      {isPastLockout && (
        <div className={clsx('mb-5 flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold',
          isDark ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-700'
        )}>
          <Lock size={16} />
          <span>Routines are locked after 10 PM. Incomplete routines will break your streak.</span>
        </div>
      )}

      {/* No routines */}
      {timeline.length === 0 ? (
        <div className={clsx('rounded-2xl border border-dashed p-10 text-center', isDark ? 'border-white/10' : 'border-slate-200')}>
          <Clock size={32} className={clsx('mx-auto mb-3', isDark ? 'text-white/20' : 'text-slate-300')} />
          <p className={clsx('font-bold', isDark ? 'text-white/40' : 'text-slate-400')}>
            No {dayLabel.toLowerCase()} routines today.
          </p>
          <p className={clsx('text-sm mt-1', isDark ? 'text-white/30' : 'text-slate-400')}>
            Ask your parents to set up routines, or add your own!
          </p>
        </div>
      ) : (
        /* Timeline */
        <div className="relative">
          {/* Vertical line */}
          <div className={clsx('absolute left-[28px] top-0 bottom-0 w-0.5', isDark ? 'bg-white/10' : 'bg-slate-200')} />

          <div className="space-y-3">
            {timeline.map(routine => {
              const log = todayLogs[routine.id];
              const isCompleted = log?.status === 'completed';
              const isSick = log?.status === 'sick';
              const isLocked = isPastLockout && !isCompleted;

              return (
                <div key={routine.id} className="flex gap-4 relative">
                  {/* Timeline dot */}
                  <div className={clsx(
                    'relative z-10 flex-shrink-0 w-14 flex flex-col items-center gap-1 pt-3'
                  )}>
                    <div className={clsx(
                      'w-8 h-8 rounded-full flex items-center justify-center text-base border-2 flex-shrink-0',
                      isCompleted
                        ? 'bg-emerald-500 border-emerald-400 text-white'
                        : isSick
                        ? 'bg-amber-400 border-amber-300 text-white'
                        : isLocked
                        ? (isDark ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200')
                        : (isDark ? 'bg-white/10 border-white/20' : 'bg-white border-slate-300 shadow-sm')
                    )}>
                      {isCompleted ? <CheckCircle2 size={16} /> : routine.icon || '📝'}
                    </div>
                    <p className={clsx('text-[10px] font-bold text-center leading-tight', isDark ? 'text-white/40' : 'text-slate-400')}>
                      {fmtTime(routine.start_time || routine.schedule_time || '')}
                    </p>
                  </div>

                  {/* Card */}
                  <div className={clsx(
                    'flex-1 rounded-2xl border p-4 transition-all mb-1',
                    isCompleted
                      ? (isDark ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-emerald-50 border-emerald-200')
                      : isLocked
                      ? (isDark ? 'bg-white/3 border-white/5 opacity-50' : 'bg-slate-50 border-slate-100 opacity-60')
                      : (isDark ? 'bg-white/5 border-white/10 hover:bg-white/8' : 'bg-white border-slate-200 hover:shadow-md')
                  )}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className={clsx(
                          'font-bold text-base leading-tight',
                          isDark ? 'text-white' : 'text-slate-900',
                          isCompleted && 'line-through opacity-60'
                        )}>
                          {routine.title}
                        </h3>
                        <p className={clsx('text-xs font-semibold mt-0.5', isDark ? 'text-white/40' : 'text-slate-400')}>
                          {fmtTime(routine.start_time || routine.schedule_time || '')} – {fmtTime(routine.end_time || '')}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={clsx('text-xs font-bold flex items-center gap-0.5', isDark ? 'text-emerald-400' : 'text-emerald-600')}>
                          <Star size={12} className="fill-current" /> {routine.points} stars
                        </span>
                        {(routine.streak > 0) && (
                          <span className={clsx('text-xs font-bold flex items-center gap-0.5', isDark ? 'text-orange-400' : 'text-orange-600')}>
                            <Flame size={12} className="fill-current" /> {routine.streak}
                          </span>
                        )}
                      </div>
                    </div>

                    {routine.requires_approval && !isCompleted && (
                      <p className={clsx('text-[10px] font-bold mb-2', isDark ? 'text-amber-400/80' : 'text-amber-600')}>
                        ⚠️ Needs parent approval for stars
                      </p>
                    )}

                    <button
                      disabled={isCompleted || isSick || isLocked || loggingId === routine.id}
                      onClick={() => handleComplete(routine.id)}
                      className={clsx(
                        'w-full py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2',
                        isCompleted
                          ? 'bg-emerald-500 text-white cursor-default'
                          : isSick
                          ? 'bg-amber-400 text-white cursor-default'
                          : isLocked
                          ? (isDark ? 'bg-white/5 text-white/30 cursor-not-allowed' : 'bg-slate-100 text-slate-300 cursor-not-allowed')
                          : 'bg-cyan-500 text-white hover:bg-cyan-400 hover:scale-[1.02] shadow-md shadow-cyan-500/20'
                      )}
                    >
                      {loggingId === routine.id ? (
                        <span className="animate-pulse">Logging...</span>
                      ) : isCompleted ? (
                        <><CheckCircle2 size={16} /> Done!</>
                      ) : isSick ? (
                        <>🤒 Sick Mode</>
                      ) : isLocked ? (
                        <><Lock size={14} /> Locked (10 PM)</>
                      ) : (
                        'Mark Complete'
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add routine modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={clsx(
            'w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden',
            isDark ? 'bg-[#1a1f3c] border-white/10' : 'bg-white border-slate-200'
          )}>
            <div className={clsx('px-5 py-4 border-b flex items-center justify-between', isDark ? 'border-white/10' : 'border-slate-100')}>
              <h3 className={clsx('text-base font-black', isDark ? 'text-white' : 'text-slate-900')}>Add My Routine</h3>
              <button onClick={() => setShowAddModal(false)} className={clsx(isDark ? 'text-white/40 hover:text-white' : 'text-slate-400 hover:text-slate-700')}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddRoutine} className="p-5 space-y-4">
              <div>
                <label className={clsx('block text-xs font-bold uppercase tracking-wider mb-1', isDark ? 'text-white/50' : 'text-slate-500')}>Routine Name *</label>
                <input
                  required
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Morning Exercise"
                  className={clsx('w-full rounded-xl border px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500/50', isDark ? 'bg-black/20 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900')}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={clsx('block text-xs font-bold uppercase tracking-wider mb-1', isDark ? 'text-white/50' : 'text-slate-500')}>Start *</label>
                  <input
                    required type="time"
                    value={form.startTime}
                    onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                    className={clsx('w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500/50', isDark ? 'bg-black/20 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900')}
                  />
                </div>
                <div>
                  <label className={clsx('block text-xs font-bold uppercase tracking-wider mb-1', isDark ? 'text-white/50' : 'text-slate-500')}>End *</label>
                  <input
                    required type="time"
                    value={form.endTime}
                    onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                    className={clsx('w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500/50', isDark ? 'bg-black/20 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900')}
                  />
                </div>
              </div>

              <div>
                <label className={clsx('block text-xs font-bold uppercase tracking-wider mb-2', isDark ? 'text-white/50' : 'text-slate-500')}>Day Range</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['weekday', 'weekend', 'everyday'] as const).map(range => (
                    <button
                      key={range} type="button"
                      onClick={() => setForm(f => ({ ...f, dayRange: range }))}
                      className={clsx(
                        'py-2 rounded-xl text-xs font-bold transition-all border',
                        form.dayRange === range
                          ? 'bg-cyan-500 text-white border-cyan-500'
                          : (isDark ? 'border-white/10 text-white/60' : 'border-slate-300 text-slate-600')
                      )}
                    >
                      {range === 'weekday' ? '📅 Weekdays' : range === 'weekend' ? '🏖️ Weekend' : '📆 Every Day'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={clsx('block text-xs font-bold uppercase tracking-wider mb-1', isDark ? 'text-white/50' : 'text-slate-500')}>Stars *</label>
                  <input
                    required type="number" min="0"
                    value={form.points}
                    onChange={e => setForm(f => ({ ...f, points: e.target.value === '' ? '' : Number(e.target.value) }))}
                    className={clsx('w-full rounded-xl border px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500/50', isDark ? 'bg-black/20 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900')}
                  />
                </div>
                <div>
                  <label className={clsx('block text-xs font-bold uppercase tracking-wider mb-1', isDark ? 'text-white/50' : 'text-slate-500')}>Icon</label>
                  <input
                    value={form.icon}
                    onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                    className={clsx('w-full rounded-xl border px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cyan-500/50', isDark ? 'bg-black/20 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900')}
                  />
                </div>
              </div>

              <p className={clsx('text-xs rounded-xl border px-3 py-2', isDark ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-amber-200 bg-amber-50 text-amber-700')}>
                ⚠️ Child-created routines need parent approval before stars are awarded.
              </p>

              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setShowAddModal(false)}
                  className={clsx('px-4 py-2 rounded-xl text-sm font-bold border', isDark ? 'border-white/10 text-white/60' : 'border-slate-200 text-slate-600')}
                >
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="px-6 py-2 rounded-xl text-sm font-bold bg-cyan-500 text-white hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/30 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Add Routine'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
