import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { telegramProductConfig, type TelegramProductConfig } from './config.js';
import { TelegramBotApiClient } from './configApi.js';

export type ConfigStatus = 'unchanged' | 'update_required' | 'blocked' | 'unsupported' | 'verification_unavailable';
export interface ConfigDiff {
  key: string;
  expected: string;
  actual: string;
  status: ConfigStatus;
  method?: string;
}

interface TelegramUser { id: number; is_bot: boolean; first_name: string; username?: string }
interface BotName { name: string }
interface BotDescription { description: string }
interface BotShortDescription { short_description: string }
interface BotCommand { command: string; description: string }
interface ProfilePhotos { total_count: number; photos: Array<Array<{ file_id: string; file_unique_id: string }>> }
interface WebhookInfo { url: string; has_custom_certificate?: boolean; pending_update_count?: number; last_error_date?: number }
interface ActualTelegramConfig {
  me: TelegramUser;
  name: string;
  description: string;
  shortDescription: string;
  commands: BotCommand[][];
  menuButton: NormalizedMenuButton;
  webhook: WebhookInfo;
  profilePhotoPresent: boolean;
}

export type NormalizedMenuButton =
  | { type: 'default' }
  | { type: 'commands' }
  | { type: 'web_app'; text: string; url: string };

export type MenuSleep = (ms: number) => Promise<void>;
const defaultMenuSleep: MenuSleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const menuReadbackDelaysMs = [0, 2_000, 3_000, 5_000, 10_000] as const;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/** Accept only documented MenuButton authority fields; reject unknown shapes. */
export function normalizeMenuButton(value: unknown): NormalizedMenuButton {
  const button = record(value);
  if (!button || typeof button.type !== 'string') throw new Error('TELEGRAM_MENU_BUTTON_MALFORMED');
  if (button.type === 'default' || button.type === 'commands') return { type: button.type };
  if (button.type === 'web_app') {
    const webApp = record(button.web_app);
    if (!webApp || typeof button.text !== 'string' || typeof webApp.url !== 'string') {
      throw new Error('TELEGRAM_MENU_BUTTON_MALFORMED');
    }
    return { type: 'web_app', text: button.text, url: webApp.url };
  }
  throw new Error('TELEGRAM_MENU_BUTTON_MALFORMED');
}

function menuButtonPayload(button: NormalizedMenuButton): Record<string, unknown> {
  if (button.type === 'web_app') return { type: button.type, text: button.text, web_app: { url: button.url } };
  return { type: button.type };
}

function sameMenuButton(a: NormalizedMenuButton, b: NormalizedMenuButton): boolean {
  return a.type === b.type && (a.type !== 'web_app' ||
    (b.type === 'web_app' && a.text === b.text && a.url === b.url));
}

export async function readMenuButton(api: TelegramConfigApi, chatId?: string): Promise<NormalizedMenuButton> {
  const body = chatId ? { chat_id: chatId } : undefined;
  return normalizeMenuButton(await api.call<unknown>('getChatMenuButton', body));
}

export async function setMenuButton(api: TelegramConfigApi, menu: NormalizedMenuButton, chatId?: string): Promise<void> {
  await api.call('setChatMenuButton', {
    ...(chatId ? { chat_id: chatId } : {}),
    menu_button: menuButtonPayload(menu)
  });
}

export async function verifyMenuButton(
  api: TelegramConfigApi, expected: NormalizedMenuButton, chatId?: string,
  sleep: MenuSleep = defaultMenuSleep, delays: readonly number[] = menuReadbackDelaysMs
): Promise<NormalizedMenuButton> {
  let actual: NormalizedMenuButton | null = null;
  for (const delayMs of delays) {
    if (delayMs) await sleep(delayMs);
    actual = await readMenuButton(api, chatId);
    if (sameMenuButton(expected, actual)) return actual;
  }
  throw new Error('TELEGRAM_MENU_BUTTON_VERIFY_FAILED');
}

export interface PrivateTesterMenuSnapshot { testerChatId: string; menuButton: NormalizedMenuButton }

export async function snapshotPrivateTesterMenu(
  api: TelegramConfigApi, testerChatId: string
): Promise<PrivateTesterMenuSnapshot> {
  return { testerChatId, menuButton: await readMenuButton(api, testerChatId) };
}

