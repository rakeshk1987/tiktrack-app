import React, { useState } from 'react';
import clsx from 'clsx';
import { useRoutines } from '../../hooks/useRoutines';
import { useToast } from '../../contexts/ToastContext';
import type { ChildProfile } from '../../types/schema';
import { Clock, Plus, Trash2, Edit2 } from 'lucide-react';

interface RoutineManagementProps {
  familyId: string;
  childrenProfiles: ChildProfile[];
}

export function RoutineManagement({ familyId, childrenProfiles }: RoutineManagementProps) {
  const { routines, createRoutine, updateRoutine, archiveRoutine, loading } = useRoutines(familyId);
  const { addToast } = useToast();
  
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  
  const [title, setTitle] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [points, setPoints] = useState<number | ''>('');
  const [icon, setIcon] = useState('📝');
  const [childId, setChildId] = useState('');

  const activeRoutines = routines.filter(r => r.status === 'active');

  const openCreate = () => {
    setEditId(null);
    setTitle('');
    setScheduleTime('');
    setPoints('');
    setIcon('📝');
    setChildId('');
    setShowModal(true);
  };

  const openEdit = (routine: any) => {
    setEditId(routine.id);
    setTitle(routine.title);
    setScheduleTime(routine.schedule_time);
    setPoints(routine.points);
    setIcon(routine.icon || '📝');
    setChildId(routine.child_id || '');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !scheduleTime || points === '') {
      addToast('Please fill all required fields.', 'error');
      return;
    }
    
    try {
      if (editId) {
        await updateRoutine(editId, {
          title,
          schedule_time: scheduleTime,
          points: Number(points),
          icon,
          child_id: childId || null,
        });
        addToast('Routine updated!', 'success');
      } else {
        await createRoutine({
          family_id: familyId,
          child_id: childId || null,
          title,
          schedule_time: scheduleTime,
          points: Number(points),
          icon,
          status: 'active'
        });
        addToast('Routine created!', 'success');
      }
      setShowModal(false);
    } catch (error) {
      addToast('Failed to save routine.', 'error');
    }
  };

  const handleArchive = async (id: string) => {
    if (confirm('Are you sure you want to archive this routine?')) {
      try {
        await archiveRoutine(id);
        addToast('Routine archived.', 'success');
      } catch (error) {
        addToast('Failed to archive routine.', 'error');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Clock className="text-cyan-500" /> Routines
          </h2>
          <p className="text-sm text-slate-500 dark:text-white/60">Set up daily habits and tracking for your children.</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-600 transition-colors shadow-lg shadow-cyan-500/20"
        >
          <Plus size={16} /> Add Routine
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading routines...</p>
      ) : activeRoutines.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-white/10">
          <p className="text-slate-500 dark:text-white/60">No routines defined yet. Create your first daily habit!</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activeRoutines.map(routine => (
            <div key={routine.id} className="rounded-2xl border p-4 bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 flex flex-col justify-between hover:shadow-lg transition-shadow">
              <div>
                <div className="flex items-start justify-between mb-2">
                  <div className="text-3xl bg-slate-100 dark:bg-white/10 p-2 rounded-xl">{routine.icon || '📝'}</div>
                  <span className="text-xs font-bold bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300 px-2 py-1 rounded-lg uppercase tracking-wider">{routine.schedule_time}</span>
                </div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">{routine.title}</h3>
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mt-1">{routine.points} pts</p>
                <p className="text-xs text-slate-500 dark:text-white/50 mt-2">
                  Assigned to: {routine.child_id ? childrenProfiles.find(c => c.id === routine.child_id)?.name || 'Unknown' : 'All Children'}
                </p>
              </div>
              <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
                <button
                  onClick={() => openEdit(routine)}
                  className="flex-1 py-1.5 rounded-lg text-sm font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-white/80 dark:hover:bg-white/20 transition-colors flex items-center justify-center gap-1"
                >
                  <Edit2 size={14} /> Edit
                </button>
                <button
                  onClick={() => handleArchive(routine.id)}
                  className="flex-1 py-1.5 rounded-lg text-sm font-bold bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20 transition-colors flex items-center justify-center gap-1"
                >
                  <Trash2 size={14} /> Archive
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#1a1f3c] shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{editId ? 'Edit Routine' : 'Create Routine'}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">✕</button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-500 dark:text-white/60">Title</label>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Morning Brushing"
                  className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500/50 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-500 dark:text-white/60">Time (HH:MM)</label>
                  <input
                    required
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500/50 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-500 dark:text-white/60">Points</label>
                  <input
                    required
                    type="number"
                    min="0"
                    value={points}
                    onChange={(e) => setPoints(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500/50 outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-500 dark:text-white/60">Icon (Emoji)</label>
                  <input
                    required
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500/50 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-slate-500 dark:text-white/60">Child</label>
                  <select
                    value={childId}
                    onChange={(e) => setChildId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500/50 outline-none"
                  >
                    <option value="">All Children</option>
                    {childrenProfiles.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-white/10 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-bold border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
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
