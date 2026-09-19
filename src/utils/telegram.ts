export function getTelegramApiUrl(path: string): string {
  const baseUrl = (import.meta.env.VITE_TELEGRAM_API_BASE_URL || '').replace(/\/$/, '');
  return `${baseUrl}${path}`;
}
