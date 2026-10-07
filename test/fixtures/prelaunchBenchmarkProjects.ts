import type { HistoricalBenchmarkProject } from '../../src/intelligence/prelaunchBenchmark.js';
import type {
  InstitutionalRelation,
  PrelaunchSignalKind
} from '../../src/intelligence/prelaunchScout.js';

interface ProjectInput {
  projectId: string;
  launchOn: string;
  codeOn: string;
  codeRef: string;
  executionOn: string;
  executionKind?: Extract<PrelaunchSignalKind, 'TESTNET_DEPLOYMENT' | 'CONTRACT_DEPLOYMENT' | 'AUDIT'>;
  executionRef: string;
  backingOn: string;
  backingEntity: string;
  backingRelation?: Extract<InstitutionalRelation, 'LEAD_INVESTOR' | 'INVESTOR' | 'STRATEGIC_INVESTOR'>;
  backingRef: string;
  launchRef: string;
}

function project(input: ProjectInput): HistoricalBenchmarkProject {
  return {
    projectId: input.projectId,
    launchOn: input.launchOn,
    fixture: {
      projectId: input.projectId,
      receipts: [
        {
          observedOn: input.codeOn,
          kind: 'PUBLIC_CODE',
          sourceRef: input.codeRef
        },
        {
          observedOn: input.executionOn,
          kind: input.executionKind ?? 'TESTNET_DEPLOYMENT',
          sourceRef: input.executionRef
        },
        {
          observedOn: input.backingOn,
          kind: 'INSTITUTIONAL_RELATION',
          entity: input.backingEntity,
          relation: input.backingRelation ?? 'LEAD_INVESTOR',
          sourceRef: input.backingRef
        },
        {
          observedOn: input.launchOn,
          kind: 'PUBLIC_LAUNCH',
          sourceRef: input.launchRef
        }
      ]
    }
  };
}

/**
 * Frozen historical cohort for the paired 90-day launch-horizon benchmark.
 *
 * PUBLIC_CODE dates are GitHub repository creation dates captured from GitHub metadata
 * on 2026-10-07. Other dates are frozen from the cited public announcements.
 *
 * This is intentionally not a profitability dataset. PUBLIC_LAUNCH means the project's
 * network became publicly usable (or the closest explicitly documented equivalent).
 */
