import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import {
  Activity,
  BarChart3,
  CheckSquare,
  Circle,
  Home,
  LogOut,
  Mail,
  Menu,
  MessageCircle,
  Moon,
  Phone,
  Plus,
  Settings,
  ShieldCheck,
  Sun,
  TrendingUp,
  Users2,
  X
} from 'lucide-react';
import { getSecondaryAuth } from '../../utils/secondaryAuth';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, doc, limit, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { activeFirebaseEnv, auth, db, isUsingFirebaseEmulators } from '../../config/firebase';

interface ChildAccount {
  id: string;
  name?: string;
  email?: string;
}

interface PendingProof {
  id: string;
  child_id?: string;
  task_id?: string;
  task_title?: string;
  image_url?: string;
  approval_status?: 'pending' | 'approved' | 'rejected';
  timestamp?: string;
}

export default function ParentDashboard() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [isModaling, setIsModaling] = useState(false);
  const [cUser, setCUser] = useState('');
  const [cName, setCName] = useState('');
  const [cPass, setCPass] = useState('');
  const [cDob, setCDob] = useState('');
  const [cHeight, setCHeight] = useState('');
  const [cWeight, setCWeight] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [info, setInfo] = useState('');
  const [children, setChildren] = useState<ChildAccount[]>([]);
  const [childrenLoading, setChildrenLoading] = useState(true);
  const [pendingProofs, setPendingProofs] = useState<PendingProof[]>([]);

  useEffect(() => {
    if (!user) {
      setChildren([]);
      setChildrenLoading(false);
      return;
    }

    const childQuery = query(
      collection(db, 'users'),
      where('parent_id', '==', user.id),
      where('role', '==', 'child_user')
    );

    const unsubscribe = onSnapshot(
      childQuery,
      (snapshot) => {
        const mapped = snapshot.docs.map((d) => {
          const data = d.data() as { name?: string; email?: string };
          return { id: d.id, name: data.name, email: data.email };
        });
        setChildren(mapped);
        setChildrenLoading(false);
      },
      (err) => {
        console.error('Failed to fetch child accounts:', err);
        setChildrenLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setPendingProofs([]);
      return;
    }

    const proofQuery = query(
      collection(db, 'proof_logs'),
      where('approval_status', '==', 'pending'),
      limit(20)
    );

    const unsubscribe = onSnapshot(
      proofQuery,
      (snapshot) => {
        const mapped = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PendingProof, 'id'>) }));
        setPendingProofs(mapped);
      },
      (err) => {
        console.error('Failed to fetch pending proofs:', err);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const formatChildCreationError = (code?: string) => {
    switch (code) {
      case 'auth/email-already-in-use':
        return 'That username already exists. Use the same password to link it, or choose another username.';
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
        return 'This username already exists, but the password does not match.';
      case 'auth/weak-password':
        return 'Password must be at least 6 characters.';
      default:
        return 'Failed to create child account. Please try again.';
    }
  };

  const handleCreateChild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const secAuth = getSecondaryAuth();
      const dummyEmail = `${cUser.trim().toLowerCase()}@tiktrack.family`;
      let childUid = '';

      try {
        const creds = await createUserWithEmailAndPassword(secAuth, dummyEmail, cPass);
        childUid = creds.user.uid;
      } catch (createErr: any) {
        if (createErr?.code === 'auth/email-already-in-use') {
          const creds = await signInWithEmailAndPassword(secAuth, dummyEmail, cPass);
          childUid = creds.user.uid;
        } else {
          throw createErr;
        }
      }

      await setDoc(doc(db, 'users', childUid), {
        id: childUid,
        email: dummyEmail,
        name: cName,
        role: 'child_user',
        parent_id: user.id
      }, { merge: true });

      await setDoc(doc(db, 'child_profile', childUid), {
        id: childUid,
        user_id: user.id,
        name: cName,
        date_of_birth: new Date(cDob).toISOString(),
        height_cm: Number(cHeight),
        weight_kg: Number(cWeight),
        streak_count: 0,
        streak_shields: 0,
        consistency_score: 0,
        total_stars: 0,
        is_sick_mode: false
      }, { merge: true });

      await signOut(secAuth);

      setIsModaling(false);
      setCUser('');
      setCName('');
      setCPass('');
      setCDob('');
      setCHeight('');
      setCWeight('');
      setSuccess('Child account is ready and linked to your Family Hub.');
    } catch (err: any) {
      setError(formatChildCreationError(err?.code));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Parent logout failed:', err);
      setError('Logout failed. Please try again.');
    }
  };

  const handleProofDecision = async (proofId: string, status: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'proof_logs', proofId), { approval_status: status });
      if (status === 'approved') {
        setSuccess('Proof approved and removed from the pending queue.');
      } else {
        setInfo('Proof rejected and removed from the pending queue.');
      }
    } catch (err) {
      console.error('Failed to update proof status:', err);
      setError('Could not update proof approval. Please try again.');
    }
  };

  const cardBase = 'rounded-3xl border p-5 shadow-[var(--card-shadow)]';
  const hasChildren = children.length > 0;
  const tasksCompleted = hasChildren ? 0 : 0;
  const consistencyPercent = hasChildren ? 0 : 0;
  const visiblePendingProofs = pendingProofs.filter((proof) => children.some((child) => child.id === proof.child_id));
  const featuredProof = visiblePendingProofs[0];

  return (
    <div className="min-h-screen px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-7xl rounded-[2rem] border bg-[var(--surface)]/95 backdrop-blur-md p-3 sm:p-4" style={{ borderColor: 'var(--border-main)' }}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[92px_1fr]">
          <aside
            className="rounded-[1.6rem] p-4 text-white"
            style={{ background: 'linear-gradient(165deg, var(--bg-hero-a), var(--bg-hero-b))' }}
          >
            <div className="flex lg:flex-col items-center justify-between gap-3 h-full">
              <div className="flex lg:flex-col items-center gap-3">
                <button className="h-11 w-11 rounded-xl bg-white/18 grid place-items-center hover:bg-white/28 transition" onClick={() => setInfo('Menu sections will be connected to routes next.')}> 
                  <Menu size={20} />
                </button>
                <button className="h-11 w-11 rounded-xl bg-white/25 grid place-items-center">
                  <Home size={20} />
                </button>
                <button className="h-11 w-11 rounded-xl bg-white/18 grid place-items-center hover:bg-white/28 transition" onClick={() => setInfo('Inbox module is pending implementation.')}>
                  <Mail size={18} />
                </button>
                <button className="h-11 w-11 rounded-xl bg-white/18 grid place-items-center hover:bg-white/28 transition" onClick={() => setInfo('Quick call reminders will be added in reminders phase.')}>
                  <Phone size={18} />
                </button>
              </div>

              <div className="flex lg:flex-col items-center gap-3">
                <button className="h-11 w-11 rounded-xl bg-white/18 grid place-items-center hover:bg-white/28 transition" onClick={() => setInfo('Chat assistant will be added in automation phase.')}>
                  <MessageCircle size={18} />
                </button>
                <button className="h-11 w-11 rounded-xl bg-white/18 grid place-items-center hover:bg-white/28 transition" onClick={() => setInfo('Settings panel is planned for next phase.')}> 
                  <Settings size={18} />
                </button>
                <button className="h-11 w-11 rounded-xl bg-white/18 grid place-items-center hover:bg-white/28 transition" onClick={toggleTheme} aria-label="toggle-theme">
                  {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                </button>
                <button className="h-11 w-11 rounded-xl bg-rose-500/40 grid place-items-center hover:bg-rose-500/60 transition" onClick={handleLogout}>
                  <LogOut size={18} />
                </button>
              </div>
            </div>
          </aside>

          <main className="rounded-[1.5rem] p-3 sm:p-4 bg-[var(--surface-soft)]" style={{ border: '1px solid var(--border-main)' }}>
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div>
                <h1 className="text-2xl font-display font-extrabold" style={{ color: 'var(--text-main)' }}>
                  Parent Control Panel
                </h1>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Welcome, {user?.email || 'Parent'}
                </p>
                <p className="text-xs font-bold mt-1 inline-flex px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  {isUsingFirebaseEmulators ? 'LOCAL EMULATOR' : `${activeFirebaseEnv.toUpperCase()} DB`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setIsModaling(true)} className="px-3 py-2 rounded-xl text-sm font-bold text-white inline-flex items-center gap-1" style={{ background: 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' }}>
                  <Plus size={16} /> Add Child
                </button>
                <button onClick={toggleTheme} className="px-3 py-2 rounded-xl text-sm font-semibold border" style={{ color: 'var(--text-main)', borderColor: 'var(--border-main)', background: 'var(--surface)' }}>
                  {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
                </button>
              </div>
            </div>

            {(error || success || info) && (
              <div className="space-y-2 mb-4">
                {error && <div className="rounded-xl px-3 py-2 text-sm font-semibold bg-red-100 text-red-700">{error}</div>}
                {success && <div className="rounded-xl px-3 py-2 text-sm font-semibold bg-emerald-100 text-emerald-700">{success}</div>}
                {info && <div className="rounded-xl px-3 py-2 text-sm font-semibold bg-cyan-100 text-cyan-700">{info}</div>}
              </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
              <section className="xl:col-span-7 space-y-4">
                <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                  <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-main)' }}>Weekly Trend</h2>
                  <div className="h-44 rounded-2xl p-4 bg-[var(--surface-soft)] border" style={{ borderColor: 'var(--border-main)' }}>
                    <div className="h-full w-full relative">
                      <div className="absolute inset-0 grid grid-rows-6 opacity-50">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div key={i} className="border-t" style={{ borderColor: 'var(--border-main)' }} />
                        ))}
                      </div>
                      <svg viewBox="0 0 320 120" className="absolute inset-0 w-full h-full">
                        <path d="M10 90 C 40 40, 70 100, 110 50 S 180 40, 220 75 S 280 40, 310 60" stroke="#8b5cf6" strokeWidth="3" fill="none" />
                        <path d="M10 100 C 50 60, 90 80, 120 60 S 180 90, 220 65 S 280 85, 310 75" stroke="#f59e0b" strokeWidth="3" fill="none" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>Consistency</p>
                      <Activity size={18} className="text-cyan-500" />
                    </div>
                    <p className="text-3xl font-black mt-2" style={{ color: 'var(--text-main)' }}>{consistencyPercent}%</p>
                    <div className="mt-3 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${consistencyPercent}%` }} />
                    </div>
                    <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                      {hasChildren ? 'Live child consistency will appear here as activity starts.' : 'Add a child account to begin tracking consistency.'}
                    </p>
                  </div>
                  <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>Tasks Completed</p>
                      <CheckSquare size={18} className="text-emerald-500" />
                    </div>
                    <p className="text-3xl font-black mt-2" style={{ color: 'var(--text-main)' }}>{tasksCompleted}</p>
                    <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                      {hasChildren ? 'Task completion totals will update from real logs.' : 'No child activity yet.'}
                    </p>
                  </div>
                </div>

                <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>Pending Proof Approval</h2>
                    <span className="px-2 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                      {visiblePendingProofs.length > 0 ? `${visiblePendingProofs.length} waiting` : 'none'}
                    </span>
                  </div>
                  {featuredProof ? (
                    <div className="rounded-2xl p-3 border flex items-center gap-3" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                      {featuredProof.image_url ? (
                        <img src={featuredProof.image_url} alt="Child proof" className="h-16 w-16 rounded-xl object-cover" />
                      ) : (
                        <div className="h-12 w-12 rounded-xl bg-slate-300 grid place-items-center text-xs text-slate-600">Image</div>
                      )}
                      <div className="flex-1">
                        <p className="font-bold" style={{ color: 'var(--text-main)' }}>{featuredProof.task_title || 'Quest proof'}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {children.find((child) => child.id === featuredProof.child_id)?.name || 'Child'} submitted this for review
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-emerald-100 text-emerald-700" onClick={() => void handleProofDecision(featuredProof.id, 'approved')}>
                          Approve
                        </button>
                        <button className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-rose-100 text-rose-700" onClick={() => void handleProofDecision(featuredProof.id, 'rejected')}>
                          Reject
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl p-4 border text-sm" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-muted)' }}>
                      No proof submissions yet. Add a child account first, then submitted task proofs will show up here.
                    </div>
                  )}
                </div>
              </section>

              <section className="xl:col-span-5 space-y-4">
                <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                  <h2 className="text-lg font-bold mb-3 inline-flex items-center gap-2" style={{ color: 'var(--text-main)' }}>
                    <Users2 size={18} /> Child Accounts
                  </h2>
                  {childrenLoading ? (
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading child accounts...</p>
                  ) : children.length === 0 ? (
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No child accounts yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {children.map((child) => (
                        <div key={child.id} className="rounded-xl border p-3 flex items-center justify-between" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                          <div>
                            <p className="font-semibold" style={{ color: 'var(--text-main)' }}>{child.name || 'Child'}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{(child.email || '').replace('@tiktrack.family', '')}</p>
                          </div>
                          <Circle size={14} className="text-emerald-500 fill-current" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                  <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-main)' }}>Quick Metrics</h2>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl p-3 text-center" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}>
                      <BarChart3 className="mx-auto text-white" size={16} />
                      <p className="text-white text-xs mt-1">Profiles</p>
                      <p className="text-white font-extrabold">{children.length}</p>
                    </div>
                    <div className="rounded-xl p-3 text-center" style={{ background: 'linear-gradient(135deg, #06b6d4, #14b8a6)' }}>
                      <TrendingUp className="mx-auto text-white" size={16} />
                      <p className="text-white text-xs mt-1">Status</p>
                      <p className="text-white font-extrabold">{hasChildren ? 'Live' : 'Empty'}</p>
                    </div>
                    <div className="rounded-xl p-3 text-center" style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)' }}>
                      <ShieldCheck className="mx-auto text-white" size={16} />
                      <p className="text-white text-xs mt-1">Proofs</p>
                      <p className="text-white font-extrabold">0</p>
                    </div>
                  </div>
                </div>

                <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                  <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text-main)' }}>Family Hub Actions</h2>
                  <div className="space-y-2">
                    <button onClick={() => setIsModaling(true)} className="w-full py-2 rounded-xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' }}>
                      + Add Child Account
                    </button>
                    <button onClick={() => setInfo('Co-parent invite flow is in pending implementation list.')} className="w-full py-2 rounded-xl text-sm font-bold border" style={{ borderColor: 'var(--border-main)', color: 'var(--text-main)', background: 'var(--surface-soft)' }}>
                      + Invite Co-Parent
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>

      {isModaling && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="rounded-3xl w-full max-w-md p-6 shadow-2xl relative border bg-[var(--surface)]" style={{ borderColor: 'var(--border-main)' }}>
            <button onClick={() => setIsModaling(false)} className="absolute top-4 right-4" style={{ color: 'var(--text-muted)' }}><X size={24} /></button>
            <p className="text-xs font-bold uppercase tracking-wider text-cyan-500 mb-2">Family Hub</p>
            <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-main)' }}>Create Child Adventure Account</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Simple username login for your child, managed by you.</p>

            {error && <div className="bg-red-100 text-red-700 text-sm p-3 rounded-lg mb-4">{error}</div>}

            <form onSubmit={handleCreateChild} className="space-y-4">
              <div className="kid-glass rounded-2xl p-3">
                <label className="text-sm font-bold ml-1" style={{ color: 'var(--text-muted)' }}>Child's Name</label>
                <input required value={cName} onChange={(e) => setCName(e.target.value)} type="text" placeholder="e.g. Athmika" className="mt-1 w-full rounded-xl py-3 px-4 border focus:outline-none" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
              </div>
              <div className="kid-glass rounded-2xl p-3">
                <label className="text-sm font-bold ml-1" style={{ color: 'var(--text-muted)' }}>Unique Username</label>
                <input required value={cUser} onChange={(e) => setCUser(e.target.value.replace(/\s+/g, ''))} type="text" placeholder="e.g. athmikastar" className="mt-1 w-full rounded-xl py-3 px-4 border focus:outline-none" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
              </div>
              <div className="kid-glass rounded-2xl p-3">
                <label className="text-sm font-bold ml-1" style={{ color: 'var(--text-muted)' }}>Secret Password</label>
                <input required value={cPass} onChange={(e) => setCPass(e.target.value)} type="password" placeholder="Min 6 characters" className="mt-1 w-full rounded-xl py-3 px-4 border focus:outline-none" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="kid-glass rounded-2xl p-3">
                  <label className="text-sm font-bold ml-1" style={{ color: 'var(--text-muted)' }}>Date of Birth</label>
                  <input required value={cDob} onChange={(e) => setCDob(e.target.value)} type="date" className="mt-1 w-full rounded-xl py-3 px-4 border focus:outline-none" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                </div>
                <div className="kid-glass rounded-2xl p-3">
                  <label className="text-sm font-bold ml-1" style={{ color: 'var(--text-muted)' }}>Height (cm)</label>
                  <input required min="30" value={cHeight} onChange={(e) => setCHeight(e.target.value)} type="number" placeholder="120" className="mt-1 w-full rounded-xl py-3 px-4 border focus:outline-none" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                </div>
                <div className="kid-glass rounded-2xl p-3">
                  <label className="text-sm font-bold ml-1" style={{ color: 'var(--text-muted)' }}>Weight (kg)</label>
                  <input required min="5" step="0.1" value={cWeight} onChange={(e) => setCWeight(e.target.value)} type="number" placeholder="22.5" className="mt-1 w-full rounded-xl py-3 px-4 border focus:outline-none" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                </div>
              </div>
              <button disabled={loading} type="submit" className="w-full text-white font-bold py-3.5 rounded-xl transition mt-4" style={{ background: 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' }}>
                {loading ? 'Registering...' : 'Create Child Account'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
