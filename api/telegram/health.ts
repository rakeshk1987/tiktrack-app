import {
  initializeTelegramFirebaseAdmin,
  setApiCors,
  type TelegramApiRequest,
  type TelegramApiResponse,
} from '../_telegramSupport.js';

export default function handler(req: TelegramApiRequest, res: TelegramApiResponse) {
  setApiCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    initializeTelegramFirebaseAdmin();
    res.status(200).json({
      ok: true,
      env: {
        botToken: Boolean(process.env.TELEGRAM_BOT_TOKEN),
        webhookSecret: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET),
        miniAppUrl: Boolean(process.env.TELEGRAM_MINI_APP_URL),
        miniAppOrigin: Boolean(process.env.TELEGRAM_MINI_APP_ORIGIN),
        firebaseServiceAccount: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
      },
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Telegram health check failed.',
    });
  }
}
