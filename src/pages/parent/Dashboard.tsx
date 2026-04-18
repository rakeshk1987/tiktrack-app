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
import GrowthChart from '../../components/insights/GrowthChart';
import AcademicHeatmap from '../../components/insights/AcademicHeatmap';
import { getSecondaryAuth } from '../../utils/secondaryAuth';
import { computeLevelFromStars, evaluateBadges, applyTaskCompletionToProfile } from '../../hooks/useCoreLogic';
import { useMessages } from '../../hooks/useData';
import { useChallenges } from '../../hooks/useChallenges';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { addDoc, collection, deleteDoc, doc, getDoc, limit, onSnapshot, orderBy, query, setDoc, updateDoc, where } from 'firebase/firestore';
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
  const [taskLoading, setTaskLoading] = useState(false);
  const [examLoading, setExamLoading] = useState(false);
  const [growthLoading2, setGrowthLoading2] = useState(false);
  const [eventLoading, setEventLoading] = useState(false);
  const [rewardLoading, setRewardLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [info, setInfo] = useState('');
  const [children, setChildren] = useState<ChildAccount[]>([]);
  const [childrenLoading, setChildrenLoading] = useState(true);
  const [pendingProofs, setPendingProofs] = useState<PendingProof[]>([]);
  const [tasks, setTasks] = useState<Array<any>>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tTitle, setTTitle] = useState('');
  const [tDesc, setTDesc] = useState('');
  const [tPoints, setTPoints] = useState<number | ''>('');
  const [tDue, setTDue] = useState('');
  const [exams, setExams] = useState<Array<any>>([]);
  const [examsLoading, setExamsLoading] = useState(true);
  const [eChild, setEChild] = useState('');
  const [eSubject, setESubject] = useState('');
  const [eMarks, setEMarks] = useState<number | ''>('');
  const [eTotal, setETotal] = useState<number | ''>('');
  const [eDate, setEDate] = useState('');
  const [editExamId, setEditExamId] = useState<string | null>(null);
  const [filterChild, setFilterChild] = useState<string>('');
  const [growthLogs, setGrowthLogs] = useState<Array<any>>([]);
  const [growthLoading, setGrowthLoading] = useState(true);
  const [gChild, setGChild] = useState('');
  const [gHeight, setGHeight] = useState<number | ''>('');
  const [gWeight, setGWeight] = useState<number | ''>('');
  const [gDate, setGDate] = useState('');
  const [editGrowthId, setEditGrowthId] = useState<string | null>(null);
  const [events, setEvents] = useState<Array<any>>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [evChild, setEvChild] = useState('');
  const [evTitle, setEvTitle] = useState('');
  const [evType, setEvType] = useState('event');
  const [evDate, setEvDate] = useState('');
  const [evReminderDays, setEvReminderDays] = useState<number | ''>('');
  const [editEventId, setEditEventId] = useState<string | null>(null);
  const [rewards, setRewards] = useState<Array<any>>([]);
  const [rewardsLoading, setRewardsLoading] = useState(true);
  const [rStarRate, setRStarRate] = useState<number | ''>('');
  const [rWeeklyBonus, setRWeeklyBonus] = useState(false);
  const [editRewardId, setEditRewardId] = useState<string | null>(null);

  const [isInboxOpen, setIsInboxOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [coParentCode, setCoParentCode] = useState('');
  const [inboxMessage, setInboxMessage] = useState('');
  const [inboxChildId, setInboxChildId] = useState('');

  const [chTitle, setChTitle] = useState('');
  const [chChild, setChChild] = useState('');
  const [chTarget, setChTarget] = useState<number | ''>('');
  const [chDesc, setChDesc] = useState('');
  const [challengeLoading, setChallengeLoading] = useState(false);

  const familyId = user?.linked_family_id || user?.id || '';
  const { messages, sendMessage } = useMessages(familyId, 'parent');
  const { activeChallenges, completedChallenges, createChallenge, incrementScore, deleteChallenge } = useChallenges(familyId);

  useEffect(() => {
    if (!user) {
      setChildren([]);
      setChildrenLoading(false);
      return;
    }

    const childQuery = query(
      collection(db, 'users'),
      where('parent_id', '==', familyId),
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

  // Derived pending proofs visible to this parent (initialized before analytics reads it)
  const visiblePendingProofs = pendingProofs.filter((proof) => children.some((child) => child.id === proof.child_id));
  const featuredProof = visiblePendingProofs[0];

  useEffect(() => {
    if (!user) {
      setTasks([]);
      setTasksLoading(false);
      return;
    }

    setTasksLoading(true);
    const tasksQuery = query(
      collection(db, 'tasks'),
      where('parent_id', '==', user.id),
      orderBy('created_at', 'desc')
    );

    const unsub = onSnapshot(
      tasksQuery,
      (snap) => {
        const mapped = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setTasks(mapped);
        setTasksLoading(false);
      },
      (err) => {
        console.error('Failed to fetch tasks:', err);
        setTasksLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setExams([]);
      setExamsLoading(false);
      return;
    }

    setExamsLoading(true);
    const examsQuery = query(
      collection(db, 'exams'),
      where('parent_id', '==', user.id),
      orderBy('exam_date', 'desc')
    );

    const unsub = onSnapshot(
      examsQuery,
      (snap) => {
        const mapped = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setExams(mapped);
        setExamsLoading(false);
      },
      (err) => {
        console.error('Failed to fetch exams:', err);
        setExamsLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setGrowthLogs([]);
      setGrowthLoading(false);
      return;
    }

    setGrowthLoading(true);
    const gql = query(
      collection(db, 'growth_logs'),
      where('parent_id', '==', user.id),
      orderBy('date', 'desc')
    );

    const unsub = onSnapshot(
      gql,
      (snap) => {
        const mapped = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setGrowthLogs(mapped);
        setGrowthLoading(false);
      },
      (err) => {
        console.error('Failed to fetch growth logs:', err);
        setGrowthLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setEvents([]);
      setEventsLoading(false);
      return;
    }

    setEventsLoading(true);
    const evq = query(
      collection(db, 'events'),
      where('parent_id', '==', user.id),
      orderBy('date', 'desc')
    );

    const unsub = onSnapshot(
      evq,
      (snap) => {
        const mapped = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setEvents(mapped);
        setEventsLoading(false);
      },
      (err) => {
        console.error('Failed to fetch events:', err);
        setEventsLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setRewards([]);
      setRewardsLoading(false);
      return;
    }

    setRewardsLoading(true);
    const rq = query(
      collection(db, 'reward_settings'),
      where('parent_id', '==', user.id),
      orderBy('created_at', 'desc')
    );

    const unsub = onSnapshot(
      rq,
      (snap) => {
        const mapped = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setRewards(mapped);
        setRewardsLoading(false);
      },
      (err) => {
        console.error('Failed to fetch reward settings:', err);
        setRewardsLoading(false);
      }
    );

    return () => unsub();
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
      const cleanUser = cUser.trim().toLowerCase().split('@')[0];
      const dummyEmail = `${cleanUser}@tiktrack.family`;
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
      alert(`Backend threw an error: ${err?.message || err}`);
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
        // Read proof record to identify child and task
        const proofSnap = await getDoc(doc(db, 'proof_logs', proofId));
        const proofData = proofSnap.exists() ? (proofSnap.data() as any) : null;
        const childId = proofData?.child_id;
        const taskId = proofData?.task_id;

        // Determine star value from cached tasks
        const task = tasks.find((t: any) => t.id === taskId) as any;
        const starValue = Number(task?.points ?? task?.star_value ?? 0);

        if (childId) {
          try {
            const profileRef = doc(db, 'child_profile', childId);
            const profileSnap = await getDoc(profileRef);
            const existing = profileSnap.exists() ? (profileSnap.data() as any) : {};
            const { updatedProfile } = applyTaskCompletionToProfile(existing || {}, starValue, true);
            await updateDoc(profileRef, {
              total_stars: updatedProfile.total_stars,
              streak_count: updatedProfile.streak_count,
              consistency_score: updatedProfile.consistency_score
            });
          } catch (innerErr) {
            console.error('Failed to update child profile after proof approval:', innerErr);
          }
        }

        setSuccess('Proof approved and removed from the pending queue. Stars applied.');
      } else {
        setInfo('Proof rejected and removed from the pending queue.');
      }
    } catch (err) {
      console.error('Failed to update proof status:', err);
      setError('Could not update proof approval. Please try again.');
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError('');
    setTaskLoading(true);

    try {
      await addDoc(collection(db, 'tasks'), {
        title: tTitle,
        description: tDesc,
        points: tPoints || 0,
        due_date: tDue ? new Date(tDue).toISOString() : null,
        parent_id: user.id,
        created_at: new Date().toISOString()
      });

      setTTitle('');
      setTDesc('');
      setTPoints('');
      setTDue('');
      setSuccess('Task created successfully.');
    } catch (err) {
      console.error('Failed to create task:', err);
      setError('Could not create task.');
    } finally {
      setTaskLoading(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
      setSuccess('Task deleted.');
    } catch (err) {
      console.error('Failed to delete task:', err);
      setError('Could not delete task.');
    }
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError('');
    setExamLoading(true);

    try {
      if (editExamId) {
        await updateDoc(doc(db, 'exams', editExamId), {
          child_id: eChild || null,
          subject: eSubject,
          marks_scored: eMarks || 0,
          total_marks: eTotal || 0,
          exam_date: eDate ? new Date(eDate).toISOString() : new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        setSuccess('Exam updated.');
      } else {
        await addDoc(collection(db, 'exams'), {
          child_id: eChild || null,
          subject: eSubject,
          marks_scored: eMarks || 0,
          total_marks: eTotal || 0,
          exam_date: eDate ? new Date(eDate).toISOString() : new Date().toISOString(),
          parent_id: user.id,
          created_at: new Date().toISOString()
        });
        setSuccess('Exam result recorded.');
      }

      setEChild('');
      setESubject('');
      setEMarks('');
      setETotal('');
      setEDate('');
      setEditExamId(null);
    } catch (err) {
      console.error('Failed to create exam:', err);
      setError('Could not save exam result.');
    } finally {
      setExamLoading(false);
    }
  };

  const handleDeleteExam = async (examId: string) => {
    try {
      await deleteDoc(doc(db, 'exams', examId));
      setSuccess('Exam removed.');
    } catch (err) {
      console.error('Failed to delete exam:', err);
      setError('Could not delete exam.');
    }
  };

  const startEditExam = (ex: any) => {
    setEditExamId(ex.id);
    setEChild(ex.child_id || '');
    setESubject(ex.subject || '');
    setEMarks(ex.marks_scored ?? '');
    setETotal(ex.total_marks ?? '');
    setEDate(ex.exam_date ? new Date(ex.exam_date).toISOString().slice(0,10) : '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditExamId(null);
    setEChild('');
    setESubject('');
    setEMarks('');
    setETotal('');
    setEDate('');
  };

  const handleCreateGrowth = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!user) return;
    setError('');
    setGrowthLoading2(true);

    try {
      if (editGrowthId) {
        await updateDoc(doc(db, 'growth_logs', editGrowthId), {
          child_id: gChild || null,
          height_cm: gHeight || 0,
          weight_kg: gWeight || 0,
          date: gDate ? new Date(gDate).toISOString() : new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        setSuccess('Growth log updated.');
      } else {
        await addDoc(collection(db, 'growth_logs'), {
          child_id: gChild || null,
          height_cm: gHeight || 0,
          weight_kg: gWeight || 0,
          date: gDate ? new Date(gDate).toISOString() : new Date().toISOString(),
          parent_id: user.id,
          created_at: new Date().toISOString()
        });
        setSuccess('Growth log saved.');
      }

      setGChild('');
      setGHeight('');
      setGWeight('');
      setGDate('');
      setEditGrowthId(null);
    } catch (err) {
      console.error('Failed to save growth log:', err);
      setError('Could not save growth log.');
    } finally {
      setGrowthLoading2(false);
    }
  };

  const handleDeleteGrowth = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'growth_logs', id));
      setSuccess('Growth log deleted.');
    } catch (err) {
      console.error('Failed to delete growth log:', err);
      setError('Could not delete growth log.');
    }
  };

  const startEditGrowth = (g: any) => {
    setEditGrowthId(g.id);
    setGChild(g.child_id || '');
    setGHeight(g.height_cm ?? '');
    setGWeight(g.weight_kg ?? '');
    setGDate(g.date ? new Date(g.date).toISOString().slice(0,10) : '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError('');
    setEventLoading(true);

    try {
      if (editEventId) {
        await updateDoc(doc(db, 'events', editEventId), {
          child_id: evChild || null,
          title: evTitle,
          type: evType,
          date: evDate ? new Date(evDate).toISOString() : new Date().toISOString(),
          reminder_days_before: evReminderDays || 0,
          updated_at: new Date().toISOString()
        });
        setSuccess('Event updated.');
      } else {
        await addDoc(collection(db, 'events'), {
          child_id: evChild || null,
          title: evTitle,
          type: evType,
          date: evDate ? new Date(evDate).toISOString() : new Date().toISOString(),
          reminder_days_before: evReminderDays || 0,
          parent_id: user.id,
          created_at: new Date().toISOString()
        });
        setSuccess('Event created.');
      }

      setEvChild('');
      setEvTitle('');
      setEvType('event');
      setEvDate('');
      setEvReminderDays('');
      setEditEventId(null);
    } catch (err) {
      console.error('Failed to save event:', err);
      setError('Could not save event.');
    } finally {
      setEventLoading(false);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'events', id));
      setSuccess('Event deleted.');
    } catch (err) {
      console.error('Failed to delete event:', err);
      setError('Could not delete event.');
    }
  };

  const startEditEvent = (ev: any) => {
    setEditEventId(ev.id);
    setEvChild(ev.child_id || '');
    setEvTitle(ev.title || '');
    setEvType(ev.type || 'event');
    setEvDate(ev.date ? new Date(ev.date).toISOString().slice(0,10) : '');
    setEvReminderDays(ev.reminder_days_before ?? '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEditEvent = () => {
    setEditEventId(null);
    setEvChild('');
    setEvTitle('');
    setEvType('event');
    setEvDate('');
    setEvReminderDays('');
  };

  const handleSaveReward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError('');
    setRewardLoading(true);

    try {
      const payload = {
        parent_id: user.id,
        star_to_currency_rate: Number(rStarRate) || 0,
        weekly_bonus_enabled: Boolean(rWeeklyBonus),
        updated_at: new Date().toISOString()
      };

      if (editRewardId) {
        await updateDoc(doc(db, 'reward_settings', editRewardId), payload);
        setSuccess('Reward setting updated.');
      } else {
        await addDoc(collection(db, 'reward_settings'), { ...payload, created_at: new Date().toISOString() });
        setSuccess('Reward setting saved.');
      }

      setRStarRate('');
      setRWeeklyBonus(false);
      setEditRewardId(null);
    } catch (err) {
      console.error('Failed to save reward setting:', err);
      setError('Could not save reward setting.');
    } finally {
      setRewardLoading(false);
    }
  };

  const handleDeleteReward = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'reward_settings', id));
      setSuccess('Reward setting deleted.');
    } catch (err) {
      console.error('Failed to delete reward setting:', err);
      setError('Could not delete reward setting.');
    }
  };

  const startEditReward = (r: any) => {
    setEditRewardId(r.id);
    setRStarRate(r.star_to_currency_rate ?? '');
    setRWeeklyBonus(Boolean(r.weekly_bonus_enabled));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEditReward = () => {
    setEditRewardId(null);
    setRStarRate('');
    setRWeeklyBonus(false);
  };

  // Analytics state
  const [childProfiles, setChildProfiles] = useState<Array<any>>([]);
  const [enrichedChildProfiles, setEnrichedChildProfiles] = useState<Array<any>>([]);
  const [weeklyStarsTrend, setWeeklyStarsTrend] = useState<number[]>([]);
  const [badgesSummary, setBadgesSummary] = useState<Record<string, number>>({});
  const [selectedTrendChild, setSelectedTrendChild] = useState<string>('');
  const [totalTasksCount, setTotalTasksCount] = useState(0);
  const [tasksCompletedCount, setTasksCompletedCount] = useState(0);
  const [avgConsistency, setAvgConsistency] = useState(0);
  const [avgBmi, setAvgBmi] = useState(0);
  const [pendingProofCount, setPendingProofCount] = useState(0);
  const [upcomingEventsCount, setUpcomingEventsCount] = useState(0);
  const [examsCount, setExamsCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setChildProfiles([]);
      return;
    }

    const cpq = query(collection(db, 'child_profile'), where('user_id', '==', familyId));
    const unsub = onSnapshot(
      cpq,
      (snap) => {
        const mapped = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setChildProfiles(mapped);
      },
      (err) => console.error('Failed to fetch child profiles for analytics:', err)
    );

    return () => unsub();
  }, [user]);

  // Subscribe to approved proofs to compute completed tasks and recent stars
  useEffect(() => {
    if (!user) {
      setTasksCompletedCount(0);
      setEnrichedChildProfiles(childProfiles);
      return;
    }

    const pq = query(collection(db, 'proof_logs'), where('approval_status', '==', 'approved'));
    const unsub = onSnapshot(
      pq,
      (snap) => {
        const approved = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        // keep only proofs for our children
        const visibleApproved = approved.filter((p) => children.some((c) => c.id === p.child_id));

        setTasksCompletedCount(visibleApproved.length);

        // map task id -> star/points from tasks list
        const taskMap = new Map<string, number>(tasks.map((t: any) => [t.id, Number(t.points ?? t.star_value ?? 0)]));

        const starsByChild: Record<string, number> = {};
        visibleApproved.forEach((p) => {
          const star = Number(taskMap.get(p.task_id) || 0);
          if (!p.child_id) return;
          starsByChild[p.child_id] = (starsByChild[p.child_id] || 0) + star;
        });

        const enriched = childProfiles.map((cp) => {
          const recent = starsByChild[cp.id] || 0;
          const existing = Number(cp.total_stars) || 0;
          const combined = existing + recent;
          return {
            ...cp,
            recentStars: recent,
            computedTotalStars: combined,
            levelInfo: computeLevelFromStars(combined),
            badges: evaluateBadges({ total_stars: combined, streak_count: cp.streak_count, consistency_score: cp.consistency_score })
          };
        });

        setEnrichedChildProfiles(enriched);

        // compute weekly stars trend (last 7 days, inclusive today)
        const days = Array.from({ length: 7 }).map(() => 0);
        const dayKeys = Array.from({ length: 7 }).map((_, i) => {
          const d = new Date();
          d.setHours(0, 0, 0, 0);
          d.setDate(d.getDate() - (6 - i));
          return d.toDateString();
        });

        const approvedForTrend = selectedTrendChild ? visibleApproved.filter((p) => p.child_id === selectedTrendChild) : visibleApproved;

        approvedForTrend.forEach((p) => {
          const ts = p.timestamp || p.created_at || p.time || p.date;
          const pd = ts ? new Date(ts) : new Date();
          const key = pd.toDateString();
          const idx = dayKeys.indexOf(key);
          const star = Number(taskMap.get(p.task_id) || 0);
          if (idx >= 0) days[idx] += star;
        });

        setWeeklyStarsTrend(days);

        // aggregate badge counts
        const badgeCounts: Record<string, number> = {};
        enriched.forEach((p) => {
          (p.badges || []).forEach((b: string) => {
            badgeCounts[b] = (badgeCounts[b] || 0) + 1;
          });
        });
        setBadgesSummary(badgeCounts);
      },
      (err) => console.error('Failed to subscribe to approved proofs for analytics:', err)
    );

    return () => unsub();
  }, [user, children, tasks, childProfiles]);

  useEffect(() => {
    // aggregate simple analytics from existing subscriptions
    setTotalTasksCount(tasks.length);
    setPendingProofCount(visiblePendingProofs.length);
    setExamsCount(exams.length);

    const today = new Date();
    const upcoming = events.filter((ev) => {
      try {
        return ev.date && new Date(ev.date) >= new Date(today.toDateString());
      } catch {
        return false;
      }
    }).length;
    setUpcomingEventsCount(upcoming);

    // consistency average
    if (childProfiles.length === 0) {
      setAvgConsistency(0);
      setAvgBmi(0);
    } else {
      const totalConsistency = childProfiles.reduce((s, p) => s + (Number(p.consistency_score) || 0), 0);
      setAvgConsistency(Math.round(totalConsistency / childProfiles.length));

      const totalBmi = childProfiles.reduce((s, p) => {
        const h = Number(p.height_cm) || 0;
        const w = Number(p.weight_kg) || 0;
        if (h > 0 && w > 0) {
          const bmi = w / ((h / 100) * (h / 100));
          return s + bmi;
        }
        return s;
      }, 0);
      const countWithBmi = childProfiles.filter((p) => (Number(p.height_cm) || 0) > 0 && (Number(p.weight_kg) || 0) > 0).length;
      setAvgBmi(countWithBmi > 0 ? Number((totalBmi / countWithBmi).toFixed(1)) : 0);
    }
  }, [tasks, visiblePendingProofs, exams, events, childProfiles]);

  const cancelEditGrowth = () => {
    setEditGrowthId(null);
    setGChild('');
    setGHeight('');
    setGWeight('');
    setGDate('');
  };

  const cardBase = 'rounded-3xl border p-5 shadow-[var(--card-shadow)]';
  const hasChildren = children.length > 0;
  const tasksCompleted = tasksCompletedCount;
  const consistencyPercent = avgConsistency;
  

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
                <button className="h-11 w-11 rounded-xl bg-white/18 grid place-items-center hover:bg-white/28 transition relative" onClick={() => setIsInboxOpen(true)}>
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
                <button className="h-11 w-11 rounded-xl bg-white/18 grid place-items-center hover:bg-white/28 transition" onClick={() => setIsSettingsOpen(true)}> 
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
                  <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-main)' }}>Analytics</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-xl p-3 text-center" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}>
                      <p className="text-white text-xs">Children</p>
                      <p className="text-white font-extrabold">{children.length}</p>
                    </div>
                    <div className="rounded-xl p-3 text-center" style={{ background: 'linear-gradient(135deg, #06b6d4, #14b8a6)' }}>
                      <p className="text-white text-xs">Tasks</p>
                      <p className="text-white font-extrabold">{totalTasksCount}</p>
                    </div>
                    <div className="rounded-xl p-3 text-center" style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)' }}>
                      <p className="text-white text-xs">Pending Proofs</p>
                      <p className="text-white font-extrabold">{pendingProofCount}</p>
                    </div>
                    <div className="rounded-xl p-3 text-center" style={{ background: 'linear-gradient(135deg, #ef4444, #fb7185)' }}>
                      <p className="text-white text-xs">Upcoming Events</p>
                      <p className="text-white font-extrabold">{upcomingEventsCount}</p>
                    </div>
                    <div className="rounded-xl p-3 text-center col-span-2 sm:col-span-2" style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)' }}>
                      <p className="text-white text-xs">Avg Consistency</p>
                      <p className="text-white font-extrabold">{avgConsistency}%</p>
                    </div>
                    <div className="rounded-xl p-3 text-center col-span-2 sm:col-span-2" style={{ background: 'linear-gradient(135deg, #8b5cf6, #c084fc)' }}>
                      <p className="text-white text-xs">Avg BMI</p>
                      <p className="text-white font-extrabold">{avgBmi}</p>
                    </div>
                  </div>
                </div>
                <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                  <div className="flex items-start justify-between">
                    <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-main)' }}>Weekly Trend</h2>
                    <div className="mb-3">
                      <select value={selectedTrendChild} onChange={(e) => setSelectedTrendChild(e.target.value)} className="rounded-xl py-1 px-2 text-sm border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                        <option value="">All Children</option>
                        {children.map((c) => (<option key={c.id} value={c.id}>{c.name || (c.email || '').replace('@tiktrack.family','')}</option>))}
                      </select>
                    </div>
                  </div>
                  <div className="h-44 rounded-2xl p-4 bg-[var(--surface-soft)] border" style={{ borderColor: 'var(--border-main)' }}>
                    <div className="h-full w-full relative flex items-end gap-2">
                      {weeklyStarsTrend.length === 0 ? (
                        <div className="flex-1 grid place-items-center text-sm" style={{ color: 'var(--text-muted)' }}>No recent activity</div>
                      ) : (
                        (() => {
                          const max = Math.max(...weeklyStarsTrend, 1);
                          return weeklyStarsTrend.map((val, idx) => (
                            <div key={idx} className="flex-1 flex flex-col items-center justify-end">
                              <div className="w-full rounded-t-md bg-emerald-400" style={{ height: `${Math.round((val / max) * 100)}%` }} />
                              <div className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>{/* label */}</div>
                            </div>
                          ));
                        })()
                      )}
                    </div>
                  </div>
                </div>

                <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>Growth & Health</h2>
                    <span className="px-2 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">{growthLogs.length}</span>
                  </div>

                  <div className="space-y-3">
                    <form onSubmit={handleCreateGrowth} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <select value={gChild} onChange={(ev) => setGChild(ev.target.value)} className="col-span-1 sm:col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                        <option value="">-- Child --</option>
                        {children.map((c) => (<option key={c.id} value={c.id}>{c.name || c.email}</option>))}
                      </select>
                      <input required value={gHeight as any} onChange={(ev) => setGHeight(ev.target.value === '' ? '' : Number(ev.target.value))} placeholder="Height (cm)" type="number" className="col-span-1 sm:col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                      <input required value={gWeight as any} onChange={(ev) => setGWeight(ev.target.value === '' ? '' : Number(ev.target.value))} placeholder="Weight (kg)" type="number" step="0.1" className="col-span-1 sm:col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />

                      <input required value={gDate} onChange={(ev) => setGDate(ev.target.value)} type="date" className="col-span-1 sm:col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                      <div className="col-span-1 sm:col-span-2 flex gap-2">
                        <button disabled={growthLoading2} type="submit" className="py-2 px-4 rounded-xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' }}>{growthLoading2 ? 'Saving...' : (editGrowthId ? 'Save Changes' : '+ Save Growth')}</button>
                        {editGrowthId ? (
                          <button type="button" onClick={cancelEditGrowth} className="py-2 px-4 rounded-xl text-sm font-semibold border" style={{ borderColor: 'var(--border-main)' }}>Cancel</button>
                        ) : (
                          <button type="button" onClick={() => { setGChild(''); setGHeight(''); setGWeight(''); setGDate(''); }} className="py-2 px-4 rounded-xl text-sm font-semibold border" style={{ borderColor: 'var(--border-main)' }}>Clear</button>
                        )}
                      </div>
                    </form>

                    <div>
                      {growthLoading ? (
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading growth logs...</p>
                      ) : (filterChild ? growthLogs.filter((x) => x.child_id === filterChild) : growthLogs).length === 0 ? (
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No growth logs yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {(filterChild ? growthLogs.filter((x) => x.child_id === filterChild) : growthLogs).map((g) => (
                            <div key={g.id} className="rounded-xl p-3 border flex items-center justify-between" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                              <div>
                                <p className="font-semibold" style={{ color: 'var(--text-main)' }}>{children.find((c) => c.id === g.child_id)?.name || 'Child'}</p>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Height: {g.height_cm} cm • Weight: {g.weight_kg} kg</p>
                                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{g.date ? new Date(g.date).toLocaleDateString() : '—'}</p>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => startEditGrowth(g)} className="py-1.5 px-3 rounded-lg text-sm font-semibold bg-amber-100 text-amber-700">Edit</button>
                                <button onClick={() => handleDeleteGrowth(g.id)} className="py-1.5 px-3 rounded-lg text-sm font-semibold bg-rose-100 text-rose-700">Delete</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>Events Planner</h2>
                    <span className="px-2 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">{events.length}</span>
                  </div>

                  <div className="space-y-3">
                    <form onSubmit={handleCreateEvent} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <select value={evChild} onChange={(ev) => setEvChild(ev.target.value)} className="col-span-1 sm:col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                        <option value="">-- Child (optional) --</option>
                        {children.map((c) => (<option key={c.id} value={c.id}>{c.name || c.email}</option>))}
                      </select>
                      <input required value={evTitle} onChange={(ev) => setEvTitle(ev.target.value)} placeholder="Title" className="col-span-1 sm:col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                      <select value={evType} onChange={(ev) => setEvType(ev.target.value)} className="col-span-1 sm:col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                        <option value="event">Event</option>
                        <option value="appointment">Appointment</option>
                        <option value="exam">Exam</option>
                        <option value="reminder">Reminder</option>
                      </select>

                      <input required value={evDate} onChange={(ev) => setEvDate(ev.target.value)} type="date" className="col-span-1 sm:col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                      <input value={evReminderDays as any} onChange={(ev) => setEvReminderDays(ev.target.value === '' ? '' : Number(ev.target.value))} placeholder="Remind days before" type="number" className="col-span-1 sm:col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                      <div className="col-span-1 sm:col-span-3 flex gap-2">
                        <button disabled={eventLoading} type="submit" className="py-2 px-4 rounded-xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' }}>{eventLoading ? 'Saving...' : (editEventId ? 'Save Changes' : '+ Create Event')}</button>
                        {editEventId ? (
                          <button type="button" onClick={cancelEditEvent} className="py-2 px-4 rounded-xl text-sm font-semibold border" style={{ borderColor: 'var(--border-main)' }}>Cancel</button>
                        ) : (
                          <button type="button" onClick={() => { setEvChild(''); setEvTitle(''); setEvType('event'); setEvDate(''); setEvReminderDays(''); }} className="py-2 px-4 rounded-xl text-sm font-semibold border" style={{ borderColor: 'var(--border-main)' }}>Clear</button>
                        )}
                      </div>
                    </form>

                    <div>
                      {eventsLoading ? (
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading events...</p>
                      ) : (filterChild ? events.filter((x) => x.child_id === filterChild) : events).length === 0 ? (
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No events planned yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {(filterChild ? events.filter((x) => x.child_id === filterChild) : events).map((ev) => (
                            <div key={ev.id} className="rounded-xl p-3 border flex items-center justify-between" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                              <div>
                                <p className="font-semibold" style={{ color: 'var(--text-main)' }}>{ev.title} • {ev.type}</p>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{ev.child_id ? children.find((c) => c.id === ev.child_id)?.name : 'Family'} • {ev.date ? new Date(ev.date).toLocaleDateString() : '—'}</p>
                                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Remind {ev.reminder_days_before ?? 0} days before</p>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => startEditEvent(ev)} className="py-1.5 px-3 rounded-lg text-sm font-semibold bg-amber-100 text-amber-700">Edit</button>
                                <button onClick={() => handleDeleteEvent(ev.id)} className="py-1.5 px-3 rounded-lg text-sm font-semibold bg-rose-100 text-rose-700">Delete</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>Rewards Configuration</h2>
                    <span className="px-2 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">{rewards.length}</span>
                  </div>

                  <div className="space-y-3">
                    <form onSubmit={handleSaveReward} className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                      <input required value={rStarRate as any} onChange={(ev) => setRStarRate(ev.target.value === '' ? '' : Number(ev.target.value))} placeholder="Stars → Currency rate" type="number" min="0" className="col-span-1 sm:col-span-2 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                      <label className="col-span-1 sm:col-span-1 inline-flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={rWeeklyBonus} onChange={(ev) => setRWeeklyBonus(ev.target.checked)} className="h-4 w-4" />
                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Weekly bonus</span>
                      </label>

                      <div className="col-span-1 sm:col-span-3 flex gap-2">
                        <button disabled={rewardLoading} type="submit" className="py-2 px-4 rounded-xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' }}>{rewardLoading ? 'Saving...' : (editRewardId ? 'Save Changes' : '+ Save Setting')}</button>
                        {editRewardId ? (
                          <button type="button" onClick={cancelEditReward} className="py-2 px-4 rounded-xl text-sm font-semibold border" style={{ borderColor: 'var(--border-main)' }}>Cancel</button>
                        ) : (
                          <button type="button" onClick={() => { setRStarRate(''); setRWeeklyBonus(false); }} className="py-2 px-4 rounded-xl text-sm font-semibold border" style={{ borderColor: 'var(--border-main)' }}>Clear</button>
                        )}
                      </div>
                    </form>

                    <div>
                      {rewardsLoading ? (
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading reward settings...</p>
                      ) : rewards.length === 0 ? (
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No rewards configured yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {rewards.map((r) => (
                            <div key={r.id} className="rounded-xl p-3 border flex items-center justify-between" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                              <div>
                                <p className="font-semibold" style={{ color: 'var(--text-main)' }}>1 star = {r.star_to_currency_rate} coins</p>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Weekly bonus: {r.weekly_bonus_enabled ? 'enabled' : 'disabled'}</p>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => startEditReward(r)} className="py-1.5 px-3 rounded-lg text-sm font-semibold bg-amber-100 text-amber-700">Edit</button>
                                <button onClick={() => handleDeleteReward(r.id)} className="py-1.5 px-3 rounded-lg text-sm font-semibold bg-rose-100 text-rose-700">Delete</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>Manage Tasks</h2>
                    <span className="px-2 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                      {tasks.length}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <form onSubmit={handleCreateTask} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input required value={tTitle} onChange={(e) => setTTitle(e.target.value)} placeholder="Task title" className="col-span-1 sm:col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                      <input value={tPoints as any} onChange={(e) => setTPoints(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Points" type="number" className="col-span-1 sm:col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                      <input value={tDue} onChange={(e) => setTDue(e.target.value)} type="date" className="col-span-1 sm:col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                      <input value={tDesc} onChange={(e) => setTDesc(e.target.value)} placeholder="Short description" className="col-span-1 sm:col-span-3 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                      <div className="col-span-1 sm:col-span-3 flex gap-2">
                        <button disabled={taskLoading} type="submit" className="py-2 px-4 rounded-xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' }}>{taskLoading ? 'Saving...' : '+ Create Task'}</button>
                        <button type="button" onClick={() => { setTTitle(''); setTDesc(''); setTPoints(''); setTDue(''); }} className="py-2 px-4 rounded-xl text-sm font-semibold border" style={{ borderColor: 'var(--border-main)' }}>Clear</button>
                      </div>
                    </form>

                    <div>
                      {tasksLoading ? (
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading tasks...</p>
                      ) : tasks.length === 0 ? (
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No tasks yet. Create one above.</p>
                      ) : (
                        <div className="space-y-2">
                          {tasks.map((t) => (
                            <div key={t.id} className="rounded-xl p-3 border flex items-center justify-between" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                              <div>
                                <p className="font-semibold" style={{ color: 'var(--text-main)' }}>{t.title}</p>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t.description}</p>
                                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t.points} pts • {t.due_date ? new Date(t.due_date).toLocaleDateString() : 'no due date'}</p>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => handleDeleteTask(t.id)} className="py-1.5 px-3 rounded-lg text-sm font-semibold bg-rose-100 text-rose-700">Delete</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
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
                      {children.map((child) => {
                        const meta = enrichedChildProfiles.find((p) => p.id === child.id) as any;
                        return (
                          <div key={child.id} className="rounded-xl border p-3 flex items-center justify-between" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                            <div>
                              <p className="font-semibold" style={{ color: 'var(--text-main)' }}>{child.name || 'Child'}</p>
                              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{(child.email || '').replace('@tiktrack.family', '')}</p>
                              {meta ? (
                                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Level {meta.levelInfo?.level} • {meta.computedTotalStars}★</p>
                              ) : null}
                            </div>
                            <Circle size={14} className="text-emerald-500 fill-current" />
                          </div>
                        );
                      })}
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
                      <p className="text-white font-extrabold">{tasksCompletedCount}</p>
                    </div>
                  </div>
                </div>

                <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>Exams</h2>
                    <div className="flex items-center gap-2">
                      <select value={filterChild} onChange={(ev) => setFilterChild(ev.target.value)} className="rounded-xl py-1 px-3 text-sm border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                        <option value="">All Children</option>
                        {children.map((c) => (<option key={c.id} value={c.id}>{c.name || c.email}</option>))}
                      </select>
                      <span className="px-2 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">{exams.length}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <form onSubmit={handleCreateExam} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <select value={eChild} onChange={(ev) => setEChild(ev.target.value)} className="col-span-1 sm:col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                        <option value="">-- Child --</option>
                        {children.map((c) => (<option key={c.id} value={c.id}>{c.name || c.email}</option>))}
                      </select>
                      <input required value={eSubject} onChange={(ev) => setESubject(ev.target.value)} placeholder="Subject" className="col-span-1 sm:col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                      <input required value={eDate} onChange={(ev) => setEDate(ev.target.value)} type="date" className="col-span-1 sm:col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />

                      <input required value={eMarks as any} onChange={(ev) => setEMarks(ev.target.value === '' ? '' : Number(ev.target.value))} placeholder="Marks scored" type="number" className="col-span-1 sm:col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                      <input required value={eTotal as any} onChange={(ev) => setETotal(ev.target.value === '' ? '' : Number(ev.target.value))} placeholder="Total marks" type="number" className="col-span-1 sm:col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                      <div className="col-span-1 sm:col-span-3 flex gap-2">
                        <button disabled={examLoading} type="submit" className="py-2 px-4 rounded-xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' }}>{examLoading ? 'Saving...' : (editExamId ? 'Save Changes' : '+ Record Exam')}</button>
                        {editExamId ? (
                          <button type="button" onClick={cancelEdit} className="py-2 px-4 rounded-xl text-sm font-semibold border" style={{ borderColor: 'var(--border-main)' }}>Cancel</button>
                        ) : (
                          <button type="button" onClick={() => { setEChild(''); setESubject(''); setEMarks(''); setETotal(''); setEDate(''); }} className="py-2 px-4 rounded-xl text-sm font-semibold border" style={{ borderColor: 'var(--border-main)' }}>Clear</button>
                        )}
                      </div>
                    </form>

                    <div>
                      {examsLoading ? (
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading exams...</p>
                      ) : (filterChild ? exams.filter((x) => x.child_id === filterChild) : exams).length === 0 ? (
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No exam results recorded yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {(filterChild ? exams.filter((x) => x.child_id === filterChild) : exams).map((ex) => (
                            <div key={ex.id} className="rounded-xl p-3 border flex items-center justify-between" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                              <div>
                                <p className="font-semibold" style={{ color: 'var(--text-main)' }}>{ex.subject} • {children.find((c) => c.id === ex.child_id)?.name || 'Child'}</p>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{ex.marks_scored}/{ex.total_marks} • {ex.exam_date ? new Date(ex.exam_date).toLocaleDateString() : '—'}</p>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => startEditExam(ex)} className="py-1.5 px-3 rounded-lg text-sm font-semibold bg-amber-100 text-amber-700">Edit</button>
                                <button onClick={() => handleDeleteExam(ex.id)} className="py-1.5 px-3 rounded-lg text-sm font-semibold bg-rose-100 text-rose-700">Delete</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <GrowthChart logs={filterChild ? growthLogs.filter((x) => x.child_id === filterChild) : growthLogs} isDark={theme === 'dark'} />
                  <AcademicHeatmap exams={filterChild ? exams.filter((x) => x.child_id === filterChild) : exams} isDark={theme === 'dark'} />
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

                <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                  <h2 className="text-lg font-bold mb-3 inline-flex items-center gap-2" style={{ color: 'var(--text-main)' }}>
                    <Activity size={18} /> Challenges
                  </h2>

                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!chTitle || !chChild || !chTarget) return;
                    setChallengeLoading(true);
                    try {
                      await createChallenge(chTitle, chChild, Number(chTarget), chDesc);
                      setChTitle(''); setChChild(''); setChTarget(''); setChDesc('');
                      setSuccess('Challenge created!');
                    } catch (err) {
                      setError('Could not create challenge.');
                    } finally {
                      setChallengeLoading(false);
                    }
                  }} className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                    <select required value={chChild} onChange={(e) => setChChild(e.target.value)} className="rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                      <option value="">-- Child --</option>
                      {children.map((c) => (<option key={c.id} value={c.id}>{c.name || c.email}</option>))}
                    </select>
                    <input required value={chTitle} onChange={(e) => setChTitle(e.target.value)} placeholder="Challenge title" className="rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                    <input required value={chTarget as any} onChange={(e) => setChTarget(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Target score" type="number" min="1" className="rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                    <input value={chDesc} onChange={(e) => setChDesc(e.target.value)} placeholder="Description (optional)" className="rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                    <div className="col-span-1 sm:col-span-2 flex gap-2">
                      <button disabled={challengeLoading} type="submit" className="py-2 px-4 rounded-xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' }}>{challengeLoading ? 'Creating...' : '+ New Challenge'}</button>
                      <button type="button" onClick={() => { setChTitle(''); setChChild(''); setChTarget(''); setChDesc(''); }} className="py-2 px-4 rounded-xl text-sm font-semibold border" style={{ borderColor: 'var(--border-main)' }}>Clear</button>
                    </div>
                  </form>

                  {activeChallenges.length > 0 && (
                    <div className="space-y-2 mb-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-emerald-500">Active</p>
                      {activeChallenges.map((ch) => (
                        <div key={ch.id} className="rounded-xl border p-3" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                          <p className="font-semibold" style={{ color: 'var(--text-main)' }}>{ch.title}</p>
                          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{ch.description || 'No description'} • Target: {ch.target_score}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <div className="flex-1">
                              <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>Parent: {ch.parent_score}</p>
                              <div className="h-2 rounded-full mt-1" style={{ background: 'var(--border-main)' }}>
                                <div className="h-full rounded-full" style={{ width: `${Math.min(100, (ch.parent_score / ch.target_score) * 100)}%`, background: 'linear-gradient(90deg, #8b5cf6, #6366f1)' }} />
                              </div>
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>Child: {ch.child_score}</p>
                              <div className="h-2 rounded-full mt-1" style={{ background: 'var(--border-main)' }}>
                                <div className="h-full rounded-full" style={{ width: `${Math.min(100, (ch.child_score / ch.target_score) * 100)}%`, background: 'linear-gradient(90deg, #ec4899, #f472b6)' }} />
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-2">
                            <button onClick={() => void incrementScore(ch.id, 'parent')} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-100 text-violet-700">+1 Parent</button>
                            <button onClick={() => void incrementScore(ch.id, 'child')} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-pink-100 text-pink-700">+1 Child</button>
                            <button onClick={() => void deleteChallenge(ch.id)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-100 text-rose-700 ml-auto">Delete</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {completedChallenges.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-amber-500">Completed</p>
                      {completedChallenges.slice(0, 3).map((ch) => (
                        <div key={ch.id} className="rounded-xl border p-3 opacity-75" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                          <p className="font-semibold" style={{ color: 'var(--text-main)' }}>{ch.title}</p>
                          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Winner: {ch.winner === 'parent' ? '👨 Parent' : ch.winner === 'child' ? '🧒 Child' : '🤝 Draw'} • {ch.parent_score} vs {ch.child_score}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeChallenges.length === 0 && completedChallenges.length === 0 && (
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No challenges yet. Create one above!</p>
                  )}
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

      {isInboxOpen && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="rounded-3xl w-full max-w-md p-6 shadow-2xl relative border bg-[var(--surface)]" style={{ borderColor: 'var(--border-main)' }}>
            <button onClick={() => setIsInboxOpen(false)} className="absolute top-4 right-4" style={{ color: 'var(--text-muted)' }}><X size={24} /></button>
            <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-main)' }}>Send Message</h2>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!inboxChildId || !inboxMessage.trim() || !user) return;
              await sendMessage(inboxChildId, user.id, inboxMessage.trim());
              setInboxMessage('');
              setSuccess('Message sent successfully!');
              setTimeout(() => setSuccess(''), 3000);
            }} className="space-y-4">
              <select required value={inboxChildId} onChange={(e) => setInboxChildId(e.target.value)} className="w-full rounded-xl py-3 px-4 border focus:outline-none" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                <option value="">Select Child...</option>
                {children.map(c => <option key={c.id} value={c.id}>{c.name || c.email}</option>)}
              </select>
              <textarea 
                required 
                value={inboxMessage} 
                onChange={(e) => setInboxMessage(e.target.value)}
                placeholder="Write an encouraging message..."
                className="w-full rounded-xl py-3 px-4 border focus:outline-none min-h-[100px]"
                style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}
              />
              <button type="submit" className="w-full py-3 rounded-xl text-sm font-bold text-white bg-sky-500 hover:bg-sky-600 transition">
                Send Message
              </button>
            </form>
          </div>
        </div>
      )}

      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="rounded-3xl w-full max-w-md p-6 shadow-2xl relative border bg-[var(--surface)]" style={{ borderColor: 'var(--border-main)' }}>
            <button onClick={() => setIsSettingsOpen(false)} className="absolute top-4 right-4" style={{ color: 'var(--text-muted)' }}><X size={24} /></button>
            <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-main)' }}>Parent Settings & Co-Parenting</h2>
            
            <div className="space-y-4">
              <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                 <p className="text-sm font-bold mb-1">Your Family Link Code</p>
                 <p className="text-xs opacity-70 mb-2">Share this code with your co-parent so they can link to your family account.</p>
                 <div className="bg-black/10 dark:bg-black/30 p-2 rounded-lg font-mono text-center select-all">{user?.id}</div>
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!coParentCode.trim() || !user) return;
                try {
                  await updateDoc(doc(db, 'users', user.id), { linked_family_id: coParentCode.trim() });
                  setSuccess('Successfully linked to family account! Please refresh the page to sync.');
                } catch (err) {
                  setError('Failed to link family account.');
                }
              }} className="p-4 rounded-xl border mt-4" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                 <p className="text-sm font-bold mb-1" style={{ color: 'var(--text-main)' }}>Join a Family Account</p>
                 <p className="text-xs opacity-70 mb-3" style={{ color: 'var(--text-main)' }}>Enter your co-parent's Family Link Code here.</p>
                 <input 
                   required 
                   value={coParentCode} 
                   onChange={(e) => setCoParentCode(e.target.value)}
                   placeholder="Enter Family Code"
                   className="w-full rounded-xl py-3 px-4 border focus:outline-none mb-3"
                   style={{ borderColor: 'var(--border-main)', background: 'var(--surface)', color: 'var(--text-main)' }}
                 />
                 <button type="submit" className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-500 hover:bg-indigo-600 transition">
                   Link Account
                 </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
