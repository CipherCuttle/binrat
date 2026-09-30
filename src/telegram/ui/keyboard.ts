import { encodeCallback, type TelegramUiAction } from './callback.js';
import type { RatButton, TelegramInlineKeyboardMarkup } from './types.js';

export function callbackButton(text: string, action: TelegramUiAction, style?: 'danger' | 'success' | 'primary'): RatButton {
  return { text, callbackData: encodeCallback(action), ...(style ? { style } : {}) };
}
export function copyButton(text: string, value: string): RatButton {
  if (!value || Array.from(value).length > 256) throw new Error('TELEGRAM_COPY_TEXT_INVALID');
  return { text, copyText:value };
}
export function keyboardMarkup(rows: RatButton[][]): TelegramInlineKeyboardMarkup {
  return { inline_keyboard: rows.map(row => row.map(button => {
    if ('callbackData' in button) return { text:button.text, callback_data:button.callbackData, ...(button.style ? {style:button.style}: {}) };
    if ('copyText' in button) return { text:button.text, copy_text:{ text:button.copyText } };
    return { text:button.text,url:button.url };
  })) };
}
