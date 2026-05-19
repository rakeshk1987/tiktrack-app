import React, { useState } from 'react';
import clsx from 'clsx';
import { useRoutines } from '../../hooks/useRoutines';
import { useToast } from '../../contexts/ToastContext';
import type { ChildProfile, Routine } from '../../types/schema';
import { Clock, Plus, Trash2, Edit2, Calendar, CheckSquare } from 'lucide-react';

interface RoutineManagementProps {
  familyId: string;
  childrenProfiles: ChildProfile[];
}

const DAY_RANGE_LABELS = {
  weekday: '📅 Weekdays (Mon–Fri)',
  weekend: '🏖️ Weekend (Sat–Sun)',
  everyday: '📆 Every Day',
} as const;

const DAY_RANGE_COLORS = {
  weekday: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  weekend: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300',
  everyday: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
};

const EMPTY_FORM = {
  title: '',
  startTime: '07:00',
  endTime: '08:00',
  points: '' as number | '',
  icon: '📝',
  childId: '',
  dayRange: 'everyday' as Routine['day_range'],
  requiresApproval: false,
};

export function RoutineManagement({ familyId, childrenProfiles }: RoutineManagementProps) {
  const { routines, createRoutine, updateRoutine, archiveRoutine, loading } = useRoutines(familyId);
  const { addToast } = useToast();

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const activeRoutines = routines.filter(r => r.status === 'active');
  const weekdayRoutines = activeRoutines.filter(r => r.day_range === 'weekday' || r.day_range === 'everyday');
  const weekendRoutines = activeRoutines.filter(r => r.day_range === 'weekend' || r.day_range === 'everyday');

  const openCreate = () => {
    setEditId(null);
    setForm({ ...EMPTY_FORM });
    setShowModal(true);
  };

  const openEdit = (r: Routine) => {
    setEditId(r.id);
    setForm({
      title: r.title,
      startTime: r.start_time || r.schedule_time || '07:00',
      endTime: r.end_time || '08:00',
      points: r.points,
      icon: r.icon || '📝',
      childId: r.child_id || '',
      dayRange: r.day_range || 'everyday',
      requiresApproval: r.requires_approval ?? false,
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.startTime || !form.endTime || form.points === '') {
      addToast('Please fill all required fields.', 'error');
      return;
    }
    if (form.endTime <= form.startTime) {
      addToast('End time must be after start time.', 'error');
      return;
    }

    try {
      const payload: Omit<Routine, 'id' | 'created_at' | 'updated_at' | 'streak'> = {
        family_id: familyId,
        child_id: form.childId || null,
        title: form.title.trim(),
        start_time: form.startTime,
        end_time: form.endTime,
        day_range: form.dayRange,
        points: Number(form.points),
        icon: form.icon || '📝',
        requires_approval: form.requiresApproval,
        created_by: 'parent',
        status: 'active',
      };

      if (editId) {
        await updateRoutine(editId, payload);
        addToast('Routine updated!', 'success');
      } else {
        await createRoutine(payload);
        addToast('Routine created!', 'success');
      }
      setShowModal(false);
    } catch (error) {
      addToast('Failed to save routine. Check Firestore rules.', 'error');
    }
  };

  const handleArchive = async (id: string) => {
    if (!confirm('Archive this routine?')) return;
    try {
      await archiveRoutine(id);
      addToast('Routine archived.', 'success');
    } catch {
      addToast('Failed to archive.', 'error');
    }
  };

  const RoutineCard = ({ routine }: { routine: Routine }) => (
    <div className="rounded-2xl border p-4 bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 flex flex-col justify-between hover:shadow-lg transition-shadow">
      <div>
        <div className="flex items-start justify-between mb-3">
          <div className="text-3xl bg-slate-100 dark:bg-white/10 p-2 rounded-xl">{routine.icon || '📝'}</div>
          <div className="flex flex-col items-end gap-1">
            <span className={clsx('text-xs font-bold px-2 py-0.5 rounded-full', DAY_RANGE_COLORS[routine.day_range || 'everyday'])}>
              {routine.day_range === 'weekday' ? 'Weekdays' : routine.day_range === 'weekend' ? 'Weekend' : 'Every Day'}
            </span>
            <span className="text-xs font-bold bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Clock size={11} /> {routine.start_time || routine.schedule_time} – {routine.end_time || '—'}
            </span>
          </div>
        </div>
        <h3 className="font-bold text-base text-slate-900 dark:text-white">{routine.title}</h3>
        <div className="flex items-center gap-3 mt-2">
          <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">⭐ {routine.points} stars</p>
          {routine.requires_approval && (
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <CheckSquare size={11} /> Needs approval
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 dark:text-white/50 mt-1">
          {routine.child_id
            ? childrenProfiles.find(c => c.id === routine.child_id)?.name || 'Unknown'
            : 'All Children'}
        </p>
      </div>
      <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-white/5">
        <button
          onClick={() => openEdit(routine)}
          className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-white/80 dark:hover:bg-white/20 transition-colors flex items-center justify-center gap-1"
        >
          <Edit2 size={13} /> Edit
        </button>
        <button
          onClick={() => handleArchive(routine.id)}
          className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20 transition-colors flex items-center justify-center gap-1"
        >
          <Trash2 size={13} /> Archive
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Clock className="text-cyan-500" /> Routines
          </h2>
          <p className="text-sm text-slate-500 dark:text-white/60">
            Create weekday and weekend habits for your children.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-600 transition-colors shadow-lg shadow-cyan-500/20"
        >
          <Plus size={16} /> Add Routine
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500 animate-pulse">Loading routines...</p>
      ) : activeRoutines.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-white/10 p-10 text-center">
          <p className="text-slate-400 dark:text-white/40 text-sm">No routines yet — create your first daily habit!</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Weekday routines */}
          {weekdayRoutines.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Calendar size={16} className="text-blue-500" />
                <h3 className="text-sm font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Weekday Routines (Mon–Fri)
                </h3>
                <span className="ml-auto text-xs font-bold bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300 px-2 py-0.5 rounded-full">
                  {weekdayRoutines.length}
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {weekdayRoutines.map(r => <RoutineCard key={r.id} routine={r} />)}
              </div>
            </div>
          )}

          {/* Weekend routines */}
          {weekendRoutines.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Calendar size={16} className="text-purple-500" />
                <h3 className="text-sm font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  Weekend Routines (Sat–Sun)
                </h3>
                <span className="ml-auto text-xs font-bold bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-300 px-2 py-0.5 rounded-full">
                  {weekendRoutines.length}
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {weekendRoutines.map(r => <RoutineCard key={r.id} routine={r} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#1a1f3c] shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {editId ? 'Edit Routine' : 'Create Routine'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">✕</button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto max-h-[80vh]">
              {/* Title */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-500 dark:text-white/60">Routine Name *</label>
                <input
                  required
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Morning Brushing"
                  className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500/50 outline-none"
                />
              </div>

              {/* Start / End Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-500 dark:text-white/60">Start Time *</label>
                  <input
                    required
                    type="time"
                    value={form.startTime}
                    onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500/50 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-500 dark:text-white/60">End Time *</label>
                  <input
                    required
                    type="time"
                    value={form.endTime}
                    onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500/50 outline-none"
                  />
                </div>
              </div>

              {/* Day Range */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-slate-500 dark:text-white/60">Day Range *</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['weekday', 'weekend', 'everyday'] as const).map(range => (
                    <button
                      key={range}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, dayRange: range }))}
                      className={clsx(
                        'py-2.5 rounded-xl text-xs font-bold transition-all border',
                        form.dayRange === range
                          ? 'bg-cyan-500 text-white border-cyan-500 shadow-md shadow-cyan-500/30'
                          : 'border-slate-300 dark:border-white/10 text-slate-600 dark:text-white/60 hover:border-cyan-400 hover:text-cyan-600'
                      )}
                    >
                      {range === 'weekday' ? '📅 Weekdays' : range === 'weekend' ? '🏖️ Weekend' : '📆 Every Day'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stars + Icon */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-500 dark:text-white/60">Stars *</label>
                  <input
                    required
                    type="number"
                    min="0"
                    value={form.points}
                    onChange={e => setForm(f => ({ ...f, points: e.target.value === '' ? '' : Number(e.target.value) }))}
                    className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500/50 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-500 dark:text-white/60">Icon (Emoji)</label>
                  <input
                    value={form.icon}
                    onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500/50 outline-none"
                  />
                </div>
              </div>

              {/* Assign to Child */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-500 dark:text-white/60">Assign To</label>
                <select
                  value={form.childId}
                  onChange={e => setForm(f => ({ ...f, childId: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500/50 outline-none"
                >
                  <option value="">All Children</option>
                  {childrenProfiles.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Requires Approval */}
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                <input
                  type="checkbox"
                  checked={form.requiresApproval}
                  onChange={e => setForm(f => ({ ...f, requiresApproval: e.target.checked }))}
                  className="w-4 h-4 rounded accent-cyan-500"
                />
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-white">Requires Parent Approval</p>
                  <p className="text-xs text-slate-500 dark:text-white/50">Stars are awarded after you approve the completion.</p>
                </div>
              </label>

              <div className="mt-2 pt-4 border-t border-slate-100 dark:border-white/10 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-bold border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70 hover:bg-slate-50 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl text-sm font-bold bg-cyan-500 text-white hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/30"
                >
                  {editId ? 'Save Changes' : 'Create Routine'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
