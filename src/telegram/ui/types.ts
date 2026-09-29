import type { RatMediaState } from '../ratMedia.js';

export const TELEGRAM_UI_RENDERER_VERSION = 'binrat.telegram-ui/2.0' as const;
export type RatView = 'HOME' | 'RATS' | 'CASE' | 'WHY' | 'WATCH_STATE' | 'WATCHLIST' | 'EMPTY' | 'ERROR' | 'DIG_WAITING' | 'DIGGING' | 'ALERT';
export type RatButton =
  | { text: string; callbackData: string; style?: 'danger' | 'success' | 'primary' }
  | { text: string; copyText: string }
  | { text: string; url: string };
export interface RatCard {
  rendererVersion: typeof TELEGRAM_UI_RENDERER_VERSION;
  view: RatView;
  media: RatMediaState;
  caption: string;
  keyboard: RatButton[][];
}
export interface TelegramInlineKeyboardMarkup { inline_keyboard: Array<Array<Record<string,unknown>>> }
export function cardDigestMaterial(card: RatCard): string {
  return JSON.stringify({ rendererVersion:card.rendererVersion, view:card.view, media:card.media,
    caption:card.caption, keyboard:card.keyboard });
}
