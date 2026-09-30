import { defineChain } from 'viem';
import type { Hex } from '../core/types.js';

export const ROBINHOOD_CHAIN_ID = 4663;
export const PONS_V2_FACTORY = '0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e' as Hex;
export const PONS_V2_START_BLOCK = 27_027_321n;
export const PONS_V2_FACTORY_CODE_HASH = '0x89a27da6f703e0a7cdd4f233e7cb57604ff75b164530962d3ff7cf8483a67d84' as Hex;

export function robinhoodMainnet(rpcUrl: string) {
  return defineChain({
    id: ROBINHOOD_CHAIN_ID,
    name: 'Robinhood Chain',
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } }
  });
}
