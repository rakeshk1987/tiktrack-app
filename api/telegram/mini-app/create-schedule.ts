import {
  adaptTelegramRequest,
  adaptTelegramResponse,
  initializeTelegramFirebaseAdmin,
  type TelegramApiRequest,
  type TelegramApiResponse,
} from '../../_telegramSupport';

export default async function handler(req: TelegramApiRequest, res: TelegramApiResponse) {
  initializeTelegramFirebaseAdmin();
  const { telegramMiniAppCreateSchedule } = await import('../../../functions/src/telegramBot');
  return telegramMiniAppCreateSchedule(adaptTelegramRequest(req) as never, adaptTelegramResponse(res) as never);
}
