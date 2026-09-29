export const TELEGRAM_UI_CALLBACK_VERSION = 'br2' as const;
export const TELEGRAM_CALLBACK_MAX_BYTES = 64;

export type TelegramUiAction =
  | { action: 'HOME' } | { action: 'RATS' } | { action: 'WATCHES' } | { action: 'DIG_HINT' }
  | { action: 'CASE' | 'WHY' | 'WATCH' | 'UNWATCH' | 'SHARE' | 'FULL'; shareId: string };

const SIMPLE: Record<string, Extract<TelegramUiAction,{ action: 'HOME' | 'RATS' | 'WATCHES' | 'DIG_HINT' }>> = {
  h: { action: 'HOME' }, r: { action: 'RATS' }, w: { action: 'WATCHES' }, d: { action: 'DIG_HINT' }
};
const CASE_ACTION: Record<string, Extract<TelegramUiAction,{shareId:string}>['action']> = {
  c: 'CASE', y: 'WHY', a: 'WATCH', u: 'UNWATCH', s: 'SHARE', f: 'FULL'
};

export function encodeCallback(action: TelegramUiAction): string {
  const code = ({ HOME:'h', RATS:'r', WATCHES:'w', DIG_HINT:'d', CASE:'c', WHY:'y', WATCH:'a', UNWATCH:'u', SHARE:'s', FULL:'f' } as const)[action.action];
  const value = 'shareId' in action ? `${TELEGRAM_UI_CALLBACK_VERSION}:${code}:${action.shareId}` : `${TELEGRAM_UI_CALLBACK_VERSION}:${code}`;
  if (new TextEncoder().encode(value).byteLength > TELEGRAM_CALLBACK_MAX_BYTES) throw new Error('TELEGRAM_CALLBACK_TOO_LARGE');
  return value;
}

export function parseCallback(value: string): TelegramUiAction | null {
  if (new TextEncoder().encode(value).byteLength > TELEGRAM_CALLBACK_MAX_BYTES) return null;
  const simple = value.match(/^br2:([hrwd])$/);
  if (simple) return SIMPLE[simple[1]!] ?? null;
  const scoped = value.match(/^br2:([cyausf]):([0-9a-f]{40})$/);
  if (!scoped) return null;
  const action = CASE_ACTION[scoped[1]!];
  return action ? { action, shareId: scoped[2]! } as TelegramUiAction : null;
}
