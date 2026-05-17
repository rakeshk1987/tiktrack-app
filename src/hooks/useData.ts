import { useCallback, useEffect, useState } from 'react';
import type { ChildProfile, DiaryEntry, Event, MoodLog, ProofLog, Task, TaskLog, InboxMessage, Reminder } from '../types/schema';
import { getExamPlannerStats, processDailyConsistency, applyTaskCompletionToProfile } from './useCoreLogic';
import { optimizeImage } from '../utils/image';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { db, storage } from '../config/firebase';

const getTodayKey = () => new Date().toISOString().slice(0, 10);
const MAX_CHILD_VISIBLE_TASKS = 7;
const isTaskActiveForToday = (task: Task) => {
  const today = getTodayKey();
  const todayWeekday = new Date().getDay();
  const dueDateKey = task.due_date ? new Date(task.due_date).toISOString().slice(0, 10) : null;
  const createdDateKey = task.created_at ? new Date(task.created_at).toISOString().slice(0, 10) : null;

  if (task.status === 'completed') {
    return false;
  }

  if (task.recurrence_type === 'daily') {
    return true;
  }

  if (task.recurrence_type === 'weekly') {
    const days = Array.isArray(task.recurrence_days) ? task.recurrence_days : [];
    return days.includes(todayWeekday);
  }

  return dueDateKey === today || createdDateKey === today || !task.due_date;
};

export function useChildProfile(childId: string) {
  const [profile, setProfile] = useState<ChildProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!childId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, 'child_profile', childId),
      async (snap) => {
        if (snap.exists()) {
          const data = snap.data() as ChildProfile;
          const today = getTodayKey();
          if (data.last_streak_eval !== today) {
            const { updated } = processDailyConsistency(data, today);
            setProfile({ ...data, ...updated });
            try {
              await updateDoc(doc(db, 'child_profile', childId), {
                last_streak_eval: updated.last_streak_eval,
                streak_count: updated.streak_count,
                streak_shields: updated.streak_shields,
                total_stars: updated.total_stars
              });
            } catch (e) {
              console.warn('Daily consistency update failed', e);
            }
          } else {
            setProfile(data);
          }
        } else {
          setProfile(null);
        }
        setLoading(false);
      },
      (error) => {
        console.warn('useChildProfile failed:', error);
        setProfile(null);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [childId]);

  return { profile, loading };
}

export function useTodaysTasks(childId: string) {
  const [tasks, setTasks] = useState<{ task: Task; log?: TaskLog }[]>([]);
  const [loading, setLoading] = useState(true);
  const { events, loading: eventsLoading } = useUpcomingEvents(childId);

  useEffect(() => {
    if (!childId) {
      setTasks([]);
      setLoading(false);
      return;
    }

    let taskDocs: Task[] = [];
    let taskLogs: TaskLog[] = [];

    const syncState = () => {
      if (taskDocs.length === 0 && taskLogs.length === 0) {
        setTasks([]);
        setLoading(false);
        return;
      }

      const logByTaskId = new Map(taskLogs.map((log) => [log.task_id, log]));
      let merged = taskDocs
        .filter((task) => task.child_id === childId)
        .map((task) => ({ task, log: logByTaskId.get(task.id) }))
        .sort((a, b) => new Date(b.task.created_at || 0).getTime() - new Date(a.task.created_at || 0).getTime());

      if (merged.length > 0) {
        // --- Exam Planner Integration ---
        const { isLightDay, virtualTasks } = getExamPlannerStats(events, merged);

        // 1. Task Load Reduction on Light Days (40% reduction)
        if (isLightDay) {
          // Keep Academic tasks and High priority tasks, filter out some others
          const academicCount = merged.filter(m => m.task.category === 'Academic').length;
          const targetCount = Math.max(academicCount + 1, Math.floor(merged.length * 0.6));
          
          merged.sort((a, b) => {
            // Prioritize Academic then Priority
            if (a.task.category === 'Academic' && b.task.category !== 'Academic') return -1;
            if (a.task.category !== 'Academic' && b.task.category === 'Academic') return 1;
            if (a.task.priority === 'high' && b.task.priority !== 'high') return -1;
            return 0;
          });
          
          merged = merged.slice(0, targetCount);
        }

        // 2. Inject Virtual Study Tasks
        const virtualMerged = virtualTasks.map(vt => ({
          task: vt,
          log: logByTaskId.get(vt.id) // Check if already logged/completed today
        }));
        
        merged = [...virtualMerged, ...merged].filter(({ task }) => isTaskActiveForToday(task));

        merged.sort((a, b) => {
          if ((a.log?.status === 'completed') === (b.log?.status === 'completed')) return 0;
          return a.log?.status === 'completed' ? 1 : -1;
        });
        setTasks(merged.slice(0, MAX_CHILD_VISIBLE_TASKS));
      } else {
        setTasks([]);
      }
      setLoading(false);
    };

    const unsubTasks = onSnapshot(
      query(collection(db, 'tasks'), where('child_id', '==', childId), limit(100)),
      (snapshot) => {
        taskDocs = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Task, 'id'>) }));
        syncState();
      },
      (error) => {
        console.warn('useTodaysTasks task query failed:', error);
        taskDocs = [];
        syncState();
      }
    );

    const unsubLogs = onSnapshot(
      query(collection(db, 'task_logs'), where('child_id', '==', childId), limit(20)),
      (snapshot) => {
        taskLogs = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TaskLog, 'id'>) })) as TaskLog[];
        syncState();
      },
      (error) => {
        console.warn('useTodaysTasks log query failed:', error);
        taskLogs = [];
        syncState();
      }
    );

    return () => {
      unsubTasks();
      unsubLogs();
    };
  }, [childId, events]);

  return { tasks, loading: loading || eventsLoading };
}

