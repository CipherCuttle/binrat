import { loadDumpsterFeed, loadPublicBag, loadBagIntelligence, loadCreatorFile, loadReplayBundle, loadCapabilityManifest, WEB_DATA_SOURCE_MODE } from "./data-source.js";
import { buildShareCardModel, buildSharePostText } from "./share-card.js";
import { PublicReadPlane, ReadState } from "./read-plane.js";
import { initFrontdoor, renderFreshCases, renderFreshState, renderPublicProduct, productRat } from "./frontdoor.js";

const grid = document.querySelector("#garbage-grid");
const drawer = document.querySelector("#drawer");
const drawerContent = document.querySelector("#drawer-content");
const drawerClose = document.querySelector("#drawer-close");
const backdrop = document.querySelector("#backdrop");
const randomBag = document.querySelector("#random-bag");
let returnFocus = null;
let activeDrawerBagId = null;
let activeDrawerBag = null;
let bags = [];
let activeFilter = "all";
let activeMode = null;
let available = false;
const initialFragment = location.hash && location.hash !== "#top" ? location.hash : "";
let initialFragmentPending = Boolean(initialFragment);
let initialFragmentInterrupted = false;
const initialScrollBehavior = document.documentElement.style.scrollBehavior;
if (initialFragmentPending) document.documentElement.style.scrollBehavior = "auto";
if (initialFragmentPending)
  history.replaceState(history.state, "", `${location.pathname}${location.search}`);
const modeCopy = {
  FIXTURE: {
    header: "FIXTURE MODE",
    desk: "PUBLIC PREVIEW / NO LIVE TOKEN DATA",
    status: "DETERMINISTIC FIXTURES",
    detail: "Real interface. Synthetic bags.",
    end: "END OF FIXTURE INDEX",
    bagLabel: "FIXTURE BAGS",
    report: "FIXTURE REPORT",
    token: "TOKEN ADDRESS / FIXTURE",
    source: "FIXTURE / PRODUCT-SHELL ONLY",
    stamp: "NOT LIVE EVIDENCE",
    scope: "this fixture",
    launch: "Launch in this fixture",
    empty: "NO FIXTURE BAGS INDEXED",
    unavailable: "FIXTURE SOURCE NOT AVAILABLE",
  },
  LIVE: {
    header: "LIVE INDEX",
    desk: "PUBLIC RECEIPTS",
    status: "PUBLIC PROJECTION / PONS 4663",
    detail: "HISTORY COVERAGE: UNVERIFIED",
    end: "END OF CURRENT INDEX",
    bagLabel: "INDEXED BAGS",
    report: "PUBLIC PROJECTION",
    token: "TOKEN ADDRESS / OBSERVED ON ROBINHOOD",
    source: "PUBLIC RECEIPTS",
    stamp: "PUBLIC EVIDENCE",
    scope: "this projection",
    launch: "Observed on Pons",
    empty: "NO BAGS IN CURRENT INDEX WINDOW",
    unavailable: "LIVE INDEX NOT AVAILABLE",
  },
};
function copy() {
  return modeCopy[activeMode ?? WEB_DATA_SOURCE_MODE];
}
function applyMode(feed) {
  for (const element of document.querySelectorAll("[data-mode-copy]")) {
    element.textContent = copy()[element.dataset.modeCopy];
  }
  document.body.dataset.mode = activeMode;
  document.querySelector('[data-mode-copy="detail"]').textContent =
    activeMode === "LIVE"
      ? `HISTORY: UNVERIFIED / AS OF BLOCK ${feed.asOfBlock}`
      : copy().detail;
}
function ageLabel(item) {
  return activeMode === "LIVE" ? item.age : `${item.age} AGO`;
}
const search = document.querySelector("#bag-search");
const latestBag = document.querySelector("#latest-bag");
const liveRail = document.querySelector("#live-rail");
const pageSurfaces = [
  ...document.querySelectorAll(
    "body > header, body > main, body > footer, .skip-link",
  ),
];

function interruptInitialFragmentRestore() {
  initialFragmentInterrupted = true;
  document.documentElement.style.scrollBehavior = initialScrollBehavior;
}

function restoreInitialFragmentUrl() {
  if (location.hash) return;
  history.replaceState(
    history.state,
    "",
    `${location.pathname}${location.search}${initialFragment}`,
  );
}

for (const eventName of ["pointerdown", "touchstart", "wheel", "keydown"]) {
  window.addEventListener(eventName, interruptInitialFragmentRestore, {
    once: true,
    passive: true,
  });
}

function restoreInitialFragment() {
  if (!initialFragmentPending) return;
  initialFragmentPending = false;
  if (initialFragmentInterrupted) {
    restoreInitialFragmentUrl();
    return;
  }
  const target = document.getElementById(initialFragment.slice(1));
  if (!target) {
    restoreInitialFragmentUrl();
    document.documentElement.style.scrollBehavior = initialScrollBehavior;
    return;
  }
  const heroImage = document.querySelector(".mascot-stage img");
  const layoutReady = [
    document.fonts?.ready ?? Promise.resolve(),
    heroImage?.decode?.().catch(() => undefined) ?? Promise.resolve(),
  ];
  void Promise.all(layoutReady).then(() => requestAnimationFrame(() => {
    if (initialFragmentInterrupted) {
      restoreInitialFragmentUrl();
      return;
    }
    const root = document.documentElement;
    const scrollPadding = Number.parseFloat(
      getComputedStyle(root).scrollPaddingTop,
    );
    restoreInitialFragmentUrl();
    window.scrollTo({
      top: Math.max(0, target.getBoundingClientRect().top + scrollY - scrollPadding),
    });
    root.style.scrollBehavior = initialScrollBehavior;
  }));
}

