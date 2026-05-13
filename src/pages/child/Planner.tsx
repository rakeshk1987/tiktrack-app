import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { BellRing, CheckCircle2, Clock3, Trophy } from 'lucide-react';
import { addDoc, collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import type { Achievement } from '../../types/schema';
import { useChildLayout } from './ChildLayout';

function formatDateLabel(iso?: string | null) {
  if (!iso) return 'No date';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

const todayIsoDate = () => new Date().toISOString().slice(0, 10);

export default function ChildPlanner() {
  const { events, reminders, tasks, mutedTextClass, panelClass, parentId, profile } = useChildLayout();
  const childId = profile.id;
  const cardClass = 'border-white/10 bg-white/[0.04]';

  const [taskTitle, setTaskTitle] = useState('');
  const [taskDate, setTaskDate] = useState(todayIsoDate());
  const [schoolTitle, setSchoolTitle] = useState('');
  const [schoolDate, setSchoolDate] = useState(todayIsoDate());
  const [examTitle, setExamTitle] = useState('');
  const [examDate, setExamDate] = useState(todayIsoDate());
  const [achievementTitle, setAchievementTitle] = useState('');
  const [achievementDate, setAchievementDate] = useState(todayIsoDate());
  const [achievementNotes, setAchievementNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  useEffect(() => {
    if (!childId) return;
    const q = query(collection(db, 'achievements'), where('child_id', '==', childId));
    const unsub = onSnapshot(q, (snap) => {
      const mapped = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Achievement, 'id'>) }))
        .sort((a, b) => b.date.localeCompare(a.date));
      setAchievements(mapped);
    });
    return () => unsub();
  }, [childId]);

  const completedTasks = tasks.filter((item) => item.log?.status === 'completed');
  const pendingTasks = tasks.filter((item) => item.log?.status !== 'completed');
  const examEvents = events
    .filter((event) => event.type.toLowerCase().includes('exam'))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const schoolTimetable = useMemo(
    () =>
      events
        .filter((event) => event.type.toLowerCase().includes('school'))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [events]
  );

  const saveChildTask = async () => {
    if (!taskTitle.trim() || !childId) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'tasks'), {
        title: taskTitle.trim(),
        description: 'Child created daily task',
        category: 'Self Planned',
        priority: 'medium',
        energy_level: 'medium',
        difficulty_level: 1,
        star_value: 1,
        requires_proof: false,
        status: 'pending',
        due_date: new Date(`${taskDate}T09:00:00.000Z`).toISOString(),
        child_id: childId,
        parent_id: parentId || childId,
        created_by: 'child',
        approval_status: 'pending',
        created_at: new Date().toISOString()
      });
      setTaskTitle('');
    } finally {
      setSaving(false);
    }
  };

  const saveSchoolEntry = async () => {
    if (!schoolTitle.trim() || !childId) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'events'), {
        child_id: childId,
        parent_id: parentId || childId,
        title: schoolTitle.trim(),
        type: 'school_timetable',
        date: new Date(`${schoolDate}T09:00:00.000Z`).toISOString(),
        reminder_days_before: 0,
        created_by: 'child',
        approval_status: 'pending',
        created_at: new Date().toISOString()
      });
      setSchoolTitle('');
    } finally {
      setSaving(false);
    }
  };

  const saveExamEntry = async () => {
    if (!examTitle.trim() || !childId) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'events'), {
        child_id: childId,
        parent_id: parentId || childId,
        title: examTitle.trim(),
        type: 'exam',
        date: new Date(`${examDate}T09:00:00.000Z`).toISOString(),
        reminder_days_before: 2,
        created_by: 'child',
        approval_status: 'pending',
        created_at: new Date().toISOString()
      });
      setExamTitle('');
    } finally {
      setSaving(false);
    }
  };

  const saveAchievement = async () => {
    if (!achievementTitle.trim() || !childId) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'achievements'), {
        child_id: childId,
        parent_id: parentId || childId,
        title: achievementTitle.trim(),
        description: achievementNotes.trim(),
        date: achievementDate,
        category: 'other',
        approval_status: 'pending',
        created_at: new Date().toISOString()
      });
      setAchievementTitle('');
      setAchievementNotes('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-display font-bold">Planner</h2>
          <p className={mutedTextClass}>Plan your day yourself: tasks, school schedule, exams, and achievements.</p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className={clsx('rounded-[1.75rem] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]', panelClass)}>
          <h3 className="text-xl font-display font-bold">Create Daily Task</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_180px_auto]">
            <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Task title" className="rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-white" />
            <input type="date" value={taskDate} onChange={(e) => setTaskDate(e.target.value)} className="rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-white" />
            <button onClick={() => void saveChildTask()} disabled={saving} className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">Save</button>
          </div>
          <div className="mt-4 space-y-2">
            {pendingTasks.map(({ task }) => (
              <div key={task.id} className={clsx('flex items-center justify-between rounded-2xl border px-4 py-3', cardClass)}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{task.title}</p>
                  <p className={clsx('text-xs', mutedTextClass)}>{task.category} • {task.priority}</p>
                </div>
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
          <h3 className="text-xl font-display font-bold">School Timetable</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_180px_auto]">
            <input value={schoolTitle} onChange={(e) => setSchoolTitle(e.target.value)} placeholder="Subject / period" className="rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-white" />
            <input type="date" value={schoolDate} onChange={(e) => setSchoolDate(e.target.value)} className="rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-white" />
            <button onClick={() => void saveSchoolEntry()} disabled={saving} className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">Save</button>
          </div>
          <div className="mt-4 space-y-2">
            {schoolTimetable.length === 0 ? <p className={mutedTextClass}>No school timetable entries yet.</p> : null}
            {schoolTimetable.map((event) => (
              <div key={event.id} className={clsx('rounded-2xl border px-4 py-3', cardClass)}>
                <p className="text-sm font-bold">{event.title}</p>
                <p className={clsx('mt-1 text-xs', mutedTextClass)}>{formatDateLabel(event.date)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={clsx('rounded-[1.75rem] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]', panelClass)}>
          <h3 className="text-xl font-display font-bold">Exam Timetable</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_180px_auto]">
            <input value={examTitle} onChange={(e) => setExamTitle(e.target.value)} placeholder="Exam subject" className="rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-white" />
            <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} className="rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-white" />
            <button onClick={() => void saveExamEntry()} disabled={saving} className="rounded-xl bg-fuchsia-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">Save</button>
          </div>
          <div className="mt-4 space-y-2">
            {examEvents.length === 0 ? <p className={mutedTextClass}>No exam entries yet.</p> : null}
            {examEvents.map((event) => (
              <div key={event.id} className={clsx('rounded-2xl border px-4 py-3', cardClass)}>
                <p className="text-sm font-bold">{event.title}</p>
                <p className={clsx('mt-1 text-xs', mutedTextClass)}>{formatDateLabel(event.date)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={clsx('rounded-[1.75rem] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]', panelClass)}>
          <h3 className="text-xl font-display font-bold inline-flex items-center gap-2"><Trophy size={18} className="text-amber-300" />Achievements</h3>
          <div className="mt-3 grid gap-2">
            <input value={achievementTitle} onChange={(e) => setAchievementTitle(e.target.value)} placeholder="Achievement title" className="rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-white" />
            <input type="date" value={achievementDate} onChange={(e) => setAchievementDate(e.target.value)} className="rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-white" />
            <textarea value={achievementNotes} onChange={(e) => setAchievementNotes(e.target.value)} placeholder="Notes (optional)" className="rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-white min-h-[80px]" />
            <button onClick={() => void saveAchievement()} disabled={saving} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-slate-900 disabled:opacity-60">Save Achievement</button>
          </div>
          <div className="mt-4 space-y-2">
            {achievements.length === 0 ? <p className={mutedTextClass}>No achievements yet.</p> : null}
            {achievements.map((item) => (
              <div key={item.id} className={clsx('rounded-2xl border px-4 py-3', cardClass)}>
                <p className="text-sm font-bold">{item.title}</p>
                <p className={clsx('mt-1 text-xs', mutedTextClass)}>{item.date}{item.description ? ` • ${item.description}` : ''}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

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

      <div className="rounded-[1.5rem] border border-white/12 bg-white/[0.04] px-4 py-3 text-sm text-white/80 shadow-[0_10px_28px_rgba(0,0,0,0.14)]">
        <div className="flex items-center gap-2 font-semibold">
          <Clock3 size={15} />
          You can self-plan now. Parent can still monitor from the parent dashboard.
        </div>
      </div>
    </div>
  );
}
