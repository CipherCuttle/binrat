import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
export const PONS_PREVIEW_ORIGIN: string;
export function ponsReadMiddleware(fetchImpl?: typeof fetch):
  (request: IncomingMessage, response: ServerResponse, next: () => void) => Promise<void>;
export function ponsPreviewProxy(): Plugin;
