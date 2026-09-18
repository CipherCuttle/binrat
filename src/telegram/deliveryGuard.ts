export type UpdateBeginResult = 'ACCEPTED' | 'INVALID' | 'SEEN' | 'IN_FLIGHT';

export class UpdateDeliveryFence {
  private readonly seen = new Set<number>();
  private readonly inFlight = new Set<number>();
  private readonly order: number[] = [];

  constructor(private readonly maxSeen = 2048) {
    if (!Number.isSafeInteger(maxSeen) || maxSeen < 1) throw new Error('INVALID_UPDATE_FENCE_CAPACITY');
  }

  begin(updateId: number): UpdateBeginResult {
    if (!Number.isSafeInteger(updateId) || updateId < 0) return 'INVALID';
    if (this.seen.has(updateId)) return 'SEEN';
    if (this.inFlight.has(updateId)) return 'IN_FLIGHT';
    this.inFlight.add(updateId);
    return 'ACCEPTED';
  }

  commit(updateId: number): void {
    if (!this.inFlight.delete(updateId)) throw new Error('UPDATE_NOT_IN_FLIGHT');
    this.seen.add(updateId);
    this.order.push(updateId);
    while (this.order.length > this.maxSeen) {
      const old = this.order.shift();
      if (old !== undefined) this.seen.delete(old);
    }
  }

  release(updateId: number): void {
    this.inFlight.delete(updateId);
  }
}

interface RateWindow {
  startedAtMs: number;
  count: number;
}

export class PerChatRateGate {
  private readonly windows = new Map<number, RateWindow>();

  constructor(
    private readonly limit: number,
    private readonly windowMs = 60_000
  ) {
    if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('INVALID_RATE_LIMIT');
    if (!Number.isSafeInteger(windowMs) || windowMs < 1) throw new Error('INVALID_RATE_WINDOW');
  }

  allow(chatId: number, nowMs = Date.now()): boolean {
    if (!Number.isSafeInteger(chatId)) return false;
    const current = this.windows.get(chatId);
    if (!current || nowMs - current.startedAtMs >= this.windowMs || nowMs < current.startedAtMs) {
      this.windows.set(chatId, { startedAtMs: nowMs, count: 1 });
      return true;
    }
    if (current.count >= this.limit) return false;
    current.count += 1;
    return true;
  }
}


export function webhookStatusForDuplicateBegin(result: 'SEEN' | 'IN_FLIGHT'): 200 | 503 {
  return result === 'IN_FLIGHT' ? 503 : 200;
}
