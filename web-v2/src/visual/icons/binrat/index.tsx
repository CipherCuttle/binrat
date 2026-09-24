import type { ReactNode, SVGProps } from "react";

/**
 * Dumpster OS / P0 domain glyphs. Original 24px monochrome masters.
 * These are UI silhouettes, not authoritative evidence or a redesigned mascot portrait.
 * Always pair evidence-related glyphs with visible role/coverage text.
 */
export const iconNames = [
  "rat-head", "cyborg-eye", "dumpster", "bag-dossier", "creator-file",
  "observed-recipient", "radar-ping", "recurrence-scar", "replay-spool",
  "receipt-tear", "ledger-slab", "watch-tripwire", "saved-scrap",
] as const;
export type BinratIconName = (typeof iconNames)[number];
export const iconLabels: Record<BinratIconName, string> = {
  "rat-head": "Cyborg rat head", "cyborg-eye": "Cyborg eye", dumpster: "Dump-tray",
  "bag-dossier": "Bag dossier", "creator-file": "Source-reported creator",
  "observed-recipient": "Observed recipient", "radar-ping": "Radar scan",
  "recurrence-scar": "Indexed recurrence", "replay-spool": "Replay spool",
  "receipt-tear": "Evidence receipt", "ledger-slab": "Ledger slab",
  "watch-tripwire": "Watch tripwire", "saved-scrap": "Local saved scrap",
};
const glyphs: Record<BinratIconName, ReactNode> = {
  "rat-head": <><path d="m3 3 5 2 3-2 2 3 4-1 4 4-1 5-3 4-4 3-5-1-4-4-1-5 1-4 2-2z"/><path d="m4 4 3 4M14 7l4 2 1 4-3 4M5 12l-3 1M4 16l3-1M19 14l3 1M17 17l4 2"/><path d="m8 11 3-1 2 2-2 2-3-1zM14 11l4-1-1 3-3 1z"/><path d="m10 17 2 1 2-1M10 20l4 0"/></>,
  "cyborg-eye": <><path d="m2 12 5-6 9-1 6 7-6 6-9 0z"/><path d="m8 8 8-1 4 5-4 4-8 0-3-4z"/><path d="m10 10 5-1 3 3-3 3-5-1zM15 9v6M5 7 3 3M20 17l2 3"/></>,
  dumpster: <><path d="m3 8 18-2-2 14H5L3 8zM2 8l1-4 18-1 1 4M5 12l15-1M9 10v8M15 9v9"/><path d="m6 3-1-2M19 2l2-1M7 21h3M15 21h3"/></>,
  "bag-dossier": <><path d="m2 6 6-1 2-2 5 1 2 3 5 1-2 13H4L2 6z"/><path d="m7 10 10-1M7 13l7-1M7 16l8-1M16 15l4 0M8 5l3 3"/><path d="m18 8 1-4 3 1-1 5"/></>,
  "creator-file": <><path d="M4 3h13l3 3v15H4zM17 3v5h3M7 11h10M7 14h7M7 17h9M8 7h4"/><path d="m2 8 2-1M2 13l2-1M2 18l2-1"/></>,
  "observed-recipient": <><path d="M3 2h6v5H3zM4 9h4l5 5h4v-3l5 5-5 5v-3h-5L7 13H4z"/><path d="M4 15v6h6v-3M12 4h8v5M16 2l4 2-4 2"/></>,
  "radar-ping": <><path d="M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5"/><path d="M12 12 21 3M17 3h4v4M11 1v4M1 12h4M12 19v4M19 12h4"/><path d="m8 14 4-2"/></>,
  "recurrence-scar": <><path d="m3 18 6-14 3 1-6 14zM10 20l5-15 3 1-5 15zM17 20l4-11 2 1-4 11z"/><path d="m2 8 19 4M2 14l18 4"/></>,
  "replay-spool": <><circle cx="5.5" cy="8.5" r="3.5"/><circle cx="18.5" cy="8.5" r="3.5"/><circle cx="5.5" cy="8.5" r=".8"/><circle cx="18.5" cy="8.5" r=".8"/><path d="M9 9c1 3 3 3 3 6s-2 4-4 4H3M15 9c-1 3-3 3-3 6s3 4 5 4h4M3 20h18M8 5h8"/></>,
  "receipt-tear": <><path d="m5 2 3 2 3-2 3 2 3-2 3 2v18l-3-2-3 2-3-2-3 2-3-2V2z"/><path d="M8 8h9M8 11h9M8 14h5M8 17h7M2 7h2M2 11h2M2 15h2"/></>,
  "ledger-slab": <><path d="m4 3 15-2 2 18-15 3L4 3zM8 5l8-1M8 9l10-1M9 13l9-1M9 17l9-1"/><path d="m2 6 3-1M2 12l3-1M3 18l3-1M16 2l2 1M17 19l2 1"/></>,
  "watch-tripwire": <><circle cx="3.5" cy="7" r="2"/><circle cx="20.5" cy="7" r="2"/><path d="M5.5 7h4l3 5 3-5h3M12.5 12v7l-3 3h6l-3-3M2 12v5M22 12v5"/><path d="m9 15 3-3 3 3"/></>,
  "saved-scrap": <><path d="M4 3h13l4 4v15l-8-4-8 4L4 3zM17 3v5h4"/><path d="m8 9 3 3 5-5M7 16h8M2 9h2M2 14h2"/></>,
};
export interface BinratIconProps extends Omit<SVGProps<SVGSVGElement>, "name" | "children"> {
  name: BinratIconName;
  size?: number;
  decorative?: boolean;
  title?: string;
}
export function BinratIcon({ name, size = 24, decorative = false, title, ...props }: BinratIconProps) {
  const label = title ?? iconLabels[name];
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size}
    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
    strokeLinecap="square" strokeLinejoin="miter" role={decorative ? undefined : "img"}
    aria-hidden={decorative ? true : undefined} aria-label={decorative ? undefined : label}
    focusable="false" {...props}>{glyphs[name]}</svg>;
}
