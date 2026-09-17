import { defineChain } from 'viem';
import type { Hex } from '../core/types.js';

export const ARC_CHAIN_ID = 5042;
export const ARCPAD_START_BLOCK = 19_014_715n;
export const ARCPAD_LAUNCHER = '0x24196cd6e534cfce8f480b53e70809b68ea86f29' as Hex;

export function arcMainnet(rpcUrl: string) {
  return defineChain({
    id: ARC_CHAIN_ID,
    name: 'Arc',
    nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
    blockExplorers: { default: { name: 'Arc Explorer', url: 'https://arc.etherscan.io' } }
  });
}
