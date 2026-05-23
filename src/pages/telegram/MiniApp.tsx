import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { activeFirebaseEnv, firebaseConfig, isUsingFirebaseEmulators } from '../../config/firebase';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        ready: () => void;
        expand: () => void;
        close: () => void;
        MainButton?: {
          setText: (text: string) => void;
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
        };
      };
    };
  }
}

type ScheduleType = 'task' | 'event' | 'exam';

interface ChildOption {
  id: string;
  name: string;
}

interface ProgramOption {
  id: string;
  name: string;
  modules: string[];
}

interface BootstrapData {
  familyId: string;
  telegramUser: { id: number; firstName: string; username: string };
  children: ChildOption[];
  programsByChild: Record<string, ProgramOption[]>;
}

interface ScheduleItem {
  id: string;
  collection: 'tasks' | 'events' | 'exams';
  type: ScheduleType;
  title: string;
  startAt: string;
  endAt?: string | null;
  childId: string;
  activityName?: string | null;
}

const typeOptions: Array<{ id: ScheduleType; label: string }> = [
  { id: 'task', label: 'Task' },
  { id: 'event', label: 'Event' },
  { id: 'exam', label: 'Exam' },
];

function functionUrl(name: string) {
  const projectId = firebaseConfig?.projectId || '';
  if (isUsingFirebaseEmulators) return `http://127.0.0.1:5001/${projectId}/us-central1/${name}`;
  return `https://us-central1-${projectId}.cloudfunctions.net/${name}`;
}

function toIsoFromLocal(value: string) {
  return value ? new Date(value).toISOString() : '';
}

function defaultLocalDateTime(offsetHours: number) {
  const date = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function moduleAllowed(type: ScheduleType, program: ProgramOption | null) {
  if (!program) return true;
  if (type === 'task') return program.modules.includes('tasks');
  if (type === 'event') return program.modules.includes('events');
  return program.modules.includes('exams');
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDay(value: string) {
  return new Date(value).toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short' });
}

function typeLabel(type: ScheduleType) {
  if (type === 'exam') return 'Exam';
  if (type === 'event') return 'Event';
  return 'Task';
}

async function callMiniAppFunction<T>(name: string, initData: string, payload: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(functionUrl(name), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData, ...payload }),
  });
  const json = await response.json();
  if (!response.ok || !json.ok) throw new Error(json.error || 'Request failed.');
  return json as T;
}