export async function activatePrivateTesterMenu(
  api: TelegramConfigApi, testerChatId: string, config = telegramProductConfig,
  sleep: MenuSleep = defaultMenuSleep, delays: readonly number[] = menuReadbackDelaysMs,
  suppliedSnapshot?: PrivateTesterMenuSnapshot
): Promise<PrivateTesterMenuSnapshot> {
  // A prior failed private rollout could only have left this exact global Web App
  // shape. Restore the documented pre-run commands menu, never arbitrary global state.
  const global = await readMenuButton(api);
  const expectedGlobal = normalizeMenuButton(config.globalMenuButton);
  if (!sameMenuButton(global, expectedGlobal)) {
    const failedRunDrift = sameMenuButton(global, normalizeMenuButton(config.privateTesterMenuButton));
    if (!failedRunDrift) throw new Error('TELEGRAM_GLOBAL_MENU_UNEXPECTED');
    await setMenuButton(api, expectedGlobal);
    await verifyMenuButton(api, expectedGlobal, undefined, sleep, delays);
  }
  const snapshot = suppliedSnapshot ?? await snapshotPrivateTesterMenu(api, testerChatId);
  if (snapshot.testerChatId !== testerChatId) throw new Error('TELEGRAM_MENU_SNAPSHOT_TESTER_MISMATCH');
  const expectedTester = normalizeMenuButton(config.privateTesterMenuButton);
  await setMenuButton(api, expectedTester, testerChatId);
  await verifyMenuButton(api, expectedTester, testerChatId, sleep, delays);
  return snapshot;
}

export async function restorePrivateTesterMenu(
  api: TelegramConfigApi, snapshot: PrivateTesterMenuSnapshot,
  sleep: MenuSleep = defaultMenuSleep, delays: readonly number[] = menuReadbackDelaysMs
): Promise<void> {
  await setMenuButton(api, snapshot.menuButton, snapshot.testerChatId);
  await verifyMenuButton(api, snapshot.menuButton, snapshot.testerChatId, sleep, delays);
}

