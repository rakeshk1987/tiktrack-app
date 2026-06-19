import {
  initializeTelegramFirebaseAdmin,
  setApiCors,
  type TelegramApiRequest,
  type TelegramApiResponse,
} from '../_telegramSupport.js';
import {
  sendApprovalNotification,
} from '../_telegramCore.js';

/**
 * POST /api/telegram/notify-approval
 *
 * Called client-side (fire-and-forget) after a child creates an approval
 * request in Firestore. Sends a Telegram push to all linked parent accounts.
 *
 * Body: { family_id, child_id, type, title, approval_id? }
 */
export default async function handler(req: TelegramApiRequest, res: TelegramApiResponse) {
  setApiCors(res);
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'Method not allowed.' }); return; }

  try {
    initializeTelegramFirebaseAdmin();

    const body = req.body as Record<string, unknown>;
    const family_id   = String(body?.family_id   || '');
    const child_id    = String(body?.child_id    || '');
    const type        = String(body?.type        || 'task') as 'task' | 'routine' | 'exam' | 'custom';
    const title       = String(body?.title       || 'Item');
    const approval_id = body?.approval_id ? String(body.approval_id) : undefined;

    if (!family_id) {
      res.status(400).json({ ok: false, error: 'family_id is required.' });
      return;
    }

    await sendApprovalNotification({
      familyId: family_id,
      approvalType: type,
      title,
      childId: child_id,
      approvalId: approval_id,
    });
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('notify-approval failed', error);
    // Return 200 so the client fire-and-forget never surfaces an error to the child UI
    res.status(200).json({ ok: false, error: 'Notification skipped.' });
  }
}
