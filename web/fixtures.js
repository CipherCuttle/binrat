export const hotGarbageFixtures = [
  {
    id: 'bag-rancid-001',
    symbol: '$RANCID',
    name: 'Rancid Coin',
    age: '17 sec',
    token: '0x1111111111111111111111111111111111111111',
    creator: '0xa71b000000000000000000000000000000000001',
    block: '21,400,118',
    coverage: 'PARTIAL',
    notedConditions: 2,
    priorLaunches: 8,
    mature24h: 6,
    unresolved: 2,
    concentration: '61%',
    evidence: [
      { tone: 'noted', text: 'same ArcPad-reported creator address appears on 8 earlier launches' },
      { tone: 'noted', text: 'top 5 non-system wallets hold 61% in this fixture' },
      { tone: 'observed', text: 'reverse trade observation exists in this fixture' },
      { tone: 'unknown', text: '2 historical outcomes are not mature yet' }
    ],
    trail: [
      { symbol: '$MUSH', age: '3d', outcome: '-94% @ 24h', coverage: 'COMPLETE' },
      { symbol: '$OOZE', age: '5d', outcome: '-88% @ 24h', coverage: 'COMPLETE' },
      { symbol: '$BAG', age: '8d', outcome: 'UNRESOLVED', coverage: 'PARTIAL' }
    ],
    note: 'same address. ninth bag.',
    receipt: 'receipt_fixture_rancid_001'
  },
  {
    id: 'bag-leftovr-002',
    symbol: '$LEFTOVR',
    name: 'Leftover Protocol',
    age: '4 min',
    token: '0x2222222222222222222222222222222222222222',
    creator: '0xb82c000000000000000000000000000000000002',
    block: '21,399,804',
    coverage: 'COMPLETE',
    notedConditions: 0,
    priorLaunches: 0,
    mature24h: 0,
    unresolved: 0,
    concentration: '18%',
    evidence: [
      { tone: 'observed', text: 'no prior ArcPad launch is present in this fixture for the reported creator address' },
      { tone: 'observed', text: 'top 5 non-system wallets hold 18% in this fixture' },
      { tone: 'unknown', text: 'no 24h outcome exists yet because the launch is fresh' }
    ],
    trail: [],
    note: 'new bag. not enough history yet.',
    receipt: 'receipt_fixture_leftovr_002'
  },
  {
    id: 'bag-moldy-003',
    symbol: '$MOLDY',
    name: 'Moldy Finance',
    age: '11 min',
    token: '0x3333333333333333333333333333333333333333',
    creator: '0xc93d000000000000000000000000000000000003',
    block: '21,398,770',
    coverage: 'PARTIAL',
    notedConditions: 1,
    priorLaunches: 3,
    mature24h: 2,
    unresolved: 1,
    concentration: '43%',
    evidence: [
      { tone: 'noted', text: 'reported creator address appears on 3 earlier ArcPad fixture launches' },
      { tone: 'observed', text: '2 mature historical observations are available' },
      { tone: 'unknown', text: '1 historical launch remains unresolved' }
    ],
    trail: [
      { symbol: '$CRUST', age: '6d', outcome: '-71% @ 24h', coverage: 'COMPLETE' },
      { symbol: '$SLOP', age: '9d', outcome: '+12% @ 24h', coverage: 'COMPLETE' },
      { symbol: '$TIN', age: '10d', outcome: 'UNRESOLVED', coverage: 'PARTIAL' }
    ],
    note: 'found older wrappers under it.',
    receipt: 'receipt_fixture_moldy_003'
  }
];

export const brandCopy = {
  primary: 'He gets the scraps. You get the receipts.',
  secondary: 'New launches go in the dumpster. BINRAT remembers what came before.',
  boundary: 'BINRAT reports observed evidence. It does not tell you what to buy, who a human is, or what a token will do next.'
};