export default function TelegramMiniApp() {
  const [initData, setInitData] = useState('');
  const [data, setData] = useState<BootstrapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeView, setActiveView] = useState<'add' | 'today' | 'week'>('add');
  const [todayItems, setTodayItems] = useState<ScheduleItem[]>([]);
  const [weekItems, setWeekItems] = useState<ScheduleItem[]>([]);
  const [todayLoading, setTodayLoading] = useState(false);
  const [weekLoading, setWeekLoading] = useState(false);
  const [deletingId, setDeletingId] = useState('');

  const [childId, setChildId] = useState('');
  const [scheduleType, setScheduleType] = useState<ScheduleType>('task');
  const [programId, setProgramId] = useState('');
  const [title, setTitle] = useState('');
  const [startAt, setStartAt] = useState(defaultLocalDateTime(1));
  const [endAt, setEndAt] = useState(defaultLocalDateTime(2));
  const [recurrenceType, setRecurrenceType] = useState<'none' | 'daily' | 'weekly'>('none');
  const [createAnyway, setCreateAnyway] = useState(false);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    tg?.ready();
    tg?.expand();
    const nextInitData = tg?.initData || new URLSearchParams(window.location.search).get('initData') || '';
    setInitData(nextInitData);
  }, []);

  useEffect(() => {
    if (!initData) {
      setLoading(false);
      setError('Open this page from the TikTrack Telegram bot.');
      return;
    }

    setLoading(true);
    callMiniAppFunction<BootstrapData & { ok: true }>('telegramMiniAppBootstrap', initData)
      .then((result) => {
        setData(result);
        setChildId(result.children[0]?.id || '');
        setError('');
      })
      .catch((err) => setError(err.message || 'Could not open Telegram Mini App.'))
      .finally(() => setLoading(false));
  }, [initData]);

  const programs = useMemo(() => data?.programsByChild[childId] || [], [childId, data]);
  const validPrograms = useMemo(() => programs.filter((program) => moduleAllowed(scheduleType, program)), [programs, scheduleType]);
  const selectedProgram = validPrograms.find((program) => program.id === programId) || null;

  useEffect(() => {
    if (programId && !validPrograms.some((program) => program.id === programId)) setProgramId('');
  }, [programId, validPrograms]);

  useEffect(() => {
    setCreateAnyway(false);
  }, [childId, scheduleType, programId, title, startAt, endAt, recurrenceType]);

  useEffect(() => {
    if (activeView === 'today' && initData && childId) void loadToday();
    if (activeView === 'week' && initData && childId) void loadWeek();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, childId, initData]);

  const createBlocked = useMemo(() => {
    if (!title.trim() || !childId) return true;
    return new Date(toIsoFromLocal(endAt)).getTime() <= new Date(toIsoFromLocal(startAt)).getTime();
  }, [childId, endAt, startAt, title]);

  async function loadToday() {
    if (!initData || !childId) return;
    setTodayLoading(true);
    setError('');
    try {
      const result = await callMiniAppFunction<{ ok: true; items: ScheduleItem[] }>('telegramMiniAppListToday', initData, { childId });
      setTodayItems(result.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load today.');
    } finally {
      setTodayLoading(false);
    }
  }

  async function loadWeek() {
    if (!initData || !childId) return;
    setWeekLoading(true);
    setError('');
    try {
      const result = await callMiniAppFunction<{ ok: true; items: ScheduleItem[] }>('telegramMiniAppListWeek', initData, { childId });
      setWeekItems(result.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load week.');
    } finally {
      setWeekLoading(false);
    }
  }

  async function handleDelete(item: ScheduleItem) {
    if (!window.confirm(`Delete "${item.title}" from TikTrack?`)) return;
    setDeletingId(item.id);
    setError('');
    setSuccess('');
    try {
      await callMiniAppFunction<{ ok: true }>('telegramMiniAppDeleteSchedule', initData, {
        childId: item.childId,
        collection: item.collection,
        id: item.id,
      });
      setSuccess('Deleted from TikTrack.');
      if (activeView === 'week') await loadWeek();
      else await loadToday();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete schedule.');
    } finally {
      setDeletingId('');
    }
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!initData || !childId || !title.trim()) return;
    if (new Date(toIsoFromLocal(endAt)).getTime() <= new Date(toIsoFromLocal(startAt)).getTime()) {
      setError('End time must be after start time.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const result = await callMiniAppFunction<{ ok: true; id: string }>('telegramMiniAppCreateSchedule', initData, {
        createAnyway,
        draft: {
          childId,
          scheduleType,
          linkedProgramId: selectedProgram?.id || null,
          programName: selectedProgram?.name || null,
          title: title.trim(),
          startAt: toIsoFromLocal(startAt),
          endAt: toIsoFromLocal(endAt),
          recurrenceType,
          recurrenceDays: recurrenceType === 'weekly' ? [new Date(startAt).getDay()] : [],
        },
      });
      setSuccess(`Created in TikTrack: ${result.id}`);
      setTitle('');
      setCreateAnyway(false);
      if (activeView === 'today') await loadToday();
      if (activeView === 'week') await loadWeek();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not create schedule.';
      if (message.includes('duplicate')) setCreateAnyway(true);
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-4 text-white">
      <div className="mx-auto max-w-md space-y-4">
        <header className="rounded-3xl border border-white/10 bg-white/[0.05] p-4">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">TikTrack Mini</p>
          <h1 className="mt-1 text-2xl font-black">Parent Console</h1>
          <p className="mt-1 text-sm text-white/55">
            {data?.telegramUser.firstName ? `Hello, ${data.telegramUser.firstName}` : 'Telegram verified schedule capture'}
          </p>
        </header>

        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-sm text-white/60">Loading TikTrack...</div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-rose-300/30 bg-rose-500/10 p-3 text-sm font-semibold text-rose-100">
            {error}
            {createAnyway ? <p className="mt-1 text-xs text-rose-100/70">Tap Create again to create anyway.</p> : null}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-2xl border border-emerald-300/30 bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-100">{success}</div>
        ) : null}

        {data ? (
          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white/[0.05] p-1">
            <button type="button" onClick={() => setActiveView('add')} className={clsx('rounded-xl px-3 py-2 text-sm font-black', activeView === 'add' ? 'bg-cyan-400 text-slate-950' : 'text-white/65')}>Add</button>
            <button type="button" onClick={() => setActiveView('today')} className={clsx('rounded-xl px-3 py-2 text-sm font-black', activeView === 'today' ? 'bg-cyan-400 text-slate-950' : 'text-white/65')}>Today</button>
            <button type="button" onClick={() => setActiveView('week')} className={clsx('rounded-xl px-3 py-2 text-sm font-black', activeView === 'week' ? 'bg-cyan-400 text-slate-950' : 'text-white/65')}>Week</button>
          </div>
        ) : null}

        {data ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-4">
            <div>
              <label className="mb-1 block text-xs font-black uppercase tracking-wide text-white/45">Child</label>
              <select value={childId} onChange={(event) => setChildId(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-900 px-3 py-3 text-sm font-bold outline-none">
                {data.children.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}
              </select>
            </div>
          </div>
        ) : null}

        {data && activeView === 'add' ? (
          <form onSubmit={handleCreate} className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.05] p-4">

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-wide text-white/45">Type</label>
              <div className="grid grid-cols-3 gap-2">
                {typeOptions.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setScheduleType(type.id)}
                    className={clsx('rounded-2xl border px-3 py-3 text-sm font-black', scheduleType === type.id ? 'border-cyan-300 bg-cyan-400 text-slate-950' : 'border-white/10 bg-white/[0.04] text-white/70')}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-black uppercase tracking-wide text-white/45">Activity</label>
              <select value={programId} onChange={(event) => setProgramId(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-900 px-3 py-3 text-sm font-bold outline-none">
                <option value="">No activity</option>
                {validPrograms.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-black uppercase tracking-wide text-white/45">Title</label>
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Physics exam, Swimming class..." className="w-full rounded-2xl border border-white/10 bg-slate-900 px-3 py-3 text-sm font-bold outline-none" />
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="mb-1 block text-xs font-black uppercase tracking-wide text-white/45">Start</label>
                <input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-900 px-3 py-3 text-sm font-bold outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-black uppercase tracking-wide text-white/45">End</label>
                <input type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-900 px-3 py-3 text-sm font-bold outline-none" />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-black uppercase tracking-wide text-white/45">Repeat</label>
              <select value={recurrenceType} onChange={(event) => setRecurrenceType(event.target.value as 'none' | 'daily' | 'weekly')} className="w-full rounded-2xl border border-white/10 bg-slate-900 px-3 py-3 text-sm font-bold outline-none">
                <option value="none">One time</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly on selected start day</option>
              </select>
            </div>

            <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-3 text-sm">
              <p className="text-xs font-black uppercase tracking-wide text-cyan-200">Review</p>
              <p className="mt-1 font-bold text-white">{typeLabel(scheduleType)} · {title.trim() || 'Untitled'}</p>
              <p className="mt-1 text-xs font-semibold text-white/55">{selectedProgram?.name || 'No activity'} · {formatDay(toIsoFromLocal(startAt))} {formatTime(toIsoFromLocal(startAt))}</p>
              {createBlocked && title.trim() ? <p className="mt-2 text-xs font-bold text-rose-200">End time must be after start time.</p> : null}
            </div>

            <button disabled={saving || createBlocked} type="submit" className="w-full rounded-2xl bg-cyan-400 px-4 py-4 text-sm font-black uppercase tracking-wide text-slate-950 disabled:opacity-50">
              {saving ? 'Creating...' : createAnyway ? 'Create Anyway' : 'Create'}
            </button>
          </form>
        ) : null}

        {data && activeView === 'today' ? (
          <section className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.05] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">Today</h2>
                <p className="text-xs font-semibold text-white/45">{todayItems.length} item{todayItems.length === 1 ? '' : 's'}</p>
              </div>
              <button type="button" onClick={() => void loadToday()} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-white/70">
                Refresh
              </button>
            </div>
            {todayLoading ? <p className="rounded-2xl border border-white/10 p-4 text-sm text-white/50">Loading today...</p> : null}
            {!todayLoading && todayItems.length === 0 ? <p className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-white/45">No schedules for today.</p> : null}
            {todayItems.map((item) => (
              <div key={`${item.collection}:${item.id}`} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-wide text-cyan-300">{typeLabel(item.type)} · {formatTime(item.startAt)}</p>
                    <h3 className="mt-1 truncate text-base font-black">{item.title}</h3>
                    <p className="mt-1 text-xs font-semibold text-white/45">{item.activityName || 'No activity'}</p>
                  </div>
                  <button type="button" disabled={deletingId === item.id} onClick={() => void handleDelete(item)} className="rounded-xl bg-rose-500/15 px-3 py-2 text-xs font-black text-rose-200 disabled:opacity-50">
                    {deletingId === item.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </section>
        ) : null}

        {data && activeView === 'week' ? (
          <section className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.05] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">Next 7 Days</h2>
                <p className="text-xs font-semibold text-white/45">{weekItems.length} item{weekItems.length === 1 ? '' : 's'}</p>
              </div>
              <button type="button" onClick={() => void loadWeek()} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-white/70">
                Refresh
              </button>
            </div>
            {weekLoading ? <p className="rounded-2xl border border-white/10 p-4 text-sm text-white/50">Loading week...</p> : null}
            {!weekLoading && weekItems.length === 0 ? <p className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-white/45">No schedules in the next 7 days.</p> : null}
            {weekItems.map((item) => (
              <div key={`${item.collection}:${item.id}:${item.startAt}`} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-wide text-cyan-300">{formatDay(item.startAt)} · {formatTime(item.startAt)} · {typeLabel(item.type)}</p>
                    <h3 className="mt-1 truncate text-base font-black">{item.title}</h3>
                    <p className="mt-1 text-xs font-semibold text-white/45">{item.activityName || 'No activity'}</p>
                  </div>
                  <button type="button" disabled={deletingId === item.id} onClick={() => void handleDelete(item)} className="rounded-xl bg-rose-500/15 px-3 py-2 text-xs font-black text-rose-200 disabled:opacity-50">
                    {deletingId === item.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </section>
        ) : null}

        <p className="px-1 text-center text-[11px] font-semibold text-white/35">
          {activeFirebaseEnv.toUpperCase()} {isUsingFirebaseEmulators ? 'emulator' : 'cloud'}
        </p>
      </div>
    </div>
  );
}
