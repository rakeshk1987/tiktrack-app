import {
  initializeTelegramFirebaseAdmin,
  setApiCors,
  type TelegramApiRequest,
  type TelegramApiResponse,
} from '../../_telegramSupport.js';
import { miniAppListWeek, BotAuthError, BotRequestError } from '../../_telegramCore.js';

export default async function handler(req: TelegramApiRequest, res: TelegramApiResponse) {
  setApiCors(res);
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'Method not allowed.' }); return; }

  try {
    initializeTelegramFirebaseAdmin();
    const result = await miniAppListWeek(req.body);
    res.status(200).json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof BotAuthError || error instanceof BotRequestError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    console.error('Telegram mini app list week failed', error);
    res.status(500).json({ ok: false, error: 'Could not load week schedule.' });
  }
}
