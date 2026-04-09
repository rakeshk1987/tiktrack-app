import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../config/firebase';
import {
  ArrowRight,
  Heart,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  Star,
  UserRound
} from 'lucide-react';

type LoginRole = 'child' | 'parent';

interface QuickAccessChild {
  username: string;
  label: string;
}

const QUICK_ACCESS_STORAGE_KEY = 'tiktrack.quickAccessChildren';

function readQuickAccessChildren(): QuickAccessChild[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(QUICK_ACCESS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as QuickAccessChild[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (entry) =>
        typeof entry?.username === 'string' &&
        entry.username.length > 0 &&
        typeof entry?.label === 'string' &&
        entry.label.length > 0
    );
  } catch {
    return [];
  }
}

function saveQuickAccessChild(username: string) {
  if (typeof window === 'undefined') {
    return;
  }

  const clean = username.trim().toLowerCase();
  if (!clean) {
    return;
  }

  const nextItem: QuickAccessChild = {
    username: clean,
    label: clean
      .split(/[._-]/g)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  };

  const existing = readQuickAccessChildren().filter((entry) => entry.username !== clean);
  const next = [nextItem, ...existing].slice(0, 2);
  window.localStorage.setItem(QUICK_ACCESS_STORAGE_KEY, JSON.stringify(next));
}

