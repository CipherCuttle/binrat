// Presentation only. The existing read plane owns data; this module cannot admit jobs.
const profiles = Object.freeze({
  "rat-zero": { name: "RAT ZERO", role: "SCOUT", status: "LIVE", image: "rat-zero.jpg", headline: "WHAT JUST HIT THE DUMPSTER?", description: "Finds fresh Pons launches and checks what BINRAT remembers.", steps: ["Find fresh Pons launches.", "Open the launch evidence.", "Keep source-backed receipts and visible gaps."], action: "DIG WITH RAT ZERO", href: "#garbage" },
  tripwire: { name: "TRIPWIRE", role: "WATCHER", status: "BUILDING", image: "tripwire.png", headline: "LEAVE HIM ON SOMETHING.", description: "Watches a subject and alerts you when a supported condition changes. Persistent Tripwire jobs are being built.", steps: ["Watch an exact address or supported condition.", "Wait quietly when nothing qualifies.", "Bring you back to the changed Case."], action: "BUILDING · NOT AVAILABLE YET" },
  sniffer: { name: "SNIFFER", role: "TRAIL HUNTER", status: "NEXT", image: "sniffer.png", headline: "HE FOLLOWS THE MONEY.", description: "Follows an evidenced funder into new wallets and checks whether they later launch on Pons. Sniffer jobs are next.", steps: ["Follow an evidenced funding trail.", "Notice a qualifying recipient.", "Hand a later Pons launch to Rat Zero."], action: "NEXT · NOT AVAILABLE YET" },
});
const escapeHtml = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

