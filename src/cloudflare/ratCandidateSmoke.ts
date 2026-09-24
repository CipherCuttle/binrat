import type { D1DatabaseLike } from './d1Types.js';
import {
  RAT_AI_MODEL, generateRatBanter, reserveRatAiCall, type RatAiBinding
} from './ratConversation.js';

export interface RatCandidateSmokeEnv {
  DB: D1DatabaseLike;
  AI?: RatAiBinding;
  RAT_CANDIDATE_SMOKE_ENABLED?: string;
  RAT_CANDIDATE_SMOKE_SECRET?: string;
}

function response(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    }
  });
}

interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens?: number;
}
function usageFromResult(raw: unknown): Usage | null {
  if (!raw || typeof raw !== 'object' || !('usage' in raw)) return null;
  const u = raw.usage;
  if (!u || typeof u !== 'object') return null;
  const usage = u as Partial<Usage>;
  const p = usage.prompt_tokens, c = usage.completion_tokens;
  if (!Number.isSafeInteger(p) || !Number.isSafeInteger(c) ||
      (p as number) < 0 || (c as number) < 0) return null;
  return {
    prompt_tokens: p as number,
    completion_tokens: c as number,
    total_tokens: Number.isSafeInteger(usage.total_tokens) ? usage.total_tokens : undefined
  };
}

/** Isolated candidate-only, one call per UTC day, fixed prompt, authenticated smoke. */
export async function handleRatCandidateSmoke(
  request: Request, env: RatCandidateSmokeEnv, nowMs: number
): Promise<Response> {
  if (
    request.method !== 'POST' ||
    env.RAT_CANDIDATE_SMOKE_ENABLED !== 'true' ||
    !env.RAT_CANDIDATE_SMOKE_SECRET ||
    env.RAT_CANDIDATE_SMOKE_SECRET.length < 32 ||
    !env.AI
  ) return response(404, { error: 'NOT_FOUND' });

  if (request.headers.get('x-binrat-candidate-secret') !== env.RAT_CANDIDATE_SMOKE_SECRET) {
    return response(401, { error: 'UNAUTHORIZED' });
  }
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) return response(503, { error: 'CLOCK_INVALID' });

  const day = Math.floor(nowMs / 86_400_000);
  try {
    const once = await env.DB.prepare(
      'INSERT OR IGNORE INTO rat_ai_daily_budget (day_utc,principal,attempts) VALUES (?,?,1)'
    ).bind(day, 'CANDIDATE:SMOKE', 1).run();
    if (!once.success) return response(503, { error: 'SMOKE_RESERVATION_FAILED' });
    if (once.meta?.changes !== 1) return response(409, { error: 'ALREADY_TESTED_TODAY' });
    if (!(await reserveRatAiCall(env.DB, 0, 0, nowMs))) {
      return response(429, { error: 'DAILY_AI_BUDGET_EXHAUSTED' });
    }
  } catch {
    return response(503, { error: 'SMOKE_BUDGET_UNAVAILABLE' });
  }

  let usage: Usage | null = null;
  let validBanter = false;
  try {
    const proxy: RatAiBinding = {
      run: async (model, input) => {
        const raw = await env.AI!.run(model, input);
        usage = usageFromResult(raw);
        return raw;
      }
    };
    validBanter = (await generateRatBanter(proxy, 'hello rat, do you nap?', '')) !== null;
  } catch {
    // No retry today. Quota is consumed conservatively even if inference fails.
    return response(503, { error: 'CANDIDATE_AI_UNAVAILABLE', model: RAT_AI_MODEL });
  }

  const u = usage as Usage | null;
  const estimatedNeurons = u !== null
    ? Math.round(((u.prompt_tokens * 5500 + u.completion_tokens * 36400) / 1_000_000) * 1000) / 1000
    : null;

  return response(200, {
    model: RAT_AI_MODEL,
    modelReturnedValidBanter: validBanter,
    reportedTokenUsage: u,
    estimatedNeuronsFromReportedTokens: estimatedNeurons,
    actualBilledNeurons: null,
    note: 'Per-response token usage may be absent. Account-level billed neurons must be verified in the Cloudflare dashboard. This route never sends Telegram messages.'
  });
}
