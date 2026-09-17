import { canonicalJson, sha256Hex } from '../evidence/canonical.js';
import type { Hex, LaunchObserved } from './types.js';

function normHex(value: Hex): Hex {
  return value.toLowerCase() as Hex;
}

export async function deriveLaunchId(input: {
  chainId: number;
  launcher: Hex;
  txHash: Hex;
  token: Hex;
}): Promise<string> {
  return sha256Hex({
    kind: 'BINRAT_ARCPAD_LAUNCH_V0',
    chainId: input.chainId,
    launcher: normHex(input.launcher),
    txHash: normHex(input.txHash),
    token: normHex(input.token)
  });
}

export async function deriveEventId(input: {
  chainId: number;
  launcher: Hex;
  txHash: Hex;
  logIndex: number;
}): Promise<string> {
  return sha256Hex({
    kind: 'BINRAT_ARCPAD_EVENT_V0',
    chainId: input.chainId,
    launcher: normHex(input.launcher),
    txHash: normHex(input.txHash),
    logIndex: input.logIndex
  });
}

export function normalizeLaunchHex(launch: LaunchObserved): LaunchObserved {
  return {
    ...launch,
    blockHash: normHex(launch.blockHash),
    launcher: normHex(launch.launcher),
    txHash: normHex(launch.txHash),
    token: normHex(launch.token),
    creator: normHex(launch.creator),
    pool: normHex(launch.pool)
  };
}

export function sameLaunchAuthority(a: LaunchObserved, b: LaunchObserved): boolean {
  return canonicalJson(launchAuthority(a)) === canonicalJson(launchAuthority(b));
}

function launchAuthority(launch: LaunchObserved) {
  const value = normalizeLaunchHex(launch);
  return {
    launchId: value.launchId,
    eventId: value.eventId,
    chainId: value.chainId,
    blockNumber: value.blockNumber,
    blockHash: value.blockHash,
    source: value.source,
    launcher: value.launcher,
    txHash: value.txHash,
    logIndex: value.logIndex,
    token: value.token,
    creator: value.creator,
    pool: value.pool,
    name: value.name,
    symbol: value.symbol,
    imageUri: value.imageUri,
    website: value.website,
    twitter: value.twitter,
    telegram: value.telegram
  };
}
