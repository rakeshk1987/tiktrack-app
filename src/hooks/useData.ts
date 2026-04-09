import { useCallback, useEffect, useState } from 'react';
import type { ChildProfile, DiaryEntry, MoodLog, ProofLog, Task, TaskLog } from '../types/schema';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  increment,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../config/firebase';

const getTodayKey = () => new Date().toISOString().slice(0, 10);

const fallbackTaskList: { task: Task; log?: TaskLog }[] = [
  {
    task: {
      id: '1',
      title: 'Math Homework',
      category: 'Academic',
      difficulty_level: 5,
      energy_level: 'high',
      priority: 'high',
      requires_proof: true,
      star_value: 2
    }
  },
  {
    task: {
      id: '2',
      title: 'Read a Book for 20 mins',
      category: 'Creative',
      difficulty_level: 2,
      energy_level: 'low',
      priority: 'medium',
      requires_proof: false,
      star_value: 1
    }
  }
];

const fallbackDiaryEntry = (childId: string): DiaryEntry => ({
  id: 'welcome-entry',
  child_id: childId,
  date: getTodayKey(),
  content: 'Today I am ready for a new quest.'
});

export function useChildProfile(childId: string) {
  const [profile, setProfile] = useState<ChildProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!childId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const fallbackProfile: ChildProfile = {
      id: childId,
      name: 'Explorer',
      date_of_birth: '2016-01-01',
      height_cm: 140,
      weight_kg: 32,
      streak_count: 0,
      streak_shields: 0,
      consistency_score: 0,
      total_stars: 0,
      is_sick_mode: false,
      user_id: childId
    };

    const unsubscribe = onSnapshot(
      doc(db, 'child_profile', childId),
      (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as ChildProfile);
        } else {
          setProfile(fallbackProfile);
        }
        setLoading(false);
      },
      (error) => {
        console.warn('useChildProfile fallback mode:', error);
        setProfile(fallbackProfile);
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
        setTasks(fallbackTaskList);
        setLoading(false);
        return;
      }

      const logByTaskId = new Map(taskLogs.map((log) => [log.task_id, log]));
      const merged = taskDocs.map((task) => ({ task, log: logByTaskId.get(task.id) }));

      if (merged.length > 0) {
        merged.sort((a, b) => {
          if ((a.log?.status === 'completed') === (b.log?.status === 'completed')) return 0;
          return a.log?.status === 'completed' ? 1 : -1;
        });
        setTasks(merged);
      } else {
        setTasks(fallbackTaskList);
      }
      setLoading(false);
    };

    const unsubTasks = onSnapshot(
      query(collection(db, 'tasks'), limit(12)),
      (snapshot) => {
        taskDocs = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Task, 'id'>) }));
        syncState();
      },
      (error) => {
        console.warn('useTodaysTasks task fallback mode:', error);
        taskDocs = fallbackTaskList.map((entry) => entry.task);
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
        console.warn('useTodaysTasks log fallback mode:', error);
        taskLogs = [];
        syncState();
      }
    );

    return () => {
      unsubTasks();
      unsubLogs();
    };
  }, [childId]);

  return { tasks, loading };
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
        setEntries(mapped.length > 0 ? mapped : [fallbackDiaryEntry(childId)]);
      },
      (error) => {
        console.warn('useDiaryEntries fallback mode:', error);
        setEntries([fallbackDiaryEntry(childId)]);
      }
    );

    return () => unsubscribe();
  }, [childId]);

  const addEntry = useCallback(async (content: string) => {
    if (!childId) return;
    const trimmed = content.trim();
    if (!trimmed) return;

    setSaving(true);
    try {
      await addDoc(collection(db, 'diary_entries'), {
        child_id: childId,
        date: new Date().toISOString(),
        content: trimmed,
        created_at: serverTimestamp()
      });
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

  const uploadProof = useCallback(async (task: Task, file: File) => {
    if (!childId) throw new Error('Missing child id');

    setUploading(true);
    try {
      const fileRef = ref(storage, `proofs/${childId}/${task.id}/${Date.now()}-${file.name}`);
      await uploadBytes(fileRef, file);
      const imageUrl = await getDownloadURL(fileRef);

      const proofDoc = await addDoc(collection(db, 'proof_logs'), {
        task_id: task.id,
        child_id: childId,
        task_title: task.title,
        image_url: imageUrl,
        image_path: fileRef.fullPath,
        timestamp: new Date().toISOString(),
        approval_status: 'pending'
      });

      return proofDoc.id;
    } finally {
      setUploading(false);
    }
  }, [childId]);

  return { proofs, uploading, uploadProof };
}

export function useQuestActions(childId: string) {
  const [saving, setSaving] = useState(false);

  const completeTask = useCallback(async (task: Task) => {
    if (!childId) return;

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

      const profileRef = doc(db, 'child_profile', childId);
      const snap = await getDoc(profileRef);
      if (snap.exists()) {
        await updateDoc(profileRef, {
          total_stars: increment(task.star_value),
          consistency_score: increment(5)
        });
      }
    } finally {
      setSaving(false);
    }
  }, [childId]);

  return { completeTask, saving };
}
