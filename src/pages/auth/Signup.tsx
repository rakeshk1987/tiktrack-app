import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import {
  ArrowRight,
  HeartHandshake,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  Star,
  User
} from 'lucide-react';
import { auth, db, isUsingFirebaseEmulators } from '../../config/firebase';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const helperCopy = useMemo(
    () => ({
      badge: 'Parent setup',
      title: 'Create your family workspace',
      subtitle:
        'Set up the secure parent account that manages children, routines, rewards, and approvals.',
      environment: isUsingFirebaseEmulators ? 'Local emulator mode' : 'Live Firebase mode'
    }),
    []
  );

  const formatSignupError = (code?: string) => {
    switch (code) {
      case 'auth/email-already-in-use':
        return 'That parent email is already registered. Try signing in instead.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/weak-password':
        return 'Choose a stronger password with at least 6 characters.';
      case 'auth/network-request-failed':
      case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
        return isUsingFirebaseEmulators
          ? 'Local Firebase emulators are not reachable. Start them with `npm run emulators` before creating accounts.'
          : 'Network error while contacting Firebase. Please try again.';
      case 'auth/invalid-api-key':
        return 'Firebase configuration looks incomplete. Please check the local setup.';
      default:
        return isUsingFirebaseEmulators
          ? 'Failed to create the parent account. If you are on localhost, make sure `npm run emulators` is running.'
          : 'Failed to create the parent account. Please try again.';
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      await setDoc(doc(db, 'users', user.uid), {
        id: user.uid,
        email: user.email,
        name: name.trim(),
        role: 'parent_admin',
        created_at: new Date().toISOString()
      });

      setSuccess(true);
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (err: any) {
      setError(formatSignupError(err?.code));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 opacity-90">
        <div className="absolute left-[-6rem] top-[-4rem] h-56 w-56 rounded-full bg-cyan-300/30 blur-3xl" />
        <div className="absolute right-[-5rem] top-16 h-72 w-72 rounded-full bg-violet-300/35 blur-3xl" />
        <div className="absolute bottom-[-4rem] left-1/3 h-64 w-64 rounded-full bg-amber-200/40 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-7xl items-center">
        <div className="grid w-full overflow-hidden rounded-[2rem] border border-white/55 bg-white/70 shadow-[0_30px_80px_rgba(64,43,123,0.18)] backdrop-blur-xl lg:grid-cols-[1.02fr_0.98fr]">
          <section className="relative flex min-h-[360px] flex-col justify-between overflow-hidden bg-[linear-gradient(145deg,#f4f7ff_0%,#eef4ff_40%,#fdf2ff_100%)] p-7 sm:p-10">
            <div className="max-w-xl">
              <span className="inline-flex rounded-full border border-white/70 bg-white/65 px-4 py-1 text-xs font-extrabold uppercase tracking-[0.24em] text-slate-600">
                {helperCopy.badge}
              </span>
              <h1 className="mt-5 font-display text-4xl font-extrabold leading-tight text-slate-900 sm:text-5xl">
                {helperCopy.title}
              </h1>
              <p className="mt-4 max-w-lg text-base leading-7 text-slate-600 sm:text-lg">
                {helperCopy.subtitle}
              </p>
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="relative min-h-[320px] overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/85 p-6 shadow-[0_18px_50px_rgba(99,102,241,0.12)]">
                <div className="absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,transparent_0%,rgba(59,130,246,0.08)_100%)]" />
                <div className="absolute left-6 top-8 grid h-12 w-12 place-items-center rounded-2xl bg-cyan-100 text-cyan-600 shadow-sm">
                  <ShieldCheck size={22} />
                </div>
                <div className="absolute right-7 top-12 grid h-10 w-10 place-items-center rounded-full bg-amber-100 text-amber-500 shadow-sm animate-float">
                  <Sparkles size={18} />
                </div>
                <div className="absolute bottom-20 right-8 grid h-11 w-11 place-items-center rounded-2xl bg-fuchsia-100 text-fuchsia-500 shadow-sm">
                  <HeartHandshake size={18} />
                </div>

                <div className="mx-auto mt-10 flex h-52 w-52 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_30%,#ffffff_0%,#dbeafe_30%,#c4b5fd_68%,#fde68a_100%)] shadow-[0_25px_60px_rgba(59,130,246,0.2)]">
                  <div className="relative flex h-44 w-44 items-center justify-center rounded-full bg-[linear-gradient(160deg,#0f172a_0%,#2563eb_55%,#8b5cf6_100%)] text-white">
                    <div className="absolute -left-4 top-8 grid h-9 w-9 place-items-center rounded-full bg-white/80 text-cyan-600">
                      <ShieldCheck size={16} />
                    </div>
                    <div className="absolute -right-3 bottom-10 grid h-10 w-10 place-items-center rounded-full bg-white/75 text-amber-500">
                      <Star size={16} />
                    </div>
                    <div className="text-center">
                      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/18">
                        <HeartHandshake size={28} />
                      </div>
                      <p className="mt-4 text-sm font-bold tracking-[0.2em] text-white/75">
                        PLAN • GUIDE • GROW
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-cyan-50 px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-600">Environment</p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">{helperCopy.environment}</p>
                  </div>
                  <div className="rounded-2xl bg-amber-50 px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-600">Control</p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">Parent account creates the full family hub</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-end gap-4">
                <div className="rounded-[1.75rem] bg-slate-950/92 p-5 text-white shadow-[0_18px_50px_rgba(15,23,42,0.28)]">
                  <p className="text-sm font-bold uppercase tracking-[0.22em] text-white/55">What happens next</p>
                  <p className="mt-3 text-lg font-semibold leading-7">
                    Create the parent account, then add child profiles and invite co-parents from the dashboard.
                  </p>
                </div>
                <div className="rounded-[1.75rem] border border-white/60 bg-white/80 p-5">
                  <p className="text-sm font-bold uppercase tracking-[0.22em] text-slate-500">Setup notes</p>
                  <div className="mt-3 space-y-3 text-sm text-slate-600">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-2xl bg-emerald-100 text-emerald-500">
                        <ShieldCheck size={16} />
                      </span>
                      <span>One secure parent login controls children, rewards, and approvals.</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-2xl bg-violet-100 text-violet-500">
                        <HeartHandshake size={16} />
                      </span>
                      <span>Child accounts are still kept lightweight and created after signup.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="relative bg-[linear-gradient(180deg,rgba(17,24,39,0.98)_0%,rgba(30,41,59,0.96)_48%,rgba(37,99,235,0.94)_100%)] p-5 sm:p-8 lg:p-10">
            <div className="mx-auto flex h-full max-w-md flex-col justify-center">
              <div className="rounded-[2rem] border border-white/12 bg-white/8 p-6 shadow-[0_20px_70px_rgba(0,0,0,0.22)] backdrop-blur-xl sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.28em] text-white/45">TikTrack</p>
                    <h2 className="mt-3 text-3xl font-display font-extrabold text-white">Create Parent Account</h2>
                    <p className="mt-2 text-sm leading-6 text-white/68">
                      Set up the family workspace owner with secure parent credentials.
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">
                    Parent only
                  </div>
                </div>

                {error && (
                  <div className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-400/12 px-4 py-3 text-sm font-medium text-rose-100">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-400/12 px-4 py-3 text-sm font-medium text-emerald-100">
                    Workspace created successfully. Redirecting to your family hub...
                  </div>
                )}

                <form onSubmit={handleSignup} className="mt-5 space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-white/80">Parent name</span>
                    <div className="flex items-center rounded-[1.25rem] border border-white/12 bg-white/10 px-4 py-3 text-white focus-within:border-cyan-300/60 focus-within:bg-white/12">
                      <User size={18} className="mr-3 text-white/45" />
                      <input
                        type="text"
                        placeholder="Rakesh Krishna"
                        className="w-full bg-transparent text-sm outline-none placeholder:text-white/38"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                      />
                    </div>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-white/80">Parent email</span>
                    <div className="flex items-center rounded-[1.25rem] border border-white/12 bg-white/10 px-4 py-3 text-white focus-within:border-fuchsia-300/60 focus-within:bg-white/12">
                      <Mail size={18} className="mr-3 text-white/45" />
                      <input
                        type="email"
                        placeholder="parent@email.com"
                        className="w-full bg-transparent text-sm outline-none placeholder:text-white/38"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-white/80">Secure password</span>
                    <div className="flex items-center rounded-[1.25rem] border border-white/12 bg-white/10 px-4 py-3 text-white focus-within:border-amber-300/60 focus-within:bg-white/12">
                      <Lock size={18} className="mr-3 text-white/45" />
                      <input
                        type="password"
                        placeholder="Choose a secure password"
                        className="w-full bg-transparent text-sm outline-none placeholder:text-white/38"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                  </label>

                  <button
                    type="submit"
                    disabled={loading || success}
                    className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-[1.2rem] bg-[linear-gradient(135deg,#22c55e,#3b82f6,#8b5cf6)] px-4 py-3.5 text-base font-extrabold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {loading ? 'Creating workspace...' : 'Create Family Workspace'}
                    {!loading && !success && <ArrowRight size={18} />}
                  </button>
                </form>

                <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/6 p-4">
                  <p className="text-sm font-bold text-white">After signup</p>
                  <div className="mt-3 space-y-3 text-sm text-white/62">
                    <div className="rounded-[1.1rem] border border-white/10 bg-white/8 px-4 py-3">
                      1. Add child accounts from the parent dashboard.
                    </div>
                    <div className="rounded-[1.1rem] border border-white/10 bg-white/8 px-4 py-3">
                      2. Share routines, rewards, and approvals from one place.
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <Link
                    to="/login"
                    className="rounded-[1.25rem] border border-white/12 bg-white px-4 py-3 text-center text-sm font-bold text-slate-900 transition hover:bg-cyan-50"
                  >
                    Back to login
                  </Link>
                  <div className="rounded-[1.25rem] border border-white/12 bg-white/10 px-4 py-3 text-center text-sm font-bold text-white/75">
                    Child setup comes next
                  </div>
                </div>

                <p className="mt-5 text-center text-xs leading-6 text-white/52">
                  Already registered?{' '}
                  <Link to="/login" className="font-bold text-amber-200 hover:text-white">
                    Sign in instead
                  </Link>
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
