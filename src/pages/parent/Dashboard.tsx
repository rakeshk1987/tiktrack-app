import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import {
  Activity,
  BarChart3,
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
import clsx from 'clsx';
import GrowthChart from '../../components/insights/GrowthChart';
import AcademicHeatmap from '../../components/insights/AcademicHeatmap';
import { createOrReuseChildAccount } from '../../utils/childAccountAuth';
import { computeLevelFromStars, evaluateBadges, applyTaskCompletionToProfile } from '../../hooks/useCoreLogic';
import { useMessages } from '../../hooks/useData';
import { useChallenges } from '../../hooks/useChallenges';
import { signOut } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, getDoc, limit, onSnapshot, orderBy, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { activeFirebaseEnv, auth, db, isUsingFirebaseEmulators } from '../../config/firebase';
import { RealTimeProvider } from '../../contexts/RealTimeContext';
import RealTimeNotifications from '../../components/RealTimeNotifications';
import RealTimeDashboard from '../../components/RealTimeDashboard';
import RoutineConfigurationUI from '../../components/RoutineConfigurationUI';
import TaskSchedulerUI from '../../components/TaskSchedulerUI';
import ReminderManagement from '../../components/ReminderManagement';
import RewardManagement from '../../components/RewardManagement';
import RedemptionHistory from '../../components/RedemptionHistory';
import { useRoutineConfiguration } from '../../hooks/useRoutineConfiguration';
import { useTaskScheduler } from '../../hooks/useTaskScheduler';
import { getDefaultReminders, useReminders } from '../../hooks/useReminders';
import { getDefaultRewards, useRedemptions, useRewards } from '../../hooks/useRedemptions';
import type { ChildProfile, Event as AppEvent, ExamResult, Reminder, RewardItem } from '../../types/schema';
import { ParentPlannerV2Page } from '../../features/planner';
import { usePlannerPrograms } from '../../features/planner/hooks/usePlannerPrograms';
import { upsertPlannerProgram } from '../../features/planner/services/planner.firestore';
import type { PlannerActivityModule, PlannerProgram } from '../../features/planner/types/planner.types';
import { usePlannerTimetable } from '../../features/planner/hooks/usePlannerTimetable';

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

interface ChildSubmission {
  id: string;
  child_id?: string;
  title?: string;
  type?: string;
  date?: string;
  description?: string;
  approval_status?: 'pending' | 'approved' | 'rejected';
  created_at?: string;
}

function ParentDashboardContent() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [isModaling, setIsModaling] = useState(false);
  const [cUser, setCUser] = useState('');
  const [cName, setCName] = useState('');
  const [cPass, setCPass] = useState('');
  const [cDob, setCDob] = useState('');
  const [cHeight, setCHeight] = useState('');
  const [cWeight, setCWeight] = useState('');
  const [childRegistering, setChildRegistering] = useState(false);
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
  const [proofReviewComment, setProofReviewComment] = useState('');
  const [pendingChildTasks, setPendingChildTasks] = useState<ChildSubmission[]>([]);
  const [pendingChildEvents, setPendingChildEvents] = useState<ChildSubmission[]>([]);
  const [pendingAchievements, setPendingAchievements] = useState<ChildSubmission[]>([]);
  const [tasks, setTasks] = useState<Array<any>>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tTitle, setTTitle] = useState('');
  const [tDesc, setTDesc] = useState('');
  const [tPoints, setTPoints] = useState<number | ''>('');
  const [tDue, setTDue] = useState('');
  const [tRecurrenceType, setTRecurrenceType] = useState<'none' | 'daily' | 'weekly'>('none');
  const [tRecurrenceDays, setTRecurrenceDays] = useState<number[]>([]);
  const [tChild, setTChild] = useState('');
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [exams, setExams] = useState<Array<any>>([]);
  const [examsLoading, setExamsLoading] = useState(true);
  const [eChild, setEChild] = useState('');
  const [eSubject, setESubject] = useState('');
  const [eType, setEType] = useState<'weekly_test' | 'unit_test' | 'midterm' | 'final' | 'practice' | 'other'>('weekly_test');
  const [eMarks, setEMarks] = useState<number | ''>('');
  const [eTotal, setETotal] = useState<number | ''>('');
  const [eDate, setEDate] = useState('');
  const [eSyllabusScope, setESyllabusScope] = useState('');
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

  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'family' | 'tasks' | 'proofs' | 'events' | 'rewards' | 'exams' | 'challenges' | 'automation' | 'communication' | 'settings' | 'planner'
  >('dashboard');
  const plannerTabIds = ['planner', 'family', 'tasks', 'exams', 'challenges', 'events', 'automation', 'proofs', 'rewards'] as const;
  const topLevelActiveTab: 'dashboard' | 'planner' | 'communication' | 'settings' = plannerTabIds.includes(activeTab as (typeof plannerTabIds)[number])
    ? 'planner'
    : (activeTab as 'dashboard' | 'communication' | 'settings');
  const [coParentCode, setCoParentCode] = useState('');
  const [inboxMessage, setInboxMessage] = useState('');
  const [inboxSubject, setInboxSubject] = useState('');
  const [inboxChildId, setInboxChildId] = useState('');
  const [settingsTab, setSettingsTab] = useState<'create_child' | 'edit_child' | 'rewards' | 'growth' | 'coparenting'>('create_child');

  const [chTitle, setChTitle] = useState('');
  const [chChild, setChChild] = useState('');
  const [chTarget, setChTarget] = useState<number | ''>('');
  const [chDesc, setChDesc] = useState('');
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [automationChildId, setAutomationChildId] = useState('');
  const [activityChildId, setActivityChildId] = useState('');
  const [activityName, setActivityName] = useState('');
  const [activityModules, setActivityModules] = useState<PlannerActivityModule[]>(['tasks']);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<PlannerProgram | null>(null);
  const [activityModalTab, setActivityModalTab] = useState<PlannerActivityModule>('tasks');

  const parentTabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'planner', label: 'Planner' },
    { id: 'communication', label: 'Communication' },
    { id: 'settings', label: 'Settings' }
  ] as const;

  const plannerWorkspaceTabs = [
    { id: 'planner', label: 'Main Planner' },
    { id: 'family', label: 'Kid Activities' },
    { id: 'tasks', label: 'Tasks / Duties' },
    { id: 'exams', label: 'Exams / Tests' },
    { id: 'challenges', label: 'Challenges' },
    { id: 'events', label: 'Events' },
    { id: 'automation', label: 'Automation' }
  ] as const;

  const familyId = user?.linked_family_id || user?.id || '';
  const belongsToFamily = (row: any) => {
    if (!row) return false;
    return (
      row.family_id === familyId ||
      row.parent_id === familyId ||
      row.parent_id === user?.id ||
      (row.child_id && children.some((child) => child.id === row.child_id))
    );
  };
  const { messages: inboxMessages, sendMessage } = useMessages(familyId, 'parent');
  const selectedThread = inboxMessages
    .filter((m) => !inboxChildId || m.child_id === inboxChildId)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const { activeChallenges, completedChallenges, createChallenge, incrementScore, deleteChallenge } = useChallenges(familyId);
  const selectedActivityChildId = activityChildId || children[0]?.id || '';
  const { programs: activityPrograms, loading: activityProgramsLoading, refresh: refreshActivityPrograms } = usePlannerPrograms(selectedActivityChildId, false);
  const { timetable: selectedChildTimetable } = usePlannerTimetable(selectedActivityChildId, true);

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
  }, [user, familyId]);

  useEffect(() => {
    if (!user || children.length === 0) {
      return;
    }

    const today = new Date().toISOString().slice(0, 10);

    children.forEach((child) => {
      void (async () => {
        try {
          const profileRef = doc(db, 'child_profile', child.id);
          const existingProfile = await getDoc(profileRef);
          if (existingProfile.exists()) {
            return;
          }

          await setDoc(profileRef, {
            id: child.id,
            user_id: child.id,
            parent_id: familyId,
            family_id: familyId,
            name: child.name || (child.email || '').split('@')[0] || 'Explorer',
            date_of_birth: new Date('2015-01-01').toISOString(),
            height_cm: 120,
            weight_kg: 25,
            streak_count: 0,
            streak_shields: 0,
            consistency_score: 0,
            total_stars: 0,
            is_sick_mode: false,
            last_streak_eval: today
          }, { merge: true });
          console.info('Backfilled missing child_profile for child:', child.id);
        } catch (error) {
          console.warn('Failed to backfill child_profile for child:', child.id, error);
        }
      })();
    });
  }, [user, children, familyId]);

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
      where('parent_id', '==', familyId),
      orderBy('created_at', 'desc'),
      limit(500)
    );
    const unsub = onSnapshot(
      tasksQuery,
      (snap) => {
        const mapped = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }));
        setTasks(mapped);
        setTasksLoading(false);
      },
      (err) => {
        console.error('Failed to fetch tasks:', err);
        setTasksLoading(false);
      }
    );

    return () => unsub();
  }, [user, children, familyId]);

  useEffect(() => {
    if (!user || children.length === 0 || tChild || editTaskId) return;
    const defaultChildId = automationChildId || children[0]?.id || '';
    if (defaultChildId) {
      setTChild(defaultChildId);
    }
  }, [user, children, tChild, editTaskId, automationChildId]);

  const clearTaskForm = () => {
    setTChild('');
    setTTitle('');
    setTDesc('');
    setTPoints('');
    setTDue('');
    setTRecurrenceType('none');
    setTRecurrenceDays([]);
    setEditTaskId(null);
  };

  const startEditTask = (task: any) => {
    setEditTaskId(task.id);
    setTChild(task.child_id || '');
    setTTitle(task.title || '');
    setTDesc(task.description || '');
    setTPoints(task.points ?? task.star_value ?? '');
    setTDue(task.due_date ? new Date(task.due_date).toISOString().slice(0, 10) : '');
    setTRecurrenceType((task.recurrence_type as 'none' | 'daily' | 'weekly') || 'none');
    setTRecurrenceDays(Array.isArray(task.recurrence_days) ? task.recurrence_days : []);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelTaskEdit = () => {
    clearTaskForm();
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || taskLoading) return;
    setError('');
    setSuccess('');
    setInfo('');
    setTaskLoading(true);

    try {
      const selectedChild = children.find((child) => child.id === tChild);
      if (!selectedChild) {
        setError('Select a child before creating the task.');
        return;
      }

      const starValue = Number(tPoints) || 1;
      const taskPayload = {
        title: tTitle,
        description: tDesc,
        points: starValue,
        star_value: starValue,
        category: 'General',
        priority: 'medium',
        energy_level: 'medium',
        difficulty_level: 1,
        requires_proof: false,
        status: 'pending',
        child_id: tChild,
        child_name: selectedChild.name || selectedChild.email || '',
        due_date: tDue ? new Date(tDue).toISOString() : null,
        recurrence_type: tRecurrenceType,
        recurrence_days: tRecurrenceType === 'weekly' ? tRecurrenceDays : [],
        parent_id: familyId,
        family_id: familyId
      };

      if (editTaskId) {
        await withOperationTimeout(
          updateDoc(doc(db, 'tasks', editTaskId), {
            ...taskPayload,
            updated_at: new Date().toISOString()
          }),
          'update-task'
        );
        setSuccess('Task updated.');
      } else {
        await withOperationTimeout(
          addDoc(collection(db, 'tasks'), {
            ...taskPayload,
            created_at: new Date().toISOString()
          }),
          'create-task'
        );
        setSuccess('Task created and assigned to the child.');
      }

      clearTaskForm();
    } catch (err) {
      console.error('Failed to create task:', err);
      setError(String((err as Error)?.message || '').includes('timeout') ? 'Task save is taking too long. Please try again.' : 'Could not create task.');
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

  const handleParentResetChildPassword = async (child: ChildAccount) => {
    try {
      await updateDoc(doc(db, 'users', child.id), {
        password_reset_requested_by_parent_at: new Date().toISOString(),
        password_reset_status: 'requested'
      });

      await addDoc(collection(db, 'messages'), {
        child_id: child.id,
        parent_id: familyId,
        subject: 'Password reset',
        content: 'Your parent initiated a password reset request. Please use the Profile page to update your password after re-login.',
        sender_role: 'parent',
        sender_id: familyId,
        is_read: false,
        timestamp: new Date().toISOString()
      });

      setSuccess(`Password reset request sent for ${child.name || child.email || 'child'}.`);
    } catch (err) {
      console.error('Failed to create child password reset request:', err);
      setError('Could not trigger password reset request.');
    }
  };

  useEffect(() => {
    if (!user) {
      setExams([]);
      setExamsLoading(false);
      return;
    }

    setExamsLoading(true);
    const examsQuery = query(
      collection(db, 'exams'),
      where('family_id', '==', familyId),
      orderBy('exam_date', 'desc'),
      limit(500)
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
  }, [user, familyId]);

  useEffect(() => {
    if (!user) {
      setGrowthLogs([]);
      setGrowthLoading(false);
      return;
    }

    setGrowthLoading(true);
    const gql = query(
      collection(db, 'growth_logs'),
      where('family_id', '==', familyId),
      orderBy('date', 'desc'),
      limit(500)
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
  }, [user, familyId]);

  useEffect(() => {
    if (!user) {
      setEvents([]);
      setEventsLoading(false);
      return;
    }

    setEventsLoading(true);
    const evq = query(collection(db, 'events'), where('family_id', '==', familyId), limit(800));

    const unsub = onSnapshot(
      evq,
      (snap) => {
        const mapped = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter((event) => belongsToFamily(event))
          .sort((a, b) => new Date(b.start_at || b.date || b.created_at || 0).getTime() - new Date(a.start_at || a.date || a.created_at || 0).getTime());
        setEvents(mapped);
        setEventsLoading(false);
      },
      (err) => {
        console.error('Failed to fetch events:', err);
        setEventsLoading(false);
      }
    );

    return () => unsub();
  }, [user, familyId]);

  useEffect(() => {
    if (!user) {
      setRewards([]);
      setRewardsLoading(false);
      return;
    }

    setRewardsLoading(true);
    const rq = query(
      collection(db, 'reward_settings'),
      where('parent_id', '==', familyId),
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
  }, [user, familyId]);

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
  }, [user, familyId, children]);

  useEffect(() => {
    if (!user) {
      setPendingChildTasks([]);
      return;
    }

    const tasksQuery = query(collection(db, 'tasks'), where('parent_id', '==', familyId), limit(100));
    const unsubscribe = onSnapshot(tasksQuery, (snapshot) => {
      const mapped = snapshot.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((item) => item.created_by === 'child' && item.approval_status === 'pending');
      setPendingChildTasks(mapped);
    });

    return () => unsubscribe();
  }, [user, familyId, children]);

  useEffect(() => {
    if (!user) {
      setPendingChildEvents([]);
      return;
    }

    const eventsQuery = query(collection(db, 'events'), where('family_id', '==', familyId), limit(100));
    const unsubscribe = onSnapshot(eventsQuery, (snapshot) => {
      const mapped = snapshot.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((item) => item.created_by === 'child' && item.approval_status === 'pending');
      setPendingChildEvents(mapped);
    });

    return () => unsubscribe();
  }, [user, familyId, children]);

  useEffect(() => {
    if (!user) {
      setPendingAchievements([]);
      return;
    }

    const achievementsQuery = query(collection(db, 'achievements'), where('parent_id', '==', familyId), limit(100));
    const unsubscribe = onSnapshot(achievementsQuery, (snapshot) => {
      const mapped = snapshot.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((item) => item.approval_status === 'pending');
      setPendingAchievements(mapped);
    });

    return () => unsubscribe();
  }, [user, familyId]);

  const formatChildCreationError = (code?: string) => {
    switch (code) {
      case 'auth/email-already-in-use':
      case 'auth/email-exists':
        return 'That username already exists. Use the same password to link it, or choose another username.';
      case 'auth/email-not-found':
      case 'auth/invalid-password':
      case 'auth/invalid-login-credentials':
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
        return 'This username already exists, but the password does not match.';
      case 'auth/weak-password':
        return 'Password must be at least 6 characters.';
      case 'auth/network-request-failed':
        return isUsingFirebaseEmulators
          ? 'Firebase emulators are still starting or temporarily unreachable. Wait a few seconds and retry. If it persists, restart with npm run local.'
          : 'Network error while contacting Firebase. Please try again.';
      case 'auth/operation-not-allowed':
      case 'auth/admin-restricted-operation':
        return 'Firebase Email/Password sign-in is not enabled for this project.';
      default:
        return `Failed to create child account${code ? ` (${code})` : ''}. Please try again.`;
    }
  };

  const withOperationTimeout = async <T,>(promise: Promise<T>, label: string, timeoutMs = 12000): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`${label}-timeout`)), timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId!);
    }
  };

  const resetChildModalForm = () => {
    setIsModaling(false);
    setCUser('');
    setCName('');
    setCPass('');
    setCDob('');
    setCHeight('');
    setCWeight('');
  };

  const handleCreateChild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError('');
    setSuccess('');
    setChildRegistering(true);
    let childUid = '';
    let dummyEmail = '';

    const childProfilePayload = {
      id: '',
      user_id: '',
      parent_id: familyId,
      family_id: familyId,
      name: cName,
      date_of_birth: new Date(cDob).toISOString(),
      height_cm: Number(cHeight),
      weight_kg: Number(cWeight),
      streak_count: 0,
      streak_shields: 0,
      consistency_score: 0,
      total_stars: 0,
      is_sick_mode: false,
      last_streak_eval: new Date().toISOString().slice(0, 10)
    };

    try {
      // Backfill parent profile fields required by Firestore rules in older production accounts.
      await withOperationTimeout(
        setDoc(doc(db, 'users', user.id), {
          id: user.id,
          email: user.email,
          role: 'parent_admin',
          linked_family_id: familyId || user.id,
          updated_at: new Date().toISOString()
        }, { merge: true }),
        'ensure-parent-profile'
      );

      const cleanUser = cUser.trim().toLowerCase().split('@')[0];
      dummyEmail = `${cleanUser}@tiktrack.family`;
      const authResult = await withOperationTimeout(
        createOrReuseChildAccount(dummyEmail, cPass),
        'create-child-auth'
      );
      childUid = authResult.uid;

      if (authResult.wasExisting) {
        const existingUserDoc = await withOperationTimeout(
          getDoc(doc(db, 'users', childUid)),
          'check-existing-child-user-doc'
        );
        const existingUser = existingUserDoc.exists() ? existingUserDoc.data() : null;
        const existingFamilyId = existingUser?.linked_family_id || existingUser?.parent_id;

        if (existingFamilyId !== familyId) {
          throw new Error('child-username-already-used');
        }
      }

      await withOperationTimeout(
        setDoc(doc(db, 'users', childUid), {
          id: childUid,
          email: dummyEmail,
          name: cName,
          role: 'child_user',
          parent_id: familyId,
          linked_family_id: familyId,
          updated_at: new Date().toISOString()
        }, { merge: true }),
        'create-child-user-doc'
      );

      await withOperationTimeout(
        setDoc(doc(db, 'child_profile', childUid), {
          ...childProfilePayload,
          id: childUid,
          user_id: childUid
        }, { merge: true }),
        'create-child-profile-doc'
      );

      resetChildModalForm();
      setSuccess(
        authResult.wasExisting
          ? 'Existing child account is linked to your Family Hub. Previous activity is still attached to this username.'
          : 'Child account is ready and linked to your Family Hub.'
      );
    } catch (err: any) {
      console.error('Child account creation failed:', err);
      const message = String(err?.message || '');
      if (childUid && !message.includes('child-username-already-used')) {
        try {
          const userDocSnap = await getDoc(doc(db, 'users', childUid));
          if (userDocSnap.exists()) {
            setDoc(doc(db, 'child_profile', childUid), {
              ...childProfilePayload,
              id: childUid,
              user_id: childUid
            }, { merge: true }).catch((profileRepairError) => {
              console.warn('Background child profile repair failed:', profileRepairError);
            });

            resetChildModalForm();
            setSuccess('Child account is ready and linked to your Family Hub.');
            return;
          }
        } catch (reconcileError) {
          console.warn('Child registration reconciliation failed:', reconcileError);
        }
      }

      if (message.includes('timeout')) {
        setError('Child registration is taking too long. Please try again in a moment.');
      } else if (message.includes('child-username-already-used')) {
        setError('That child username is already linked to another Family Hub. Choose a different username.');
      } else {
        setError(formatChildCreationError(err?.code));
      }
    } finally {
      setChildRegistering(false);
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
      await updateDoc(doc(db, 'proof_logs', proofId), {
        approval_status: status,
        review_comment: proofReviewComment.trim() || null,
        reviewed_at: new Date().toISOString()
      });

      // Read proof record to identify child and task
      const proofSnap = await getDoc(doc(db, 'proof_logs', proofId));
      const proofData = proofSnap.exists() ? (proofSnap.data() as any) : null;
      const childId = proofData?.child_id;
      const taskId = proofData?.task_id;
      const today = new Date().toISOString().slice(0, 10);
      const logId = childId && taskId ? `${childId}_${taskId}_${today}` : '';

      if (status === 'approved') {
        // Mark task completion only at approval time for proof-based tasks.
        if (childId && taskId) {
          await setDoc(doc(db, 'task_logs', logId), {
            id: logId,
            child_id: childId,
            task_id: taskId,
            date: today,
            status: 'completed'
          }, { merge: true });

          try {
            await updateDoc(doc(db, 'tasks', taskId), {
              status: 'completed',
              completed_at: new Date().toISOString()
            });
          } catch (taskUpdateErr) {
            console.warn('Task update after proof approval skipped:', taskUpdateErr);
          }

          // Determine star value from cached tasks and apply exactly once at approval.
          const task = tasks.find((t: any) => t.id === taskId) as any;
          const starValue = Number(task?.points ?? task?.star_value ?? 0);
          try {
            const profileRef = doc(db, 'child_profile', childId);
            const profileSnap = await getDoc(profileRef);
            const existing = profileSnap.exists() ? (profileSnap.data() as any) : {};
            const { updatedProfile } = applyTaskCompletionToProfile(
              existing || {},
              starValue,
              true,
              today
            );
            await updateDoc(profileRef, {
              total_stars: updatedProfile.total_stars,
              streak_count: updatedProfile.streak_count,
              consistency_score: updatedProfile.consistency_score,
              streak_shields: updatedProfile.streak_shields,
              last_task_date: updatedProfile.last_task_date
            });
          } catch (innerErr) {
            console.error('Failed to update child profile after proof approval:', innerErr);
          }
        }

        setSuccess('Proof approved. Completion and stars are now reflected for the child.');
        if (childId && familyId) {
          await sendMessage(childId, familyId, `Proof approved${proofReviewComment.trim() ? `: ${proofReviewComment.trim()}` : '.'}`, 'parent', familyId, 'Proof review');
        }
      } else {
        if (childId && taskId) {
          await setDoc(doc(db, 'task_logs', logId), {
            id: logId,
            child_id: childId,
            task_id: taskId,
            date: today,
            status: 'failed'
          }, { merge: true });
        }
        setInfo('Proof rejected and removed from the pending queue.');
        if (childId && familyId) {
          await sendMessage(childId, familyId, `Proof rejected${proofReviewComment.trim() ? `: ${proofReviewComment.trim()}` : '. Please retry and upload again.'}`, 'parent', familyId, 'Proof review');
        }
      }
      setProofReviewComment('');
    } catch (err) {
      console.error('Failed to update proof status:', err);
      setError('Could not update proof approval. Please try again.');
    }
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError('');
    setExamLoading(true);

    try {
      const examDateIso = eDate ? new Date(eDate).toISOString() : new Date().toISOString();
      const hasResult = eMarks !== '' && eTotal !== '';
      const datePassed = new Date(examDateIso).getTime() < Date.now();
      const computedStatus: 'scheduled' | 'completed_pending_result' | 'result_published' =
        hasResult ? 'result_published' : (datePassed ? 'completed_pending_result' : 'scheduled');
      const reminderPlan = ['7d', '3d', '1d', 'same_day'];

      const syncExamCountdownReminders = async (examId: string, childId: string | null, examTitle: string, examDate: string, status: string) => {
        if (!childId) return;
        const offsetByPlan: Record<string, number> = { '7d': 7, '3d': 3, '1d': 1, same_day: 0 };
        for (const planItem of reminderPlan) {
          const offset = offsetByPlan[planItem] ?? 0;
          const reminderId = `exam_${examId}_${planItem}`;
          await setDoc(doc(db, 'reminders', reminderId), {
            child_id: childId,
            parent_id: familyId,
            type: 'exam_countdown',
            title: `Exam Reminder: ${examTitle}`,
            message: offset === 0 ? `${examTitle} is today. You can do this!` : `${examTitle} in ${offset} day${offset === 1 ? '' : 's'}. Start preparation.`,
            schedule_time: '07:00',
            is_enabled: status === 'scheduled',
            frequency: 'daily',
            days_of_week: [0, 1, 2, 3, 4, 5, 6],
            linked_exam_id: examId,
            target_date: examDate,
            offset_days: offset,
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString()
          }, { merge: true });
        }
      };

      if (editExamId) {
        await updateDoc(doc(db, 'exams', editExamId), {
          child_id: eChild || null,
          subject: eSubject,
          exam_type: eType,
          marks_scored: hasResult ? Number(eMarks) : null,
          total_marks: hasResult ? Number(eTotal) : null,
          exam_date: examDateIso,
          status: computedStatus,
          syllabus_scope: eSyllabusScope || '',
          result_published_at: hasResult ? new Date().toISOString() : null,
          reminder_plan: reminderPlan,
          updated_at: new Date().toISOString()
        });
        await syncExamCountdownReminders(editExamId, eChild || null, eSubject, examDateIso, computedStatus);
        setSuccess('Exam updated.');
      } else {
        const createdRef = await addDoc(collection(db, 'exams'), {
          child_id: eChild || null,
          subject: eSubject,
          exam_type: eType,
          marks_scored: hasResult ? Number(eMarks) : null,
          total_marks: hasResult ? Number(eTotal) : null,
          exam_date: examDateIso,
          status: computedStatus,
          syllabus_scope: eSyllabusScope || '',
          result_published_at: hasResult ? new Date().toISOString() : null,
          reminder_plan: ['7d', '3d', '1d', 'same_day'],
          parent_id: familyId,
          family_id: familyId,
          created_at: new Date().toISOString()
        });
        await syncExamCountdownReminders(createdRef.id, eChild || null, eSubject, examDateIso, computedStatus);
        setSuccess('Exam result recorded.');
      }

      setEChild('');
      setESubject('');
      setEType('weekly_test');
      setEMarks('');
      setETotal('');
      setEDate('');
      setESyllabusScope('');
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
    setEType((ex.exam_type as 'weekly_test' | 'unit_test' | 'midterm' | 'final' | 'practice' | 'other') || 'weekly_test');
    setEMarks(ex.marks_scored ?? '');
    setETotal(ex.total_marks ?? '');
    setEDate(ex.exam_date ? new Date(ex.exam_date).toISOString().slice(0,10) : '');
    setESyllabusScope(ex.syllabus_scope || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditExamId(null);
    setEChild('');
    setESubject('');
    setEMarks('');
    setETotal('');
    setEDate('');
    setESyllabusScope('');
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
          parent_id: familyId,
          family_id: familyId,
          created_at: new Date().toISOString()
        });
        setSuccess('Growth log saved.');
      }

      if (gChild) {
        await setDoc(doc(db, 'child_profile', gChild), {
          height_cm: gHeight || 0,
          weight_kg: gWeight || 0,
          updated_at: new Date().toISOString()
        }, { merge: true });
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
    if (!user || eventLoading) return;
    setError('');
    setSuccess('');
    setInfo('');
    setEventLoading(true);

    try {
      if (editEventId) {
        await withOperationTimeout(
          updateDoc(doc(db, 'events', editEventId), {
            child_id: evChild || null,
            title: evTitle,
            type: evType,
            date: evDate ? new Date(evDate).toISOString() : new Date().toISOString(),
            reminder_days_before: evReminderDays || 0,
            updated_at: new Date().toISOString()
          }),
          'update-event'
        );
        setSuccess('Event updated.');
      } else {
        await withOperationTimeout(
          addDoc(collection(db, 'events'), {
            child_id: evChild || null,
            title: evTitle,
            type: evType,
            date: evDate ? new Date(evDate).toISOString() : new Date().toISOString(),
            reminder_days_before: evReminderDays || 0,
            parent_id: familyId,
            family_id: familyId,
            created_at: new Date().toISOString()
          }),
          'create-event'
        );
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
      setError(String((err as Error)?.message || '').includes('timeout') ? 'Event save is taking too long. Please try again.' : 'Could not save event.');
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
    const rawDate = ev.start_at || ev.date || ev.created_at;
    setEvDate(rawDate ? new Date(rawDate).toISOString().slice(0,10) : '');
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
        parent_id: familyId,
        family_id: familyId,
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
  const [selectedTrendChild, setSelectedTrendChild] = useState<string>('');
  const [totalTasksCount, setTotalTasksCount] = useState(0);
  const [tasksCompletedCount, setTasksCompletedCount] = useState(0);
  const [avgConsistency, setAvgConsistency] = useState(0);
  const [avgBmi, setAvgBmi] = useState(0);
  const [pendingProofCount, setPendingProofCount] = useState(0);
  const [upcomingEventsCount, setUpcomingEventsCount] = useState(0);
  const [examsCount, setExamsCount] = useState(0);
  const getEventDateValue = (event: any) => event.start_at || event.date || event.created_at || null;
  const calculateBmi = (heightCm?: number, weightKg?: number) => {
    const h = Number(heightCm) || 0;
    const w = Number(weightKg) || 0;
    if (h <= 0 || w <= 0) return null;
    return Number((w / ((h / 100) * (h / 100))).toFixed(1));
  };
  const selectedAutomationChildId = automationChildId || children[0]?.id || '';
  const selectedAutomationProfile = (childProfiles.find((profile) => profile.id === selectedAutomationChildId) || null) as ChildProfile | null;
  const selectedAutomationName = children.find((child) => child.id === selectedAutomationChildId)?.name || 'Child';
  const selectedChildEvents = events.filter((event) => !event.child_id || event.child_id === selectedAutomationChildId) as AppEvent[];
  const selectedChildExams = exams
    .filter((exam) => !exam.child_id || exam.child_id === selectedAutomationChildId)
    .map((exam) => ({
      id: exam.id,
      child_id: exam.child_id || selectedAutomationChildId,
      subject: exam.subject,
      marks_scored: Number(exam.marks_scored) || 0,
      total_marks: Number(exam.total_marks) || 0,
      exam_date: exam.exam_date || exam.date || new Date().toISOString()
    })) as ExamResult[];
  const upcomingExamEvents = selectedChildEvents.filter((event) => {
    const eventDate = getEventDateValue(event);
    const eventKind = event.type || (event as any).category;
    return eventKind === 'exam' && eventDate && new Date(eventDate) >= new Date(new Date().toDateString());
  });
  const {
    routine,
    loading: routineLoading,
    createRoutine,
    updateRoutine
  } = useRoutineConfiguration(familyId, selectedAutomationChildId);
  const {
    scheduledTasks,
    loading: schedulerLoading,
    error: schedulerError,
    generateTodaysTasks,
    generateExamTasks
  } = useTaskScheduler(
    selectedAutomationChildId,
    familyId,
    routine,
    selectedAutomationProfile,
    selectedChildExams,
    selectedChildEvents
  );
  const {
    reminders,
    loading: remindersLoading,
    createReminder,
    updateReminder,
    deleteReminder,
    requestPermission,
    notificationPermission
  } = useReminders(selectedAutomationChildId, familyId);
  const {
    rewards: rewardItems,
    loading: rewardItemsLoading,
    createReward,
    updateReward,
    deleteReward
  } = useRewards(familyId);
  const {
    redemptions,
    loading: redemptionsLoading,
    updateRedemptionStatus
  } = useRedemptions(selectedAutomationChildId, familyId);

  useEffect(() => {
    if (!automationChildId && children[0]?.id) {
      setAutomationChildId(children[0].id);
    }
  }, [automationChildId, children]);

  useEffect(() => {
    if (!activityChildId && children[0]?.id) {
      setActivityChildId(children[0].id);
    }
  }, [activityChildId, children]);

  useEffect(() => {
    if (!user) {
      setChildProfiles([]);
      return;
    }

    const cpq = query(collection(db, 'child_profile'), where('parent_id', '==', familyId));
    const unsub = onSnapshot(
      cpq,
      (snap) => {
        const mapped = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setChildProfiles(mapped);
      },
      (err) => console.error('Failed to fetch child profiles for analytics:', err)
    );

    return () => unsub();
  }, [user, familyId]);

  // Subscribe to completed task logs to compute completed tasks and stars
  useEffect(() => {
    if (!user) {
      setTasksCompletedCount(0);
      setEnrichedChildProfiles(childProfiles);
      return;
    }

    const logQuery = query(
      collection(db, 'task_logs'),
      where('parent_id', '==', familyId),
      where('status', '==', 'completed'),
      limit(500)
    );
    const unsub = onSnapshot(
      logQuery,
      (snap) => {
        const visibleCompleted = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

        setTasksCompletedCount(visibleCompleted.length);

        // map task id -> star/points from tasks list
        const taskMap = new Map<string, number>(tasks.map((t: any) => [t.id, Number(t.points ?? t.star_value ?? 0)]));

        const starsByChild: Record<string, number> = {};
        visibleCompleted.forEach((entry) => {
          const star = Number(taskMap.get(entry.task_id) || 0);
          if (!entry.child_id) return;
          starsByChild[entry.child_id] = (starsByChild[entry.child_id] || 0) + star;
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

        const completedForTrend = selectedTrendChild ? visibleCompleted.filter((entry) => entry.child_id === selectedTrendChild) : visibleCompleted;

        completedForTrend.forEach((entry) => {
          const ts = entry.timestamp || entry.created_at || entry.time || entry.date;
          const pd = ts ? new Date(ts) : new Date();
          const key = pd.toDateString();
          const idx = dayKeys.indexOf(key);
          const star = Number(taskMap.get(entry.task_id) || 0);
          if (idx >= 0) days[idx] += star;
        });

        setWeeklyStarsTrend(days);

      },
      (err) => console.error('Failed to subscribe to completed task logs for analytics:', err)
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
        const eventDate = getEventDateValue(ev);
        return eventDate && new Date(eventDate) >= new Date(today.toDateString());
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
  const getChildName = (childId?: string) => children.find((c) => c.id === childId)?.name || 'Child';
  const latestExams = [...exams]
    .sort((a, b) => new Date(b.exam_date || 0).getTime() - new Date(a.exam_date || 0).getTime())
    .slice(0, 3);
  const upcomingEventsPreview = events
    .filter((ev) => {
      const eventDate = getEventDateValue(ev);
      return eventDate && new Date(eventDate) >= new Date(new Date().toDateString());
    })
    .sort((a, b) => new Date(getEventDateValue(a) || 0).getTime() - new Date(getEventDateValue(b) || 0).getTime())
    .slice(0, 3);
  const latestGrowthLogs = [...growthLogs]
    .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
    .slice(0, 3);

  const saveRoutineConfiguration = async (updates: Parameters<typeof updateRoutine>[0]) => {
    if (!routine?.id) {
      await createRoutine({
        parent_id: familyId,
        child_id: selectedAutomationChildId,
        school_days_routine: updates.school_days_routine || routine?.school_days_routine || [],
        vacation_routine: updates.vacation_routine || routine?.vacation_routine || [],
        academic_mode_start: updates.academic_mode_start || routine?.academic_mode_start || '06-01',
        academic_mode_end: updates.academic_mode_end || routine?.academic_mode_end || '03-31',
        current_mode: updates.current_mode || routine?.current_mode || 'academic'
      });
      setSuccess('Routine created.');
      return;
    }

    await updateRoutine(updates);
    setSuccess('Routine updated.');
  };

  const handleChildSubmissionDecision = async (
    collectionName: 'tasks' | 'events' | 'achievements',
    submissionId: string,
    status: 'approved' | 'rejected'
  ) => {
    try {
      await updateDoc(doc(db, collectionName, submissionId), {
        approval_status: status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id || familyId
      });
      setSuccess(`Submission ${status}.`);
    } catch (err) {
      console.error('Failed to update child submission:', err);
      setError('Could not update child submission.');
    }
  };

  const createReminderForSelectedChild = async (reminder: Omit<Reminder, 'id' | 'created_at' | 'updated_at' | 'next_send_at'>) => {
    await createReminder({
      ...reminder,
      child_id: selectedAutomationChildId,
      parent_id: familyId
    });
    setSuccess('Reminder saved.');
  };

  const seedDefaultReminders = async () => {
    if (!selectedAutomationChildId) return;
    for (const reminder of getDefaultReminders(selectedAutomationChildId, familyId)) {
      await createReminder(reminder);
    }
    setSuccess(`Default reminders added for ${selectedAutomationName}.`);
  };

  const createRewardForFamily = async (reward: Omit<RewardItem, 'id' | 'created_at' | 'updated_at'>) => {
    await createReward({
      ...reward,
      parent_id: familyId
    });
    setSuccess('Reward saved.');
  };

  const seedDefaultRewards = async () => {
    for (const reward of getDefaultRewards(familyId)) {
      await createReward(reward);
    }
    setSuccess('Default reward marketplace added.');
  };

  const automatedTasks = tasks.filter((task) => task.is_generated === true);
  const manualTasks = tasks.filter((task) => task.is_generated !== true);
  const selectedActivityTasks = selectedActivity
    ? tasks.filter((task) => task.child_id === selectedActivity.childId && task.linked_program_id === selectedActivity.id)
    : [];
  const selectedActivityExams = selectedActivity
    ? exams.filter((exam) => exam.child_id === selectedActivity.childId && exam.linked_program_id === selectedActivity.id)
    : [];
  const selectedActivityEvents = selectedActivity
    ? events.filter((event) => event.child_id === selectedActivity.childId && event.linked_program_id === selectedActivity.id)
    : [];

  const mappableTasks = selectedActivity
    ? tasks.filter((task) => task.child_id === selectedActivity.childId && !task.linked_program_id)
    : [];
  const mappableExams = selectedActivity
    ? exams.filter((exam) => exam.child_id === selectedActivity.childId && !exam.linked_program_id)
    : [];

  const visibleExams = (filterChild ? exams.filter((x) => x.child_id === filterChild) : exams);
  const upcomingExamSchedules = visibleExams.filter((ex) => (ex.status || 'scheduled') === 'scheduled');
  const pendingExamResults = visibleExams.filter((ex) => (ex.status || 'scheduled') === 'completed_pending_result');
  const publishedExamResults = visibleExams.filter((ex) => (ex.status || 'scheduled') === 'result_published');

  const linkTaskToActivity = async (taskId: string) => {
    if (!selectedActivity) return;
    await updateDoc(doc(db, 'tasks', taskId), {
      linked_program_id: selectedActivity.id,
      updated_at: new Date().toISOString()
    });
    setSuccess('Task mapped to activity.');
  };

  const linkExamToActivity = async (examId: string) => {
    if (!selectedActivity) return;
    await updateDoc(doc(db, 'exams', examId), {
      linked_program_id: selectedActivity.id,
      updated_at: new Date().toISOString()
    });
    setSuccess('Exam mapped to activity.');
  };

  const clearActivityForm = () => {
    setActivityName('');
    setActivityModules(['tasks']);
    setEditingActivityId(null);
  };

  const toggleActivityModule = (moduleId: PlannerActivityModule) => {
    setActivityModules((prev) => {
      const hasModule = prev.includes(moduleId);
      const next = hasModule ? prev.filter((item) => item !== moduleId) : [...prev, moduleId];
      return next.length ? next : ['tasks'];
    });
  };

  const startEditActivity = (program: PlannerProgram) => {
    setEditingActivityId(program.id);
    setActivityName(program.name || '');
    setActivityModules(program.modules && program.modules.length ? program.modules : ['tasks']);
  };

  const handleSaveActivity = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedActivityChildId || !activityName.trim()) return;
    try {
      await upsertPlannerProgram(
        selectedActivityChildId,
        familyId,
        {
          name: activityName.trim(),
          category: activityName.trim().toLowerCase() === 'school' ? 'school' : 'custom',
          modules: activityModules,
          isDefault: activityName.trim().toLowerCase() === 'school'
        },
        editingActivityId || undefined
      );
      await refreshActivityPrograms();
      clearActivityForm();
      setSuccess('Activity saved.');
    } catch (err) {
      console.error('Failed to save activity:', err);
      setError('Could not save activity.');
    }
  };

  return (
    <div className="min-h-screen px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-[1680px] rounded-[2rem] border bg-[var(--surface)]/95 backdrop-blur-md p-3 sm:p-4 lg:p-5" style={{ borderColor: 'var(--border-main)' }}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[92px_1fr]">
          <aside
            className="rounded-[1.6rem] p-4 text-white"
            style={{ background: 'linear-gradient(165deg, var(--bg-hero-a), var(--bg-hero-b))' }}
          >
            <div className="flex lg:flex-col items-center justify-between gap-3 h-full">
              <div className="flex lg:flex-col items-center gap-3">
                <button className="h-11 w-11 rounded-xl bg-white/18 grid place-items-center hover:bg-white/28 transition" onClick={() => setActiveTab('dashboard')}>
                  <Menu size={20} />
                </button>
                <button className="h-11 w-11 rounded-xl bg-white/25 grid place-items-center">
                  <Home size={20} />
                </button>
                <button className="h-11 w-11 rounded-xl bg-white/18 grid place-items-center hover:bg-white/28 transition relative" onClick={() => setActiveTab('communication')}>
                  <Mail size={18} />
                </button>
                <button className="h-11 w-11 rounded-xl bg-white/18 grid place-items-center hover:bg-white/28 transition" onClick={() => setActiveTab('communication')}>
                  <Phone size={18} />
                </button>
              </div>

              <div className="flex lg:flex-col items-center gap-3">
                <button className="h-11 w-11 rounded-xl bg-white/18 grid place-items-center hover:bg-white/28 transition" onClick={() => setActiveTab('automation')}>
                  <MessageCircle size={18} />
                </button>
                <button className="h-11 w-11 rounded-xl bg-white/18 grid place-items-center hover:bg-white/28 transition" onClick={() => setActiveTab('settings')}>
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

            <div className="mb-4 overflow-x-auto">
              <div className="inline-flex min-w-max gap-2 rounded-full bg-slate-100 p-1 dark:bg-slate-800">
                {parentTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id === 'planner' ? 'planner' : tab.id)}
                    className={clsx(
                      'rounded-full px-4 py-2 text-sm font-semibold transition',
                      topLevelActiveTab === tab.id
                        ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                        : 'text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700'
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {topLevelActiveTab === 'planner' ? (
              <div className="mb-4 overflow-x-auto">
                <div className="inline-flex min-w-max gap-2 rounded-full bg-slate-100 p-1 dark:bg-slate-800">
                  {plannerWorkspaceTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={clsx(
                        'rounded-full px-4 py-2 text-sm font-semibold transition',
                        activeTab === tab.id
                          ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                          : 'text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700'
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {(error || success || info) && (
              <div className="space-y-2 mb-4">
                {error && <div className="rounded-xl px-3 py-2 text-sm font-semibold bg-red-100 text-red-700">{error}</div>}
                {success && <div className="rounded-xl px-3 py-2 text-sm font-semibold bg-emerald-100 text-emerald-700">{success}</div>}
                {info && <div className="rounded-xl px-3 py-2 text-sm font-semibold bg-cyan-100 text-cyan-700">{info}</div>}
              </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 lg:gap-5">
              <div className={activeTab === 'dashboard' ? 'xl:col-span-7 2xl:col-span-8 space-y-4' : 'hidden'}>
                <section className="xl:col-span-7 2xl:col-span-8 space-y-4">
                  {/* Real-time Dashboards for each child */}
                {children.map((child) => (
                  <RealTimeDashboard
                    key={child.id}
                    childId={child.id}
                    childName={child.name || (child.email || '').replace('@tiktrack.family', '')}
                    tasks={tasks.filter((task) => task.child_id === child.id)}
                    challenges={activeChallenges.filter((challenge) => challenge.child_id === child.id)}
                    streakCurrent={(childProfiles.find((profile) => profile.id === child.id) as ChildProfile | undefined)?.streak_count || 0}
                  />
                ))}

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
                </section>
            </div>

                <div className={activeTab === 'planner' ? 'xl:col-span-12' : 'hidden'}>
                  <ParentPlannerV2Page childId={selectedActivityChildId} familyId={familyId} />
                </div>

                <div className="hidden">
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
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>BMI: {calculateBmi(g.height_cm, g.weight_kg) ?? 'N/A'} (kg/m²)</p>
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
	              </div>

                <div className={activeTab === 'events' ? 'xl:col-span-12' : 'hidden'}>
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
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{ev.child_id ? children.find((c) => c.id === ev.child_id)?.name : 'Family'} • {getEventDateValue(ev) ? new Date(getEventDateValue(ev) as string).toLocaleDateString() : '—'}</p>
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
              </div>

                <div className={activeTab === 'rewards' ? 'xl:col-span-12' : 'hidden'}>
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
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" onClick={() => void seedDefaultRewards()} disabled={rewardItemsLoading} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                        Add Default Reward Items
                      </button>
                    </div>
                    <div className="mt-4 space-y-4">
                      <RewardManagement
                        rewards={rewardItems}
                        onCreateReward={createRewardForFamily}
                        onUpdateReward={updateReward}
                        onDeleteReward={deleteReward}
                        loading={rewardItemsLoading}
                      />
                      <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h2 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>Redemption Approvals</h2>
                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Review reward requests for the selected child.</p>
                          </div>
                          <select value={selectedAutomationChildId} onChange={(event) => setAutomationChildId(event.target.value)} className="rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                            <option value="">Select child</option>
                            {children.map((child) => (
                              <option key={child.id} value={child.id}>{child.name || child.email}</option>
                            ))}
                          </select>
                        </div>
                        <RedemptionHistory redemptions={redemptions} onUpdateStatus={updateRedemptionStatus} loading={redemptionsLoading} />
                      </div>
                    </div>
	                  </div>
	                </div>
              </div>

                <div className={activeTab === 'tasks' ? 'xl:col-span-12' : 'hidden'}>
                  <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>Manage Tasks</h2>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                        {tasks.length}
                      </span>
                      <span className="px-2 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
                        Auto: {automatedTasks.length}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <form onSubmit={handleCreateTask} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <select required value={tChild} onChange={(e) => setTChild(e.target.value)} className="col-span-1 sm:col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                        <option value="">-- Child --</option>
                        {children.map((c) => (<option key={c.id} value={c.id}>{c.name || c.email}</option>))}
                      </select>
                      <input required value={tTitle} onChange={(e) => setTTitle(e.target.value)} placeholder="Task title" className="col-span-1 sm:col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                      <input value={tPoints as any} onChange={(e) => setTPoints(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Points" type="number" className="col-span-1 sm:col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                      <input value={tDue} onChange={(e) => setTDue(e.target.value)} type="date" className="col-span-1 sm:col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                      <select value={tRecurrenceType} onChange={(e) => setTRecurrenceType(e.target.value as 'none' | 'daily' | 'weekly')} className="col-span-1 sm:col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                        <option value="none">One-time</option>
                        <option value="daily">Daily quest</option>
                        <option value="weekly">Weekly quest</option>
                      </select>
                      {tRecurrenceType === 'weekly' ? (
                        <div className="col-span-1 sm:col-span-2 flex flex-wrap gap-2 rounded-xl py-2 px-2 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, dayIndex) => (
                            <button
                              key={day}
                              type="button"
                              onClick={() => setTRecurrenceDays((prev) => prev.includes(dayIndex) ? prev.filter((x) => x !== dayIndex) : [...prev, dayIndex])}
                              className={clsx('px-2 py-1 rounded-lg text-xs font-semibold border', tRecurrenceDays.includes(dayIndex) ? 'bg-cyan-100 text-cyan-700 border-cyan-300' : 'bg-white text-slate-600 border-slate-200')}
                            >
                              {day}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      <input value={tDesc} onChange={(e) => setTDesc(e.target.value)} placeholder="Short description" className="col-span-1 sm:col-span-3 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                      <div className="col-span-1 sm:col-span-3 flex gap-2">
                        <button disabled={taskLoading} type="submit" className="py-2 px-4 rounded-xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' }}>{taskLoading ? 'Saving...' : (editTaskId ? 'Save Changes' : '+ Create Task')}</button>
                        <button type="button" onClick={editTaskId ? cancelTaskEdit : clearTaskForm} className="py-2 px-4 rounded-xl text-sm font-semibold border" style={{ borderColor: 'var(--border-main)' }}>{editTaskId ? 'Cancel Edit' : 'Clear'}</button>
                      </div>
                    </form>

                    <div className="space-y-4">
                      {tasksLoading ? (
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading tasks...</p>
                      ) : tasks.length === 0 ? (
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No tasks yet. Create one above.</p>
                      ) : (
                        <>
                          <div>
                            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                              Automated Tasks
                            </h3>
                            {automatedTasks.length === 0 ? (
                              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No automated tasks yet.</p>
                            ) : (
                              <div className="space-y-2">
                                {automatedTasks.map((t) => (
                                  <div key={t.id} className="rounded-xl p-3 border flex items-center justify-between" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                                    <div>
                                      <p className="font-semibold" style={{ color: 'var(--text-main)' }}>{t.title}</p>
                                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t.description}</p>
                                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{getChildName(t.child_id)} • {t.points ?? t.star_value} pts • {t.due_date ? new Date(t.due_date).toLocaleDateString() : 'no due date'}</p>
                                    </div>
                                    <div className="flex gap-2">
                                      <button onClick={() => startEditTask(t)} className="py-1.5 px-3 rounded-lg text-sm font-semibold bg-amber-100 text-amber-700">Edit</button>
                                      <button onClick={() => handleDeleteTask(t.id)} className="py-1.5 px-3 rounded-lg text-sm font-semibold bg-rose-100 text-rose-700">Delete</button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div>
                            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                              Manual Tasks
                            </h3>
                            {manualTasks.length === 0 ? (
                              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No manual tasks yet.</p>
                            ) : (
                              <div className="space-y-2">
                                {manualTasks.map((t) => (
                                  <div key={t.id} className="rounded-xl p-3 border flex items-center justify-between" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                                    <div>
                                      <p className="font-semibold" style={{ color: 'var(--text-main)' }}>{t.title}</p>
                                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t.description}</p>
                                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{getChildName(t.child_id)} • {t.points ?? t.star_value} pts • {t.due_date ? new Date(t.due_date).toLocaleDateString() : 'no due date'}</p>
                                    </div>
                                    <div className="flex gap-2">
                                      <button onClick={() => startEditTask(t)} className="py-1.5 px-3 rounded-lg text-sm font-semibold bg-amber-100 text-amber-700">Edit</button>
                                      <button onClick={() => handleDeleteTask(t.id)} className="py-1.5 px-3 rounded-lg text-sm font-semibold bg-rose-100 text-rose-700">Delete</button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

                <div className={activeTab === 'automation' ? 'xl:col-span-12 space-y-4' : 'hidden'}>
                  <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>Automation Center</h2>
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Routine, smart task generation, and reminders for one selected child.</p>
                      </div>
                      <select value={selectedAutomationChildId} onChange={(event) => setAutomationChildId(event.target.value)} className="rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                        <option value="">Select child</option>
                        {children.map((child) => (
                          <option key={child.id} value={child.id}>{child.name || child.email}</option>
                        ))}
                      </select>
                    </div>
                    {schedulerError && <div className="mt-3 rounded-xl bg-rose-100 px-3 py-2 text-sm font-semibold text-rose-700">{schedulerError}</div>}
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                        <p className="text-xs font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Selected Child</p>
                        <p className="mt-1 font-bold" style={{ color: 'var(--text-main)' }}>{selectedAutomationChildId ? selectedAutomationName : 'None'}</p>
                      </div>
                      <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                        <p className="text-xs font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Generated Tasks</p>
                        <p className="mt-1 font-bold" style={{ color: 'var(--text-main)' }}>{scheduledTasks.length}</p>
                      </div>
                      <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                        <p className="text-xs font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Notifications</p>
                        <button type="button" onClick={() => void requestPermission()} className="mt-1 text-sm font-bold text-cyan-600">
                          {notificationPermission === 'granted' ? 'Enabled' : 'Enable browser alerts'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <RoutineConfigurationUI routine={routine} onUpdate={saveRoutineConfiguration} loading={routineLoading} />
                  <TaskSchedulerUI
                    routine={routine}
                    upcomingExams={upcomingExamEvents}
                    onGenerateTodaysTasks={generateTodaysTasks}
                    onGenerateExamTasks={generateExamTasks}
                    onOpenTasks={() => setActiveTab('tasks')}
                    loading={schedulerLoading}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => void seedDefaultReminders()} disabled={!selectedAutomationChildId || remindersLoading} className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                      Add Default Reminders
                    </button>
                  </div>
                  <ReminderManagement
                    reminders={reminders}
                    onCreate={createReminderForSelectedChild}
                    onUpdate={updateReminder}
                    onDelete={deleteReminder}
                    loading={remindersLoading}
                  />
                </div>

                <div className={activeTab === 'proofs' ? 'xl:col-span-12' : 'hidden'}>
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
                  <div className="mt-3">
                    <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Review comment (optional)</label>
                    <input
                      value={proofReviewComment}
                      onChange={(event) => setProofReviewComment(event.target.value)}
                      placeholder="Share a quick note for the child..."
                      className="mt-1 w-full rounded-xl py-2 px-3 border text-sm"
                      style={{ borderColor: 'var(--border-main)', background: 'var(--surface)', color: 'var(--text-main)' }}
                    />
                  </div>

                  <div className="mt-5 rounded-2xl border p-4" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-base font-bold" style={{ color: 'var(--text-main)' }}>Child Submission Approvals</h3>
                      <span className="px-2 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-700">
                        {pendingChildTasks.length + pendingChildEvents.length + pendingAchievements.length} pending
                      </span>
                    </div>

                    <div className="space-y-3">
                      {pendingChildTasks.map((item) => (
                        <div key={`task-${item.id}`} className="rounded-xl border p-3 flex items-center justify-between" style={{ borderColor: 'var(--border-main)', background: 'var(--surface)' }}>
                          <div>
                            <p className="font-semibold" style={{ color: 'var(--text-main)' }}>Task: {item.title}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{children.find((child) => child.id === item.child_id)?.name || 'Child'} • {item.date ? new Date(item.date).toLocaleDateString() : 'No date'}</p>
                          </div>
                          <div className="flex gap-2">
                            <button className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-emerald-100 text-emerald-700" onClick={() => void handleChildSubmissionDecision('tasks', item.id, 'approved')}>Approve</button>
                            <button className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-rose-100 text-rose-700" onClick={() => void handleChildSubmissionDecision('tasks', item.id, 'rejected')}>Reject</button>
                          </div>
                        </div>
                      ))}

                      {pendingChildEvents.map((item) => (
                        <div key={`event-${item.id}`} className="rounded-xl border p-3 flex items-center justify-between" style={{ borderColor: 'var(--border-main)', background: 'var(--surface)' }}>
                          <div>
                            <p className="font-semibold" style={{ color: 'var(--text-main)' }}>Timetable: {item.title}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.type || 'event'} • {children.find((child) => child.id === item.child_id)?.name || 'Child'} • {item.date ? new Date(item.date).toLocaleDateString() : 'No date'}</p>
                          </div>
                          <div className="flex gap-2">
                            <button className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-emerald-100 text-emerald-700" onClick={() => void handleChildSubmissionDecision('events', item.id, 'approved')}>Approve</button>
                            <button className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-rose-100 text-rose-700" onClick={() => void handleChildSubmissionDecision('events', item.id, 'rejected')}>Reject</button>
                          </div>
                        </div>
                      ))}

                      {pendingAchievements.map((item) => (
                        <div key={`achievement-${item.id}`} className="rounded-xl border p-3 flex items-center justify-between" style={{ borderColor: 'var(--border-main)', background: 'var(--surface)' }}>
                          <div>
                            <p className="font-semibold" style={{ color: 'var(--text-main)' }}>Achievement: {item.title}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{children.find((child) => child.id === item.child_id)?.name || 'Child'} • {item.date ? new Date(item.date).toLocaleDateString() : 'No date'}</p>
                            {item.description ? <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{item.description}</p> : null}
                          </div>
                          <div className="flex gap-2">
                            <button className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-emerald-100 text-emerald-700" onClick={() => void handleChildSubmissionDecision('achievements', item.id, 'approved')}>Approve</button>
                            <button className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-rose-100 text-rose-700" onClick={() => void handleChildSubmissionDecision('achievements', item.id, 'rejected')}>Reject</button>
                          </div>
                        </div>
                      ))}

                      {pendingChildTasks.length === 0 && pendingChildEvents.length === 0 && pendingAchievements.length === 0 ? (
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No child-created submissions waiting for review.</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              <section className={clsx(
                'space-y-4',
                activeTab === 'dashboard' && 'xl:col-span-5 2xl:col-span-4',
                ['family', 'exams', 'challenges', 'communication', 'settings'].includes(activeTab) && 'xl:col-span-12',
                !['dashboard', 'family', 'exams', 'challenges', 'communication', 'settings'].includes(activeTab) && 'hidden'
              )}>
                {activeTab === 'dashboard' && (
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
                )}

                {activeTab === 'dashboard' && (
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
                )}

                {activeTab === 'dashboard' && (
                  <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                    <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-main)' }}>Family Snapshot</h2>
                    <div className="space-y-3">
                      <div className="rounded-2xl border p-3" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <p className="font-semibold" style={{ color: 'var(--text-main)' }}>Recent Exams</p>
                          <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>{examsCount}</span>
                        </div>
                        {latestExams.length === 0 ? (
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No exam results recorded yet.</p>
                        ) : latestExams.map((ex) => (
                          <div key={ex.id} className="py-2 border-t first:border-t-0" style={{ borderColor: 'var(--border-main)' }}>
                            <p className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>{ex.subject} • {getChildName(ex.child_id)}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{ex.marks_scored}/{ex.total_marks} • {ex.exam_date ? new Date(ex.exam_date).toLocaleDateString() : 'No date'}</p>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-2xl border p-3" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <p className="font-semibold" style={{ color: 'var(--text-main)' }}>Active Challenges</p>
                          <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>{activeChallenges.length}</span>
                        </div>
                        {activeChallenges.length === 0 ? (
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{completedChallenges.length > 0 ? `${completedChallenges.length} completed challenge${completedChallenges.length === 1 ? '' : 's'}.` : 'No active challenges.'}</p>
                        ) : activeChallenges.slice(0, 3).map((ch) => (
                          <div key={ch.id} className="py-2 border-t first:border-t-0" style={{ borderColor: 'var(--border-main)' }}>
                            <p className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>{ch.title}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Parent {ch.parent_score} vs Child {ch.child_score} • Target {ch.target_score}</p>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-2xl border p-3" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <p className="font-semibold" style={{ color: 'var(--text-main)' }}>Upcoming Events</p>
                          <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>{upcomingEventsCount}</span>
                        </div>
                        {upcomingEventsPreview.length === 0 ? (
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No upcoming events.</p>
                        ) : upcomingEventsPreview.map((ev) => (
                          <div key={ev.id} className="py-2 border-t first:border-t-0" style={{ borderColor: 'var(--border-main)' }}>
                            <p className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>{ev.title}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{ev.child_id ? getChildName(ev.child_id) : 'Family'} • {getEventDateValue(ev) ? new Date(getEventDateValue(ev) as string).toLocaleDateString() : 'No date'}</p>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-2xl border p-3" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <p className="font-semibold" style={{ color: 'var(--text-main)' }}>Growth Updates</p>
                          <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>{growthLogs.length}</span>
                        </div>
                        {latestGrowthLogs.length === 0 ? (
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No growth logs yet.</p>
                        ) : latestGrowthLogs.map((g) => (
                          <div key={g.id} className="py-2 border-t first:border-t-0" style={{ borderColor: 'var(--border-main)' }}>
                            <p className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>{getChildName(g.child_id)}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{g.height_cm} cm • {g.weight_kg} kg • {g.date ? new Date(g.date).toLocaleDateString() : 'No date'}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'exams' && (
                  <>
                    <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
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
                        <form onSubmit={handleCreateExam} className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          <select value={eChild} onChange={(ev) => setEChild(ev.target.value)} className="rounded-xl py-2 px-3 border min-w-0" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                            <option value="">-- Child --</option>
                            {children.map((c) => (<option key={c.id} value={c.id}>{c.name || c.email}</option>))}
                          </select>
                          <input required value={eSubject} onChange={(ev) => setESubject(ev.target.value)} placeholder="Subject" className="rounded-xl py-2 px-3 border min-w-0" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                          <select value={eType} onChange={(ev) => setEType(ev.target.value as 'weekly_test' | 'unit_test' | 'midterm' | 'final' | 'practice' | 'other')} className="rounded-xl py-2 px-3 border min-w-0" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                            <option value="weekly_test">Weekly Test</option>
                            <option value="unit_test">Unit Test</option>
                            <option value="midterm">Midterm</option>
                            <option value="final">Final</option>
                            <option value="practice">Practice</option>
                            <option value="other">Other</option>
                          </select>
                          <input required value={eDate} onChange={(ev) => setEDate(ev.target.value)} type="date" className="rounded-xl py-2 px-3 border min-w-0" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                          <input value={eSyllabusScope} onChange={(ev) => setESyllabusScope(ev.target.value)} placeholder="Syllabus scope (optional)" className="rounded-xl py-2 px-3 border min-w-0" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                          <input value={eMarks as any} onChange={(ev) => setEMarks(ev.target.value === '' ? '' : Number(ev.target.value))} placeholder="Marks scored (add later)" type="number" className="rounded-xl py-2 px-3 border min-w-0" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                          <input value={eTotal as any} onChange={(ev) => setETotal(ev.target.value === '' ? '' : Number(ev.target.value))} placeholder="Total marks (add later)" type="number" className="rounded-xl py-2 px-3 border min-w-0" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                          <div className="md:col-span-2 flex flex-wrap gap-2">
                            <button disabled={examLoading} type="submit" className="py-2 px-4 rounded-xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' }}>{examLoading ? 'Saving...' : (editExamId ? 'Save Changes' : '+ Save Exam Schedule / Result')}</button>
                            {editExamId ? (
                              <button type="button" onClick={cancelEdit} className="py-2 px-4 rounded-xl text-sm font-semibold border" style={{ borderColor: 'var(--border-main)' }}>Cancel</button>
                            ) : (
                              <button type="button" onClick={() => { setEChild(''); setESubject(''); setEMarks(''); setETotal(''); setEDate(''); setESyllabusScope(''); }} className="py-2 px-4 rounded-xl text-sm font-semibold border" style={{ borderColor: 'var(--border-main)' }}>Clear</button>
                            )}
                          </div>
                        </form>

                        <div>
                          {examsLoading ? (
                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading exams...</p>
                          ) : visibleExams.length === 0 ? (
                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No exam results recorded yet.</p>
                          ) : (
                            <div className="space-y-4">
                              <div>
                                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-cyan-600">Upcoming Exams</p>
                                <div className="space-y-2">
                                  {upcomingExamSchedules.length === 0 ? <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No upcoming exams.</p> : null}
                                  {upcomingExamSchedules.map((ex) => (
                                    <div key={ex.id} className="rounded-xl p-3 border flex items-center justify-between" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                                      <div>
                                        <p className="font-semibold" style={{ color: 'var(--text-main)' }}>{ex.subject} • {getChildName(ex.child_id)}</p>
                                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{(ex.exam_type || 'exam').replace('_', ' ')} • {ex.exam_date ? new Date(ex.exam_date).toLocaleDateString() : 'No date'}</p>
                                      </div>
                                      <div className="flex gap-2">
                                        <button onClick={() => startEditExam(ex)} className="py-1.5 px-3 rounded-lg text-sm font-semibold bg-amber-100 text-amber-700">Edit</button>
                                        <button onClick={() => handleDeleteExam(ex.id)} className="py-1.5 px-3 rounded-lg text-sm font-semibold bg-rose-100 text-rose-700">Delete</button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-600">Pending Results</p>
                                <div className="space-y-2">
                                  {pendingExamResults.length === 0 ? <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No pending results.</p> : null}
                                  {pendingExamResults.map((ex) => (
                                    <div key={ex.id} className="rounded-xl p-3 border flex items-center justify-between" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                                      <div>
                                        <p className="font-semibold" style={{ color: 'var(--text-main)' }}>{ex.subject} • {getChildName(ex.child_id)}</p>
                                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{(ex.exam_type || 'exam').replace('_', ' ')} • Exam done, add marks now.</p>
                                      </div>
                                      <button onClick={() => startEditExam(ex)} className="py-1.5 px-3 rounded-lg text-sm font-semibold bg-cyan-100 text-cyan-800">Add Marks</button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-emerald-600">Published Results</p>
                                <div className="space-y-2">
                                  {publishedExamResults.length === 0 ? <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No published results yet.</p> : null}
                                  {publishedExamResults.map((ex) => (
                                    <div key={ex.id} className="rounded-xl p-3 border flex items-center justify-between" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                                      <div>
                                        <p className="font-semibold" style={{ color: 'var(--text-main)' }}>{ex.subject} • {getChildName(ex.child_id)}</p>
                                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{ex.marks_scored ?? '-'} / {ex.total_marks ?? '-'} • {(ex.exam_type || 'exam').replace('_', ' ')} • {ex.exam_date ? new Date(ex.exam_date).toLocaleDateString() : 'No date'}</p>
                                      </div>
                                      <div className="flex gap-2">
                                        <button onClick={() => startEditExam(ex)} className="py-1.5 px-3 rounded-lg text-sm font-semibold bg-amber-100 text-amber-700">Edit</button>
                                        <button onClick={() => handleDeleteExam(ex.id)} className="py-1.5 px-3 rounded-lg text-sm font-semibold bg-rose-100 text-rose-700">Delete</button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <GrowthChart logs={filterChild ? growthLogs.filter((x) => x.child_id === filterChild) : growthLogs} isDark={theme === 'dark'} />
                      <AcademicHeatmap exams={filterChild ? exams.filter((x) => x.child_id === filterChild) : exams} isDark={theme === 'dark'} />
                    </div>
                  </>
                )}

                {activeTab === 'family' && (
                  <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>Kid Activities</h2>
                      <select value={selectedActivityChildId} onChange={(e) => setActivityChildId(e.target.value)} className="rounded-xl py-2 px-3 border text-sm" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                        <option value="">Select child</option>
                        {children.map((c) => (<option key={c.id} value={c.id}>{c.name || c.email}</option>))}
                      </select>
                    </div>
                    <p className="mb-3 text-sm" style={{ color: 'var(--text-muted)' }}>Create root activities (School, Extra Curricular, etc.) and choose which branches appear on the child side.</p>
                    <form onSubmit={handleSaveActivity} className="grid grid-cols-1 gap-2 rounded-2xl border p-3 sm:grid-cols-3" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                      <input required value={activityName} onChange={(e) => setActivityName(e.target.value)} placeholder="Activity name" className="rounded-xl py-2 px-3 border sm:col-span-1" style={{ borderColor: 'var(--border-main)', background: 'var(--surface)', color: 'var(--text-main)' }} />
                      <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
                        {(['tasks', 'exams', 'timetable', 'challenges', 'events'] as PlannerActivityModule[]).map((moduleId) => (
                          <button key={moduleId} type="button" onClick={() => toggleActivityModule(moduleId)} className={clsx('rounded-full px-3 py-1.5 text-xs font-semibold border', activityModules.includes(moduleId) ? 'bg-cyan-100 text-cyan-800 border-cyan-300' : 'bg-white text-slate-600 border-slate-200')}>
                            {moduleId}
                          </button>
                        ))}
                      </div>
                      <div className="sm:col-span-3 flex gap-2">
                        <button type="submit" className="py-2 px-4 rounded-xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' }}>{editingActivityId ? 'Save Activity' : '+ Add Activity'}</button>
                        <button type="button" onClick={clearActivityForm} className="py-2 px-4 rounded-xl text-sm font-semibold border" style={{ borderColor: 'var(--border-main)' }}>Clear</button>
                      </div>
                    </form>
                    <div className="mt-4 space-y-2">
                      {activityProgramsLoading ? (
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading activities...</p>
                      ) : activityPrograms.length === 0 ? (
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No activities yet for this child.</p>
                      ) : (
                        activityPrograms.map((program) => (
                          <div key={program.id} className="rounded-2xl border p-4 flex items-center justify-between" style={{ borderColor: 'var(--border-main)', background: 'linear-gradient(135deg, rgba(79,70,229,0.12), rgba(6,182,212,0.1))' }}>
                            <div>
                              <p className="font-semibold" style={{ color: 'var(--text-main)' }}>{program.name}</p>
                              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{children.find((child) => child.id === program.childId)?.name || 'Child'} • Modules: {(program.modules || ['tasks']).join(', ')}</p>
                            </div>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => { setSelectedActivity(program); setActivityModalTab((program.modules?.[0] || 'tasks') as PlannerActivityModule); }} className="py-1.5 px-3 rounded-lg text-sm font-semibold bg-cyan-100 text-cyan-800">Open</button>
                              <button type="button" onClick={() => startEditActivity(program)} className="py-1.5 px-3 rounded-lg text-sm font-semibold bg-amber-100 text-amber-700">Edit</button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'communication' && (
                  <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                    <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-main)' }}>Family Chat</h2>
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      if (!inboxChildId || !inboxMessage.trim() || !user) return;
                      await sendMessage(inboxChildId, familyId, inboxMessage.trim(), 'parent', familyId, inboxSubject);
                      setInboxMessage('');
                      setInboxSubject('');
                      setSuccess('Message sent successfully!');
                      setTimeout(() => setSuccess(''), 3000);
                    }} className="space-y-4">
                      <select required value={inboxChildId} onChange={(e) => setInboxChildId(e.target.value)} className="w-full rounded-xl py-3 px-4 border focus:outline-none" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                        <option value="">Select Child...</option>
                        {children.map(c => <option key={c.id} value={c.id}>{c.name || c.email}</option>)}
                      </select>
                      <input
                        value={inboxSubject}
                        onChange={(e) => setInboxSubject(e.target.value)}
                        placeholder="Subject (optional)"
                        className="w-full rounded-xl py-3 px-4 border focus:outline-none"
                        style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}
                      />
                      <div className="rounded-xl border p-3 h-64 overflow-y-auto" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                        {inboxChildId && selectedThread.length === 0 ? (
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No messages yet with this child.</p>
                        ) : null}
                        {!inboxChildId ? (
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Select a child to view conversation.</p>
                        ) : null}
                        {selectedThread.map((msg) => {
                          const isParentSender = (msg.sender_role || 'parent') === 'parent';
                          return (
                            <div key={msg.id} className={`mb-2 flex ${isParentSender ? 'justify-end' : 'justify-start'}`}>
                              <div
                                className={`max-w-[80%] rounded-2xl px-3 py-2 ${isParentSender ? 'bg-sky-500 text-white' : ''}`}
                                style={isParentSender ? {} : { background: 'var(--surface)', color: 'var(--text-main)', border: '1px solid var(--border-main)' }}
                              >
                                {msg.subject ? <p className="text-[11px] font-bold uppercase tracking-wide opacity-80 mb-1">{msg.subject}</p> : null}
                                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                <p className={`text-[10px] mt-1 ${isParentSender ? 'text-white/80' : ''}`} style={isParentSender ? {} : { color: 'var(--text-muted)' }}>
                                  {new Date(msg.timestamp).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <textarea
                        required
                        value={inboxMessage}
                        onChange={(e) => setInboxMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="w-full rounded-xl py-3 px-4 border focus:outline-none min-h-[100px]"
                        style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}
                      />
                      <button type="submit" className="w-full py-3 rounded-xl text-sm font-bold text-white bg-sky-500 hover:bg-sky-600 transition">
                        Send
                      </button>
                    </form>
                  </div>
                )}

                {activeTab === 'settings' && (
                  <div className="space-y-4">
                    <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                      <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-main)' }}>Settings</h2>
                      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                        <button onClick={() => setSettingsTab('create_child')} className="w-full py-2 rounded-xl text-sm font-bold border" style={{ borderColor: 'var(--border-main)', color: settingsTab === 'create_child' ? 'white' : 'var(--text-main)', background: settingsTab === 'create_child' ? 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' : 'var(--surface-soft)' }}>
                          Create Child
                        </button>
                        <button onClick={() => setSettingsTab('edit_child')} className="w-full py-2 rounded-xl text-sm font-bold border" style={{ borderColor: 'var(--border-main)', color: settingsTab === 'edit_child' ? 'white' : 'var(--text-main)', background: settingsTab === 'edit_child' ? 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' : 'var(--surface-soft)' }}>
                          Edit Child
                        </button>
                        <button onClick={() => setSettingsTab('rewards')} className="w-full py-2 rounded-xl text-sm font-bold border" style={{ borderColor: 'var(--border-main)', color: settingsTab === 'rewards' ? 'white' : 'var(--text-main)', background: settingsTab === 'rewards' ? 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' : 'var(--surface-soft)' }}>
                          Rewards
                        </button>
                        <button onClick={() => setSettingsTab('growth')} className="w-full py-2 rounded-xl text-sm font-bold border" style={{ borderColor: 'var(--border-main)', color: settingsTab === 'growth' ? 'white' : 'var(--text-main)', background: settingsTab === 'growth' ? 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' : 'var(--surface-soft)' }}>
                          Growth
                        </button>
                        <button onClick={() => setSettingsTab('coparenting')} className="w-full py-2 rounded-xl text-sm font-bold border" style={{ borderColor: 'var(--border-main)', color: settingsTab === 'coparenting' ? 'white' : 'var(--text-main)', background: settingsTab === 'coparenting' ? 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' : 'var(--surface-soft)' }}>
                          Co-Parenting
                        </button>
                      </div>
                    </div>

                    {settingsTab === 'create_child' && (
                      <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                        <h3 className="text-base font-bold mb-3" style={{ color: 'var(--text-main)' }}>Create Child Account</h3>
                        <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>Create a child profile under your family account.</p>
                        <button onClick={() => setIsModaling(true)} className="py-2 px-4 rounded-xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' }}>
                          + Create Child (Family)
                        </button>
                      </div>
                    )}

                    {settingsTab === 'edit_child' && (
                      <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                        <h3 className="text-base font-bold mb-3 inline-flex items-center gap-2" style={{ color: 'var(--text-main)' }}>
                          <Users2 size={18} /> Child Profiles
                        </h3>
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
                                    {meta ? <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Level {meta.levelInfo?.level} • {meta.computedTotalStars}★</p> : null}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => void handleParentResetChildPassword(child)}
                                      className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white"
                                    >
                                      Reset Password
                                    </button>
                                    <Circle size={14} className="text-emerald-500 fill-current" />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {settingsTab === 'rewards' && (
                      <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-base font-bold" style={{ color: 'var(--text-main)' }}>Rewards Configuration</h3>
                          <span className="px-2 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">{rewards.length}</span>
                        </div>
                        <div className="space-y-4">
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
                          <RewardManagement rewards={rewardItems} onCreateReward={createRewardForFamily} onUpdateReward={updateReward} onDeleteReward={deleteReward} loading={rewardItemsLoading} />
                        </div>
                      </div>
                    )}

                    {settingsTab === 'growth' && (
                      <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-base font-bold" style={{ color: 'var(--text-main)' }}>Growth & Health</h3>
                          <span className="px-2 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">{growthLogs.length}</span>
                        </div>
                        <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                          BMI formula: weight (kg) / (height (m) × height (m)). Height and weight come from each growth log entry.
                        </p>
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
                                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>BMI: {calculateBmi(g.height_cm, g.weight_kg) ?? 'N/A'} (kg/m²)</p>
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
                    )}

                    {settingsTab === 'coparenting' && (
                      <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                        <h3 className="text-base font-bold mb-3" style={{ color: 'var(--text-main)' }}>Co-Parenting</h3>
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
                          }} className="p-4 rounded-xl border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
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
                    )}
                  </div>
                )}

                {activeTab === 'challenges' && (
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
                            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Winner: {ch.winner === 'parent' ? 'Parent' : ch.winner === 'child' ? 'Child' : 'Draw'} • {ch.parent_score} vs {ch.child_score}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {activeChallenges.length === 0 && completedChallenges.length === 0 && (
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No challenges yet. Create one above!</p>
                    )}
                  </div>
                )}
              </section>
            </div>
          </main>
        </div>
      </div>

      {selectedActivity ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-4xl rounded-3xl border bg-[var(--surface)] p-5 shadow-2xl" style={{ borderColor: 'var(--border-main)' }}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-cyan-400">Activity</p>
                <h3 className="text-xl font-bold" style={{ color: 'var(--text-main)' }}>{selectedActivity.name}</h3>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{children.find((child) => child.id === selectedActivity.childId)?.name || 'Child'}</p>
              </div>
              <button type="button" onClick={() => setSelectedActivity(null)} className="rounded-lg border px-3 py-1 text-sm font-semibold" style={{ borderColor: 'var(--border-main)', color: 'var(--text-main)' }}>Close</button>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              {(selectedActivity.modules || ['tasks']).map((moduleId) => (
                <button key={moduleId} type="button" onClick={() => setActivityModalTab(moduleId)} className={clsx('rounded-full border px-3 py-1.5 text-xs font-semibold', activityModalTab === moduleId ? 'bg-cyan-100 text-cyan-800 border-cyan-300' : 'bg-white text-slate-600 border-slate-200')}>
                  {moduleId}
                </button>
              ))}
            </div>

            {activityModalTab === 'tasks' ? (
              <div className="space-y-3">
                <p className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>Mapped Tasks</p>
                {selectedActivityTasks.length === 0 ? <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No mapped tasks yet.</p> : null}
                {selectedActivityTasks.map((task) => (
                  <div key={task.id} className="rounded-xl border p-3" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                    <p className="font-semibold" style={{ color: 'var(--text-main)' }}>{task.title}</p>
                  </div>
                ))}
                <p className="pt-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Map Existing Tasks</p>
                {mappableTasks.map((task) => (
                  <div key={task.id} className="rounded-xl border p-3 flex items-center justify-between" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                    <p className="text-sm" style={{ color: 'var(--text-main)' }}>{task.title}</p>
                    <button type="button" onClick={() => void linkTaskToActivity(task.id)} className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-white">Map</button>
                  </div>
                ))}
              </div>
            ) : null}

            {activityModalTab === 'exams' ? (
              <div className="space-y-3">
                <p className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>Mapped Exams</p>
                {selectedActivityExams.length === 0 ? <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No mapped exams yet.</p> : null}
                {selectedActivityExams.map((exam) => (
                  <div key={exam.id} className="rounded-xl border p-3" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                    <p className="font-semibold" style={{ color: 'var(--text-main)' }}>{exam.subject}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {(exam.status || 'scheduled').replaceAll('_', ' ')} • {exam.exam_date ? new Date(exam.exam_date).toLocaleDateString() : 'No date'} • {exam.marks_scored ?? '-'} / {exam.total_marks ?? '-'}
                    </p>
                  </div>
                ))}
                <p className="pt-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Map Existing Exams</p>
                {mappableExams.map((exam) => (
                  <div key={exam.id} className="rounded-xl border p-3 flex items-center justify-between" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                    <p className="text-sm" style={{ color: 'var(--text-main)' }}>{exam.subject}</p>
                    <button type="button" onClick={() => void linkExamToActivity(exam.id)} className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-white">Map</button>
                  </div>
                ))}
              </div>
            ) : null}

            {activityModalTab === 'events' ? (
              <div className="space-y-3">
                {selectedActivityEvents.length === 0 ? <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No mapped events yet.</p> : null}
                {selectedActivityEvents.map((ev) => (
                  <div key={ev.id} className="rounded-xl border p-3" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                    <p className="font-semibold" style={{ color: 'var(--text-main)' }}>{ev.title}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {activityModalTab === 'timetable' ? (
              <div className="space-y-2">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Timetable preview for selected child.</p>
                {selectedChildTimetable ? (
                  <div className="rounded-xl border p-3 text-sm" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                    {selectedChildTimetable.periods.length} periods across {selectedChildTimetable.days.length} days.
                  </div>
                ) : null}
              </div>
            ) : null}

            {activityModalTab === 'challenges' ? (
              <div className="space-y-2">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Challenge mapping UI can be plugged here next.</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {isModaling && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="rounded-3xl w-full max-w-2xl p-6 sm:p-7 shadow-2xl relative border bg-[var(--surface)]" style={{ borderColor: 'var(--border-main)' }}>
            <button onClick={() => setIsModaling(false)} className="absolute top-4 right-4" style={{ color: 'var(--text-muted)' }}><X size={24} /></button>
            <p className="text-xs font-bold uppercase tracking-wider text-cyan-500 mb-2">Family Hub</p>
            <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-main)' }}>Create Child Adventure Account</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Simple username login for your child, managed by you.</p>

            {error && <div className="bg-red-100 text-red-700 text-sm p-3 rounded-lg mb-4">{error}</div>}

            <form onSubmit={handleCreateChild} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="kid-glass rounded-2xl p-3">
                  <label className="text-sm font-bold ml-1" style={{ color: 'var(--text-muted)' }}>Child's Name</label>
                  <input required value={cName} onChange={(e) => setCName(e.target.value)} type="text" placeholder="e.g. Athmika" className="mt-1 w-full rounded-xl py-3 px-4 border focus:outline-none" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                </div>
                <div className="kid-glass rounded-2xl p-3">
                  <label className="text-sm font-bold ml-1" style={{ color: 'var(--text-muted)' }}>Unique Username</label>
                  <input required value={cUser} onChange={(e) => setCUser(e.target.value.replace(/\s+/g, ''))} type="text" placeholder="e.g. athmikastar" className="mt-1 w-full rounded-xl py-3 px-4 border focus:outline-none" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                </div>
              </div>
              <div className="kid-glass rounded-2xl p-3">
                <label className="text-sm font-bold ml-1" style={{ color: 'var(--text-muted)' }}>Secret Password</label>
                <input required value={cPass} onChange={(e) => setCPass(e.target.value)} type="password" placeholder="Min 6 characters" className="mt-1 w-full rounded-xl py-3 px-4 border focus:outline-none" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4">
                <div className="kid-glass rounded-2xl p-3">
                  <label className="text-sm font-bold ml-1" style={{ color: 'var(--text-muted)' }}>Date of Birth</label>
                  <input required value={cDob} onChange={(e) => setCDob(e.target.value)} type="date" className="mt-1 w-full min-w-0 rounded-xl py-3 px-4 border focus:outline-none" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                </div>
                <div className="kid-glass rounded-2xl p-3">
                  <label className="text-sm font-bold ml-1" style={{ color: 'var(--text-muted)' }}>Height (cm)</label>
                  <input required min="30" max="250" value={cHeight} onChange={(e) => setCHeight(e.target.value)} type="number" placeholder="120" className="mt-1 w-full rounded-xl py-3 px-4 border focus:outline-none" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                </div>
                <div className="kid-glass rounded-2xl p-3">
                  <label className="text-sm font-bold ml-1" style={{ color: 'var(--text-muted)' }}>Weight (kg)</label>
                  <input required min="5" max="200" step="0.1" value={cWeight} onChange={(e) => setCWeight(e.target.value)} type="number" placeholder="22.5" className="mt-1 w-full rounded-xl py-3 px-4 border focus:outline-none" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                </div>
              </div>
              <button disabled={childRegistering} type="submit" className="w-full text-white font-bold py-3.5 rounded-xl transition mt-4 disabled:opacity-70" style={{ background: 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' }}>
                {childRegistering ? 'Registering...' : 'Create Child Account'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default function ParentDashboard() {
  const { user } = useAuth();

  if (!user) {
    return <ParentDashboardContent />;
  }

  return (
    <RealTimeProvider userId={user.id} userRole="parent_admin">
      <RealTimeNotifications />
      <ParentDashboardContent />
    </RealTimeProvider>
  );
}
