export const TELEGRAM_UI_CALLBACK_VERSION = 'br2' as const;
export const TELEGRAM_CALLBACK_MAX_BYTES = 64;

export type TelegramUiAction =
  | { action: 'HOME' } | { action: 'RATS' } | { action: 'WATCHES' } | { action: 'DIG_PROMPT' }
  | { action: 'RATS_PAGE'; discoveryId: string; index: number }
  | { action: 'CASE' | 'WHY' | 'WATCH' | 'UNWATCH' | 'SHARE' | 'FULL'; shareId: string };

const SIMPLE: Record<string, Extract<TelegramUiAction,{ action: 'HOME' | 'RATS' | 'WATCHES' | 'DIG_PROMPT' }>> = {
  h: { action: 'HOME' }, r: { action: 'RATS' }, w: { action: 'WATCHES' }, d: { action: 'DIG_PROMPT' }
};
const CASE_ACTION: Record<string, Extract<TelegramUiAction,{shareId:string}>['action']> = {
  c: 'CASE', y: 'WHY', a: 'WATCH', u: 'UNWATCH', s: 'SHARE', f: 'FULL'
};

export function encodeCallback(action: TelegramUiAction): string {
  if (action.action === 'RATS_PAGE') {
    if (!/^[0-9a-f]{64}$/.test(action.discoveryId) || !Number.isInteger(action.index) || action.index < 0 || action.index > 9) throw new Error('TELEGRAM_CALLBACK_INVALID');
    const value = `${TELEGRAM_UI_CALLBACK_VERSION}:p:${hexToBase64url(action.discoveryId)}:${action.index.toString(36)}`;
    if (new TextEncoder().encode(value).byteLength > TELEGRAM_CALLBACK_MAX_BYTES) throw new Error('TELEGRAM_CALLBACK_TOO_LARGE');
    return value;
  }
  const code = ({ HOME:'h', RATS:'r', WATCHES:'w', DIG_PROMPT:'d', CASE:'c', WHY:'y', WATCH:'a', UNWATCH:'u', SHARE:'s', FULL:'f' } as const)[action.action];
  const value = 'shareId' in action ? `${TELEGRAM_UI_CALLBACK_VERSION}:${code}:${action.shareId}` : `${TELEGRAM_UI_CALLBACK_VERSION}:${code}`;
  if (new TextEncoder().encode(value).byteLength > TELEGRAM_CALLBACK_MAX_BYTES) throw new Error('TELEGRAM_CALLBACK_TOO_LARGE');
  return value;
}

export function parseCallback(value: string): TelegramUiAction | null {
  if (new TextEncoder().encode(value).byteLength > TELEGRAM_CALLBACK_MAX_BYTES) return null;
  const simple = value.match(/^br2:([hrwd])$/);
  if (simple) return SIMPLE[simple[1]!] ?? null;
  const page = value.match(/^br2:p:([A-Za-z0-9_-]{43}):([0-9a-z])$/);
  if (page) {
    const discoveryId = base64urlToHex(page[1]!);
    const index = Number.parseInt(page[2]!,36);
    return discoveryId !== null && Number.isInteger(index) && index >= 0 && index <= 9 ? {action:'RATS_PAGE',discoveryId,index} : null;
  }
  const scoped = value.match(/^br2:([cyausf]):([0-9a-f]{40})$/);
  if (!scoped) return null;
  const action = CASE_ACTION[scoped[1]!];
  return action ? { action, shareId: scoped[2]! } as TelegramUiAction : null;
}
function hexToBase64url(hex: string): string {
  const bytes = new Uint8Array(32);
  for (let index=0; index<bytes.length; index++) bytes[index]=Number.parseInt(hex.slice(index*2,index*2+2),16);
  let binary=''; for (const byte of bytes) binary+=String.fromCharCode(byte);
  return btoa(binary).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
}
function base64urlToHex(value: string): string | null {
  try {
    const binary=atob(value.replaceAll('-','+').replaceAll('_','/')+'=');
    if (binary.length !== 32) return null;
    return Array.from(binary,byte=>byte.charCodeAt(0).toString(16).padStart(2,'0')).join('');
  } catch { return null; }
}
