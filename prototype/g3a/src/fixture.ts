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

export const demo = {
  id: 'DEMO-PONS-001',
  name: 'MOLD',
  label: 'DEMO — FICTIONAL',
  description: 'A separate fictional case. It is unrelated to the verified historical receipt.',
  monitoring: 'No monitoring enabled.'
} as const;

export const shortAddress = (address: string, start = 8, end = 9) =>
  `${address.slice(0, start)}…${address.slice(-end)}`;