export interface TelegramConfigApi {
  call<T>(method: string, body?: Record<string, unknown>): Promise<T>;
  setProfilePhoto(assetPath: string): Promise<boolean>;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function same(a: unknown, b: unknown): boolean { return stable(a) === stable(b); }
function display(value: unknown): string {
  const text = typeof value === 'string' ? value : stable(value);
  return text.length > 92 ? `${text.slice(0, 89)}...` : text;
}
function item(key: string, expected: unknown, actual: unknown, method?: string): ConfigDiff {
  return { key, expected: display(expected), actual: display(actual), status: same(expected, actual) ? 'unchanged' : 'update_required', method };
}

export async function readTelegramConfig(api: TelegramConfigApi, config = telegramProductConfig): Promise<ActualTelegramConfig> {
  const me = await api.call<TelegramUser>('getMe');
  const [name, description, shortDescription, menuButton, webhook, photos, ...commands] = await Promise.all([
    api.call<BotName>('getMyName'),
    api.call<BotDescription>('getMyDescription'),
    api.call<BotShortDescription>('getMyShortDescription'),
    readMenuButton(api),
    api.call<WebhookInfo>('getWebhookInfo'),
    api.call<ProfilePhotos>('getUserProfilePhotos', { user_id: me.id, offset: 0, limit: 1 }),
    ...config.commandScopes.map(entry => api.call<BotCommand[]>('getMyCommands', { scope: entry.scope }))
  ]);
  return {
    me, name: name.name, description: description.description,
    shortDescription: shortDescription.short_description,
    commands, menuButton, webhook,
    profilePhotoPresent: photos.total_count > 0 && photos.photos.length > 0
  };
}

export function diffTelegramConfig(actual: ActualTelegramConfig, config = telegramProductConfig): ConfigDiff[] {
  const usernameMatches = actual.me.username?.toLowerCase() === config.identity.username.toLowerCase();
  const rows: ConfigDiff[] = [
    {
      key: 'BOT USERNAME', expected: config.identity.username, actual: actual.me.username ?? '(missing)',
      status: usernameMatches ? 'unchanged' : 'blocked'
    },
    item('BOT NAME', config.identity.name, actual.name, 'setMyName'),
    item('DESCRIPTION', config.description, actual.description, 'setMyDescription'),
    item('SHORT DESCRIPTION', config.shortDescription, actual.shortDescription, 'setMyShortDescription')
  ];
  config.commandScopes.forEach((entry, index) => {
    rows.push(item(`COMMANDS ${entry.scope.type}`, entry.commands, actual.commands[index] ?? [], 'setMyCommands'));
  });
  const expectedGlobalMenu = normalizeMenuButton(config.globalMenuButton);
  rows.push({
    key: 'GLOBAL MENU BUTTON', expected: display(expectedGlobalMenu), actual: display(actual.menuButton),
    status: sameMenuButton(expectedGlobalMenu, actual.menuButton) ? 'unchanged' : 'blocked'
  });
  rows.push({
    key: 'WEBHOOK', expected: config.webhook.url, actual: actual.webhook.url || '(empty)',
    status: actual.webhook.url === config.webhook.url ? 'unchanged' : 'blocked'
  });
  rows.push({
    key: 'PROFILE PHOTO', expected: 'present (repo asset; content readback unavailable)',
    actual: actual.profilePhotoPresent ? 'present' : 'missing',
    status: actual.profilePhotoPresent ? 'verification_unavailable' : 'update_required',
    method: actual.profilePhotoPresent ? undefined : 'setMyProfilePhoto'
  });
  for (const manual of config.botFatherOnly) {
    rows.push({ key: 'BOTFATHER', expected: manual, actual: 'Bot API has no readback', status: 'unsupported' });
  }
  return rows;
}

export async function planTelegramConfig(api: TelegramConfigApi, config = telegramProductConfig) {
  const actual = await readTelegramConfig(api, config);
  return { actual, diffs: diffTelegramConfig(actual, config) };
}

export async function applyTelegramConfig(api: TelegramConfigApi, config = telegramProductConfig): Promise<ConfigDiff[]> {
  const before = await planTelegramConfig(api, config);
  const blocked = before.diffs.find(row => row.status === 'blocked');
  if (blocked) throw new Error(`TELEGRAM_CONFIG_BLOCKED:${blocked.key}`);
  if (before.actual.me.username?.toLowerCase() !== config.identity.username.toLowerCase()) {
    throw new Error('TELEGRAM_BOT_IDENTITY_MISMATCH');
  }
  for (const row of before.diffs.filter(entry => entry.status === 'update_required')) {
    if (row.key === 'BOT NAME') await api.call('setMyName', { name: config.identity.name });
    else if (row.key === 'DESCRIPTION') await api.call('setMyDescription', { description: config.description });
    else if (row.key === 'SHORT DESCRIPTION') await api.call('setMyShortDescription', { short_description: config.shortDescription });
    else if (row.key.startsWith('COMMANDS ')) {
      const scope = config.commandScopes.find(entry => `COMMANDS ${entry.scope.type}` === row.key)!;
      await api.call('setMyCommands', { scope: scope.scope, commands: scope.commands });
    }
    else if (row.key === 'PROFILE PHOTO') await api.setProfilePhoto(config.profilePhoto.assetPath);
    else throw new Error(`TELEGRAM_CONFIG_UNKNOWN_CHANGE:${row.key}`);
  }
  const after = await planTelegramConfig(api, config);
  const drift = after.diffs.filter(row => row.status === 'update_required' || row.status === 'blocked');
  if (drift.length) throw new Error(`TELEGRAM_CONFIG_VERIFY_FAILED:${drift.map(row => row.key).join(',')}`);
  return after.diffs;
}

export function telegramConfigHash(config: TelegramProductConfig = telegramProductConfig): string {
  return createHash('sha256').update(stable(config)).digest('hex');
}

export async function telegramProfileAssetHash(config = telegramProductConfig): Promise<string> {
  return createHash('sha256').update(await readFile(config.profilePhoto.assetPath)).digest('hex');
}

export function formatTelegramPlan(diffs: ConfigDiff[]): string {
  const lines = diffs.map(row => `${row.key.padEnd(28)} ${row.status.padEnd(24)} ${row.actual}`);
  const changes = diffs.filter(row => row.status === 'update_required').length;
  const manual = diffs.filter(row => row.status === 'unsupported').length;
  const blocked = diffs.filter(row => row.status === 'blocked').length;
  return [...lines, '', `${changes} API change(s)`, `${manual} BotFather-only item(s)`, `${blocked} blocking drift(s)`].join('\n');
}

export function productionTelegramApi(token: string): TelegramConfigApi {
  return new TelegramBotApiClient(token);
}