const sectionNav = document.querySelector(".section-nav");
sectionNav?.addEventListener("click", (event) => {
  if (event.target.closest("a")) sectionNav.open = false;
});

void bootstrapPublicProduct();
const readPlane = new PublicReadPlane({
  loadFeed: loadDumpsterFeed,
  pollingEnabled: WEB_DATA_SOURCE_MODE === "LIVE",
  onSnapshot: renderVerifiedSnapshot,
  onState: renderReadState,
});
initFrontdoor({ initialFragment, onOpenCase: openBag, onRetry: () => readPlane.retry(), onNavigate: closeDrawer });
readPlane.start();
document.addEventListener("visibilitychange", () => readPlane.visibilityChanged());
window.addEventListener("pagehide", () => readPlane.stop(), { once: true });

function renderVerifiedSnapshot(feed) {
  if (feed.mode === "LIVE" && WEB_DATA_SOURCE_MODE !== "LIVE") return;
  bags = feed.bags;
  activeMode = feed.mode;
  available = true;
  applyMode(feed);
  renderLiveRail(feed);
  if (randomBag) randomBag.disabled = bags.length === 0;
  renderIntake();
  renderFeed();
  renderFreshCases(feed);
  void bootstrapPublicProduct();
}

function renderReadState({ state, snapshot, status: sourceStatus }) {
  renderFreshState({ state, snapshot, status: sourceStatus });
  document.body.dataset.readState = state;
  if (snapshot?.feed) {
    renderLiveRail(snapshot.feed);
    for (const bag of bags) bag.readState = state;
  }
  if (activeDrawerBag?.mode === 'LIVE') {
    const bound = activeDrawerBag.asOfBlock === snapshot?.checkpoint && activeDrawerBag.asOfBlockHash === snapshot?.checkpointBlockHash && activeDrawerBag.feedDigest === snapshot?.digest;
    activeDrawerBag.readState = bound ? state : ReadState.STALE;
    const stamp = drawerContent.querySelector('.share-card-kicker');
    if (stamp) stamp.textContent = `HOT GARBAGE // ${buildShareCardModel(activeDrawerBag).stamp}`;
  }
  const status = document.querySelector("#read-freshness");
  if (!status) return;
  if (state === ReadState.LOADING) {
    status.hidden = false;
    status.dataset.state = state;
    const message = WEB_DATA_SOURCE_MODE === "LIVE"
      ? "CHECKING PONS RECEIPTS…"
      : "LOADING SYNTHETIC FIXTURES…";
    status.textContent = message;
    latestBag.innerHTML = `<span class="intake-loading">${message}</span>`;
    grid.innerHTML = `<div class="feed-loading">${message}</div>`;
  } else if (state === ReadState.STALE && snapshot) {
    status.hidden = false;
    status.dataset.state = state;
    const block = snapshot.checkpoint ? ` · BLOCK ${snapshot.checkpoint}` : "";
    status.textContent = `REFRESH DEGRADED · SHOWING LAST VERIFIED DATA${block}`;
  } else if (state === ReadState.UNAVAILABLE && !snapshot) {
    status.hidden = true;
    renderUnavailable();
    grid.querySelector("#retry-read-plane")?.addEventListener("click", () => readPlane.retry());
  } else {
    status.hidden = true;
  }
}

async function bootstrapPublicProduct() {
  try {
    const manifest = await loadCapabilityManifest();
    renderPublicProduct(manifest.publicProduct);
    document.body.dataset.productState = "VERIFIED_PROJECTION";
  } catch {
    renderPublicProduct(null);
    document.body.dataset.productState = "UNVERIFIED";
  }
}

function renderUnavailable() {
  available = false;
  if (randomBag) randomBag.disabled = true;
  document.body.dataset.mode = "UNAVAILABLE";
  for (const element of document.querySelectorAll("[data-mode-copy]"))
    element.textContent = "INDEX UNAVAILABLE";

  latestBag.innerHTML =
    '<span class="intake-loading">DUMPSTER DATA UNAVAILABLE</span>';
  liveRail.innerHTML = '<span class="live-rail-dot offline" aria-hidden="true"></span><strong>OFFLINE</strong><span>PONS 4663</span><span>LIVE INDEX NOT AVAILABLE</span>';
  document.querySelector("#feed-count").textContent = "INDEX UNAVAILABLE";
  for (const element of document.querySelectorAll(".filter-button span")) {
    element.textContent = "—";
  }
  grid.innerHTML = `<div class="data-unavailable">DUMPSTER DATA UNAVAILABLE<br/>${copy().unavailable}<br/><button id="retry-read-plane" type="button">RETRY VERIFIED READ ↻</button></div>`;
  restoreInitialFragment();
}

