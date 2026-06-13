import {
  initializeTelegramFirebaseAdmin,
  setApiCors,
  type TelegramApiRequest,
  type TelegramApiResponse,
} from '../_telegramSupport.js';
import {
  processWebhookUpdate,
  verifyWebhookSecret,
  type TelegramUpdate,
} from '../_telegramCore.js';

export default async function handler(req: TelegramApiRequest, res: TelegramApiResponse) {
  setApiCors(res);
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'Method not allowed.' }); return; }

  try {
    initializeTelegramFirebaseAdmin();

    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET || '';
    const received = String(
      (req.headers as Record<string, string | string[] | undefined>)['x-telegram-bot-api-secret-token'] || ''
    );
    if (!verifyWebhookSecret(received, expectedSecret)) {
      res.status(401).send('Unauthorized');
      return;
    }

    await processWebhookUpdate(req.body as TelegramUpdate);
    res.status(200).send('ok');
  } catch (error) {
    console.error('Telegram webhook failed', error);
    res.status(200).send('ok'); // always 200 so Telegram doesn't retry
  }
}
