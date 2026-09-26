export const receipt = {
  fixtureId: 'BINRAT-G1A-PONS-4663-20260926-v3',
  status: 'OBSERVED_HISTORICAL_SNAPSHOT_NOT_LIVE',
  chainId: 4663,
  protocol: 'Pons V2',
  network: 'Robinhood Chain 4663',
  token: '0xb0ee78dffa46dbe4e667e9dddc6e3ddae33563d9',
  curve: '0xf22a1f125df55879821cfa366a6d74166c6bab91',
  factory: '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e',
  originalDeployer: '0x54ec7ec16f034a33f8976917549248b6eb639c39',
  block: 72448839,
  time: '2026-09-25T18:40:22Z',
  asOf: '2026-09-25T19:07:57Z',
  pair: 'native ETH',
  transaction: '0x44d2bdc412ebe6ce0c25600a16adb229b1bd5c22a41267823b0db39161c6e1cb',
  explorer: 'https://robinscan.io/tx/0x44d2bdc412ebe6ce0c25600a16adb229b1bd5c22a41267823b0db39161c6e1cb',
  funding: 'UNKNOWN',
  pricing: 'NOT RECONSTRUCTED',
  feeRecipient: 'UNKNOWN',
  graduation: 'UNKNOWN',
  v4: 'UNKNOWN'
} as const;

export type DemoWindow = '6h' | '24h' | '3d' | '7d';

export const demo = {
  id: 'DEMO-PONS-001',
  name: 'MOLD',
  symbol: '$MOLD (DEMO)',
  label: 'DEMO — FICTIONAL',
  funder: 'DEMO-FUNDER-A',
  description: 'A separate fictional case. It is unrelated to the verified historical receipt.',
  monitoring: 'No monitoring enabled.',
  asOf: '2026-09-20T12:00:00Z',
  transfers: [
    {
      launch: 'MOLD',
      target: 'DEMO-LAUNCHER-MOLD',
      eth: 0.18,
      minutesBeforeLaunch: 23,
      current: true
    },
    {
      launch: 'GRIME',
      target: 'DEMO-LAUNCHER-GRIME',
      eth: 0.11,
      minutesBeforeLaunch: 34,
      current: false
    },
    {
      launch: 'SLUDGE',
      target: 'DEMO-LAUNCHER-SLUDGE',
      eth: 0.14,
      minutesBeforeLaunch: 42,
      current: false
    },
    {
      launch: 'DUST',
      target: 'DEMO-LAUNCHER-DUST',
      eth: 0.07,
      minutesBeforeLaunch: 18,
      current: false
    }
  ],
  previous: [
    {
      name: 'GRIME',
      launcher: 'DEMO-LAUNCHER-GRIME',
      ageHours: 216,
      peakEstimatedFDV: 48000,
      latestEstimatedFDV: 7200,
      timeToPeakHours: 9,
      eligible: ['6h', '24h', '3d', '7d'] as DemoWindow[]
    },
    {
      name: 'SLUDGE',
      launcher: 'DEMO-LAUNCHER-SLUDGE',
      ageHours: 120,
      peakEstimatedFDV: 31500,
      latestEstimatedFDV: 12500,
      timeToPeakHours: 17,
      eligible: ['6h', '24h', '3d'] as DemoWindow[]
    },
    {
      name: 'DUST',
      launcher: 'DEMO-LAUNCHER-DUST',
      ageHours: 30,
      peakEstimatedFDV: null,
      latestEstimatedFDV: null,
      timeToPeakHours: null,
      eligible: ['6h', '24h'] as DemoWindow[]
    }
  ],
  windows: {
    '6h': { ageEligible: 3, priceSupported: 2 },
    '24h': { ageEligible: 3, priceSupported: 2 },
    '3d': { ageEligible: 2, priceSupported: 2 },
    '7d': { ageEligible: 1, priceSupported: 1 }
  } satisfies Record<DemoWindow, { ageEligible: number; priceSupported: number }>
} as const;

export const usd = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value);

export const shortAddress = (address: string, start = 8, end = 9) =>
  `${address.slice(0, start)}…${address.slice(-end)}`;
