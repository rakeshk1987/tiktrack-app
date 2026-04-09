import { useState } from 'react';
import { useChildProfile, useTodaysTasks } from '../../hooks/useData';
import { Star, Shield, Flame, Camera, BookHeart, Smile, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { signOut } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { Moon, Sun } from 'lucide-react';

const moodOptions = [
  { icon: ':(', label: 'Need a hug' },
  { icon: ':|', label: 'Okay-ish' },
  { icon: ':)', label: 'Ready' },
  { icon: 'B)', label: 'Super mode' }
];

export default function ChildDashboard() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const childId = user?.id || '';
  const { profile, loading: profileLoading } = useChildProfile(childId);
  const { tasks, loading: tasksLoading } = useTodaysTasks(childId);

  const [mood, setMood] = useState<string | null>(null);
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([]);
  const [notice, setNotice] = useState('');

  if (profileLoading || tasksLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-bg">
        <div className="animate-pulse flex flex-col items-center">
          <Star className="h-12 w-12 text-accent mb-4 animate-spin-slow" />
          <p className="text-lg font-medium text-textMuted">Loading your adventure...</p>
        </div>
      </div>
    );
  }

  const completedFromLogs = tasks.filter((t) => t.log?.status === 'completed').length;
  const completedCount = Math.max(completedFromLogs, completedTaskIds.length);
  const progressPercent = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;

  const markTaskDone = (taskId: string) => {
    if (completedTaskIds.includes(taskId)) return;
    setCompletedTaskIds((prev) => [...prev, taskId]);
    setNotice('Awesome. Quest marked as done.');
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Child logout failed:', error);
      setNotice('Could not logout right now. Please retry.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fff7ed] via-[#fefce8] to-[#ecfeff] pb-20 relative overflow-x-hidden">
      <div className="absolute -top-16 -left-16 h-44 w-44 rounded-full bg-[#fdba74]/30 blur-3xl" />
      <div className="absolute top-40 -right-12 h-40 w-40 rounded-full bg-[#67e8f9]/25 blur-3xl" />

      <div className="max-w-xl mx-auto px-4 pt-6 relative z-10">
        <div className="rounded-3xl p-6 text-white shadow-xl bg-gradient-to-br from-primary via-[#06b6d4] to-secondary">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider font-bold opacity-90">Today is your quest day</p>
              <h1 className="text-3xl font-display font-extrabold leading-tight mt-1">
                Hi {profile?.name || 'Athmika'}.
              </h1>
              <p className="text-sm opacity-90 mt-2">You are building strong habits one tiny win at a time.</p>
            </div>
            <div className="h-14 w-14 rounded-2xl bg-white/25 border border-white/40 flex items-center justify-center">
              <Sparkles size={24} />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center gap-2">
              <button onClick={handleLogout} className="px-3 py-1.5 bg-white/20 border border-white/30 text-white text-xs font-semibold rounded-lg hover:bg-white/30 transition">
                Logout
              </button>
              <button onClick={toggleTheme} className="px-3 py-1.5 bg-white/20 border border-white/30 text-white text-xs font-semibold rounded-lg hover:bg-white/30 transition inline-flex items-center gap-1">
                {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
                Theme
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-6">
            <div className="kid-glass rounded-2xl p-3 text-center text-gray-800">
              <div className="flex items-center justify-center gap-1 text-amber-600">
                <Star className="fill-current" size={16} />
                <span className="font-bold">{profile?.total_stars}</span>
              </div>
              <p className="text-xs font-semibold uppercase">Stars</p>
            </div>
            <div className="kid-glass rounded-2xl p-3 text-center text-gray-800">
              <div className="flex items-center justify-center gap-1 text-orange-500">
                <Flame className="fill-current" size={16} />
                <span className="font-bold">{profile?.streak_count}</span>
              </div>
              <p className="text-xs font-semibold uppercase">Streak</p>
            </div>
            <div className="kid-glass rounded-2xl p-3 text-center text-gray-800">
              <div className="flex items-center justify-center gap-1 text-cyan-600">
                <Shield className="fill-current" size={16} />
                <span className="font-bold">{profile?.streak_shields}</span>
              </div>
              <p className="text-xs font-semibold uppercase">Shields</p>
            </div>
          </div>

          <div className="mt-5 bg-white/20 rounded-xl p-3 border border-white/30">
            <div className="flex justify-between text-xs font-bold uppercase tracking-wide">
              <span>Adventure Meter</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="mt-2 h-2.5 bg-white/40 rounded-full overflow-hidden">
              <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        </div>

        {notice && (
          <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 text-cyan-700 px-3 py-2 text-sm font-semibold">
            {notice}
          </div>
        )}

        <div className="rounded-2xl p-5 shadow-sm border mt-6" style={{ background: 'var(--surface)', borderColor: 'var(--border-main)' }}>
          <h2 className="text-lg font-display font-bold text-text flex items-center gap-2 mb-3">
            <Smile size={19} className="text-secondary" />
            How are you feeling right now?
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {moodOptions.map((option) => (
              <button
                key={option.label}
                className={clsx(
                  'rounded-xl border px-3 py-2 text-left transition-all',
                  mood === option.label
                    ? 'border-primary bg-cyan-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-cyan-200 hover:bg-cyan-50/50'
                )}
                onClick={() => setMood(option.label)}
              >
                <span className="block font-bold" style={{ color: 'var(--text-main)' }}>{option.icon}</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-7">
          <div className="flex items-center justify-between px-1 mb-3">
            <h2 className="text-xl font-display font-bold text-text">Today's Quests</h2>
            <span className="text-sm font-semibold px-3 py-1 rounded-full border" style={{ color: 'var(--text-muted)', background: 'var(--surface)', borderColor: 'var(--border-main)' }}>
              {tasks.length} left
            </span>
          </div>

          <div className="space-y-3">
            {tasks.map((t) => {
              const isAcademic = t.task.category === 'Academic';
              return (
                <div
                  key={t.task.id}
                  className={clsx(
                    'rounded-2xl p-4 border shadow-sm transition-all hover:shadow-md',
                    isAcademic ? 'bg-blue-50/60 border-blue-100' : 'bg-emerald-50/60 border-emerald-100'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={clsx('h-11 w-11 rounded-xl flex items-center justify-center border', isAcademic ? 'bg-white border-blue-100' : 'bg-white border-emerald-100')}>
                      {isAcademic ? <BookHeart size={20} className="text-primary" /> : <Star size={20} className="text-secondary" />}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-text">{t.task.title}</h3>
                      <div className="flex items-center gap-2 mt-2 text-xs">
                        <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-100 px-2 py-1 rounded-md font-semibold">
                          <Star size={12} className="fill-current" /> {t.task.star_value} stars
                        </span>
                        <span className={clsx('px-2 py-1 rounded-md font-semibold', t.task.energy_level === 'high' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700')}>
                          {t.task.energy_level === 'high' ? 'Focus quest' : 'Light quest'}
                        </span>
                      </div>
                    </div>

                    {t.task.requires_proof ? (
                      <button
                        onClick={() => setNotice('Proof upload flow is next. Camera integration pending.')}
                        className="h-10 w-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-textMuted hover:bg-primary hover:text-white hover:border-primary transition-colors focus:outline-none"
                      >
                        <Camera size={18} />
                      </button>
                    ) : (
                      <button
                        onClick={() => markTaskDone(t.task.id)}
                        className="px-3 py-2 rounded-xl bg-white border border-gray-200 text-sm font-semibold text-text hover:bg-secondary hover:text-white hover:border-secondary transition-colors focus:outline-none"
                      >
                        Quest done
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
