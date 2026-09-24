import type { ReactNode } from "react";
import type { CoverageState, EvidenceState } from "../types";
import type { ReplayStage } from "../evidenceIntegrity";
import type { DataMode } from "../data";
import type { Bookmark } from "../mobile/MobileExperience";
import { BinratIcon } from "./icons/binrat";
import { Micrographic } from "./micrographics";
import s from "./components.module.css";

export type EvidenceStampProps = ({ scope: "fact"; state: EvidenceState } |
  { scope: "coverage"; state: CoverageState } |
  { scope: "replay"; state: ReplayStage["state"] }) & { className?: string };

/** Visible labels never rely on color or ornament. "OBSERVED" is not "VERIFIED". */
export function EvidenceStamp({ scope, state, className = "" }: EvidenceStampProps) {
  return <span className={[s.stamp, className].filter(Boolean).join(" ")}
    data-scope={scope} data-state={state.toLowerCase()}>
    <span className={s.stateSlot} aria-hidden="true"/>
    <span>{state}</span>
  </span>;
}
export function ScrapCard({ as: As = "article", variant, density = "field", className = "", children }: {
  as?: "article" | "section" | "div";
  variant: "steel" | "paper" | "oxide";
  density?: "field" | "bench";
  className?: string;
  children: ReactNode;
}) {
  return <As className={[s.scrap, s[variant], density === "bench" ? s.bench : s.field, className].join(" ")}
    data-dumpster-os="scrap-card">
    <Micrographic kind="rivet-corner" tone="rust" size={24} className={s.rivet}/>
    {children}
  </As>;
}
export function ReceiptSheet({ title, receiptId, checkpoint, source, mode, children, className = "" }: {
  title: string;
  receiptId?: string;
  checkpoint?: string;
  source?: string;
  mode: DataMode;
  children: ReactNode;
  className?: string;
}) {
  return <section className={[s.receipt, className].join(" ")} data-dumpster-os="receipt-sheet">
    <header><BinratIcon name="receipt-tear" decorative size={22}/>
      <span>{title}</span><small>{mode === "DEMO" ? "SYNTHETIC / NOT CHAIN PROOF" : "PUBLIC READ"}</small></header>
    {source && <p className={s.receiptMeta}>SOURCE / {source}</p>}
    {checkpoint && <p className={s.receiptMeta}>SOURCE CHECKPOINT / {checkpoint}</p>}
    <div className={s.receiptBody}>{children}</div>
    {receiptId && <div className={s.receiptId}><small>REPORTED RECEIPT IDENTIFIER / NO CLIENT CRYPTOGRAPHIC ATTESTATION</small><code>{receiptId}</code></div>}
    <div className={s.paperTear} aria-hidden="true"/>
  </section>;
}
export function ScrapBookmark({ item, saved, onToggle, label, className = "" }: {
  item: Bookmark;
  saved: boolean;
  onToggle: (item: Bookmark) => void;
  label: string;
  className?: string;
}) {
  return <button type="button" onClick={() => onToggle(item)} aria-pressed={saved}
    aria-label={saved ? "Remove " + label + " from saved files" : "Save " + label + " on this device"}
    className={[s.scrapBookmark, saved ? s.bookmarked : "", className].join(" ")}>
    <BinratIcon name="saved-scrap" decorative size={19}/>
    <span>{saved ? "SAVED" : "SAVE"}</span>
  </button>;
}
/** Pure framing; do not let a sewer divider masquerade as evidence. */
export function SewerDivider({ kind = "weld", className = "" }: {
  kind?: "weld" | "paper" | "cable";
  className?: string;
}) {
  const motif = kind === "paper" ? "receipt-perforation" : kind === "cable" ? "cable-conduit" : "weld-seam";
  return <div className={[s.divider, s[kind], className].join(" ")} aria-hidden="true" data-dumpster-os="sewer-divider">
    <span/><Micrographic kind={motif} tone="rust" size={23}/><span/>
  </div>;
}
/** One approved physical-source crop, never synthetic art or evidence success. */
export function RatOperator({ size = "stamp", className = "" }: { size?: "stamp" | "panel"; className?: string }) {
  return <span className={[s.ratOperator, size === "panel" ? s.ratPanel : "", className].join(" ")}
    aria-hidden="true" data-dumpster-os="rat-operator">
    <img src={import.meta.env.BASE_URL + "binrat-hero.webp"} alt="" loading="lazy"/>
    <i/>
  </span>;
}
