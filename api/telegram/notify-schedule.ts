import {
  initializeTelegramFirebaseAdmin,
  setApiCors,
  type TelegramApiRequest,
  type TelegramApiResponse,
} from '../_telegramSupport.js';
import {
  sendScheduleCreatedNotification,
} from '../_telegramCore.js';

/**
 * POST /api/telegram/notify-schedule
 *
 * Called client-side (fire-and-forget) after a new task, event, or exam
 * is created in Firestore. Sends a Telegram push to all linked parent accounts.
 *
 * Body: { family_id, child_id, schedule_type, title, start_at, created_by? }
 */
export default async function handler(req: TelegramApiRequest, res: TelegramApiResponse) {
  setApiCors(res);
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'Method not allowed.' }); return; }

  try {
    initializeTelegramFirebaseAdmin();

    const body = req.body as Record<string, unknown>;
    const family_id    = String(body?.family_id    || '');
    const child_id     = String(body?.child_id     || '');
    const schedule_type = String(body?.schedule_type || 'task') as 'task' | 'event' | 'exam';
    const title        = String(body?.title        || 'Untitled');
    const start_at     = String(body?.start_at     || new Date().toISOString());
    const created_by   = String(body?.created_by   || 'web') as 'telegram' | 'web' | 'parent' | 'child';

    if (!family_id || !child_id) {
      res.status(400).json({ ok: false, error: 'family_id and child_id are required.' });
      return;
    }

    await sendScheduleCreatedNotification({
      familyId: family_id,
      childId: child_id,
      scheduleType: schedule_type,
      title,
      startAt: start_at,
      createdBy: created_by,
    });

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('notify-schedule failed', error);
    // Return 200 so the client fire-and-forget never surfaces an error to the UI
    res.status(200).json({ ok: false, error: 'Notification skipped.' });
  }
}
