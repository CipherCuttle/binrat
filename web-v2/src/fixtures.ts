import type { PublicFeed, RadarWatchlist } from './types';

const creator = '0x92f831C7E80cF1B3A2d96d6B6e03d98a21B57A40';

export const demoFeed: PublicFeed = {
  schemaVersion: 'binrat.public-feed/0.1',
  chainId: 5042,
  asOfBlock: '20418842',
  historyCoverage: 'PARTIAL',
  receipt: { receiptId: 'binrat-public:demo-20418842' },
  bags: [
    {
      id: 'bag-feral-arc-20418791',
      symbol: 'FERAL',
      name: 'Feral Frequency',
      token: '0x6F77D35b25BaB46D5Ff03Cf65A42402A84a67831',
      reportedCreatorAddress: creator,
      blockNumber: '20418791',
      txHash: '0xa74f4aac6c8f8547553c97845a291750ad5a3644815ee9b0f76a093643671fee',
      trashTrail: {
        coverage: 'PARTIAL',
        priorLaunchCount: 3,
        prior: [
          { id: 'bag-rind', symbol: 'RIND', name: 'Orange Rind', blockNumber: '20392118' },
          { id: 'bag-claw', symbol: 'CLAW', name: 'Sidewalk Claw', blockNumber: '20274002' },
          { id: 'bag-scab', symbol: 'SCAB', name: 'Scab Radio', blockNumber: '20198220' }
        ]
      },
      evidence: [
        { state: 'OBSERVED', text: 'Launch event fixed to Arc block 20,418,791.' },
        { state: 'OBSERVED', text: 'ArcPad reported the creator address shown in this file.' },
        { state: 'NOTED', text: 'The same reported creator address appears in 3 earlier indexed launches.' },
        { state: 'UNKNOWN', text: 'Human identity behind the address is not established.' }
      ]
    },
    {
      id: 'bag-slag-arc-20418502',
      symbol: 'SLAG',
      name: 'Slag Heap',
      token: '0x3A384b9Ba9025a766Ce86E06f8D439B6c7264B12',
      reportedCreatorAddress: '0x1C79020Ba514eC3D9ABeC88F47035a740Cc3e02D',
      blockNumber: '20418502',
      txHash: '0xb1bc911520c6f42980ec7d11a5d8de638fcaa13a17ee591f8c829cd54bf31baa',
      trashTrail: { coverage: 'PARTIAL', priorLaunchCount: 0, prior: [] },
      evidence: [
        { state: 'OBSERVED', text: 'Launch event and source fields were observed.' },
        { state: 'UNKNOWN', text: 'No earlier launch for this reported creator is present in current coverage.' }
      ]
    },
    {
      id: 'bag-gunk-arc-20418011',
      symbol: 'GUNK',
      name: 'Green Gunk',
      token: '0x963A64EBFDf988E11bcB3d52758Be6E6704dAc1a',
      reportedCreatorAddress: '0xB70d2b15B8dDb976327A06D77B9D0B1d28d72111',
      blockNumber: '20418011',
      txHash: '0x36939496ccb433bcad4ad6834aa1bbe3b2cc77d10c0e9a464a307eab11d25e68',
      trashTrail: { coverage: 'UNVERIFIED', priorLaunchCount: 1, prior: [{ id: 'bag-muck', symbol: 'MUCK', name: 'Muck', blockNumber: '19811840' }] },
      evidence: [
        { state: 'OBSERVED', text: 'Launch event was observed at the checkpoint.' },
        { state: 'NOTED', text: 'One earlier indexed launch shares the reported creator address.' },
        { state: 'UNKNOWN', text: 'Historical backfill is not verified complete.' }
      ]
    }
  ]
};

export const demoRadar: RadarWatchlist = {
  schemaVersion: 'binrat.rat-radar-watchlist/0.1',
  rankingVersion: 'binrat.rat-radar-ranking/0.1',
  chainId: 5042,
  asOfBlock: demoFeed.asOfBlock,
  coverage: {
    historyCoverage: 'PARTIAL',
    indexedLaunchCount: 126,
    swapReceiptCount: 1482,
    acquisitionReceiptCount: 906,
    distinctRecipientAddressCount: 414,
    rankedAddressCount: 5,
    status: 'PARTIAL'
  },
  method: {
    evidencedRole: 'V3_SWAP_RECIPIENT',
    identityBoundary: 'An observed recipient address is not automatically a human trader identity.',
    recommendationBoundary: 'Ranking describes observed recurrence and timing; it is not a BUY/SELL recommendation.'
  },
  candidates: [
    ['0x7cA80c219A384F9C4b285F10A7537B0f2629C0E1', 8, 18, 2, 1],
    ['0x31E6cb158D883Bf98f0D44649e5C3A9220459e7A', 6, 9, 4, 2],
    ['0xA93b2242C01e3184f8137E3a03feEc27aB6Ba779', 5, 12, 7, 3],
    ['0x2d8C1cc6Fb6830F9E12e74b0cb3cC09F45F2e861', 4, 6, 3, 4],
    ['0x18f0d98dD5a50E4a1739f23bB132b5682101E1aa', 3, 7, 11, 5]
  ].map(([address, launches, receipts, median, rank]) => ({
    rank: rank as number,
    observedRecipientAddress: address as string,
    distinctLaunchCount: launches as number,
    acquisitionReceiptCount: receipts as number,
    medianFirstEntryBlockDelta: median as number,
    earliestFirstEntryBlockDelta: 1,
    latestSeenBlock: String(20418842 - (rank as number) * 17),
    reasons: [
      `Observed as launched-token recipient across ${launches} distinct indexed launches.`,
      `Median first recipient-side acquisition: ${median} blocks after indexed launch.`,
      `${receipts} launched-token acquisition receipts observed.`
    ],
    evidenceActivityIds: [`${rank}`.repeat(64), `${(rank as number) + 1}`.repeat(64)]
  })),
  receipt: { receiptId: 'binrat-rat-radar:demo-20418842', evidenceDigest: 'demo-evidence-digest' }
};