function renderIntake() {
  updateFilterCounts();
  const latest = bags[0];
  if (!latest) {
    latestBag.innerHTML = `<span class="intake-loading">${copy().empty}</span>`;
    if (randomBag) randomBag.disabled = true;
    return;
  }
  latestBag.innerHTML = `<span class="intake-label">LAST INTO THE BIN</span>
    <button class="intake-bag" type="button" aria-label="Open latest ${copy().report} bag ${escapeHtml(latest.symbol)}">
      <b>${escapeHtml(latest.symbol)}</b><span class="intake-note">${escapeHtml(latest.note)}</span>
      <span class="intake-block">BLOCK / ${escapeHtml(latest.block)}</span><span class="intake-open">INSPECT RECEIPT ↗</span>
    </button>`;
  const button = latestBag.querySelector("button");
  button.addEventListener("click", () => openBag(latest.id, button));
}

function renderFeed() {
  if (!available) return;
  const query = search.value.trim().toLowerCase();
  const visible = bags.filter(
    (bag) =>
      matchesFilter(bag, activeFilter) &&
      [bag.symbol, bag.name, bag.reportedCreatorAddress, bag.token].some(
        (value) => String(value).toLowerCase().includes(query),
      ),
  );
  grid.innerHTML = visible.length
    ? `${renderFeedHeader()}${visible.map(renderCard).join("")}`
    : bags.length === 0
      ? `<div class="empty-feed">${copy().empty}</div>`
      : '<div class="empty-feed">No bags match this dig.<button type="button" id="clear-search">CLEAR FILTERS ↗</button></div>';
  document.querySelector("#feed-count").textContent =
    `${String(visible.length).padStart(2, "0")} / ${String(bags.length).padStart(2, "0")} ${copy().bagLabel}`;
  grid.querySelector("#clear-search")?.addEventListener("click", () => {
    search.value = "";
    setFilter("all");
    search.focus();
  });
  for (const button of grid.querySelectorAll("[data-bag-id]")) {
    button.addEventListener("click", () =>
      openBag(button.dataset.bagId, button),
    );
  }
  for (const link of grid.querySelectorAll("[data-social-link]")) {
    link.addEventListener("click", (event) => event.stopPropagation());
    link.addEventListener("keydown", (event) => event.stopPropagation());
  }
  for (const image of grid.querySelectorAll("[data-token-image]")) {
    image.addEventListener("error", () => image.remove(), { once: true });
  }
  window.dispatchEvent(new CustomEvent("binrat:feed-rendered"));
  restoreInitialFragment();
}

function renderCard(bag) {
  const coverage = normalizeCoverage(bag.coverage);
  const noted =
    Number.isInteger(bag.notedConditions) && bag.notedConditions >= 0
      ? bag.notedConditions
      : 0;
  const evidenceState = summarizeEvidence(bag);
  return `
    <article class="bag-card" tabindex="0" role="button" aria-haspopup="dialog" data-bag-id="${escapeHtml(bag.id)}" data-noted="${noted}" aria-label="Open ${escapeHtml(bag.symbol)} ${copy().report}">
      <div class="feed-cell feed-age" data-label="AGE / BLOCK"><span>BLK</span>${escapeHtml(bag.block)}</div>
      <div class="feed-cell feed-token" data-label="TOKEN"><div class="feed-token-main">${renderTokenThumb(bag)}<div class="feed-token-copy"><h3 class="token-symbol">${escapeHtml(bag.symbol)}</h3><div class="token-name">${escapeHtml(bag.name)}</div><code>${escapeHtml(shortAddress(bag.token))}</code></div></div></div>
      <div class="feed-cell feed-creator" data-label="PONS-REPORTED DEPLOYER"><code title="${escapeHtml(bag.reportedCreatorAddress)}">${escapeHtml(shortAddress(bag.reportedCreatorAddress))}</code><span>${bag.priorLaunches > 0 ? "REPEAT ADDRESS" : "NO PRIOR BAG IN INDEX"}</span></div>
      <div class="feed-cell feed-prior" data-label="PRIOR BAGS"><strong>${escapeHtml(bag.priorLaunches)}</strong><span>INDEXED</span></div>
      <div class="feed-cell feed-socials" data-label="SOCIALS">${renderSocials(bag)}</div>
      <div class="feed-cell feed-evidence" data-label="EVIDENCE STATE"><span class="evidence-summary ${evidenceState.toLowerCase()}">${evidenceState}</span><small>${coverage} HISTORY</small></div>
      <div class="feed-cell feed-inspect" data-label="INSPECT"><span>OPEN FILE</span><b aria-hidden="true">↗</b></div>
      <div class="feed-mobile-note"><span>RAT NOTE /</span> “${escapeHtml(bag.note)}”</div>
    </article>`;
}

function renderFeedHeader() {
  return `<div class="feed-table-head" aria-hidden="true">
    <span>AGE / BLOCK</span><span>TOKEN</span><span>PONS-REPORTED DEPLOYER</span><span>PRIOR BAGS</span><span>SOCIALS</span><span>EVIDENCE STATE</span><span>INSPECT</span>
  </div>`;
}

function matchesFilter(bag, filter) {
  if (filter === "repeat") return bag.priorLaunches > 0;
  if (filter === "noted") return bag.notedConditions > 0;
  if (filter === "socials") return hasSocials(bag);
  if (filter === "unknown")
    return bag.evidence.some((item) => item.tone === "unknown");
  return true;
}

