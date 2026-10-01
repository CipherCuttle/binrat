#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { telegramProductConfig } from './config.js';
import {
  activatePrivateTesterMenu, applyTelegramConfig, formatTelegramPlan, planTelegramConfig, productionTelegramApi,
  snapshotPrivateTesterMenu,
  restorePrivateTesterMenu, type PrivateTesterMenuSnapshot,
  telegramConfigHash, telegramProfileAssetHash
} from './configManager.js';

const command = process.argv[2] ?? 'plan';
const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
if (!token) throw new Error('TELEGRAM_BOT_TOKEN_MISSING');
const api = productionTelegramApi(token);

function privateTesterId(): string {
  const value = process.env.CONTROLLED_RAT_PRIVATE_TESTER_ID?.trim() ?? '';
  if (!/^[1-9]\d{3,16}$/.test(value)) throw new Error('CONTROLLED_RAT_PRIVATE_TESTER_ID_MISSING_OR_INVALID');
  return value;
}
function menuStatePath(): string {
  const value = process.env.BINRAT_TELEGRAM_MENU_STATE_PATH?.trim() ?? '';
  if (!value.startsWith('/tmp/binrat-private-menu-') || !value.endsWith('.json')) {
    throw new Error('TELEGRAM_MENU_STATE_PATH_INVALID');
  }
  return value;
}

async function verify(): Promise<void> {
  const result = await planTelegramConfig(api);
  console.log(formatTelegramPlan(result.diffs));
  const drift = result.diffs.filter(row => row.status === 'update_required' || row.status === 'blocked');
  if (drift.length) throw new Error(`TELEGRAM_CONFIG_DRIFT:${drift.map(row => row.key).join(',')}`);
}

async function smoke(): Promise<void> {
  await verify();
  const origin=new URL(telegramProductConfig.miniApp.url).origin;
  const [serviceResponse, assetHash] = await Promise.all([
    fetch(`${origin}/health`, { signal: AbortSignal.timeout(20_000) }),
    telegramProfileAssetHash()
  ]);
  const service = await serviceResponse.json() as Record<string, unknown>;
  if (!serviceResponse.ok || service.ok !== true || service.service !== 'binrat-cloudflare-edge') throw new Error('SMOKE_SERVICE_UNHEALTHY');

  let pons: Record<string, unknown> | null = null;
  let ponsHealthy=false;
  for (let attempt=0;attempt<7;attempt+=1) {
    const ponsResponse=await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(20_000) });
    pons=await ponsResponse.json().catch(()=>null) as Record<string, unknown> | null;
    ponsHealthy=Boolean(ponsResponse.ok && pons?.ok === true && pons.chainId === 4663 &&
      pons.indexReady === true && pons.liveCaughtUp === true && pons.lastSyncError === null);
    console.log(`TELEGRAM_SMOKE_PONS_PROBE attempt=${attempt+1} healthy=${ponsHealthy}`);
    if (ponsHealthy) break;
    if (attempt<6) await new Promise(resolve=>setTimeout(resolve,5_000));
  }
  if (!ponsHealthy) throw new Error('SMOKE_PONS_UNHEALTHY');
  if (service.autonomousRatPublicEnabled !== false || service.autonomousRatEnabled !== true ||
      service.telegramUiV2Enabled !== true || service.telegramMediaEnabled !== true) {
    throw new Error('SMOKE_PRIVATE_FEATURE_STATE_INVALID');
  }
  const forged = await fetch(`${new URL(telegramProductConfig.miniApp.url).origin}/api/miniapp/bootstrap`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ initData: 'user=%7B%22id%22%3A1%7D&auth_date=1&hash=' + '0'.repeat(64) }),
    signal: AbortSignal.timeout(20_000)
  });
  if (forged.status !== 401) throw new Error('SMOKE_FORGED_IDENTITY_NOT_REJECTED');
  const receipt = {
    schemaVersion: 'binrat.telegram-deploy-receipt/1',
    releaseSha: service.releaseSha ?? null,
    botApiConfigHash: telegramConfigHash(),
    profileAssetHash: assetHash,
    miniAppUrl: telegramProductConfig.miniApp.url,
    cloudflareVersion: process.env.BINRAT_CLOUDFLARE_VERSION_ID ?? null,
    featureFlags: telegramProductConfig.features,
    migrationState: process.env.BINRAT_MIGRATION_STATE ?? 'verified-by-controlled-rollout',
    webhook: telegramProductConfig.webhook.url,
    verifiedAt: new Date().toISOString()
  };
  const path = process.env.BINRAT_SMOKE_RECEIPT_PATH ?? '.artifacts/telegram-smoke-receipt.json';
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
  console.log(`TELEGRAM_SMOKE_PASS receipt=${path}`);
  console.log('Incoming user updates cannot be simulated by the Bot API; mobile callback/ForceReply acceptance remains an owner test.');
}

if (command === 'plan') {
  const result = await planTelegramConfig(api);
  console.log(formatTelegramPlan(result.diffs));
} else if (command === 'apply') {
  const diffs = await applyTelegramConfig(api);
  console.log(formatTelegramPlan(diffs));
  console.log('TELEGRAM_CONFIG_APPLY_PASS');
} else if (command === 'verify') await verify();
else if (command === 'private-menu-activate') {
  const path = menuStatePath();
  const testerChatId = privateTesterId();
  const snapshot = await snapshotPrivateTesterMenu(api, testerChatId);
  // The snapshot is intentionally local to the ephemeral runner and mode 0600.
  // It contains no token or user content and permits exact rollback after postdeploy failure.
  await writeFile(path, JSON.stringify(snapshot), { mode: 0o600 });
  await activatePrivateTesterMenu(api, testerChatId, telegramProductConfig, undefined, undefined, snapshot);
  console.log('TELEGRAM_PRIVATE_MENU_APPLY_PASS');
} else if (command === 'private-menu-restore') {
  const snapshot = JSON.parse(await readFile(menuStatePath(), 'utf8')) as PrivateTesterMenuSnapshot;
  if (snapshot.testerChatId !== privateTesterId()) throw new Error('TELEGRAM_MENU_SNAPSHOT_TESTER_MISMATCH');
  await restorePrivateTesterMenu(api, snapshot);
  console.log('TELEGRAM_PRIVATE_MENU_RESTORE_PASS');
}
else if (command === 'smoke') await smoke();
else throw new Error('USAGE: configCli.ts plan|apply|verify|private-menu-activate|private-menu-restore|smoke');
