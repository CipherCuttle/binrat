#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { telegramProductConfig } from './config.js';
import {
  applyTelegramConfig, formatTelegramPlan, planTelegramConfig, productionTelegramApi,
  telegramConfigHash, telegramProfileAssetHash
} from './configManager.js';

const command = process.argv[2] ?? 'plan';
const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
if (!token) throw new Error('TELEGRAM_BOT_TOKEN_MISSING');
const api = productionTelegramApi(token);

async function verify(): Promise<void> {
  const result = await planTelegramConfig(api);
  console.log(formatTelegramPlan(result.diffs));
  const drift = result.diffs.filter(row => row.status === 'update_required' || row.status === 'blocked');
  if (drift.length) throw new Error(`TELEGRAM_CONFIG_DRIFT:${drift.map(row => row.key).join(',')}`);
}

async function smoke(): Promise<void> {
  await verify();
  const [serviceResponse, ponsResponse, assetHash] = await Promise.all([
    fetch(`${new URL(telegramProductConfig.miniApp.url).origin}/health`, { signal: AbortSignal.timeout(20_000) }),
    fetch(`${new URL(telegramProductConfig.miniApp.url).origin}/api/health`, { signal: AbortSignal.timeout(20_000) }),
    telegramProfileAssetHash()
  ]);
  const service = await serviceResponse.json() as Record<string, unknown>;
  const pons = await ponsResponse.json() as Record<string, unknown>;
  if (!serviceResponse.ok || service.ok !== true || service.service !== 'binrat-cloudflare-edge') throw new Error('SMOKE_SERVICE_UNHEALTHY');
  if (!ponsResponse.ok || pons.ok !== true || pons.chainId !== 4663 || pons.indexReady !== true ||
      pons.liveCaughtUp !== true || pons.lastSyncError !== null) throw new Error('SMOKE_PONS_UNHEALTHY');
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
else if (command === 'smoke') await smoke();
else throw new Error('USAGE: configCli.ts plan|apply|verify|smoke');