function updateFilterCounts() {
  const counts = {
    all: bags.length,
    repeat: bags.filter((bag) => matchesFilter(bag, "repeat")).length,
    noted: bags.filter((bag) => matchesFilter(bag, "noted")).length,
    socials: bags.filter((bag) => matchesFilter(bag, "socials")).length,
    unknown: bags.filter((bag) => matchesFilter(bag, "unknown")).length,
  };
  for (const [filter, count] of Object.entries(counts)) {
    document.querySelector(`[data-filter="${filter}"] span`).textContent =
      String(count).padStart(2, "0");
  }
}

function hasSocials(bag) {
  return Object.values(bag.socials ?? {}).some((value) =>
    String(value ?? "").trim(),
  );
}

function summarizeEvidence(bag) {
  const states = new Set(bag.evidence.map((item) => item.tone));
  if (states.has("noted")) return "NOTED";
  if (states.has("unknown")) return "UNKNOWN";
  return "OBSERVED";
}

function renderLiveRail(feed) {
  if (!liveRail) return;
  if (activeMode === "LIVE") {
    liveRail.innerHTML = `<span class="live-rail-dot" aria-hidden="true"></span><strong>${document.body.dataset.readState === ReadState.FRESH ? "FRESH VERIFIED" : "STALE VERIFIED"}</strong><span>PONS 4663</span><span>${String(bags.length).padStart(2, "0")} BAGS</span><span>BLOCK ${escapeHtml(feed.asOfBlock)}</span><span>HISTORY ${escapeHtml(feed.historyCoverage)}</span>`;
    return;
  }
  liveRail.innerHTML = `<span class="live-rail-dot fixture" aria-hidden="true"></span><strong>FIXTURE</strong><span>${String(bags.length).padStart(2, "0")} BAGS</span><span>SYNTHETIC DATA</span>`;
}

function renderTokenThumb(bag) {
  const src = safeExternalUrl(bag.imageUri);
  const mark = String(bag.symbol || "?").trim().slice(0, 2).toUpperCase() || "?";
  return `<span class="token-thumb" aria-hidden="true"><span>${escapeHtml(mark)}</span>${src ? `<img src="${escapeHtml(src)}" alt="" width="44" height="44" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-token-image />` : ""}</span>`;
}

function renderSocials(bag) {
  const labels = { website: "WEB", twitter: "X", telegram: "TG" };
  const links = Object.entries(bag.socials ?? {}).flatMap(([kind, value]) => {
    const href = safeExternalUrl(value);
    return href
      ? [
          `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" data-social-link>${labels[kind]}</a>`,
        ]
      : [];
  });
  if (links.length) return links.join("");
  return hasSocials(bag)
    ? "<span>REPORTED / NO SAFE LINK</span>"
    : "<span>NONE REPORTED</span>";
}

