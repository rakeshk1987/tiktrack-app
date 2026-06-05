import {
  runTelegramHandler,
  type TelegramApiRequest,
  type TelegramApiResponse,
} from '../../_telegramSupport';

export default async function handler(req: TelegramApiRequest, res: TelegramApiResponse) {
  return runTelegramHandler(req, res, async () => {
    const { telegramMiniAppCreateSchedule } = await import('../../../functions/src/telegramBot');
    return telegramMiniAppCreateSchedule as never;
  });
}