export function initFrontdoor({ initialFragment, onOpenCase, onRetry, onNavigate }) {
  const homeSections = document.querySelectorAll("[data-home-section]");
  const dumpster = document.querySelector("#dumpster-view");
  const panel = document.querySelector("#crew-selected");
  const fresh = document.querySelector("#fresh-cases");
  const menu = document.querySelector(".section-nav");

  function selectRat(key) {
    const profile = profiles[key];
    if (!profile) return;
    for (const button of document.querySelectorAll("[data-select-rat]")) {
      button.setAttribute("aria-pressed", String(button.dataset.selectRat === key));
    }
    panel.dataset.rat = key;
    panel.innerHTML = `<figure class="crew-portrait"><img src="./assets/crew/${profile.image}" alt="${profile.name}, the approved BINRAT ${profile.role.toLowerCase()}" width="1024" height="1024" loading="lazy" /></figure>
      <div class="crew-job"><p class="eyebrow">${profile.role} <span class="rat-status">${profile.status}</span></p><h3>${profile.name}</h3><strong class="crew-line">${profile.headline}</strong><p>${profile.description}</p><ol>${profile.steps.map((step) => `<li>${step}</li>`).join("")}</ol>${profile.href ? `<a class="button primary" href="${profile.href}">${profile.action} <span aria-hidden="true">→</span></a>` : `<p class="rat-unavailable">${profile.action}</p>`}</div>`;
  }

  function applyDestination(fragment) {
    const isDumpster = ["#garbage", "#latest-bag"].includes(fragment);
    homeSections.forEach((section) => { section.hidden = isDumpster; });
    dumpster.hidden = !isDumpster;
    document.querySelectorAll("[data-crew-detail]").forEach((element) => { element.hidden = !(fragment.startsWith("#crew") || fragment === "#den"); });
    document.body.dataset.view = isDumpster ? "dumpster" : "home";
    for (const link of document.querySelectorAll("[data-nav-destination]")) {
      const active = (link.dataset.navDestination === "dumpster" && isDumpster) ||
        (link.dataset.navDestination === "crew" && fragment.startsWith("#crew")) ||
        (link.dataset.navDestination === "den" && fragment === "#den");
      if (active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    }
    if (fragment === "#crew-tripwire") selectRat("tripwire");
    else if (fragment === "#crew-sniffer") selectRat("sniffer");
    else if (fragment === "#crew") selectRat("rat-zero");
    menu.open = false;
  }

  selectRat("rat-zero");
  applyDestination(initialFragment || location.hash);
  window.addEventListener("hashchange", () => {
    onNavigate();
    applyDestination(location.hash);
    // A hash target may have been hidden when native fragment scrolling ran.
    document.getElementById(location.hash.slice(1))?.scrollIntoView();
  });
  document.addEventListener("click", (event) => {
    const anchor = event.target.closest('a[href^="#"]');
    if (!anchor || anchor.getAttribute("href") !== location.hash) return;
    // Repeated links still carry intent after a user manually changed the selected Rat.
    onNavigate();
    applyDestination(location.hash);
    document.getElementById(location.hash.slice(1))?.scrollIntoView();
  });
  document.querySelector("#crew-roster").addEventListener("click", (event) => {
    const button = event.target.closest("[data-select-rat]");
    if (button) selectRat(button.dataset.selectRat);
  });
  fresh.addEventListener("click", (event) => {
    const button = event.target.closest("[data-open-case]");
    if (button) onOpenCase(button.dataset.openCase, button);
    if (event.target.closest("[data-retry-fresh]")) onRetry();
  });
}

export function renderFreshCases(feed) {
  const target = document.querySelector("#fresh-cases");
  const items = feed.bags.slice(0, 3);
  target.innerHTML = items.length ? items.map((bag) => `<article class="fresh-card">
    <p class="eyebrow">${feed.mode === "FIXTURE" ? "FIXTURE · NOT LIVE EVIDENCE" : "ROBINHOOD · PONS"}</p>
    <h3>${escapeHtml(bag.symbol || `${bag.token.slice(0, 6)}…${bag.token.slice(-4)}`)}</h3><p class="fresh-name">${escapeHtml(bag.name || "Name unavailable")}</p>
    <p class="fresh-block">Launch block ${escapeHtml(bag.block)}</p>
    <p class="fresh-reason">${bag.priorLaunches > 0 ? `This Pons-reported deployer appears on ${escapeHtml(bag.priorLaunches)} earlier indexed launch${bag.priorLaunches === 1 ? "" : "es"}.` : "No earlier launch found in current coverage. History may be incomplete."}</p>
    <button class="button ghost" type="button" data-open-case="${escapeHtml(bag.id)}" aria-label="Open Case for ${escapeHtml(bag.symbol || bag.token)}">OPEN CASE <span aria-hidden="true">↗</span></button>
  </article>`).join("") : `<p class="fresh-empty">${feed.mode === "FIXTURE" ? "No launches in this fixture view." : "No launches in this view. No example was substituted."}</p>`;
}

export function renderFreshState({ state, snapshot, status }) {
  const target = document.querySelector("#fresh-cases");
  const label = document.querySelector("#home-freshness");
  if (state === "LOADING_NO_DATA") {
    label.textContent = "Loading Pons launches…";
    return;
  }
  if (state === "UNAVAILABLE_NO_DATA" && !snapshot) {
    label.textContent = "Launches unavailable right now.";
    target.innerHTML = '<div class="fresh-empty"><p>Launches unavailable right now.</p><button class="button ghost" type="button" data-retry-fresh>RETRY</button></div>';
    return;
  }
  if (state === "FIXTURE_DATA") {
    label.textContent = "FIXTURE · SYNTHETIC LAUNCHES · NOT LIVE EVIDENCE";
    return;
  }
  const checkpoint = snapshot?.checkpoint ? ` · verified through block ${snapshot.checkpoint}` : "";
  const statusMatchesSnapshot = status?.checkpointBlock === snapshot?.checkpoint &&
    snapshot?.digest && status?.feedDigest === snapshot.digest;
  const verifiedAt = statusMatchesSnapshot && Number.isSafeInteger(status?.verifiedAtMs) && status.verifiedAtMs > 0 && status.verifiedAtMs <= 8.64e15
    ? ` · snapshot verified ${new Date(status.verifiedAtMs).toISOString()}` : "";
  label.textContent = `${state === "STALE_VERIFIED" ? "Refresh unavailable. Showing last verified launches" : "Showing verified Pons launches"}${checkpoint}${verifiedAt}.`;
}
