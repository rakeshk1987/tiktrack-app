import {
  adaptTelegramRequest,
  adaptTelegramResponse,
  initializeTelegramFirebaseAdmin,
  type TelegramApiRequest,
  type TelegramApiResponse,
} from '../_telegramSupport';

export default async function handler(req: TelegramApiRequest, res: TelegramApiResponse) {
  initializeTelegramFirebaseAdmin();
  const { telegramWebhook } = await import('../../functions/src/telegramBot');
  return telegramWebhook(adaptTelegramRequest(req) as never, adaptTelegramResponse(res) as never);
}
