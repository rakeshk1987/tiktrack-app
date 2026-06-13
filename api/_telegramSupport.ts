import admin from 'firebase-admin';

type HeaderValue = number | string | readonly string[];

interface ServiceAccountJson {
  project_id?: string;
  client_email?: string;
  private_key?: string;
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
}

export interface TelegramApiRequest {
  method?: string;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
  header?: (name: string) => string | undefined;
}

export interface TelegramApiResponse {
  setHeader: (name: string, value: HeaderValue) => TelegramApiResponse;
  status: (code: number) => TelegramApiResponse;
  send: (body: unknown) => void;
  json: (body: unknown) => void;
  set?: (name: string, value: HeaderValue) => TelegramApiResponse;
}

export type TelegramCloudHandler = (req: never, res: never) => unknown | Promise<unknown>;

export function initializeTelegramFirebaseAdmin() {
  if (admin.apps.length) return;

  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!rawServiceAccount) {
    admin.initializeApp();
    return;
  }

  const parsed = JSON.parse(rawServiceAccount) as ServiceAccountJson;
  const projectId = parsed.project_id || parsed.projectId;
  const clientEmail = parsed.client_email || parsed.clientEmail;
  const privateKey = (parsed.private_key || parsed.privateKey || '').replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is missing project_id, client_email, or private_key.');
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

export function adaptTelegramRequest(req: TelegramApiRequest): TelegramApiRequest {
  if (req.header) return req;

  req.header = (name: string) => {
    const value = req.headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  };
  return req;
}

export function adaptTelegramResponse(res: TelegramApiResponse): TelegramApiResponse {
  res.set = (name: string, value: HeaderValue) => res.setHeader(name, value);
  return res;
}

export async function runTelegramHandler(
  req: TelegramApiRequest,
  res: TelegramApiResponse,
  loadHandler: () => Promise<TelegramCloudHandler>
) {
  try {
    initializeTelegramFirebaseAdmin();
    const handler = await loadHandler();
    return handler(adaptTelegramRequest(req) as never, adaptTelegramResponse(res) as never);
  } catch (error) {
    console.error('Telegram Vercel route failed', error);
    setApiCors(res);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Telegram API route failed.',
    });
    return;
  }
}

export function setApiCors(res: TelegramApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', process.env.TELEGRAM_MINI_APP_ORIGIN || '*');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}
