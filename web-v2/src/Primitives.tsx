import { useState, type MouseEvent, type ReactNode } from "react";
import type { CoverageState } from "./types";

type Navigate = (path: string) => void;

export function AppLink({
  href,
  navigate,
  className,
  children,
  ariaLabel,
  ariaCurrent,
}: {
  href: string;
  navigate: Navigate;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
  ariaCurrent?: "page";
}) {
  const base =
    import.meta.env.BASE_URL === "/"
      ? ""
      : import.meta.env.BASE_URL.replace(/\/$/, "");
  const resolvedHref = `${base}${href === "/" ? "/" : href}${window.location.search}`;
  const follow = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    navigate(href);
  };
  return (
    <a
      href={resolvedHref}
      className={className}
      aria-label={ariaLabel}
      aria-current={ariaCurrent}
      onClick={follow}
    >
      {children}
    </a>
  );
}

export function CoverageStamp({ state }: { state: CoverageState | "MISSING" }) {
  return (
    <b className={`semantic coverage-stamp ${state.toLowerCase()}`}>
      <span aria-hidden="true" />
      {state}
    </b>
  );
}

export function CaseTab({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: "green" | "orange" | "red";
}) {
  return <span className={`case-tab ${tone}`}>{children}</span>;
}

export function RecurrenceMarks({
  count,
  total = 8,
  compact = false,
}: {
  count: number;
  total?: number;
  compact?: boolean;
}) {
  const slots = Math.max(total, count);
  return (
    <span
      className={compact ? "recurrence-marks compact" : "recurrence-marks"}
      aria-label={`${count} distinct indexed launch recurrences`}
    >
      {Array.from({ length: slots }, (_, index) => (
        <i key={index} className={index < count ? "hit" : ""}>
          <span>{index + 1}</span>
        </i>
      ))}
    </span>
  );
}

export function Receipt({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <div className="evidence-receipt">
      <div className="receipt-teeth" aria-hidden="true" />
      <header>
        <span>{title}</span>
        {count !== undefined && <b>{String(count).padStart(2, "0")}</b>}
      </header>
      {children}
    </div>
  );
}

export function CheckpointRail({
  checkpoint,
  coverage,
  receiptId,
}: {
  checkpoint: string;
  coverage: CoverageState;
  receiptId?: string;
}) {
  return (
    <div className="checkpoint-rail">
      <span>
        <small>AS OF BLOCK</small>
        {checkpoint}
      </span>
      {receiptId && (
        <span className="checkpoint-receipt">
          <small>AUTHORITY RECEIPT</small>
          <code>{receiptId}</code>
        </span>
      )}
      <CoverageStamp state={coverage} />
    </div>
  );
}

export function ProofBoundary({ children }: { children: ReactNode }) {
  return (
    <p className="proof-boundary">
      <b>PROOF BOUNDARY</b>
      <span>{children}</span>
    </p>
  );
}

export function WatchControl({
  armed,
  onClick,
  subject,
}: {
  armed: boolean;
  onClick: () => void;
  subject: string;
}) {
  return (
    <button
      className={armed ? "watch-control armed" : "watch-control"}
      onClick={onClick}
      aria-pressed={armed}
    >
      <span className="tripwire-mark" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span>
        <small>
          {armed ? "FUTURE-ONLY / LOCAL DEMO" : "ARM FUTURE EVIDENCE"}
        </small>
        {armed ? "WATCH ARMED" : `WATCH ${subject}`}
      </span>
      <b>{armed ? "✓" : "+"}</b>
    </button>
  );
}

/** Copy identifiers without presenting synthetic demo data as verified evidence. */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [status, setStatus] = useState<"READY" | "COPIED" | "COPY FAILED">("READY");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("COPIED");
    } catch {
      setStatus("COPY FAILED");
    }
  };
  return (
    <>
      <button
        type="button"
        className="copy-button"
        aria-label={`Copy ${label}`}
        onClick={() => void copy()}
        title={`Copy ${label}`}
      >
        {status === "READY" ? "COPY" : status}
      </button>
      <span className="sr-only" role="status">
        {status === "COPIED" ? `${label} copied` : status === "COPY FAILED" ? `${label} could not be copied` : ""}
      </span>
    </>
  );
}
