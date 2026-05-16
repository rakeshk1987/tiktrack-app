import { useEffect, useState, useCallback } from 'react';
import {
  collection,
  getDocs,
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

  const fetchSubjects = useCallback(async () => {
    if (!childId) {
      setSubjects([]);
      setLoading(false);
      return;
    }
    try {
      // Query all subjects for this child to avoid composite index requirements
      const q = query(
        collection(db, 'planner_subjects'),
        where('childId', '==', childId)
      );
      const snapshot = await getDocs(q);
      const allItems = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data()
      })) as PlannerSubject[];

      // Filter by programId in memory
      const filtered = programId
        ? allItems.filter((s) => s.programId === programId)
        : allItems;

      setSubjects(filtered);
    } catch (err) {
      console.error('Firestore Subject Fetch Error:', err);
      // Don't clear existing subjects on error — keep optimistic state
    } finally {
      setLoading(false);
    }
  }, [childId, programId]);

  useEffect(() => {
    setLoading(true);
    void fetchSubjects();
  }, [fetchSubjects]);

  async function addSubject(
    name: string,
    familyId: string,
    teacherName?: string,
    includeInExams?: boolean,
    description?: string
  ) {
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

    // Optimistic update — show immediately in UI
    const tempId = `temp_${Date.now()}`;
    const optimisticSubject: PlannerSubject = { id: tempId, ...newSubjectData } as PlannerSubject;
    setSubjects((prev) => [...prev, optimisticSubject]);

    try {
      const docRef = await addDoc(collection(db, 'planner_subjects'), newSubjectData);
      // Replace temp item with real Firestore id
      setSubjects((prev) =>
        prev.map((s) => (s.id === tempId ? { ...optimisticSubject, id: docRef.id } : s))
      );
    } catch (err) {
      // Roll back optimistic update on failure
      setSubjects((prev) => prev.filter((s) => s.id !== tempId));
      throw err;
    }
  }

  async function removeSubject(subjectId: string) {
    // Optimistic removal
    setSubjects((prev) => prev.filter((s) => s.id !== subjectId));
    try {
      await deleteDoc(doc(db, 'planner_subjects', subjectId));
    } catch (err) {
      // Re-fetch to restore state on failure
      void fetchSubjects();
      throw err;
    }
  }

  async function updateSubject(subjectId: string, updates: Partial<PlannerSubject>) {
    // Optimistic update
    setSubjects((prev) =>
      prev.map((s) => (s.id === subjectId ? { ...s, ...updates } : s))
    );
    try {
      await updateDoc(doc(db, 'planner_subjects', subjectId), {
        ...updates,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      void fetchSubjects();
      throw err;
    }
  }

  return { subjects, loading, addSubject, removeSubject, updateSubject, refresh: fetchSubjects };
}
