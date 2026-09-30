#!/usr/bin/env node
// Read-only production menu-scope receipt. It deliberately logs semantic menu
// authority only: never a bot token, tester ID, or Telegram message content.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';

const CONFIG = '/tmp/binrat-telegram-menu-forensics.jsonc';
const DB_ID = '46814564-1a41-449a-88e5-c1349eed3a27';
const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
if (!token) throw new Error('TELEGRAM_BOT_TOKEN_MISSING');

function parseJsonc(path) {
  return JSON.parse(readFileSync(path, 'utf8').replace(/^\s*\/\/.*$/gm, '').replace(/,\s*([}\]])/g, '$1'));
}
function cli(args) {
  const output = execFileSync('pnpm', ['dlx', 'wrangler@4.135.0', ...args], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: process.env, timeout: 120_000
  }).trim();
  const offsets = [output.indexOf('{'), output.indexOf('[')].filter(index => index >= 0);
  if (!offsets.length) throw new Error('WRANGLER_JSON_MISSING');
  return JSON.parse(output.slice(Math.min(...offsets)));
}
function walk(value, match) {
  if (!value || typeof value !== 'object') return null;
  const found = match(value);
  if (found) return found;
  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    const nested = walk(child, match);
    if (nested) return nested;
  }
  return null;
}
function testerId() {
  const configured = process.env.CONTROLLED_RAT_ALLOWED_USER_ID?.trim() || process.env.CONTROLLED_RAT_ALLOWED_USER_ID_FALLBACK?.trim();
  if (configured && /^[1-9]\d{3,16}$/.test(configured)) return configured;
  const row = walk(cli(['d1', 'execute', 'DB', '--remote', '--yes', '--json', '--command',
    "SELECT CASE WHEN COUNT(*) = 1 THEN MAX(user_id) ELSE NULL END AS user_id, COUNT(*) AS matches FROM rat_feedback WHERE body = 'binrat-controlled-rat-id-0929';",
    '--config', CONFIG]), value => Number.isFinite(Number(value.matches)) && Object.hasOwn(value, 'user_id') ? value : null);
  if (!row || Number(row.matches) !== 1 || !/^[1-9]\d{3,16}$/.test(String(row.user_id ?? ''))) {
    throw new Error('CONTROLLED_RAT_TESTER_MARKER_INVALID');
  }
  return String(row.user_id);
}
function semantic(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.type !== 'string') throw new Error('TELEGRAM_MENU_BUTTON_MALFORMED');
  if (value.type === 'commands' || value.type === 'default') return { type: value.type };
  if (value.type === 'web_app' && typeof value.text === 'string' && value.web_app && typeof value.web_app === 'object' && typeof value.web_app.url === 'string') {
    return { type: 'web_app', text: value.text, url: value.web_app.url };
  }
  throw new Error('TELEGRAM_MENU_BUTTON_MALFORMED');
}
async function menu(chatId) {
  const response = await fetch(`https://api.telegram.org/bot${token}/getChatMenuButton`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(chatId ? { chat_id: chatId } : {}), signal: AbortSignal.timeout(20_000)
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.ok !== true) throw new Error('TELEGRAM_MENU_READBACK_FAILED');
  return semantic(body.result);
}

const config = parseJsonc('cloudflare/wrangler.example.jsonc');
config.d1_databases[0].database_id = DB_ID;
writeFileSync(CONFIG, JSON.stringify(config));
try {
  const tester = testerId();
  const [global, privateTester] = await Promise.all([menu(), menu(tester)]);
  console.log('TELEGRAM_MENU_FORENSICS=' + JSON.stringify({ global, privateTester }));
} finally {
  rmSync(CONFIG, { force: true });
}