function safeExternalUrl(value) {
  try {
    const url = new URL(String(value));
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function shortAddress(value) {
  const address = String(value);
  return address.length > 14
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : address;
}

function setFilter(value) {
  activeFilter = value;
  for (const button of document.querySelectorAll("[data-filter]")) {
    const active = button.dataset.filter === value;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  }
  renderFeed();
}

search.addEventListener("input", renderFeed);
for (const button of document.querySelectorAll("[data-filter]")) {
  button.addEventListener("click", () => setFilter(button.dataset.filter));
}
if (
  matchMedia("(hover: hover) and (prefers-reduced-motion: no-preference)")
    .matches
) {
  grid.addEventListener("pointermove", (event) => {
    const card = event.target.closest(".bag-card");
    if (!card) return;
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--pointer-x", `${event.clientX - rect.left}px`);
    card.style.setProperty("--pointer-y", `${event.clientY - rect.top}px`);
  });
}

function openBag(idOrBag, origin = document.activeElement) {
  const bag = typeof idOrBag === "string"
    ? bags.find((item) => item.id === idOrBag)
    : idOrBag;
  if (!bag) return;
  activeDrawerBagId = bag.id;
  activeDrawerBag = bag;
  returnFocus = origin instanceof HTMLElement ? origin : null;

  const trail = bag.trail.length
    ? bag.trail
        .map(
          (item) => `
        <div class="trail-row">
          <strong>${escapeHtml(item.symbol)}</strong>
          <span class="trail-age">${escapeHtml(ageLabel(item))}</span>
          <span class="trail-outcome">${escapeHtml(item.outcome)}</span>
          <span class="coverage ${normalizeCoverage(item.coverage)}">${normalizeCoverage(item.coverage)}</span>
        </div>
      `,
        )
        .join("")
    : bag.priorLaunches > 0
      ? `<div class="empty-trail">${escapeHtml(bag.priorLaunches)} earlier indexed launch${bag.priorLaunches===1?"":"es"} exist for this reported deployer. The fast homepage view does not inline the full trail; Deployer File loads it on demand.</div>`
      : `<div class="empty-trail">No earlier matching launch is present in ${copy().scope}. History coverage is ${escapeHtml(bag.coverage)}. Missing history is not positive evidence.</div>`;

  bag.readState = bag.asOfBlock === readPlane.snapshot?.checkpoint && bag.asOfBlockHash === readPlane.snapshot?.checkpointBlockHash && bag.feedDigest === readPlane.snapshot?.digest ? document.body.dataset.readState : "STALE_VERIFIED";
  const share = buildShareCardModel(bag);

  drawerContent.innerHTML = `
    <p class="drawer-kicker">TRASH TRAIL // ${copy().report}</p>
    <div class="drawer-title-row"><div><h2 id="drawer-title">${escapeHtml(bag.symbol)}</h2><p>${escapeHtml(bag.name)} / ${escapeHtml(ageLabel(bag))}</p></div><div class="case-number">FILE<br/><b>${(() => { const index=bags.findIndex((item)=>item.id===bag.id); return index>=0 ? String(index+1).padStart(3,"0") : "HIST"; })()}</b></div></div>
    <div class="address creator-address"><span>Pons-reported deployer address</span><code>${escapeHtml(bag.reportedCreatorAddress)}</code></div>
    <div class="address"><span>${copy().token}</span><code>${escapeHtml(bag.token)}</code></div>
    ${activeMode === "LIVE" ? `<div class="address"><span>LAUNCH TRANSACTION</span><code>${escapeHtml(bag.txHash)}</code></div>` : ""}
    <div class="drawer-note"><span>RAT NOTE / PRESENTATION, NOT A VERDICT</span>“${escapeHtml(bag.note)}”</div>
    <div class="file-section-heading"><h3>01 / OBSERVATIONS</h3><span>${bag.evidence.length} RECORDS</span></div>
    <div class="evidence-list">
      ${bag.evidence.map((item) => `<div class="evidence-item ${normalizeTone(item.tone)}"><span class="evidence-label">${normalizeTone(item.tone).toUpperCase()}</span><span>${escapeHtml(item.text)}</span></div>`).join("")}
    </div>

    <div class="trail">
      <div class="file-section-heading"><h3>02 / TRASH TRAIL</h3><span>${escapeHtml(bag.priorLaunches)} PRIOR INDEXED BAGS</span></div>
      <p class="trail-summary">Same reported address. Not a claim of human identity. ${bag.trail.length} earlier bag${bag.trail.length === 1 ? "" : "s"} shown in ${copy().scope}.</p>
      <div class="trail-rows"><div class="trail-row current"><strong>${escapeHtml(bag.symbol)} / CURRENT BAG</strong><span class="trail-age">${escapeHtml(ageLabel(bag))}</span><span class="trail-outcome">${copy().launch}</span><span class="coverage ${normalizeCoverage(bag.coverage)}">${normalizeCoverage(bag.coverage)}</span></div>${trail}</div>
    </div>

    <section class="intelligence-panel rb-card" data-intelligence-panel>
      <div class="file-section-heading"><h3>03 / WHAT CHANGED?</h3><span>LOADING OBSERVATIONS…</span></div>
      <p class="intel-loading">Checking 5m / 1h / 24h evidence receipts.</p>
    </section>

    <section class="creator-file-panel rb-card" data-creator-panel>
      <div class="file-section-heading"><h3>04 / DEPLOYER FILE</h3><span>INDEXED HISTORY</span></div>
      <p class="intel-loading">Opening the reported-address file…</p>
    </section>

    <section class="replay-lab-panel rb-card" data-replay-panel>
      <div class="file-section-heading"><h3>05 / REPLAY LAB</h3><span>REAL INDEXED PONS EVIDENCE</span></div>
      <p class="intel-loading">Composing launch → 5m → 1h → 24h evidence chain…</p>
    </section>

    <div class="receipt-box">
      <div class="receipt-head"><h3>06 / RECEIPT</h3><span>BINRAT / PONS 4663</span></div>
      <dl class="receipt-grid">
        <dt>evidence ref</dt><dd>${escapeHtml(bag.receipt)}</dd>
        <dt>coverage</dt><dd>${escapeHtml(normalizeCoverage(bag.coverage))}</dd>
        <dt>source class</dt><dd>${copy().source}</dd>
        <dt>launch block</dt><dd>${escapeHtml(bag.block)}</dd>
        ${activeMode === "LIVE" ? `<dt>as-of block</dt><dd>${escapeHtml(bag.asOfBlock)}</dd>${bag.asOfBlockHash ? `<dt>as-of hash</dt><dd>${escapeHtml(bag.asOfBlockHash)}</dd>` : ""}` : ""}
      </dl>
      <span class="fixture-stamp">${copy().stamp}</span><span class="receipt-bars" aria-hidden="true"></span>
    </div>

    <section class="share-tools" aria-label="Share card ${copy().report}">
      <h3>07 / TAKE THE RECEIPT WITH YOU</h3>
      ${renderShareCard(share)}
      <div class="share-actions">
        <button class="button ghost" type="button" data-copy-post>COPY POST</button>
      </div>
      <div class="share-copy-status" aria-live="polite"></div>
    </section>

    <section class="case-next-step" aria-label="Future monitoring job">
      <span>TRIPWIRE · ${escapeHtml(productRat("tripwire")?.status ?? "UNVERIFIED")}</span>
      <h3>LEAVE A TRIPWIRE IN THE TRASH.</h3>
      <p>Tripwire is being built to watch this exact Pons-reported deployer and bring you back when a supported condition changes. Persistent jobs are not available yet.</p>
      <a class="button ghost" href="#crew-tripwire" data-crew-handoff>SEE THE FUTURE PLAN <span>→</span></a>
    </section>
  `;

  const copyButton = drawerContent.querySelector("[data-copy-post]");
  const copyStatus = drawerContent.querySelector(".share-copy-status");
  copyButton?.addEventListener("click", () => copySharePost(bag, copyStatus));
  if (activeMode === "LIVE") {
    void hydrateBagIntelligence(bag);
    void hydrateCreatorFile(bag);
    void hydrateReplayLab(bag);
  }

  drawer.inert = false;
  pageSurfaces.forEach((surface) => {
    surface.inert = true;
  });
  document.body.classList.add("drawer-open");
  drawer.scrollTop = 0;
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
  backdrop.hidden = false;
  requestAnimationFrame(() => {
    if (drawer.classList.contains("open"))
      drawerClose.focus({ preventScroll: true });
  });
}

async function hydrateBagIntelligence(bag) {
  const panel = drawerContent.querySelector("[data-intelligence-panel]");
  if (!panel) return;
  try {
    const intel = await loadBagIntelligence(bag.id);
    if (!intel || !drawer.classList.contains("open") || activeDrawerBagId !== bag.id) return;
    const snapshots = intel.snapshots.length
      ? intel.snapshots.map(renderObservationSnapshot).join("")
      : '<div class="intel-empty">No matured 5m / 1h / 24h observation receipt yet.</div>';
    const changes = intel.changes.length
      ? intel.changes.map(renderObservedChange).join("")
      : '<div class="intel-empty">No between-horizon change can be projected yet.</div>';
    panel.innerHTML = `
      <div class="file-section-heading"><h3>03 / WHAT CHANGED?</h3><span>${escapeHtml(intel.observationCoverage)} OBSERVATION COVERAGE</span></div>
      <p class="intel-boundary">On-chain snapshots only. Raw pool liquidity is not USD liquidity. The Pons-reported deployer address is not a claim of human identity.</p>
      <div class="intel-snapshots">${snapshots}</div>
      <div class="intel-changes"><span class="intel-subhead">BETWEEN RECEIPTS</span>${changes}</div>
      <div class="intel-receipt">INTELLIGENCE RECEIPT / ${escapeHtml(intel.receipt.receiptId)}</div>
    `;
    window.dispatchEvent(new CustomEvent("binrat:drawer-hydrated", { detail: { kind: "intelligence" } }));
  } catch {
    if (activeDrawerBagId !== bag.id) return;
    panel.innerHTML = '<div class="file-section-heading"><h3>03 / WHAT CHANGED?</h3><span>UNAVAILABLE</span></div><div class="intel-empty">Observation projection is not available. Missing evidence stays missing.</div>';
  }
}

async function hydrateCreatorFile(bag) {
  const panel = drawerContent.querySelector("[data-creator-panel]");
  if (!panel) return;
  try {
    const file = await loadCreatorFile(bag.reportedCreatorAddress);
    if (!file || !drawer.classList.contains("open") || activeDrawerBagId !== bag.id) return;
    const rows = file.launches.map((item) => `
      <div class="creator-launch-row">
        <div class="creator-launch-token">
          ${renderCreatorTokenThumb(item)}
          <div><strong>${escapeHtml(item.symbol)}</strong><small>${escapeHtml(item.name)}</small></div>
        </div>
        <span>BLK ${escapeHtml(item.blockNumber)}</span>
        <code title="${escapeHtml(item.token)}">${escapeHtml(shortAddress(item.token))}</code>
        <div class="creator-launch-meta">
          ${renderCreatorLaunchSocials(item)}
        </div>
        <button class="creator-launch-open" type="button" data-open-creator-launch="${escapeHtml(item.id)}">OPEN CHANGES ↗</button>
      </div>`).join("");
    panel.innerHTML = `
      <div class="file-section-heading"><h3>04 / DEPLOYER FILE</h3><span>LATEST ${escapeHtml(file.launches.length)} VERIFIED LAUNCHES</span></div>
      <div class="creator-file-stats">
        <div><span>REPORTED ADDRESS</span><code>${escapeHtml(shortAddress(file.reportedCreatorAddress))}</code></div>
        <div><span>AS OF BLOCK</span><b>${escapeHtml(file.checkpointBlock)}</b></div>
        <div><span>COVERAGE</span><b>${escapeHtml(file.coverage.mode)}</b></div>
        <div><span>OLDER LAUNCHES</span><b>${file.coverage.olderLaunchesOmitted ? "OMITTED" : "NONE"}</b></div>
      </div>
      <p class="intel-boundary">Same Pons-reported deployer address only. This does not establish common human ownership. Latest verified launches shown; older launches may be omitted. Open any launch to inspect its evidence-bound WHAT CHANGED timeline.</p>
      <div class="creator-launches">${rows}</div>
      <div class="intel-receipt">VERIFIED SNAPSHOT DIGEST / ${escapeHtml(file.feedDigest)}</div>
    `;
    for (const image of panel.querySelectorAll("[data-token-image]")) {
      image.addEventListener("error", () => image.remove(), { once: true });
    }
    for (const button of panel.querySelectorAll("[data-open-creator-launch]")) {
      button.addEventListener("click", async () => {
        const launchId = button.dataset.openCreatorLaunch;
        if (!launchId) return;
        const current = bags.find((item) => item.id === launchId);
        if (current) { openBag(current, button); return; }
        button.disabled = true;
        button.textContent = "OPENING…";
        try {
          const historical = await loadPublicBag(launchId);
          if (!historical) throw new Error("PUBLIC_BAG_NOT_AVAILABLE");
          openBag(historical, button);
        } catch {
          button.disabled = false;
          button.textContent = "OPEN UNAVAILABLE";
        }
      });
    }
    window.dispatchEvent(new CustomEvent("binrat:drawer-hydrated", { detail: { kind: "creator" } }));
  } catch {
    if (activeDrawerBagId !== bag.id) return;
    panel.innerHTML = '<div class="file-section-heading"><h3>04 / DEPLOYER FILE</h3><span>UNAVAILABLE</span></div><div class="intel-empty">Deployer history projection is not available.</div>';
  }
}


async function hydrateReplayLab(bag) {
  const panel = drawerContent.querySelector("[data-replay-panel]");
  if (!panel) return;
  try {
    const replay = await loadReplayBundle(bag.id);
    if (!replay || !drawer.classList.contains("open") || activeDrawerBagId !== bag.id) return;
    const stages = replay.stages.map((stage) => `
      <div class="intel-snapshot">
        <span class="intel-horizon">${escapeHtml(stage.label)}</span>
        <strong>${escapeHtml(stage.status)}</strong>
        <span>BLOCK ${escapeHtml(stage.blockNumber)}</span>
        <code title="${escapeHtml(stage.blockHash)}">${escapeHtml(shortAddress(stage.blockHash))}</code>
      </div>`).join("");
    panel.innerHTML = `
      <div class="file-section-heading"><h3>05 / REPLAY LAB</h3><span>${escapeHtml(replay.stages.length)} EVIDENCE STAGES</span></div>
      <p class="intel-boundary">Deterministic replay of real indexed Pons evidence. Missing 5m / 1h / 24h stages remain missing; nothing is simulated.</p>
      <div class="intel-snapshots">${stages}</div>
      <div class="creator-file-stats">
        <div><span>DEPLOYER FILE</span><b>${escapeHtml(replay.creatorFile.indexedLaunchCount)} LAUNCHES</b></div>
        <div><span>OBSERVATION COVERAGE</span><b>${escapeHtml(replay.intelligence.observationCoverage)}</b></div>
        <div><span>AS OF BLOCK</span><b>${escapeHtml(replay.asOfBlock)}</b></div>
        <div><span>HISTORY</span><b>${escapeHtml(replay.historyCoverage)}</b></div>
      </div>
      <div class="share-actions"><button class="button ghost" type="button" data-copy-replay>COPY EVIDENCE BUNDLE</button></div>
      <div class="share-copy-status" data-replay-copy-status aria-live="polite"></div>
      <div class="intel-receipt">REPLAY RECEIPT / ${escapeHtml(replay.receipt.receiptId)}</div>
    `;
    panel.querySelector("[data-copy-replay]")?.addEventListener("click", async () => {
      const status = panel.querySelector("[data-replay-copy-status]");
      try {
        await navigator.clipboard.writeText(JSON.stringify(replay, null, 2));
        if (status) status.textContent = "EVIDENCE BUNDLE COPIED";
      } catch {
        if (status) status.textContent = "COPY UNAVAILABLE";
      }
    });
    window.dispatchEvent(new CustomEvent("binrat:drawer-hydrated", { detail: { kind: "replay" } }));
  } catch {
    if (activeDrawerBagId !== bag.id) return;
    panel.innerHTML = '<div class="file-section-heading"><h3>05 / REPLAY LAB</h3><span>UNAVAILABLE</span></div><div class="intel-empty">Replay bundle is unavailable. No evidence was synthesized.</div>';
  }
}

function renderCreatorTokenThumb(item) {
  const src = safeExternalUrl(item?.metadata?.imageUri);
  const mark = String(item?.symbol || "?").trim().slice(0, 2).toUpperCase() || "?";
  return `<span class="token-thumb creator-token-thumb" aria-hidden="true"><span>${escapeHtml(mark)}</span>${src ? `<img src="${escapeHtml(src)}" alt="" width="36" height="36" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-token-image />` : ""}</span>`;
}

function renderCreatorLaunchSocials(item) {
  const sources = {
    website: item?.metadata?.website,
    twitter: item?.metadata?.twitter,
    telegram: item?.metadata?.telegram,
  };
  const labels = { website: "WEB", twitter: "X", telegram: "TG" };
  const links = Object.entries(sources).flatMap(([kind, value]) => {
    const href = safeExternalUrl(value);
    return href ? [`<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${labels[kind]}</a>`] : [];
  });
  return links.length ? `<span class="creator-launch-socials">${links.join("")}</span>` : '<span class="creator-launch-socials muted">NO SOCIALS</span>';
}

function renderObservationSnapshot(snapshot) {
  return `
    <article class="intel-snapshot" data-rb-animated>
      <div class="intel-snapshot-head"><strong>+${escapeHtml(snapshot.horizonLabel.toUpperCase())}</strong><span>BLK ${escapeHtml(snapshot.observedBlock)}</span></div>
      <dl>
        <dt>reported deployer share</dt><dd>${formatBps(snapshot.reportedCreatorShareBps)}</dd>
        <dt>reported deployer balance</dt><dd>${formatRaw(snapshot.reportedCreatorBalanceRaw)}</dd>
        <dt>active liquidity</dt><dd>${formatRaw(snapshot.poolActiveLiquidityRaw)} <small>RAW</small></dd>
        <dt>pool tick</dt><dd>${snapshot.poolTick === null ? "UNKNOWN" : escapeHtml(snapshot.poolTick)}</dd>
      </dl>
    </article>`;
}

function renderObservedChange(change) {
  const label = {
    POOL_ACTIVE_LIQUIDITY_RAW: "ACTIVE LIQUIDITY / RAW",
    POOL_TICK: "POOL TICK",
    REPORTED_CREATOR_BALANCE_RAW: "REPORTED DEPLOYER BALANCE",
    REPORTED_CREATOR_SHARE_BPS: "REPORTED DEPLOYER SHARE",
  }[change.field] ?? change.field;
  const before = change.field === "REPORTED_CREATOR_SHARE_BPS" ? formatBps(change.before) : formatRaw(change.before);
  const after = change.field === "REPORTED_CREATOR_SHARE_BPS" ? formatBps(change.after) : formatRaw(change.after);
  return `<div class="intel-change"><span>${escapeHtml(label)}</span><b>${before} → ${after}</b><small>${escapeHtml(horizonLabel(change.fromHorizonMs))} → ${escapeHtml(horizonLabel(change.toHorizonMs))}</small></div>`;
}

function horizonLabel(ms) {
  if (ms === 300000) return "+5M";
  if (ms === 3600000) return "+1H";
  if (ms === 86400000) return "+24H";
  return `+${ms}MS`;
}

function formatBps(value) {
  if (value === null || value === undefined) return "UNKNOWN";
  const bps = BigInt(value);
  const whole = bps / 100n;
  const fraction = (bps % 100n).toString().padStart(2, "0");
  return `${whole}.${fraction}%`;
}

function formatRaw(value) {
  if (value === null || value === undefined) return "UNKNOWN";
  const text = String(value);
  if (!/^-?\d+$/.test(text)) return escapeHtml(text);
  const negative = text.startsWith("-");
  const digits = negative ? text.slice(1) : text;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return escapeHtml((negative ? "-" : "") + grouped);
}

function renderShareCard(card) {
  return `
    <div class="share-card" data-share-card-version="${escapeHtml(card.version)}">
      <div class="share-card-copy">
        <div class="share-card-kicker">HOT GARBAGE // ${escapeHtml(card.stamp)}</div>
        <h4 class="share-card-symbol">${escapeHtml(card.symbol)}</h4>
        <div class="share-card-metrics">
          <div class="share-card-metric"><span>REPORTED DEPLOYER</span><b>${escapeHtml(card.creatorShort)}</b></div>
          <div class="share-card-metric"><span>PRIOR BAGS</span><b>${escapeHtml(card.priorLaunches)}</b></div>
          <div class="share-card-metric"><span>COVERAGE</span><b>${escapeHtml(card.coverage)}</b></div>
        </div>
        <p class="share-card-note">binrat: “${escapeHtml(card.note)}”</p>
      </div>
      <div class="share-card-rat" aria-hidden="true">
        <img src="./assets/binrat-hero.webp" alt="" width="1100" height="1100" loading="lazy" />
      </div>
      <div class="share-card-footer">
        <span>${escapeHtml(card.receipt)}</span>
        <span>${escapeHtml(card.footer)}</span>
      </div>
    </div>
  `;
}

async function copySharePost(bag, statusNode) {
  const text = buildSharePostText(bag);
  try {
    if (!navigator.clipboard?.writeText)
      throw new Error("CLIPBOARD_UNAVAILABLE");
    await navigator.clipboard.writeText(text);
    statusNode.textContent = `COPIED // ${copy().report} stamp included`;
  } catch {
    statusNode.textContent = "COPY UNAVAILABLE // select the card manually";
  }
}

function closeDrawer() {
  const wasOpen = drawer.classList.contains("open");
  drawer.classList.remove("open");
  drawer.inert = true;
  pageSurfaces.forEach((surface) => {
    surface.inert = false;
  });
  document.body.classList.remove("drawer-open");
  drawer.setAttribute("aria-hidden", "true");
  backdrop.hidden = true;
  if (wasOpen && returnFocus?.isConnected) returnFocus.focus();
  activeDrawerBagId = null;
  activeDrawerBag = null;
  returnFocus = null;
}

drawerClose.addEventListener("click", closeDrawer);
drawerContent.addEventListener("click", (event) => {
  if (event.target.closest("[data-crew-handoff]")) closeDrawer();
});
backdrop.addEventListener("click", closeDrawer);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeDrawer();
  if (event.key === "Tab" && drawer.classList.contains("open")) {
    const focusable = [
      ...drawer.querySelectorAll('button, a[href], input, [tabindex="0"]'),
    ];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
  if (
    event.key === "/" &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !drawer.classList.contains("open") &&
    !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)
  ) {
    event.preventDefault();
    if (document.querySelector("#dumpster-view").hidden) location.hash = "garbage";
    requestAnimationFrame(() => search.focus());
  }
  if (
    (event.key === "Enter" || event.key === " ") &&
    document.activeElement?.dataset?.bagId
  ) {
    event.preventDefault();
    openBag(document.activeElement.dataset.bagId, document.activeElement);
  }
});

if (randomBag) {
  randomBag.addEventListener("click", () => {
    if (bags.length === 0) return;
    const bag = bags[Math.floor(Math.random() * bags.length)];
    openBag(bag.id, randomBag);
  });
}

function normalizeCoverage(value) {
  return ["COMPLETE", "PARTIAL", "UNVERIFIED"].includes(value)
    ? value
    : "UNVERIFIED";
}

function normalizeTone(value) {
  return ["observed", "noted", "unknown"].includes(value) ? value : "unknown";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