export default function Login() {
  const [role, setRole] = useState<LoginRole>('child');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [quickAccessChildren, setQuickAccessChildren] = useState<QuickAccessChild[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    setQuickAccessChildren(readQuickAccessChildren());
  }, []);

  const formatAuthError = (code?: string) => {
    switch (code) {
      case 'auth/invalid-email':
        return role === 'parent'
          ? 'Please enter a valid parent email address.'
          : 'Please enter a valid child username or email.';
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return role === 'parent'
          ? 'Parent login details did not match. Please try again.'
          : 'Child login details did not match. Please try again.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please wait a few minutes and try again.';
      default:
        return 'Login failed. Please try again.';
    }
  };

  const heroCopy = useMemo(
    () =>
      role === 'child'
        ? {
            badge: 'For growing explorers',
            title: 'Welcome to TikTrack',
            subtitle:
              'Big buttons, quick access, and a calm space for kids to jump back into their routine.',
            highlight: 'Quick child access'
          }
        : {
            badge: 'For family organizers',
            title: 'Welcome to TikTrack',
            subtitle:
              'Secure sign-in with a clean control-center feel, built for parents managing the family hub.',
            highlight: 'Secure parent access'
          },
    [role]
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const normalized = identifier.trim().toLowerCase();
      const formattedEmail =
        role === 'parent'
          ? normalized
          : normalized.includes('@')
            ? normalized
            : `${normalized}@tiktrack.family`;

      await signInWithEmailAndPassword(auth, formattedEmail, password);

      if (role === 'child' && !normalized.includes('@')) {
        saveQuickAccessChild(normalized);
        setQuickAccessChildren(readQuickAccessChildren());
      }

      navigate('/');
    } catch (err: any) {
      setError(formatAuthError(err?.code));
    } finally {
      setLoading(false);
    }
  };

  const fillQuickAccess = (username: string) => {
    setRole('child');
    setIdentifier(username);
    setError('');
  };

  return (
    <div className="min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 opacity-90">
        <div className="absolute left-[-6rem] top-[-4rem] h-56 w-56 rounded-full bg-fuchsia-300/40 blur-3xl" />
        <div className="absolute right-[-5rem] top-16 h-72 w-72 rounded-full bg-cyan-300/35 blur-3xl" />
        <div className="absolute bottom-[-4rem] left-1/3 h-64 w-64 rounded-full bg-amber-200/40 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-7xl items-center">
        <div className="grid w-full overflow-hidden rounded-[2rem] border border-white/55 bg-white/70 shadow-[0_30px_80px_rgba(64,43,123,0.18)] backdrop-blur-xl lg:grid-cols-[1.08fr_0.92fr]">
          <section className="relative flex min-h-[360px] flex-col justify-between overflow-hidden bg-[linear-gradient(145deg,#fdf2ff_0%,#eef4ff_45%,#fff5d8_100%)] p-7 sm:p-10">
            <div className="max-w-xl">
              <span className="inline-flex rounded-full border border-white/70 bg-white/65 px-4 py-1 text-xs font-extrabold uppercase tracking-[0.24em] text-slate-600">
                {heroCopy.badge}
              </span>
              <h1 className="mt-5 font-display text-4xl font-extrabold leading-tight text-slate-900 sm:text-5xl">
                {heroCopy.title}
              </h1>
              <p className="mt-4 max-w-lg text-base leading-7 text-slate-600 sm:text-lg">
                {heroCopy.subtitle}
              </p>
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="relative min-h-[320px] overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/85 p-6 shadow-[0_18px_50px_rgba(99,102,241,0.12)]">
                <div className="absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,transparent_0%,rgba(236,72,153,0.08)_100%)]" />
                <div className="absolute left-6 top-8 grid h-12 w-12 place-items-center rounded-2xl bg-fuchsia-100 text-fuchsia-500 shadow-sm">
                  <Heart size={22} />
                </div>
                <div className="absolute right-7 top-12 grid h-10 w-10 place-items-center rounded-full bg-amber-100 text-amber-500 shadow-sm animate-float">
                  <Sparkles size={18} />
                </div>
                <div className="absolute bottom-20 right-8 grid h-11 w-11 place-items-center rounded-2xl bg-cyan-100 text-cyan-500 shadow-sm">
                  <Star size={18} />
                </div>

                <div className="mx-auto mt-10 flex h-52 w-52 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_30%,#ffffff_0%,#f5d0fe_32%,#c7d2fe_70%,#fde68a_100%)] shadow-[0_25px_60px_rgba(99,102,241,0.2)]">
                  <div className="relative flex h-44 w-44 items-center justify-center rounded-full bg-[linear-gradient(160deg,#1d2340_0%,#6d42ff_60%,#3a9dff_100%)] text-white">
                    <div className="absolute -left-4 top-8 grid h-9 w-9 place-items-center rounded-full bg-white/80 text-pink-500">
                      <Heart size={16} />
                    </div>
                    <div className="absolute -right-3 bottom-10 grid h-10 w-10 place-items-center rounded-full bg-white/75 text-amber-500">
                      <Star size={16} />
                    </div>
                    <div className="text-center">
                      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/18">
                        <UserRound size={28} />
                      </div>
                      <p className="mt-4 text-sm font-bold tracking-[0.2em] text-white/75">
                        LEARN • PLAY • GROW
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-fuchsia-50 px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-fuchsia-500">Mood</p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">Soft, playful, welcoming</p>
                  </div>
                  <div className="rounded-2xl bg-cyan-50 px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-500">{heroCopy.highlight}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">Designed to feel safe on any screen</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-end gap-4">
                <div className="rounded-[1.75rem] bg-slate-950/92 p-5 text-white shadow-[0_18px_50px_rgba(15,23,42,0.28)]">
                  <p className="text-sm font-bold uppercase tracking-[0.22em] text-white/55">TikTrack promise</p>
                  <p className="mt-3 text-lg font-semibold leading-7">
                    One place for secure parent control and joyful child routines.
                  </p>
                </div>
                <div className="rounded-[1.75rem] border border-white/60 bg-white/80 p-5">
                  <p className="text-sm font-bold uppercase tracking-[0.22em] text-slate-500">Why this screen works</p>
                  <div className="mt-3 space-y-3 text-sm text-slate-600">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-2xl bg-amber-100 text-amber-500">
                        <ShieldCheck size={16} />
                      </span>
                      <span>Parent mode stays focused and minimal.</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-2xl bg-emerald-100 text-emerald-500">
                        <Sparkles size={16} />
                      </span>
                      <span>Child mode keeps actions larger and less intimidating.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="relative bg-[linear-gradient(180deg,rgba(23,28,51,0.98)_0%,rgba(34,41,71,0.96)_48%,rgba(77,38,146,0.94)_100%)] p-5 sm:p-8 lg:p-10">
            <div className="mx-auto flex h-full max-w-md flex-col justify-center">
              <div className="rounded-[2rem] border border-white/12 bg-white/8 p-6 shadow-[0_20px_70px_rgba(0,0,0,0.22)] backdrop-blur-xl sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.28em] text-white/45">TikTrack</p>
                    <h2 className="mt-3 text-3xl font-display font-extrabold text-white">Welcome Back</h2>
                    <p className="mt-2 text-sm leading-6 text-white/68">
                      {role === 'child'
                        ? 'Pick child mode for a softer, simpler sign-in flow.'
                        : 'Use parent mode for secure family management access.'}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.2em] text-amber-300">
                    {role}
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-white/8 p-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setRole('child');
                      setError('');
                    }}
                    className={`rounded-[1rem] px-4 py-3 text-sm font-bold transition ${
                      role === 'child'
                        ? 'bg-[linear-gradient(135deg,#f472b6,#8b5cf6)] text-white shadow-lg'
                        : 'text-white/70 hover:bg-white/6'
                    }`}
                  >
                    Child login
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRole('parent');
                      setError('');
                    }}
                    className={`rounded-[1rem] px-4 py-3 text-sm font-bold transition ${
                      role === 'parent'
                        ? 'bg-[linear-gradient(135deg,#22c55e,#3b82f6)] text-white shadow-lg'
                        : 'text-white/70 hover:bg-white/6'
                    }`}
                  >
                    Parent login
                  </button>
                </div>

                {error && (
                  <div className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-400/12 px-4 py-3 text-sm font-medium text-rose-100">
                    {error}
                  </div>
                )}

                <form onSubmit={handleLogin} className="mt-5 space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-white/80">
                      {role === 'parent' ? 'Parent email' : 'Child username or email'}
                    </span>
                    <div className="flex items-center rounded-[1.25rem] border border-white/12 bg-white/10 px-4 py-3 text-white focus-within:border-fuchsia-300/60 focus-within:bg-white/12">
                      <Mail size={18} className="mr-3 text-white/45" />
                      <input
                        type={role === 'parent' ? 'email' : 'text'}
                        placeholder={
                          role === 'parent' ? 'parent@email.com' : 'athmika or child@email.com'
                        }
                        className="w-full bg-transparent text-sm outline-none placeholder:text-white/38"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        required
                      />
                    </div>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-white/80">
                      {role === 'parent' ? 'Secure password' : 'Password'}
                    </span>
                    <div className="flex items-center rounded-[1.25rem] border border-white/12 bg-white/10 px-4 py-3 text-white focus-within:border-cyan-300/60 focus-within:bg-white/12">
                      <Lock size={18} className="mr-3 text-white/45" />
                      <input
                        type="password"
                        placeholder={role === 'parent' ? 'Enter secure password' : 'Enter password'}
                        className="w-full bg-transparent text-sm outline-none placeholder:text-white/38"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                  </label>

                  <button
                    type="submit"
                    disabled={loading}
                    className={`mt-2 inline-flex w-full items-center justify-center gap-2 rounded-[1.2rem] px-4 py-3.5 text-base font-extrabold text-white transition disabled:cursor-not-allowed disabled:opacity-70 ${
                      role === 'child'
                        ? 'bg-[linear-gradient(135deg,#ec4899,#8b5cf6,#3b82f6)] hover:brightness-105'
                        : 'bg-[linear-gradient(135deg,#0f172a,#334155,#2563eb)] hover:brightness-110'
                    }`}
                  >
                    {loading ? 'Signing in...' : role === 'child' ? 'Start Child Session' : 'Open Parent Dashboard'}
                    {!loading && <ArrowRight size={18} />}
                  </button>
                </form>

                <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/6 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-white">Quick Access</p>
                      <p className="mt-1 text-xs leading-5 text-white/55">
                        Child shortcuts appear here after a successful child login on this device.
                      </p>
                    </div>
                    <div className="rounded-full bg-amber-300/20 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-200">
                      Same machine
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3">
                    {quickAccessChildren.length > 0 ? (
                      quickAccessChildren.map((child) => (
                        <button
                          key={child.username}
                          type="button"
                          onClick={() => fillQuickAccess(child.username)}
                          className="flex items-center justify-between rounded-[1.25rem] border border-white/10 bg-white/9 px-4 py-4 text-left transition hover:bg-white/14"
                        >
                          <div className="flex items-center gap-3">
                            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[linear-gradient(135deg,#fde68a,#f472b6)] text-slate-900 shadow-md">
                              <UserRound size={20} />
                            </span>
                            <div>
                              <p className="text-base font-bold text-white">{child.label}</p>
                              <p className="text-xs text-white/55">@{child.username}</p>
                            </div>
                          </div>
                          <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/45">
                            use
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="rounded-[1.25rem] border border-dashed border-white/12 bg-white/5 px-4 py-5 text-sm text-white/55">
                        No quick child profiles yet. Sign in once as a child and the shortcut will appear here.
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <Link
                    to="/signup"
                    className="rounded-[1.25rem] border border-white/12 bg-white px-4 py-3 text-center text-sm font-bold text-slate-900 transition hover:bg-amber-50"
                  >
                    + Add Child
                  </Link>
                  <Link
                    to="/signup"
                    className="rounded-[1.25rem] border border-white/12 bg-white/10 px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-white/14"
                  >
                    + Invite Parent
                  </Link>
                </div>

                <p className="mt-5 text-center text-xs leading-6 text-white/52">
                  Parent registration stays available through{' '}
                  <Link to="/signup" className="font-bold text-amber-200 hover:text-white">
                    family setup
                  </Link>
                  . Child accounts are still created from the parent dashboard.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
