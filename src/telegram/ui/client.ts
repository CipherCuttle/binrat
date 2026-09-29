import { createHash } from 'node:crypto';
import { ratMediaUrl } from '../ratMedia.js';
import { keyboardMarkup } from './keyboard.js';
import { cardDigestMaterial, type RatCard } from './types.js';

interface ApiResult<T> { ok?: boolean; result?: T; description?: string; parameters?: { retry_after?: number } }
export class TelegramUiError extends Error { constructor(readonly code:'REJECTED'|'AMBIGUOUS', readonly retryAfter?:number) { super(`TELEGRAM_UI_${code}`); } }
async function call<T>(token:string, method:string, body:unknown, fetchImpl:typeof fetch):Promise<T> {
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),10_000);
  try {
    const response=await fetchImpl(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:controller.signal});
    const result=await response.json().catch(()=>null) as ApiResult<T>|null;
    if (response.ok && result?.ok) return result.result as T;
    if (response.status===400 && /message is not modified/i.test(result?.description ?? '')) return true as T;
    if (response.status>=400 && response.status<500) throw new TelegramUiError('REJECTED',result?.parameters?.retry_after);
    throw new TelegramUiError('AMBIGUOUS',result?.parameters?.retry_after);
  } catch (error) { if (error instanceof TelegramUiError) throw error; throw new TelegramUiError('AMBIGUOUS'); }
  finally { clearTimeout(timer); }
}
export async function answerCallback(token:string, callbackQueryId:string, fetchImpl:typeof fetch):Promise<void> { await call<boolean>(token,'answerCallbackQuery',{callback_query_id:callbackQueryId},fetchImpl); }
function messageId(result: {message_id?:number}): number {
  if (!Number.isSafeInteger(result?.message_id)) throw new TelegramUiError('AMBIGUOUS'); return result.message_id!;
}
async function sendTextCard(token:string,chatId:number,card:RatCard,fetchImpl:typeof fetch):Promise<number> {
  return messageId(await call<{message_id?:number}>(token,'sendMessage',{chat_id:chatId,text:card.caption,reply_markup:keyboardMarkup(card.keyboard)},fetchImpl));
}
export async function sendCard(token:string,chatId:number,origin:string,card:RatCard,mediaEnabled:boolean,fetchImpl:typeof fetch):Promise<number> {
  if (!mediaEnabled) return sendTextCard(token,chatId,card,fetchImpl);
  try {
    return messageId(await call<{message_id?:number}>(token,'sendPhoto',{chat_id:chatId,photo:ratMediaUrl(origin,card.media),caption:card.caption,reply_markup:keyboardMarkup(card.keyboard)},fetchImpl));
  } catch (error) {
    // A definitive rejection proves Telegram did not create the photo message.
    if (error instanceof TelegramUiError && error.code === 'REJECTED') return sendTextCard(token,chatId,card,fetchImpl);
    throw error;
  }
}
export async function editCard(token:string,chatId:number,messageId:number,origin:string,card:RatCard,mediaEnabled:boolean,fetchImpl:typeof fetch):Promise<void> {
  const markup=keyboardMarkup(card.keyboard);
  if (!mediaEnabled) {
    // Existing photo cards retain their photo after media is disabled. Text cards
    // reject caption edits, then safely receive a text-only edit without artwork.
    try { await call(token,'editMessageCaption',{chat_id:chatId,message_id:messageId,caption:card.caption,reply_markup:markup},fetchImpl); return; }
    catch (error) { if (!(error instanceof TelegramUiError) || error.code !== 'REJECTED') throw error; }
    await call(token,'editMessageText',{chat_id:chatId,message_id:messageId,text:card.caption,reply_markup:markup},fetchImpl);
    return;
  }
  try {
    await call(token,'editMessageMedia',{chat_id:chatId,message_id:messageId,media:{type:'photo',media:ratMediaUrl(origin,card.media),caption:card.caption},reply_markup:markup},fetchImpl);
  } catch (error) {
    // Do not issue a second message after a failed edit; keep the existing card
    // and update its canonical text if Telegram definitively rejects the artwork.
    if (!(error instanceof TelegramUiError) || error.code !== 'REJECTED') throw error;
    try { await call(token,'editMessageCaption',{chat_id:chatId,message_id:messageId,caption:card.caption,reply_markup:markup},fetchImpl); }
    catch (captionError) {
      if (!(captionError instanceof TelegramUiError) || captionError.code !== 'REJECTED') throw captionError;
      await call(token,'editMessageText',{chat_id:chatId,message_id:messageId,text:card.caption,reply_markup:markup},fetchImpl);
    }
  }
}
export async function sendDigForceReply(token:string,chatId:number,fetchImpl:typeof fetch):Promise<number> {
  return messageId(await call<{message_id?:number}>(token,'sendMessage',{chat_id:chatId,text:"🐀 drop the deployer address here. i'll dig.",reply_markup:{force_reply:true,input_field_placeholder:'Robinhood/Pons deployer address'},disable_web_page_preview:true},fetchImpl));
}
export async function deleteMessage(token:string,chatId:number,messageId:number,fetchImpl:typeof fetch):Promise<void> { await call(token,'deleteMessage',{chat_id:chatId,message_id:messageId},fetchImpl); }
export async function sendChatAction(token:string,chatId:number,action:'typing'|'upload_photo',fetchImpl:typeof fetch):Promise<void> { await call(token,'sendChatAction',{chat_id:chatId,action},fetchImpl); }
export function ratCardDigest(card:RatCard):string { return createHash('sha256').update(cardDigestMaterial(card)).digest('hex'); }
