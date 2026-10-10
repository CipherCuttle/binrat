export type PonsTripwireWatchReceipt = {
  generation: string;
  sourceCaseUrl: string;
  deployer: string;
  state: "ACTIVE" | "CANCELLED" | "REORG";
  startBlock: string;
  startHash: string;
  createdAtMs: number;
  latestNotificationState?: string | null;
};

export type PonsTripwireReply = { watch: PonsTripwireWatchReceipt | null };
export type TripwireAction = "watch" | "status" | "cancel";

type TelegramWebApp = { initData?: string; ready?: () => void };
type TelegramWindow = Window & { Telegram?: { WebApp?: TelegramWebApp } };
const telegramWindow = () => window as TelegramWindow;
const casePattern = /^[0-9a-f]{64}$/;

/** Start payload fits Telegram's 64-character bound and preserves all Case bytes. */
export function ponsCaseTelegramLink(caseId: string): string {
  if (!casePattern.test(caseId)) throw Error("PONS_TRIPWIRE_CASE_INVALID");
  const bytes = caseId.match(/../g)!.map((value) => String.fromCharCode(parseInt(value, 16))).join("");
  const payload = btoa(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return "https://t.me/BinratBot?start=pons_" + payload;
}

let telegramSdk: Promise<string> | undefined;
/** Only the first-party SDK supplies credentials; URL data is never accepted as auth. */
export async function telegramInitData(): Promise<string> {
  const existing = telegramWindow().Telegram?.WebApp;
  if (existing?.initData) { existing.ready?.(); return existing.initData; }
  const launch = new URLSearchParams(window.location.hash.slice(1));
  if (!launch.has("tgWebAppData")) return "";
  telegramSdk ??= new Promise<string>((resolve) => {
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-web-app.js?64";
    script.async = true;
    const finish = () => {
      clearTimeout(timer);
      const app = telegramWindow().Telegram?.WebApp;
      app?.ready?.();
      resolve(app?.initData || "");
    };
    const timer = window.setTimeout(finish, 10000);
    script.onload = finish;
    script.onerror = finish;
    document.head.append(script);
  });
  return telegramSdk;
}

export async function requestPonsTripwire(
  action: TripwireAction,
  { initData, caseId, deployer, signal }: { initData: string; caseId: string; deployer: string; signal?: AbortSignal },
): Promise<PonsTripwireReply> {
  if (!initData || initData.length > 8192 || !casePattern.test(caseId) || !/^0x[0-9a-f]{40}$/.test(deployer)) {
    throw Error("PONS_TRIPWIRE_AUTH_REQUIRED");
  }
  const response = await fetch("/api/pons-tripwire/" + action, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ initData, caseId }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
    cache: "no-store",
  });
  const raw = await response.text();
  if (raw.length > 16384) throw Error("PONS_TRIPWIRE_RESPONSE_INVALID");
  const body = JSON.parse(raw) as Record<string, unknown>;
  if (!body || typeof body !== "object" || Array.isArray(body)) throw Error("PONS_TRIPWIRE_RESPONSE_INVALID");
  if (!response.ok) throw Error(typeof body.error === "string" ? body.error : "PONS_TRIPWIRE_UNAVAILABLE");
  if (body.ok !== true || !Object.hasOwn(body, "watch")) throw Error("PONS_TRIPWIRE_RESPONSE_INVALID");
  if (body.watch === null) return { watch: null };
  if (!body.watch || typeof body.watch !== "object" || Array.isArray(body.watch)) throw Error("PONS_TRIPWIRE_RESPONSE_INVALID");
  const watch = body.watch as Record<string, unknown>;
  if (typeof watch.generation !== "string" || !/^[0-9a-f-]{36}$/.test(watch.generation) ||
    typeof watch.sourceCaseUrl !== "string" || !/^https:\/\/binrat\.tech\/bag\/[0-9a-f]{64}$/.test(watch.sourceCaseUrl) || watch.deployer !== deployer ||
    (watch.state !== "ACTIVE" && watch.state !== "CANCELLED" && watch.state !== "REORG") ||
    typeof watch.startBlock !== "string" || !/^(0|[1-9]\d*)$/.test(watch.startBlock) ||
    typeof watch.startHash !== "string" || !/^0x[0-9a-f]{64}$/.test(watch.startHash) ||
    !Number.isSafeInteger(watch.createdAtMs) || (watch.createdAtMs as number) <= 0) {
    throw Error("PONS_TRIPWIRE_RESPONSE_INVALID");
  }
  return { watch: watch as PonsTripwireWatchReceipt };
}

export function tripwireErrorMessage(code: string): string {
  if (/DISABLED|GATE_CLOSED/.test(code)) return "The Pons Watch pilot is closed. No Watch was changed.";
  if (/AUTH|PRIVATE_GATE|OWNER/.test(code)) return "Open this Case again from the Telegram Rat. Watch is available only to the authenticated owner pilot.";
  if (/STALE|REORG|SOURCE|CHECKPOINT/.test(code)) return "Pons indexing is not ready to verify a new Watch. Recheck the Case and try again.";
  if (/CAPACITY|QUOTA|RATE|LIMIT/.test(code)) return "The pilot Watch limit has been reached. Cancel an existing Watch or try again later.";
  return "Watch could not be confirmed. Recheck its saved status before trying again.";
}
