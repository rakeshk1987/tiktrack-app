import clsx from 'clsx';
import { useChildLayout } from './ChildLayout';

export default function ChildDiary() {
  const {
    accentCaptionClass,
    diaryDraft,
    diarySaving,
    entries,
    handleDiarySubmit,
    isDark,
    mutedTextClass,
    panelClass,
    setDiaryDraft,
    softTextClass
  } = useChildLayout();

  return (
    <div className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
      <div className={clsx('rounded-[2rem] border p-5 shadow-[0_20px_50px_rgba(0,0,0,0.18)]', panelClass)}>
        <h2 className="text-3xl font-display font-bold">Quest diary</h2>
        <p className={clsx('mt-2 text-sm', mutedTextClass)}>Write one brave thing, one fun thing, or one tiny win from today.</p>
        <textarea
          value={diaryDraft}
          onChange={(event) => setDiaryDraft(event.target.value)}
          placeholder="Today I felt proud because..."
          className={clsx('mt-4 h-40 w-full rounded-[1.4rem] border px-4 py-4 outline-none transition', isDark ? 'border-white/12 bg-white/6 text-white placeholder:text-white/35' : 'border-indigo-200 bg-white text-slate-900 placeholder:text-slate-400')}
        />
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className={clsx('text-sm', mutedTextClass)}>{diaryDraft.trim().length}/280 thoughts</p>
          <button onClick={() => void handleDiarySubmit()} disabled={!diaryDraft.trim() || diarySaving} className="rounded-2xl bg-[linear-gradient(135deg,#8b5cf6,#ec4899)] px-5 py-3 text-sm font-black text-white shadow-[0_12px_25px_rgba(139,92,246,0.28)] transition hover:brightness-110 disabled:opacity-60">
            {diarySaving ? 'Saving...' : 'Save Diary'}
          </button>
        </div>
      </div>

      <div className={clsx('rounded-[2rem] border p-5 shadow-[0_20px_50px_rgba(0,0,0,0.18)]', panelClass)}>
        <h3 className="text-2xl font-display font-bold">Recent notes</h3>
        <div className="mt-4 space-y-3">
          {entries.map((entry) => (
            <div key={entry.id} className={clsx('rounded-[1.3rem] border px-4 py-4', isDark ? 'border-white/10 bg-white/6' : 'border-indigo-200/70 bg-white/80')}>
              <p className={clsx('text-xs font-bold uppercase tracking-[0.18em]', accentCaptionClass)}>{new Date(entry.date).toLocaleDateString()}</p>
              <p className={clsx('mt-2 text-sm leading-6', softTextClass)}>{entry.content}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
