import type { PublicShareReceipt } from './share.js';
import type { Receipt } from './model.js';
import type { RatsSnapshot } from './rats.js';
import type { WatchRow } from './watches.js';

/** Domain results deliberately contain facts, not Telegram wording or markup. */
export type AutonomousOutcome =
  | { kind: 'HOME' }
  | { kind: 'RATS'; snapshot: RatsSnapshot; candidateIndex: number }
  | { kind: 'CASE'; receipt: Receipt; mode: 'DIG' | 'WHY' | 'ALERT'; privateAttention: string | null }
  | { kind: 'WATCH'; reply: string }
  | { kind: 'WATCHLIST'; watches: WatchRow[]; legacyWatchCount: number }
  | { kind: 'SHARE'; receipt: PublicShareReceipt }
  | { kind: 'OPEN_RECEIPT'; receipt: PublicShareReceipt }
  | { kind: 'REPLAY'; reply: string }
  | { kind: 'ERROR'; code: string };
