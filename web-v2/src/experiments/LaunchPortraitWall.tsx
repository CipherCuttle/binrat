import { useEffect, useMemo, useState } from "react";
import { AppLink } from "../Primitives";
import type { Bag, PublicFeed } from "../types";
import s from "./LaunchPortraitWall.module.css";

type Go = (path: string) => void;
const PAGE_SIZE = 8;
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
  const [failed, setFailed] = useState<Set<string>>(new Set());
  useEffect(() => { setPage(0); setFailed(new Set()); }, [feed?.asOfBlock]);
  const pageCount = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const shown = all.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  return <section className={s.section + " " + s.arcGallery} aria-labelledby="portrait-wall-title" data-testid="launch-portrait-wall" data-visible-tiles={shown.length}>
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
    <div className={s.wall} data-testid="portrait-wall-viewport">
      {!feed ? <div role={loaded ? "alert" : "status"} className={s.empty}>
        {loaded ? "LAUNCH FEED UNAVAILABLE / " + (error ?? "NO VALIDATED FEED") : "CHECKING THE INDEX…"}
      </div> : !shown.length ? <div className={s.empty}>NO INDEXED LAUNCHES AT THIS CHECKPOINT.</div> :
      <div className={s.columns} data-testid="launch-portrait-grid">
        {shown.map(bag => {
          const image = safeTokenPortrait(bag.imageUri);
          return <AppLink key={bag.id} href={"/bag/" + bag.id} navigate={navigate}
            ariaLabel={accessibleName(bag)} className={s.tile}>
            {image && !failed.has(bag.id) ? <img src={image} alt="" loading="lazy"
              decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(prev => {
                const next = new Set(prev); next.add(bag.id); return next;
              })} /> : <span className={s.noImage} aria-hidden="true">
                <b>{bag.symbol.slice(0, 3).toUpperCase() || "?"}</b><small>NO SOURCE IMAGE</small>
              </span>}
            <span className={s.tileCaption}><b>{bag.symbol}</b><small>BLK {bag.blockNumber}</small></span>
          </AppLink>;
        })}
      </div>}
      <div className={s.pixelBackground} aria-hidden="true" />
    </div>
    <footer className={s.footer}>
      <span>{mode === "DEMO" ? "DEMO: ARTWORK IS NOT LIVE EVIDENCE" :
        "SOURCE-REPORTED ARTWORK / COVERAGE " + (feed?.historyCoverage ?? "UNAVAILABLE")}</span>
      {feed && all.length > PAGE_SIZE && <div className={s.pager} aria-label="Launch portrait pages">
        <button type="button" aria-label="PREVIOUS LAUNCH PAGE"
          disabled={safePage === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>← PREV</button>
        <span>PAGE {safePage + 1}/{pageCount}</span>
        <button type="button" aria-label="NEXT LAUNCH PAGE"
          disabled={safePage + 1 >= pageCount} onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}>NEXT →</button>
      </div>}
      <AppLink href="/dumpster" navigate={navigate}>BROWSE ALL INDEXED LAUNCHES ↗</AppLink>
    </footer>
  </section>;
}
