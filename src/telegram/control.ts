export function parseRepliesEnabled(value: string | undefined): boolean {
  if (value === undefined || value.trim() === '') return false;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  throw new Error('INVALID_CONFIG:TELEGRAM_REPLIES_ENABLED');
}
