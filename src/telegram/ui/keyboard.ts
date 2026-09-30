import { encodeCallback, type TelegramUiAction } from './callback.js';
import type { RatButton, TelegramInlineKeyboardMarkup } from './types.js';

export function callbackButton(text: string, action: TelegramUiAction, style?: 'danger' | 'success' | 'primary'): RatButton {
  return { text, callbackData: encodeCallback(action), ...(style ? { style } : {}) };
}
export function copyButton(text: string, value: string): RatButton {
  if (!value || Array.from(value).length > 256) throw new Error('TELEGRAM_COPY_TEXT_INVALID');
  return { text, copyText:value };
}
export function webAppButton(text: string, url: string): RatButton {
  if (!/^https:\/\//.test(url)) throw new Error('TELEGRAM_WEB_APP_URL_INVALID');
  return { text, webAppUrl:url };
}
export function keyboardMarkup(rows: RatButton[][]): TelegramInlineKeyboardMarkup {
  return { inline_keyboard: rows.map(row => row.map(button => {
    if ('callbackData' in button) return { text:button.text, callback_data:button.callbackData, ...(button.style ? {style:button.style}: {}) };
    if ('copyText' in button) return { text:button.text, copy_text:{ text:button.copyText } };
    if ('webAppUrl' in button) return { text:button.text, web_app:{ url:button.webAppUrl } };
    return { text:button.text,url:button.url };
  })) };
}
