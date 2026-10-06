import type {
  CommsWriter,
  CommsWriterRequest,
  CommsWriterResponse,
  CommsWriterUsage,
} from './modelWriter.js';

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const MAX_RESPONSE_BYTES = 64 * 1024;

export const OPENROUTER_COMMS_DRAFT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'x', 'telegram'],
  properties: {
    schemaVersion: {
      type: 'string',
      enum: ['binrat.comms-draft/1'],
    },
    x: { type: 'string' },
    telegram: { type: 'string' },
  },
} as const;

export type CommsTransport = (
  url: string,
  init: RequestInit,
) => Promise<Response>;

export interface OpenRouterCommsWriterConfig {
  apiKey: string;
  model: string;
  timeoutMs?: number;
  transport?: CommsTransport;
}

async function readBoundedBody(response: Response): Promise<string> {
  if (!response.body) return '';

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      if (size + value.byteLength > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error('OPENROUTER_RESPONSE_TOO_LARGE');
      }
      chunks.push(value);
      size += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks).toString('utf8');
}

function optionalUsage(value: unknown): CommsWriterUsage | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const usage = value as Record<string, unknown>;
  const inputTokens =
    typeof usage.prompt_tokens === 'number' &&
    Number.isSafeInteger(usage.prompt_tokens) &&
    usage.prompt_tokens >= 0
      ? usage.prompt_tokens
      : undefined;
  const outputTokens =
    typeof usage.completion_tokens === 'number' &&
    Number.isSafeInteger(usage.completion_tokens) &&
    usage.completion_tokens >= 0
      ? usage.completion_tokens
      : undefined;

  if (inputTokens === undefined && outputTokens === undefined) return undefined;
  return {
    ...(inputTokens !== undefined ? { inputTokens } : {}),
    ...(outputTokens !== undefined ? { outputTokens } : {}),
  };
}

export function createOpenRouterCommsWriter(
  config: OpenRouterCommsWriterConfig,
): CommsWriter {
  if (
    typeof config.apiKey !== 'string' ||
    config.apiKey.length < 16 ||
    config.apiKey.length > 512 ||
    /\s/.test(config.apiKey)
  ) {
    throw new Error('OPENROUTER_API_KEY_INVALID');
  }
  if (
    typeof config.model !== 'string' ||
    config.model.length === 0 ||
    config.model.length > 160
  ) {
    throw new Error('OPENROUTER_MODEL_INVALID');
  }

  const transport = config.transport ?? fetch;
  const timeoutMs = config.timeoutMs ?? 30_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 120_000) {
    throw new Error('OPENROUTER_TIMEOUT_INVALID');
  }

  return {
    async generate(request: CommsWriterRequest): Promise<CommsWriterResponse> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const body = {
        model: config.model,
        messages: request.messages,
        stream: false,
        max_completion_tokens: 512,
        provider: {
          require_parameters: true,
        },
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'binrat_comms_draft_v1',
            strict: true,
            schema: OPENROUTER_COMMS_DRAFT_SCHEMA,
          },
        },
      };

      try {
        const response = await transport(OPENROUTER_ENDPOINT, {
          method: 'POST',
          redirect: 'error',
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        const rawBody = await readBoundedBody(response);
        if (response.status !== 200) {
          throw new Error(`OPENROUTER_HTTP_${response.status}`);
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(rawBody);
        } catch {
          throw new Error('OPENROUTER_RESPONSE_JSON_INVALID');
        }

        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('OPENROUTER_RESPONSE_INVALID');
        }

        const object = parsed as Record<string, unknown>;
        if (!Array.isArray(object.choices) || object.choices.length !== 1) {
          throw new Error('OPENROUTER_RESPONSE_INVALID');
        }

        const choice = object.choices[0];
        if (!choice || typeof choice !== 'object' || Array.isArray(choice)) {
          throw new Error('OPENROUTER_RESPONSE_INVALID');
        }

        const message = (choice as Record<string, unknown>).message;
        if (!message || typeof message !== 'object' || Array.isArray(message)) {
          throw new Error('OPENROUTER_RESPONSE_INVALID');
        }

        const messageObject = message as Record<string, unknown>;
        if (
          typeof messageObject.content !== 'string' ||
          messageObject.content.length === 0 ||
          messageObject.tool_calls != null
        ) {
          throw new Error('OPENROUTER_RESPONSE_INVALID');
        }

        const responseModel =
          typeof object.model === 'string' && object.model.length > 0
            ? object.model
            : config.model;
        const usage = optionalUsage(object.usage);

        return {
          provider: 'openrouter',
          model: responseModel,
          rawOutput: messageObject.content,
          ...(usage ? { usage } : {}),
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
