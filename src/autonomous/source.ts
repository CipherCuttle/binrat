import { createPublicClient, http } from 'viem';
import { arcMainnet } from '../arc/chain.js';

export interface WatchSource {
  head(): Promise<{ chainId: number; block: bigint; hash: string; timestampMs: number }>;
  point(block: bigint): Promise<{ hash: string; timestampMs: number }>;
}
export function arcWatchSource(rpcUrl: string): WatchSource {
  const client = createPublicClient({ chain: arcMainnet(rpcUrl),
    transport: http(rpcUrl, { timeout: 8000, retryCount: 0 }) });
  return {
    async head() {
      const chainId = await client.getChainId();
      const block = await client.getBlock({ blockTag: 'latest' });
      if (chainId !== 5042 || block.number === null || !block.hash) throw new Error('SOURCE_UNAVAILABLE');
      return { chainId, block: block.number, hash: block.hash, timestampMs: Number(block.timestamp) * 1000 };
    },
    async point(blockNumber) {
      if (await client.getChainId() !== 5042) throw new Error('SOURCE_UNAVAILABLE');
      const block = await client.getBlock({ blockNumber });
      if (!block.hash) throw new Error('SOURCE_UNAVAILABLE');
      return { hash:block.hash,timestampMs:Number(block.timestamp)*1000 };
    }
  };
}
