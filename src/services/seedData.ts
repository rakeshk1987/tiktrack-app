import { addDoc, collection, doc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

interface SeedInput {
  familyId: string;
  parentId: string;
  childId: string;
  childName: string;
}

export async function seedStarterData(input: SeedInput) {
  const now = new Date();
  const isoDate = now.toISOString().slice(0, 10);
  const mkIso = (days: number, hour: number, minute: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };

  const starterTasks = [
    { title: 'Math practice 20 min', category: 'Study', star_value: 8, priority: 'high' },
    { title: 'Reading time 15 min', category: 'Reading', star_value: 6, priority: 'medium' },
    { title: 'Pack school bag', category: 'Routine', star_value: 4, priority: 'medium' },
    { title: 'Water and stretch break', category: 'Health', star_value: 3, priority: 'low' }
  ];

  for (const task of starterTasks) {
    await addDoc(collection(db, 'tasks'), {
      ...task,
      description: '',
      child_id: input.childId,
      parent_id: input.parentId,
      family_id: input.familyId,
      requires_proof: false,
      status: 'pending',
      recurrence_type: 'daily',
      recurrence_days: [],
      created_at: new Date().toISOString()
    });
  }

  const starterEvents = [
    { title: 'School Hours', category: 'school', start_at: mkIso(1, 8, 30), end_at: mkIso(1, 14, 30) },
    { title: 'Math Tuition', category: 'tuition', start_at: mkIso(1, 18, 0), end_at: mkIso(1, 19, 0) },
    { title: 'Science Unit Test', category: 'exam', start_at: mkIso(3, 10, 0), end_at: mkIso(3, 12, 0) }
  ];

  for (const event of starterEvents) {
    await addDoc(collection(db, 'events'), {
      family_id: input.familyId,
      child_id: input.childId,
      parent_id: input.parentId,
      title: event.title,
      description: '',
      category: event.category,
      color: '#3b82f6',
      start_at: event.start_at,
      end_at: event.end_at,
      all_day: false,
      timezone: 'Asia/Kolkata',
      recurrence: { type: 'none', interval: 1, by_week_days: [], by_month_days: [], until: null, count: null, rrule: null },
      linked_program_id: null,
      linked_task_ids: [],
      participant_ids: [],
      reminder_ids: [],
      source: 'manual',
      sync: { google_enabled: false, google_event_id: null, sync_status: 'not_configured', last_sync_at: null, sync_error: null },
      created_by: 'parent',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null
    });
  }

  await setDoc(doc(db, 'reward_settings', `${input.familyId}_default`), {
    parent_id: input.parentId,
    family_id: input.familyId,
    star_to_currency_rate: 0.1,
    weekly_bonus_enabled: true,
    created_at: new Date().toISOString()
  }, { merge: true });

  await addDoc(collection(db, 'reward_items'), {
    parent_id: input.parentId,
    family_id: input.familyId,
    child_id: input.childId,
    name: 'Friday Movie Night',
    description: 'Pick one family movie',
    star_cost: 50,
    category: 'experience',
    is_available: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  await setDoc(doc(db, 'school_timetables', `${input.childId}_active`), {
    family_id: input.familyId,
    child_id: input.childId,
    is_active: true,
    periods: ['Period 1', 'Period 2', 'Period 3', 'Period 4', 'Period 5'],
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    data: {
      'Period 1': { Mon: { subject: 'Math' }, Tue: { subject: 'English' }, Wed: { subject: 'Science' }, Thu: { subject: 'Math' }, Fri: { subject: 'Reading' } },
      'Period 2': { Mon: { subject: 'Social' }, Tue: { subject: 'Math' }, Wed: { subject: 'English' }, Thu: { subject: 'Science' }, Fri: { subject: 'Art' } }
    },
    updated_at: new Date().toISOString()
  }, { merge: true });

  await setDoc(doc(db, 'child_profile', input.childId), {
    id: input.childId,
    user_id: input.childId,
    parent_id: input.parentId,
    family_id: input.familyId,
    name: input.childName,
    date_of_birth: new Date('2015-01-01').toISOString(),
    height_cm: 125,
    weight_kg: 27,
    streak_count: 0,
    streak_shields: 0,
    consistency_score: 0,
    total_stars: 0,
    is_sick_mode: false,
    last_streak_eval: isoDate
  }, { merge: true });
}
