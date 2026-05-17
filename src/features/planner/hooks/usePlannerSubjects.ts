import { useEffect, useState, useCallback } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  addDoc,
  deleteDoc,
  doc,
  updateDoc
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import type { PlannerSubject } from '../types/planner.types';

export function usePlannerSubjects(childId: string, programId?: string | null) {
  const [subjects, setSubjects] = useState<PlannerSubject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!childId) {
      setSubjects([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'planner_subjects'),
      where('childId', '==', childId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const allItems = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data()
        })) as PlannerSubject[];

        const filtered = programId
          ? allItems.filter((s) => s.programId === programId)
          : allItems;

        setSubjects(filtered);
        setLoading(false);
      },
      (err) => {
        console.error('Firestore Subject Fetch Error:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [childId, programId]);

  const addSubject = useCallback(async (
    name: string,
    familyId: string,
    teacherName?: string,
    includeInExams?: boolean,
    description?: string
  ) => {
    if (!childId || !programId || !name.trim()) return;

    const newSubjectData = {
      childId,
      familyId,
      programId,
      name: name.trim(),
      teacherName: teacherName || '',
      includeInExams: includeInExams ?? true,
      description: description || '',
      createdAt: new Date().toISOString()
    };

    await addDoc(collection(db, 'planner_subjects'), newSubjectData);
  }, [childId, programId]);

  const removeSubject = useCallback(async (subjectId: string) => {
    await deleteDoc(doc(db, 'planner_subjects', subjectId));
  }, []);

  const updateSubject = useCallback(async (subjectId: string, updates: Partial<PlannerSubject>) => {
    await updateDoc(doc(db, 'planner_subjects', subjectId), {
      ...updates,
      updatedAt: new Date().toISOString()
    });
  }, []);

  return { subjects, loading, addSubject, removeSubject, updateSubject, refresh: () => {} };
}

