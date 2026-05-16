import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, addDoc, deleteDoc, doc } from 'firebase/firestore';
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

    // Query by childId only to avoid composite index requirements for (childId, programId)
    const q = query(
      collection(db, 'planner_subjects'),
      where('childId', '==', childId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allItems = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data()
      })) as PlannerSubject[];
      
      // Filter by programId in memory
      const filtered = programId 
        ? allItems.filter(s => s.programId === programId)
        : allItems;

      setSubjects(filtered);
      setLoading(false);
    }, (err) => {
      console.error('Firestore Subject Sync Error:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [childId, programId]);

  async function addSubject(name: string, familyId: string, teacherName?: string, includeInExams?: boolean, description?: string) {
    if (!childId || !programId || !name.trim()) return;
    await addDoc(collection(db, 'planner_subjects'), {
      childId,
      familyId,
      programId,
      name: name.trim(),
      teacherName: teacherName || '',
      includeInExams: includeInExams ?? true,
      description: description || '',
      createdAt: new Date().toISOString()
    });
  }

  async function removeSubject(subjectId: string) {
    await deleteDoc(doc(db, 'planner_subjects', subjectId));
  }

  return { subjects, loading, addSubject, removeSubject };
}
