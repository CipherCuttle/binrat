import type { ReactNode, SVGProps } from "react";

/** Material accents. Decorative only; never represent an evidence state. */
export const motifNames = [
  "rivet-corner", "welded-bracket", "bent-plate-edge", "claw-notch",
  "weld-seam", "receipt-perforation", "hazard-stripe", "cable-conduit",
] as const;
export type MotifName = (typeof motifNames)[number];
const motifs: Record<MotifName, ReactNode> = {
  "rivet-corner": <><path d="M2 21V4h15M6 18V8h8"/><circle cx="4" cy="4" r="1.8"/><circle cx="16" cy="4" r="1.4"/><path d="m3 3 2 2M15 3l2 2"/></>,
  "welded-bracket": <><path d="M3 2v19h19M8 7v9h9M1 6l4 2M1 11l4 2M6 23l2-4M13 23l2-4"/></>,
  "bent-plate-edge": <><path d="M1 2h19v18H1zM20 2l3 4v14h-3M1 20l5 3h17l-3-3M15 2l5 4M3 18h12"/></>,
  "claw-notch": <><path d="m1 2 7 15 4-2L8 1M10 2l5 18 4-2-3-17M18 4l4 17 2-3"/><path d="m2 22 8-4M12 23l8-4"/></>,
  "weld-seam": <><path d="M1 13h5l2-2 4 3 3-2h8M3 8l4 9M9 8l4 9M17 8l3 10M1 19l3-4M21 9l2-3"/></>,
  "receipt-perforation": <><path d="M1 7h22M1 17h22" strokeDasharray="3 3"/><circle cx="3" cy="12" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="21" cy="12" r="1"/></>,
  "hazard-stripe": <><path d="m-1 23 9-22M5 23 15 1M13 23 23 1M20 23 25 12" strokeWidth="4"/><path d="M0 1h24M0 23h24" strokeWidth=".7"/></>,
  "cable-conduit": <><path d="M2 2v9h10v10h10M5 3v5h10v10h5" strokeWidth="2"/><circle cx="2" cy="2" r="1"/><circle cx="22" cy="21" r="1.5"/><path d="m8 8 3 3"/></>,
};
export interface MicrographicProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  kind: MotifName;
  size?: number;
  tone?: "steel" | "rust" | "bone";
}
export function Micrographic({ kind, size = 24, tone = "steel", className, ...props }: MicrographicProps) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size}
    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4}
    className={"binrat-motif binrat-motif--" + tone + (className ? " " + className : "")}
    aria-hidden="true" focusable="false" {...props}>{motifs[kind]}</svg>;
}
