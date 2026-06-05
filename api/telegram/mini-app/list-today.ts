import {
  runTelegramHandler,
  type TelegramApiRequest,
  type TelegramApiResponse,
} from '../../_telegramSupport.js';

export default async function handler(req: TelegramApiRequest, res: TelegramApiResponse) {
  return runTelegramHandler(req, res, async () => {
    const { telegramMiniAppListToday } = await import('../../../functions/lib/telegramBot.js');
    return telegramMiniAppListToday as never;
  });
}
