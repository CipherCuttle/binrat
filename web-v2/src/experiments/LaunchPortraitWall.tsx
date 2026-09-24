import { useEffect, useMemo, useRef, useState } from "react";
import { AppLink } from "../Primitives";
import type { Bag, PublicFeed } from "../types";
import s from "./LaunchPortraitWall.module.css";

type Go = (path: string) => void;
const PAGE_SIZE = 24;
const MAX_INDEXED = 500;
const MEDIA_HOSTS = new Set(["ipfs.io", "gateway.pinata.cloud", "cloudflare-ipfs.com", "arweave.net"]);

/** Untrusted source-reported media. Restrict direct browser requests to known HTTPS gateways.
 * A self-hosted, content-type checked thumbnail proxy is a separate measured follow-up. */
export function safeTokenPortrait(raw: string | undefined): string | null {
  if (!raw || raw.length > 600) return null;
  let value = raw.trim();
  if (value.startsWith("ipfs://")) {
    const path = value.slice(7).replace(/^ipfs\//, "");
    if (!/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{30,90})(\/[a-zA-Z0-9._-]+)*$/.test(path)) return null;
    value = "https://ipfs.io/ipfs/" + path;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
        !MEDIA_HOSTS.has(url.hostname.toLowerCase()) || url.port) return null;
    if (/\.(svg|svgz|html?|xml|pdf|js)(?:$|\/)/i.test(url.pathname)) return null;
    if ((url.hostname !== "arweave.net") && !url.pathname.startsWith("/ipfs/")) return null;
    return url.href;
  } catch { return null; }
}
const accessibleName = (bag: Bag) =>
  "Open indexed launch " + bag.symbol + " " + bag.name + " at block " + bag.blockNumber;

export default function LaunchPortraitWall({
  feed, mode, loaded, error, navigate,
}: {
  feed: PublicFeed | null;
  mode: "LIVE" | "DEMO";
  loaded: boolean;
  error: string | null;
  navigate: Go;
}) {
  const all = useMemo(() => (feed?.bags ?? []).slice(0, MAX_INDEXED), [feed]);
  const [page, setPage] = useState(0);
  const [active, setActive] = useState(false);
  const [visible, setVisible] = useState(true);
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const wallRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setPage(0);
    setFailed(new Set());
  }, [feed?.asOfBlock]);
  useEffect(() => {
    const element = wallRef.current;
    if (!element || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry?.isIntersecting ?? false));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (active || !visible || document.visibilityState !== "visible" || all.length <= PAGE_SIZE) return;
    const timer = window.setInterval(() => setPage(x => (x + 1) % Math.ceil(all.length / PAGE_SIZE)), 24_000);
    return () => window.clearInterval(timer);
  }, [active, visible, all.length]);
  const shown = all.slice((page % Math.max(1, Math.ceil(all.length / PAGE_SIZE))) * PAGE_SIZE,
    (page % Math.max(1, Math.ceil(all.length / PAGE_SIZE)) + 1) * PAGE_SIZE);
  const nCols = Math.min(4, Math.max(1, shown.length));
  const columns = Array.from({ length: nCols }, (_, column) => shown.filter((_, i) => i % nCols === column));
  return <section className={s.section} aria-labelledby="portrait-wall-title" data-testid="launch-portrait-wall">
    <div className={s.heading}>
      <div><span className={s.kicker}>THE DUMPSTER WINDOW / ARC 5042</span>
        <h2 id="portrait-wall-title">THE LATEST IN THE BIN.</h2>
        <p>Source-reported token artwork, never a verification badge. Select a portrait to open its indexed case.</p>
      </div>
      <div className={s.counter}>
        <strong>{feed ? String(all.length) : "—"}</strong>
        <span>{mode === "DEMO" ? "SYNTHETIC DEMO FILES" : "RECENT INDEXED LAUNCHES"}<br/>
          {feed ? "SHOWING " + shown.length + " · AS OF BLOCK " + feed.asOfBlock : !loaded ? "CHECKING" : "UNAVAILABLE"}
        </span>
      </div>
    </div>
    <div ref={wallRef} className={s.wall} onPointerEnter={() => setActive(true)}
      onPointerLeave={() => setActive(false)} onFocusCapture={() => setActive(true)}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setActive(false); }}
      data-visible-tiles={shown.length}>
      {!feed ? <div role={loaded ? "alert" : "status"} className={s.empty}>
        {loaded ? "LAUNCH FEED UNAVAILABLE / " + (error ?? "NO VALIDATED FEED") : "CHECKING THE INDEX…"}
      </div> : !shown.length ? <div className={s.empty}>NO INDEXED LAUNCHES AT THIS CHECKPOINT.</div> :
      <div className={s.columns} style={{ gridTemplateColumns: "repeat(" + nCols + ", minmax(0,1fr))" }}>
        {columns.map((col, index) =>
          <div key={index} className={s.column} data-testid="launch-portrait-column" style={{ animationDelay: "-" + index * 2 + "s" }}>
            {col.map(bag => {
              const image = safeTokenPortrait(bag.imageUri);
              return <AppLink key={bag.id} href={"/bag/" + bag.id} navigate={navigate}
                ariaLabel={accessibleName(bag)} className={s.tile}>
                {image && !failed.has(bag.id) ? <img src={image} alt="" loading="lazy"
                  decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(prev => {
                    const next = new Set(prev); next.add(bag.id); return next;
                  })} /> : <span className={s.noImage} aria-hidden="true">
                    <b>{bag.symbol.slice(0, 3).toUpperCase() || "?"}</b><small>NO SOURCE IMAGE</small>
                  </span>}
                <span className={s.tileCaption}><b> {bag.symbol}</b><small>BLK {bag.blockNumber}</small></span>
              </AppLink>;
            })}
          </div>
        )}
      </div>}
      <div className={s.pixelBackground} aria-hidden="true" />
    </div>
    <footer className={s.footer}>
      <span>{mode === "DEMO" ? "DEMO: ARTWORK IS NOT LIVE EVIDENCE" :
        "SOURCE-REPORTED ARTWORK / COVERAGE " + (feed?.historyCoverage ?? "UNAVAILABLE")}</span>
      <AppLink href="/dumpster" navigate={navigate}>BROWSE ALL INDEXED LAUNCHES ↗</AppLink>
    </footer>
  </section>;
}