export const PRELAUNCH_BENCHMARK_PROJECTS: readonly HistoricalBenchmarkProject[] = [
  project({
    projectId: 'taiko',
    codeOn: '2022-07-28',
    codeRef: 'https://github.com/taikoxyz/taiko-mono',
    executionOn: '2022-12-27',
    executionRef: 'https://www.reddit.com/r/taiko_xyz/comments/zwoz3z',
    backingOn: '2024-03-03',
    backingEntity: 'Wintermute Ventures',
    backingRelation: 'INVESTOR',
    backingRef: 'https://www.theblock.co/news/deals/2024-03-02-ethereum-layer-2-taiko-funding-mainnet-280268',
    launchOn: '2024-05-27',
    launchRef: 'https://github.com/taikoxyz/taiko-mono/blob/main/packages/protocol/deployments/mainnet-contract-logs-L1.md'
  }),
  project({
    projectId: 'scroll',
    codeOn: '2022-09-07',
    codeRef: 'https://github.com/scroll-tech/scroll',
    executionOn: '2023-02-27',
    executionRef: 'https://scroll.io/blog/alpha-testnet',
    backingOn: '2023-03-06',
    backingEntity: 'Polychain Capital',
    backingRef: 'https://www.theblock.co/news/deals/2023-03-06-ethereum-scaling-scroll-50-million-funding-round-1-8-billion-valuation-217340',
    launchOn: '2023-10-17',
    launchRef: 'https://chain.scroll.io/blog/founder-letter'
  }),
  project({
    projectId: 'zksync-era',
    codeOn: '2019-05-29',
    codeRef: 'https://github.com/matter-labs/zksync',
    executionOn: '2022-10-28',
    executionKind: 'CONTRACT_DEPLOYMENT',
    executionRef: 'https://www.theblock.co/amp/post/180846/matter-labs-releases-first-phase-of-zksync-2-0-mainnet-called-baby-alpha',
    backingOn: '2022-11-16',
    backingEntity: 'Blockchain Capital',
    backingRef: 'https://medium.com/@zksync-team',
    launchOn: '2023-03-24',
    launchRef: 'https://www.zksync.io/blog/transitioning-zksyncs-ecosystem-management-to-dappradar'
  }),
  project({
    projectId: 'starknet',
    codeOn: '2020-10-31',
    codeRef: 'https://github.com/starkware-libs/cairo-lang',
    executionOn: '2021-06-14',
    executionRef: 'https://www.starknet.io/blog/starknet-planets-alpha-on-testnet/',
    backingOn: '2021-03-24',
    backingEntity: 'Paradigm',
    backingRelation: 'INVESTOR',
    backingRef: 'https://investors.defillama.com/chain/starknet?events=false&incentives=true&tvl=false',
    launchOn: '2021-11-29',
    launchRef: 'https://www.starknet.io/blog/starknet-alpha-now-on-mainnet/'
  }),
  project({
    projectId: 'fuel',
    codeOn: '2020-08-27',
    codeRef: 'https://github.com/FuelLabs/fuel-core',
    executionOn: '2022-11-09',
    executionRef: 'https://forum.fuel.network/t/whats-the-difference-between-beta-1-testnet-and-beta-2-testnet/31',
    backingOn: '2022-09-06',
    backingEntity: 'Blockchain Capital',
    backingRef: 'https://www.theblock.co/news/ecosystems/2022-09-06-fuel-labs-scaling-startup-fundraise-167763',
    launchOn: '2024-09-25',
    launchRef: 'https://fuel.network/'
  }),
  project({
    projectId: 'aleo',
    codeOn: '2020-02-16',
    codeRef: 'https://github.com/ProvableHQ/snarkOS',
    executionOn: '2022-08-02',
    executionRef: 'https://aleo.org/',
    backingOn: '2022-02-07',
    backingEntity: 'SoftBank Vision Fund 2',
    backingRef: 'https://www.theblock.co/news/deals/2022-02-07-aleo-raises-200-million-softbank-tiger-others-blockchain-133218',
    launchOn: '2024-09-18',
    launchRef: 'https://aleo.org/post/announcing-aleo-mainnet/'
  }),
  project({
    projectId: 'celestia',
    codeOn: '2021-08-16',
    codeRef: 'https://github.com/celestiaorg/celestia-node',
    executionOn: '2022-05-25',
    executionRef: 'https://blog.celestia.org/celestia-testnet-introduces-alpha-data-availability-api/',
    backingOn: '2022-10-19',
    backingEntity: 'Bain Capital Crypto',
    backingRef: 'https://blog.celestia.org/celestia-raises-55m-to-launch-modular-blockchain-network/',
    launchOn: '2023-10-31',
    launchRef: 'https://blog.celestia.org/celestia-mainnet-is-live/'
  }),
  project({
    projectId: 'berachain',
    codeOn: '2023-01-10',
    codeRef: 'https://github.com/berachain/polaris',
    executionOn: '2024-01-11',
    executionRef: 'https://medium.com/berachain-foundation/the-bera-era-has-begun-49a18c6d77c0',
    backingOn: '2023-04-20',
    backingEntity: 'Polychain Capital',
    backingRef: 'https://www.theblock.co/news/business/2023-04-20-berachain-funding-new-layer-1-blockchain-227344',
    launchOn: '2025-02-06',
    launchRef: 'https://blog.berachain.com/'
  }),
  project({
    projectId: 'monad',
    codeOn: '2024-12-13',
    codeRef: 'https://github.com/monad-developers/foundry-monad',
    executionOn: '2025-02-19',
    executionRef: 'https://blog.uniswap.org/monad-testnet',
    backingOn: '2024-04-09',
    backingEntity: 'Paradigm',
    backingRef: 'https://www.theblock.co/news/deals/2024-04-09-monad-labs-raises-225-million-in-funding-round-led-by-paradigm-287257',
    launchOn: '2025-11-24',
    launchRef: 'https://blog.uniswap.org/'
  }),
  project({
    projectId: 'babylon',
    codeOn: '2024-07-26',
    codeRef: 'https://github.com/babylonlabs-io/babylon',
    executionOn: '2024-02-28',
    executionRef: 'https://babylonlabs.io/',
    backingOn: '2024-05-30',
    backingEntity: 'Paradigm',
    backingRef: 'https://www.prweb.com/releases/babylon-completes-70m-raise-led-by-paradigm-to-advance-trustless-bitcoin-staking-302159158.html',
    launchOn: '2025-04-10',
    launchRef: 'https://babylonlabs.io/blog/phase-2-launch-round-up---bitcoin-staking-activated-babylon-genesis-marches-towards-the-next-phase'
  }),
  project({
    projectId: 'avail',
    codeOn: '2021-12-14',
    codeRef: 'https://github.com/availproject/avail',
    executionOn: '2023-11-07',
    executionRef: 'https://blog.availproject.org/introducing-avails-clash-of-nodes-incentivized-testnet/',
    backingOn: '2024-02-26',
    backingEntity: 'Founders Fund',
    backingRef: 'https://blog.availproject.org/avail-raises-27m-to-accelerate-the-unification-of-web3/',
    launchOn: '2024-07-23',
    launchRef: 'https://blog.availproject.org/avail-da-mainnet-is-live/'
  }),
  project({
    projectId: 'eclipse',
    codeOn: '2023-11-15',
    codeRef: 'https://github.com/Eclipse-Laboratories-Inc/eclipse-benchmarking',
    executionOn: '2023-12-13',
    executionRef: 'https://www.eclipse.xyz/',
    backingOn: '2024-03-11',
    backingEntity: 'Placeholder',
    backingRef: 'https://www.coindesk.com/business/2024/03/11/blockchain-builder-eclipse-labs-raises-50m-ahead-of-layer-2s-mainnet-debut',
    launchOn: '2024-11-07',
    launchRef: 'https://www.prnewswire.com/news-releases/eclipse-foundation-launches-public-mainnet-with-a-novel-solana-virtual-machine-chain-on-ethereum-302298840.html'
  }),
  project({
    projectId: 'movement',
    codeOn: '2024-02-22',
    codeRef: 'https://github.com/movement-network/movement',
    executionOn: '2024-07-30',
    executionRef: 'https://www.prnewswire.com/news-releases/movement-labs-joins-the-agglayer-developed-by-polygon-labs-bringing-unified-liquidity-to-move-based-l2-chains-302209489.html',
    backingOn: '2024-04-25',
    backingEntity: 'Polychain Capital',
    backingRef: 'https://www.theblock.co/news/deals/2024-04-25-polychain-capital-38-million-usd-series-a-round-movement-labs-facebook-move-ethereum-290891',
    launchOn: '2024-12-09',
    launchRef: 'https://www.movementnetwork.xyz/'
  }),
  project({
    projectId: 'initia',
    codeOn: '2023-10-12',
    codeRef: 'https://github.com/initia-labs/initia',
    executionOn: '2024-05-14',
    executionRef: 'https://initia.xyz/',
    backingOn: '2024-09-25',
    backingEntity: 'Theory Ventures',
    backingRef: 'https://www.theblock.co/news/deals/2024-09-25-initia-funding-token-valuation-318102',
    launchOn: '2025-04-24',
    launchRef: 'https://initia.xyz/'
  }),
  project({
    projectId: 'story',
    codeOn: '2024-02-26',
    codeRef: 'https://github.com/thedatafoundation/protocol-core-v1',
    executionOn: '2024-08-27',
    executionRef: 'https://forum.story.foundation/t/genesis-set-announcement/27332',
    backingOn: '2024-08-21',
    backingEntity: 'a16z crypto',
    backingRef: 'https://www.theblock.co/post/312349/a16z-crypto-story-protocol-series-b-layer-1-ip-blockchain/',
    launchOn: '2025-02-13',
    launchRef: 'https://crypto.news/story-protocol-announces-launch-of-public-mainnet/'
  }),
  project({
    projectId: 'manta-pacific',
    codeOn: '2021-04-12',
    codeRef: 'https://github.com/Manta-Network/Manta',
    executionOn: '2023-07-19',
    executionRef: 'https://www.theblock.co/news/deals/2023-07-19-manta-network-p0x-labs-raises-25-million-layer-2-zk-apps-240481',
    backingOn: '2023-07-19',
    backingEntity: 'Polychain Capital',
    backingRef: 'https://www.theblock.co/news/deals/2023-07-19-manta-network-p0x-labs-raises-25-million-layer-2-zk-apps-240481',
    launchOn: '2023-09-12',
    launchRef: 'https://mantanetwork.medium.com/manta-pacific-mainnet-alpha-launch-743c6bc2b95e'
  }),
  project({
    projectId: 'dymension',
    codeOn: '2022-07-10',
    codeRef: 'https://github.com/dymensionxyz/dymension',
    executionOn: '2023-02-15',
    executionRef: 'https://chainwire.org/2023/02/09/dymension-raises-6-7m-and-releases-testnet-for-a-network-of-modular-layer-2-rollapps/',
    backingOn: '2023-02-09',
    backingEntity: 'Big Brain Holdings',
    backingRef: 'https://www.theblock.co/news/deals/2023-02-09-modular-blockchain-dymension-raises-6-7-million-in-private-token-round-210093',
    launchOn: '2024-02-06',
    launchRef: 'https://github.com/dymensionxyz/dymension'
  }),
  project({
    projectId: 'sei',
    codeOn: '2022-05-17',
    codeRef: 'https://github.com/sei-protocol/sei-chain',
    executionOn: '2023-05-02',
    executionRef: 'https://blog.sei.io/',
    backingOn: '2023-04-11',
    backingEntity: 'Jump Crypto',
    backingRelation: 'INVESTOR',
    backingRef: 'https://blog.sei.io/announcements/sei-labs-raises-30m-to-build-the-layer-1-for-trading/',
    launchOn: '2023-08-15',
    launchRef: 'https://blog.sei.io/'
  }),
  project({
    projectId: 'aptos',
    codeOn: '2022-02-23',
    codeRef: 'https://github.com/aptos-labs/aptos-core',
    executionOn: '2022-05-24',
    executionRef: 'https://aptosnetwork.com/currents/aptos-airdrop-announcement',
    backingOn: '2022-03-15',
    backingEntity: 'a16z crypto',
    backingRef: 'https://medium.com/aptoslabs/expanding-the-aptos-community-38c5b18a84b7',
    launchOn: '2022-10-12',
    launchRef: 'https://aptosnetwork.com/currents/aptos-tokenomics-overview'
  }),
  project({
    projectId: 'sui',
    codeOn: '2021-11-09',
    codeRef: 'https://github.com/MystenLabs/sui',
    executionOn: '2022-11-17',
    executionRef: 'https://www.sui.io/blog/sui-testnet-wave-1',
    backingOn: '2022-09-08',
    backingEntity: 'a16z crypto',
    backingRelation: 'INVESTOR',
    backingRef: 'https://forums.sui.io/t/looking-back-sui-in-q3-2022/466',
    launchOn: '2023-05-03',
    launchRef: 'https://www.sui.io/blog/sui-and-the-journey-ahead'
  })
] as const;