export function useUpcomingEvents(childId: string) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!childId) {
      setEvents([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'events'),
      where('child_id', '==', childId),
      limit(20)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const mapped = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Event, 'id'>) }));
        setEvents(mapped);
        setLoading(false);
      },
      (error) => {
        console.warn('useUpcomingEvents fallback mode:', error);
        setEvents([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [childId]);

  return { events, loading };
}

export function useChildMood(childId: string) {
  const [moodLog, setMoodLog] = useState<MoodLog | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!childId) {
      setMoodLog(null);
      return;
    }

    const entryId = `${childId}_${getTodayKey()}`;
    const unsubscribe = onSnapshot(
      doc(db, 'mood_logs', entryId),
      (snapshot) => {
        setMoodLog(snapshot.exists() ? (snapshot.data() as MoodLog) : null);
      },
      (error) => {
        console.warn('useChildMood fallback mode:', error);
        setMoodLog(null);
      }
    );

    return () => unsubscribe();
  }, [childId]);

  const saveMood = useCallback(async (mood: MoodLog['mood']) => {
    if (!childId) return;
    const payload: MoodLog = {
      id: `${childId}_${getTodayKey()}`,
      child_id: childId,
      date: getTodayKey(),
      mood
    };

    setSaving(true);
    try {
      await setDoc(doc(db, 'mood_logs', payload.id), payload, { merge: true });
      setMoodLog(payload);
    } finally {
      setSaving(false);
    }
  }, [childId]);

  return { moodLog, saving, saveMood };
}

export function useDiaryEntries(childId: string) {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!childId) {
      setEntries([]);
      return;
    }

    const unsubscribe = onSnapshot(
      query(collection(db, 'diary_entries'), where('child_id', '==', childId), limit(12)),
      (snapshot) => {
        const mapped = snapshot.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<DiaryEntry, 'id'>) }))
          .sort((a, b) => b.date.localeCompare(a.date));
        setEntries(mapped);
      },
      (error) => {
        console.warn('useDiaryEntries failed:', error);
        setEntries([]);
      }
    );

    return () => unsubscribe();
  }, [childId]);

  const addEntry = useCallback(async (content: string, dateKey?: string) => {
    if (!childId) return;
    const trimmed = content.trim();
    if (!trimmed) return;
    const targetDate = dateKey || getTodayKey();
    const entryId = `${childId}_${targetDate}`;

    setSaving(true);
    try {
      await setDoc(doc(db, 'diary_entries', entryId), {
        id: entryId,
        child_id: childId,
        date: targetDate,
        content: trimmed,
        updated_at: serverTimestamp()
      }, { merge: true });
    } finally {
      setSaving(false);
    }
  }, [childId]);

  return { entries, saving, addEntry };
}

export interface ChildProofItem extends ProofLog {
  child_id?: string;
  task_title?: string;
}

export function useChildProofs(childId: string) {
  const [proofs, setProofs] = useState<ChildProofItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pendingRetry, setPendingRetry] = useState<{ task: Task; file: File } | null>(null);

  useEffect(() => {
    if (!childId) {
      setProofs([]);
      return;
    }

    const unsubscribe = onSnapshot(
      query(collection(db, 'proof_logs'), where('child_id', '==', childId), limit(20)),
      (snapshot) => {
        const mapped = snapshot.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<ChildProofItem, 'id'>) }))
          .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        setProofs(mapped);
      },
      (error) => {
        console.warn('useChildProofs fallback mode:', error);
        setProofs([]);
      }
    );

    return () => unsubscribe();
  }, [childId]);

  const uploadProof = useCallback(async (task: Task, file: File, notes?: string) => {
    if (!childId) throw new Error('Missing child id');

    setUploading(true);
    setUploadProgress(0);
    setPendingRetry(null);
    try {
      const optimizedBlob = await optimizeImage(file);
      const fileRef = ref(storage, `proofs/${childId}/${task.id}/${Date.now()}-${file.name.replace(/\.[^/.]+$/, "")}.jpg`);
      const uploadTask = uploadBytesResumable(fileRef, optimizedBlob);

      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = snapshot.totalBytes > 0
              ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
              : 0;
            setUploadProgress(progress);
          },
          (error) => reject(error),
          () => resolve()
        );
      });

      const imageUrl = await getDownloadURL(fileRef);

      const proofDoc = await addDoc(collection(db, 'proof_logs'), {
        task_id: task.id,
        child_id: childId,
        task_title: task.title,
        image_url: imageUrl,
        image_path: fileRef.fullPath,
        timestamp: new Date().toISOString(),
        approval_status: 'pending',
        notes: notes || ''
      });

      return proofDoc.id;
    } catch (error) {
      setPendingRetry({ task, file });
      throw error;
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 800);
    }
  }, [childId]);

  const retryUpload = useCallback(async () => {
    if (!pendingRetry) return null;
    return uploadProof(pendingRetry.task, pendingRetry.file);
  }, [pendingRetry, uploadProof]);

  return { proofs, uploading, uploadProgress, uploadProof, retryUpload, hasPendingRetry: Boolean(pendingRetry) };
}

