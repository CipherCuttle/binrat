export type Hex = `0x${string}`;

export type LaunchSourceKind = 'ARCPAD';

export interface ChainPoint {
  chainId: number;
  blockNumber: bigint;
  blockHash: Hex;
  observedAtMs: number;
}

export interface LaunchObserved extends ChainPoint {
  launchId: string;
  eventId: string;
  source: LaunchSourceKind;
  launcher: Hex;
  txHash: Hex;
  logIndex: number;
  token: Hex;
  creator: Hex;
  pool: Hex;
  name: string;
  symbol: string;
  imageUri: string;
  website: string;
  twitter: string;
  telegram: string;
}

export interface ChainCheckpoint {
  chainId: number;
  blockNumber: bigint;
  blockHash: Hex;
  guardBlockNumber: bigint | null;
  guardBlockHash: Hex | null;
}
