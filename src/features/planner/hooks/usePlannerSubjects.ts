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

function mapPlannerSubject(docId: string, raw: Record<string, unknown>): PlannerSubject {
  return {
    id: docId,
    familyId: String(raw.familyId || raw.family_id || ''),
    childId: String(raw.childId || raw.child_id || ''),
    programId: String(raw.programId || raw.program_id || ''),
    name: String(raw.name || ''),
    teacherName: String(raw.teacherName || raw.teacher_name || ''),
    includeInExams: Boolean(raw.includeInExams ?? raw.include_in_exams ?? true),
    description: String(raw.description || ''),
    color: raw.color ? String(raw.color) : undefined,
    createdAt: String(raw.createdAt || raw.created_at || new Date().toISOString())
  };
}

export function usePlannerSubjects(childId: string, programId?: string | null) {
  const [subjects, setSubjects] = useState<PlannerSubject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!childId) {
      setSubjects([]);
      setLoading(false);
      return;
    }

    setSubjects([]);
    setLoading(true);
    const q = programId
      ? query(
          collection(db, 'planner_subjects'),
          where('childId', '==', childId),
          where('programId', '==', programId)
        )
      : query(
          collection(db, 'planner_subjects'),
          where('childId', '==', childId)
        );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setSubjects(snapshot.docs.map((d) => mapPlannerSubject(d.id, d.data() as Record<string, unknown>)));
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