export function useQuestActions(childId: string) {
  const [saving, setSaving] = useState(false);

  const markTaskPendingProof = useCallback(async (task: Task) => {
    if (!childId) return;
    const today = getTodayKey();
    const logId = `${childId}_${task.id}_${today}`;
    await setDoc(doc(db, 'task_logs', logId), {
      id: logId,
      child_id: childId,
      task_id: task.id,
      date: today,
      status: 'pending'
    }, { merge: true });
  }, [childId]);

  const completeTask = useCallback(async (task: Task) => {
    if (!childId) return;
    if ((task as any).created_by === 'child' && (task as any).approval_status !== 'approved') {
      throw new Error('This self-created task needs parent approval before completion rewards can be counted.');
    }

    const today = getTodayKey();
    const logId = `${childId}_${task.id}_${today}`;
    setSaving(true);
    try {
      await setDoc(doc(db, 'task_logs', logId), {
        id: logId,
        child_id: childId,
        task_id: task.id,
        date: today,
        status: 'completed'
      }, { merge: true });

      try {
        await updateDoc(doc(db, 'tasks', task.id), {
          status: 'completed',
          completed_at: new Date().toISOString()
        });
      } catch (error) {
        console.warn('Task status update skipped:', error);
      }

      const profileRef = doc(db, 'child_profile', childId);
      const snap = await getDoc(profileRef);
      if (snap.exists()) {
        const data = snap.data() as ChildProfile;
        
        // Gamification: Early Bird (completed before 8:30 AM)
        const currentHour = new Date().getHours();
        const currentMins = new Date().getMinutes();
        const isEarlyBird = data.last_task_date !== today && (currentHour < 8 || (currentHour === 8 && currentMins <= 30));

        const { updatedProfile } = applyTaskCompletionToProfile(data, task.star_value, true, today, isEarlyBird);
        await updateDoc(profileRef, {
          total_stars: updatedProfile.total_stars,
          streak_count: updatedProfile.streak_count,
          streak_shields: updatedProfile.streak_shields,
          consistency_score: updatedProfile.consistency_score,
          last_task_date: updatedProfile.last_task_date
        });
      }
    } finally {
      setSaving(false);
    }
  }, [childId]);

  return { completeTask, markTaskPendingProof, saving };
}

export function useMessages(userId: string, targetType: 'child' | 'parent') {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    const field = targetType === 'child' ? 'child_id' : 'parent_id';
    const q = query(collection(db, 'messages'), where(field, '==', userId));

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const mapped = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<InboxMessage, 'id'>) }))
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setMessages(mapped);
        setLoading(false);
      },
      (error) => {
        console.warn('useMessages failed:', error);
        setMessages([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId, targetType]);

  const sendMessage = useCallback(async (
    childId: string,
    parentId: string,
    content: string,
    senderRole: 'parent' | 'child' = 'parent',
    senderId?: string,
    subject?: string
  ) => {
    const payload: Record<string, unknown> = {
      child_id: childId,
      parent_id: parentId,
      content,
      timestamp: new Date().toISOString(),
      is_read: false,
      sender_role: senderRole,
      sender_id: senderId || (senderRole === 'child' ? childId : parentId)
    };
    if (subject?.trim()) {
      payload.subject = subject.trim();
    }

    await addDoc(collection(db, 'messages'), payload);
  }, []);

  const markAsRead = useCallback(async (messageId: string) => {
    await updateDoc(doc(db, 'messages', messageId), { is_read: true });
  }, []);

  return { messages, loading, sendMessage, markAsRead };
}

export function useChildReminders(childId: string) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!childId) {
      setReminders([]);
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'reminders'), where('child_id', '==', childId), limit(50));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const mapped = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Reminder, 'id'>) }))
          .sort((a, b) => {
            const aTime = a.schedule_time || '';
            const bTime = b.schedule_time || '';
            return aTime.localeCompare(bTime);
          });
        setReminders(mapped);
        setLoading(false);
      },
      (error) => {
        console.warn('useChildReminders failed:', error);
        setReminders([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [childId]);

  return { reminders, loading };
}
