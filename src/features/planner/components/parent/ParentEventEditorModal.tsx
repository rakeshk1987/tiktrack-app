import { useEffect, useMemo, useState } from 'react';
import { PLANNER_EVENT_CATEGORIES } from '../../constants/planner.constants';
import type { PlannerEvent, PlannerProgram } from '../../types/planner.types';
import { plannerEventInputSchema, type PlannerEventInput } from '../../utils/planner.validation';
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard';

const WEEK_DAYS = [
  { id: 0, label: 'Sun' },
  { id: 1, label: 'Mon' },
  { id: 2, label: 'Tue' },
  { id: 3, label: 'Wed' },
  { id: 4, label: 'Thu' },
  { id: 5, label: 'Fri' },
  { id: 6, label: 'Sat' }
];

interface ParentEventEditorModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  event: PlannerEvent | null;
  programs: PlannerProgram[];
  onClose: () => void;
  onSubmit: (input: PlannerEventInput) => Promise<void>;
}

function toInputDateTimeLocal(value: string): string {
  const d = new Date(value);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function toIsoFromLocal(value: string): string {
  const d = new Date(value);
  return d.toISOString();
}

export function ParentEventEditorModal({ open, mode, event, programs, onClose, onSubmit }: ParentEventEditorModalProps) {
  const draftKey = useMemo(() => `planner_event_draft_${mode}_${event?.id || 'new'}`, [event?.id, mode]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<PlannerEvent['category']>('school');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [linkedProgramId, setLinkedProgramId] = useState('');
  const [recurrenceType, setRecurrenceType] = useState<'none' | 'daily' | 'weekly'>('none');
  const [recurrenceWeekDays, setRecurrenceWeekDays] = useState<number[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [initialSnapshot, setInitialSnapshot] = useState('');

  useEffect(() => {
    if (!open) return;

    const saved = localStorage.getItem(draftKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as {
          title: string;
          category: PlannerEvent['category'];
          startAt: string;
          endAt: string;
          linkedProgramId: string;
          recurrenceType: 'none' | 'daily' | 'weekly';
          recurrenceWeekDays: number[];
        };
        setTitle(parsed.title || '');
        setCategory(parsed.category || 'school');
        setStartAt(parsed.startAt || '');
        setEndAt(parsed.endAt || '');
        setLinkedProgramId(parsed.linkedProgramId || '');
        setRecurrenceType(parsed.recurrenceType || 'none');
        setRecurrenceWeekDays(parsed.recurrenceWeekDays || []);
        setInitialSnapshot(saved);
        return;
      } catch {
      }
    }

    if (event) {
      setTitle(event.title);
      setCategory(event.category);
      setStartAt(toInputDateTimeLocal(event.startAt));
      setEndAt(toInputDateTimeLocal(event.endAt));
      setLinkedProgramId(event.linkedProgramId || '');
      const recurrence = event.recurrence.type;
      setRecurrenceType(recurrence === 'daily' || recurrence === 'weekly' ? recurrence : 'none');
      setRecurrenceWeekDays(event.recurrence.byWeekDays || []);
      setInitialSnapshot(JSON.stringify({ title: event.title, category: event.category, startAt: toInputDateTimeLocal(event.startAt), endAt: toInputDateTimeLocal(event.endAt), linkedProgramId: event.linkedProgramId || '', recurrenceType: recurrence === 'daily' || recurrence === 'weekly' ? recurrence : 'none', recurrenceWeekDays: event.recurrence.byWeekDays || [] }));
    } else {
      const start = new Date();
      start.setHours(start.getHours() + 1, 0, 0, 0);
      const end = new Date(start.getTime() + 60 * 60000);
      setTitle('');
      setCategory('school');
      setStartAt(toInputDateTimeLocal(start.toISOString()));
      setEndAt(toInputDateTimeLocal(end.toISOString()));
      setLinkedProgramId('');
      setRecurrenceType('none');
      setRecurrenceWeekDays([]);
      setInitialSnapshot(JSON.stringify({ title: '', category: 'school', startAt: toInputDateTimeLocal(start.toISOString()), endAt: toInputDateTimeLocal(end.toISOString()), linkedProgramId: '', recurrenceType: 'none', recurrenceWeekDays: [] }));
    }
  }, [draftKey, event, open]);

  useEffect(() => {
    if (!open) return;
    localStorage.setItem(draftKey, JSON.stringify({ title, category, startAt, endAt, linkedProgramId, recurrenceType, recurrenceWeekDays }));
  }, [category, draftKey, endAt, linkedProgramId, open, recurrenceType, recurrenceWeekDays, startAt, title]);

  const currentSnapshot = JSON.stringify({ title, category, startAt, endAt, linkedProgramId, recurrenceType, recurrenceWeekDays });
  const hasUnsavedChanges = open && currentSnapshot !== initialSnapshot;
  useUnsavedChangesGuard(hasUnsavedChanges);

  function handleCloseRequest() {
    if (hasUnsavedChanges && !window.confirm('Discard unsaved changes?')) return;
    onClose();
  }

  if (!open) return null;

  async function handleSubmit() {
    setError('');
    const parsed = plannerEventInputSchema.safeParse({
      title,
      category,
      startAt: toIsoFromLocal(startAt),
      endAt: toIsoFromLocal(endAt),
      linkedProgramId: linkedProgramId || null,
      recurrenceType,
      recurrenceWeekDays
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || 'Invalid event data');
      return;
    }

    setSaving(true);
    try {
      await onSubmit(parsed.data);
      localStorage.removeItem(draftKey);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save event');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 md:items-center" role="dialog" aria-modal="true">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-slate-950 p-5 shadow-2xl max-h-[85vh] overflow-auto">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold text-white">{mode === 'create' ? 'Create Event' : 'Edit Event'}</h3>
          <button type="button" onClick={handleCloseRequest} className="min-h-[40px] rounded-lg border border-white/15 px-2.5 py-1 text-xs text-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">Close</button>
        </div>

        <div className="mt-4 space-y-3">
          <input aria-label="Event title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="min-h-[44px] w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300" />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <select aria-label="Event category" value={category} onChange={(e) => setCategory(e.target.value as PlannerEvent['category'])} className="min-h-[44px] rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">
              {PLANNER_EVENT_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat.replace('_', ' ')}</option>)}
            </select>
            <select aria-label="Linked program" value={linkedProgramId} onChange={(e) => setLinkedProgramId(e.target.value)} className="min-h-[44px] rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">
              <option value="">No linked program</option>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input aria-label="Start date and time" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="min-h-[44px] rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300" />
            <input aria-label="End date and time" type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} className="min-h-[44px] rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300" />
          </div>

          <div>
            <select aria-label="Recurrence type" value={recurrenceType} onChange={(e) => setRecurrenceType(e.target.value as 'none' | 'daily' | 'weekly')} className="min-h-[44px] w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">
              <option value="none">No recurrence</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
            {recurrenceType === 'weekly' ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {WEEK_DAYS.map((day) => {
                  const active = recurrenceWeekDays.includes(day.id);
                  return (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => setRecurrenceWeekDays((prev) => (prev.includes(day.id) ? prev.filter((x) => x !== day.id) : [...prev, day.id]))}
                      className={active ? 'rounded-full border border-cyan-300/40 bg-cyan-400/20 px-3 py-1 text-xs text-cyan-100' : 'rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/70'}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}

          <button type="button" disabled={saving} onClick={() => void handleSubmit()} className="w-full rounded-xl bg-cyan-500/30 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-60">
            {saving ? 'Saving...' : mode === 'create' ? 'Create event' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
