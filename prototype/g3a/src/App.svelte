<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import { demo, receipt, shortAddress, usd, type DemoWindow } from './fixture';

  type Scene = 'discovery' | 'radar' | 'retrieving' | 'investigation' | 'rat-trap';

  let scene = $state<Scene>('discovery');
  let progress = $state(0);
  let radarCaseOpen = $state(false);
  let scanEntry = $state<'discovery' | 'radar'>('discovery');
  let selectedWindow = $state<DemoWindow>('24h');
  let funderRevealed = $state(false);
  let relationshipVisible = $state(false);
  let sceneHeading = $state<HTMLElement | null>(null);
  let radarCaseHeading = $state<HTMLElement | null>(null);
  let demoEntryButton = $state<HTMLButtonElement | null>(null);
  let revealHeading = $state<HTMLElement | null>(null);
  let relationshipHeading = $state<HTMLElement | null>(null);
  let intervalId: number | undefined;
  let finishId: number | undefined;
  let ambientFrame: number | undefined;

  const windows = Object.keys(demo.windows) as DemoWindow[];
  const windowData = $derived(demo.windows[selectedWindow]);
  const playbackStep = $derived(
    progress < 28
      ? '01 / FACTORY EVENT FOUND'
      : progress < 52
        ? '02 / TOKEN + DEPLOYER MATCHED'
        : progress < 76
          ? '03 / CURVE MATCHED'
          : '04 / SOURCE RECEIPT READY'
  );

  const prefersReducedMotion = () =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Original Svelte implementation: the licensed React Bits Pro CTA 5 source is not used.
  // Cursor movement is decorative, gentle, and disabled for reduced motion/coarse input.
  const moveAmbient = (event: PointerEvent) => {
    if (prefersReducedMotion() || !window.matchMedia('(pointer: fine)').matches) return;
    const host = event.currentTarget as HTMLElement;
    const rect = host.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 20;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 13;
    if (ambientFrame !== undefined) window.cancelAnimationFrame(ambientFrame);
    ambientFrame = window.requestAnimationFrame(() => {
      host.style.setProperty('--flow-x', `${x.toFixed(1)}px`);
      host.style.setProperty('--flow-y', `${y.toFixed(1)}px`);
      ambientFrame = undefined;
    });
  };

  const resetAmbient = (event: PointerEvent) => {
    if (ambientFrame !== undefined) window.cancelAnimationFrame(ambientFrame);
    ambientFrame = undefined;
    const host = event.currentTarget as HTMLElement;
    host.style.setProperty('--flow-x', '0px');
    host.style.setProperty('--flow-y', '0px');
  };

  const clearTimers = () => {
    if (intervalId) window.clearInterval(intervalId);
    if (finishId) window.clearTimeout(finishId);
    intervalId = undefined;
    finishId = undefined;
  };

  // One history entry per scene, not per reveal or thermometer selection.
  // Retrieval completion replaces its entry: Back never replays a finished scan.
  type RouteSnapshot = {
    version: 1;
    scene: Scene;
    selectedWindow: DemoWindow;
    radarCaseOpen?: boolean;
    scanEntry?: 'discovery' | 'radar';
    funderRevealed: boolean;
    relationshipVisible: boolean;
  };

  const snapshot = (target: Scene = scene): RouteSnapshot => ({
    version: 1,
    scene: target,
    selectedWindow,
    radarCaseOpen,
    scanEntry,
    funderRevealed,
    relationshipVisible
  });

  const readRoute = (state: unknown): RouteSnapshot | null => {
    if (!state || typeof state !== 'object') return null;
    const candidate = (state as { binratG3c?: RouteSnapshot }).binratG3c;
    if (
      candidate?.version !== 1 ||
      !['discovery', 'radar', 'retrieving', 'investigation', 'rat-trap'].includes(candidate.scene) ||
      !['6h', '24h', '3d', '7d'].includes(candidate.selectedWindow)
    ) return null;
    return candidate;
  };

  const replaceRoute = () => {
    window.history.replaceState({ ...(window.history.state ?? {}), binratG3c: snapshot() }, '');
  };

  const focusScene = async (from?: Scene) => {
    await tick();
    if (scene === 'radar' && radarCaseOpen) {
      radarCaseHeading?.focus();
    } else if (scene === 'investigation' && from === 'rat-trap') {
      demoEntryButton?.focus();
    } else if (scene === 'rat-trap' && relationshipVisible) {
      relationshipHeading?.focus();
    } else if (scene === 'rat-trap' && funderRevealed) {
      revealHeading?.focus();
    } else {
      sceneHeading?.focus();
    }
  };

  const pushScene = (next: Scene) => {
    window.history.pushState({ ...(window.history.state ?? {}), binratG3c: snapshot(next) }, '');
    scene = next;
    void focusScene();
  };

  const restoreRoute = (route: RouteSnapshot, from?: Scene) => {
    clearTimers();
    selectedWindow = route.selectedWindow;
    radarCaseOpen = Boolean(route.radarCaseOpen);
    scanEntry = route.scanEntry === 'radar' ? 'radar' : 'discovery';
    funderRevealed = route.funderRevealed;
    relationshipVisible = route.relationshipVisible;
    // Forward/reload into an interrupted retrieval settles on its preloaded receipt.
    // It never starts a second playback or makes a fresh network request.
    scene = route.scene === 'retrieving' ? 'investigation' : route.scene;
    progress = scene === 'discovery' ? 0 : 100;
    if (route.scene === 'retrieving') replaceRoute();
    void focusScene(from);
  };

  const openInvestigation = () => {
    const wasRetrieving = scene === 'retrieving';
    clearTimers();
    progress = 100;
    if (wasRetrieving) {
      scene = 'investigation';
      replaceRoute();
      void focusScene();
    } else {
      pushScene('investigation');
    }
  };

  const openRadar = () => {
    radarCaseOpen = typeof window !== 'undefined' && window.matchMedia('(min-width: 761px)').matches;
    pushScene('radar');
  };

  const selectRadarCase = async () => {
    radarCaseOpen = true;
    replaceRoute();
    await tick();
    radarCaseHeading?.focus();
  };

  const closeRadarCase = async () => {
    radarCaseOpen = false;
    replaceRoute();
    await tick();
    sceneHeading?.focus();
  };

  const beginRetrieval = () => {
    scanEntry = scene === 'radar' ? 'radar' : 'discovery';
    if (prefersReducedMotion()) {
      openInvestigation();
      return;
    }

    clearTimers();
    progress = 8;
    pushScene('retrieving');
    intervalId = window.setInterval(() => {
      progress = Math.min(96, progress + 4);
    }, 120);
    finishId = window.setTimeout(openInvestigation, 3000);
  };

  const returnToDiscovery = () => {
    clearTimers();
    if (scene === 'radar') {
      window.history.back();
      return;
    }
    if (readRoute(window.history.state)) {
      window.history.go((scene === 'rat-trap' ? -2 : -1) - (scanEntry === 'radar' ? 1 : 0));
    } else {
      progress = 0;
      scene = 'discovery';
      replaceRoute();
      void focusScene();
    }
  };

  const openRatTrap = () => {
    funderRevealed = false;
    relationshipVisible = false;
    selectedWindow = '24h';
    pushScene('rat-trap');
  };

  const returnToInvestigation = () => {
    if (readRoute(window.history.state)) {
      window.history.back();
    } else {
      scene = 'investigation';
      replaceRoute();
      void focusScene('rat-trap');
    }
  };

  const revealFunder = async () => {
    funderRevealed = true;
    replaceRoute();
    await tick();
    revealHeading?.focus();
  };

  const revealRelationship = async () => {
    relationshipVisible = true;
    replaceRoute();
    await tick();
    relationshipHeading?.focus();
  };

  const chooseWindow = (window: DemoWindow) => {
    selectedWindow = window;
    replaceRoute();
    // The selected button retains DOM focus while the live numerator changes.
  };

  const scrollHorizontal = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const region = event.currentTarget as HTMLElement;
    if (region.scrollWidth <= region.clientWidth) return;
    event.preventDefault();
    region.scrollBy({
      left: event.key === 'ArrowRight' ? 260 : -260,
      behavior: 'instant'
    });
  };

  onMount(() => {
    const saved = readRoute(window.history.state);
    if (saved) {
      restoreRoute(saved);
    } else {
      replaceRoute();
    }
    const onPopState = (event: PopStateEvent) => {
      const target = readRoute(event.state);
      if (target) restoreRoute(target, scene);
      else clearTimers();
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  });

  onDestroy(() => {
    clearTimers();
    if (ambientFrame !== undefined) window.cancelAnimationFrame(ambientFrame);
  });
</script>

<svelte:head>
  <meta name="color-scheme" content="dark" />
</svelte:head>

{#if scene === 'discovery'}
  <main class="discovery g4-world" data-testid="discovery">
    <header class="masthead">
      <a class="brand" href="#fresh-garbage" aria-label="BINRAT home">
        <img src="./rat-original.jpg" alt="" width="1536" height="1536" />
        <span><strong>BINRAT</strong><small>Trash in. Truth out.</small></span>
      </a>
      <nav aria-label="Primary navigation">
        <button type="button" onclick={openRadar}>Rat Radar</button>
        <a href="#product-dock">Explore</a>
        <a href="#evidence-limit">Our method</a>
      </nav>
      <span class="network">Pons-first · Robinhood 4663</span>
    </header>

    <section class="poster" id="fresh-garbage" aria-labelledby="fresh-title" onpointermove={moveAmbient} onpointerleave={resetAmbient}>
      <!-- A masked, independently authored ember/aurora field inspired by the public CTA 5 visual.
           Decorative only: static gradient fallback, no video download or WebGL dependency. -->
      <div class="hero-flow-mask" aria-hidden="true" data-testid="hero-flow-mask">
        <span class="hero-flow hero-flow--warm"></span>
        <span class="hero-flow hero-flow--violet"></span>
        <span class="hero-flow hero-flow--glow"></span>
      </div>
      <div class="poster-copy">
        <p class="eyebrow">Open-source intelligence. Closer to reality.</p>
        <h1 id="fresh-title" class="display-title" bind:this={sceneHeading} tabindex="-1">The rat<br /><em>remembers.</em></h1>
        <p class="hero-deck">Signals fade. Narratives change. The dumpster never forgets.</p>
        <p class="hero-description">Start with the receipts. Follow what is documented, and leave the rest marked unknown.</p>
        <div class="primary-actions">
          <button class="enter-dumpster" type="button" onclick={openRadar}>Enter Rat Radar <span aria-hidden="true">↗</span></button>
          <button class="investigate" type="button" onclick={beginRetrieval}>Investigate the receipt <span aria-hidden="true">→</span></button>
        </div>
        <p class="world-label">People <span>/</span> patterns <span>/</span> proof</p>
      </div>
      <figure class="rat-stage" aria-label="BINRAT's original approved artwork">
        <img src="./rat-original.jpg" alt="The original BINRAT rat looking out from a dumpster in a pixel-art cyberpunk alley" width="1536" height="1536" />
      </figure>
      <div class="skyline skyline-near" aria-hidden="true"></div>
    </section>

    <section class="product-dock" id="product-dock" aria-label="Explore BINRAT">
      <div class="dock-title"><div><span class="eyebrow">The dumpster is open</span><h2>Pick a thread.</h2></div><p>One real historical receipt to explore. The rest is a look at where BINRAT is going.</p></div>
      <div class="product-grid">
        <button class="product-tile available" type="button" onclick={openRadar}>
          <span class="product-symbol" aria-hidden="true">◎</span>
          <span class="product-name">Rat Radar <span aria-hidden="true">↗</span></span>
          <span class="product-explain">A historical Pons receipt, with its source attached.</span>
          <span class="mini-radar" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
          <span class="product-status">Explore the prototype</span>
        </button>
        <article class="product-tile upcoming">
          <span class="product-symbol" aria-hidden="true">▣</span><h3>Replay Lab</h3>
          <p>See the sequence, not just the headline.</p><span class="product-status">Planned · no live feed</span>
        </article>
        <article class="product-tile upcoming">
          <span class="product-symbol" aria-hidden="true">⌁</span><h3>Ledger</h3>
          <p>Follow on-chain evidence without inventing the rest.</p><span class="product-status">Planned</span>
        </article>
        <article class="product-tile upcoming">
          <span class="product-symbol" aria-hidden="true">◉</span><h3>Watch</h3>
          <p>Keep an eye on addresses and launches that matter.</p><span class="product-status">Planned · no alerts active</span>
        </article>
      </div>
    </section>

    <section class="world-proof" id="evidence-limit" aria-labelledby="proof-title">
      <div class="proof-copy"><span class="eyebrow">Something the rat actually found</span><h2 id="proof-title">A receipt beats a rumor.</h2><p>We have one independently checked historical Pons V2 factory event. This isn't a live feed, and the launch's funding and price history haven't been reconstructed.</p></div>
      <article class="receipt-card" aria-label="Verified historical launch summary">
        <div class="status-row"><strong>VERIFIED HISTORICAL SNAPSHOT</strong><strong>⊘ NOT LIVE</strong></div>
        <dl>
          <div><dt>Token</dt><dd>{shortAddress(receipt.token)}</dd></div>
          <div><dt>Network</dt><dd>Robinhood Chain 4663</dd></div>
          <div><dt>Captured (UTC)</dt><dd>25 Sep 2026</dd></div>
          <div><dt>Direct funding</dt><dd class="unknown">{receipt.funding}</dd></div>
          <div><dt>Price history</dt><dd>{receipt.pricing}</dd></div>
        </dl>
        <p class="receipt-provenance">Source: two independent archive RPCs and Robinscan; an official Blockscout UI conflict is documented in Dig Deeper.</p>
        <a class="receipt-link" href={receipt.explorer} target="_blank" rel="noreferrer">View verified receipt ↗</a>
      </article>
    </section>
    <footer class="world-footer"><strong>BINRAT</strong><span>The dumpster never forgets.</span><small>Historical fixture · no wallet, trades or live monitoring</small></footer>
  </main>
{:else if scene === 'radar'}
  <main class="radar" data-testid="radar">
    <header class="masthead">
      <button class="brand brand-button" type="button" onclick={returnToDiscovery} aria-label="BINRAT home">
        <img src="./rat-original.jpg" alt="" width="1536" height="1536" />
        <span><strong>BINRAT</strong><small>The rat remembers.</small></span>
      </button>
      <nav aria-label="Radar navigation"><button class="nav-active" type="button" aria-current="page">Radar</button><button type="button" onclick={returnToDiscovery}>Dumpster</button></nav>
      <span class="network">Pons-first · Historical snapshot</span>
    </header>
    <section class="radar-hero" aria-labelledby="radar-title">
      <div>
        <p class="eyebrow">Observe. Connect. Question. Dig deeper.</p>
        <h1 id="radar-title" bind:this={sceneHeading} tabindex="-1">Rat Radar</h1>
        <p>The same address can tell different stories. Here's one factory event we can actually verify.</p>
      </div>
      <img src="./rat-original.jpg" alt="" width="1536" height="1536" />
    </section>
    <div class="radar-toolbar" aria-label="Radar source filters">
      <span class="radar-tab current">Observed receipts <span>1</span></span>
      <span class="radar-tab paused">Launch trends · planned</span>
      <span class="toolbar-spacer"></span>
      <span class="toolbar-pill">Robinhood 4663</span>
      <span class="toolbar-pill">25 Sep 2026 snapshot</span>
    </div>
    <div class="radar-workspace" class:case-open={radarCaseOpen}>
      <section class="radar-list" aria-labelledby="radar-list-title">
        <div class="workspace-heading"><div><p class="eyebrow">Evidence, not a leaderboard</p><h2 id="radar-list-title">Observed launches</h2></div><span class="verified-count">1 verified receipt</span></div>
        <p class="list-context">This preview contains one frozen historical event—not a comprehensive list or live rankings.</p>
        <div class="table-head" aria-hidden="true"><span>Token / network</span><span>Observed</span><span>Evidence</span><span></span></div>
        <button type="button" class="launch-row" aria-expanded={radarCaseOpen} aria-controls="radar-case-file" onclick={selectRadarCase}>
          <span class="launch-identity"><span class="record-number">01</span><span><strong>{shortAddress(receipt.token)}</strong><small>Pons V2 · native ETH pair</small></span></span>
          <span class="launch-date">25 Sep 2026<small>18:40 UTC</small></span>
          <span class="launch-status">Factory event<small>Verified historical</small></span>
          <span class="row-arrow" aria-hidden="true">↗</span>
        </button>
        <div class="radar-empty"><strong>That's the verified set for this experiment.</strong><p>Funding, market cap and graduation are still unknown. No imaginary whales hiding in the next row.</p></div>
        <div class="separate-demo"><span class="demo-stamp">Separate fictional demonstration</span><h3>Want to see where a funding investigation could go?</h3><p>After the real receipt, there's a clearly fictional MOLD case with four example transfers.</p></div>
      </section>

      <aside class="radar-case" id="radar-case-file" aria-label="Selected historical case file">
        <button class="case-mobile-back" type="button" onclick={closeRadarCase}>← Back to observed launches</button>
        <div class="case-topline"><span>Case file / 001</span><span>Observed, not an identity.</span></div>
        <div class="case-title-row"><div><p class="eyebrow">The receipt is real. The missing pieces stay missing.</p><h2 bind:this={radarCaseHeading} tabindex="-1">{shortAddress(receipt.token, 7, 6)}</h2><p>Pons V2 · Robinhood Chain</p></div><span class="case-stamp">Factory event<br />verified</span></div>
        <div class="case-chips"><span>Historical</span><span>Native ETH pair</span><span>No live query</span></div>
        <div class="case-metrics">
          <div><span>Block</span><strong>{receipt.block}</strong></div>
          <div><span>Observed (UTC)</span><strong>18:40</strong></div>
          <div><span>Direct funder</span><strong class="unknown">Unknown</strong></div>
        </div>
        <div class="case-section"><h3>What we actually have</h3><p>A factory event matching this token, original deployer and bonding curve. Confirmed against independent archived evidence.</p><a href={receipt.explorer} target="_blank" rel="noreferrer">Open original source ↗</a></div>
        <div class="case-section case-boundary"><h3>Where the trail stops</h3><p>No verified direct funding relationship, token price history, graduation or V4 state from this receipt.</p></div>
        <button class="case-investigate" type="button" onclick={beginRetrieval}>Scan the archived receipt <span aria-hidden="true">→</span></button>
        <p class="case-footnote">Frozen fixture {receipt.fixtureId}. This is a historical playback, not a network scan.</p>
      </aside>
    </div>
    <footer class="radar-footer"><span>One real record. Sources attached.</span><button type="button" onclick={returnToDiscovery}>← Back to the dumpster</button></footer>
  </main>
{:else if scene === 'retrieving'}
  <main class="retrieval" data-testid="retrieval" aria-labelledby="retrieval-title">
    <header class="compact-header">
      <strong>BINRAT <span aria-hidden="true">/</span> Receipt scanner</strong>
      <span>PRELOADED ARCHIVE / NOT LIVE</span>
    </header>

    <div class="retrieval-instrument" role="dialog" aria-modal="true" aria-labelledby="retrieval-title" aria-describedby="retrieval-detail">
      <div class="retrieval-copy">
        <p class="eyebrow">Historical receipt / block {receipt.block}</p>
        <h1 id="retrieval-title" bind:this={sceneHeading} tabindex="-1">A little something turned up.</h1>
        <p id="retrieval-detail">Playing back the frozen fixture and exposing each documented field.</p>
      </div>

      <div class="retrieval-actions retrieval-actions-top">
        <button class="skip" type="button" onclick={openInvestigation}>Skip retrieval</button>
        <a href={receipt.explorer} target="_blank" rel="noreferrer">Open original Robinscan ↗</a>
      </div>

      <div class="receipt-machine" style={`--receipt-offset: ${-1 * (100 - progress)}%`} aria-hidden="true">
        <div class="machine-face">
          <div class="machine-screen">
            <img src="./rat-original.jpg" alt="" width="1536" height="1536" />
            <div class="scan-lines"></div>
          </div>
          <div class="machine-readout"><span>ARCHIVE READER</span><i></i><i></i><i></i></div>
          <div class="receipt-slot"><span>DOCUMENT OUT</span></div>
        </div>

        <article class="emerging-receipt">
          <header><strong>BINRAT FACTORY RECEIPT</strong><span>NOT LIVE</span></header>
          <p class:found={progress >= 16}>FACTORY EVENT · BLOCK {receipt.block}</p>
          <p class:found={progress >= 32}>TOKEN · {shortAddress(receipt.token, 12, 10)}</p>
          <p class:found={progress >= 48}>DEPLOYER · {shortAddress(receipt.originalDeployer, 12, 8)}</p>
          <p class:found={progress >= 64}>CURVE · {shortAddress(receipt.curve, 12, 8)}</p>
          <p class:found={progress >= 80}>TX · {shortAddress(receipt.transaction, 12, 8)}</p>
          <footer>FUNDING UNKNOWN · PRICING NOT RECONSTRUCTED · V4 UNKNOWN</footer>
        </article>
      </div>

      <div class="playback-status" aria-live="polite"><strong>{playbackStep}</strong><span>Fixture {receipt.fixtureId}</span></div>
      <p class="motion-note">Preloaded fixture playback only — no network work is occurring. Reduced motion opens the receipt immediately.</p>
    </div>
  </main>
{:else if scene === 'investigation'}
  <main class="investigation" data-testid="investigation">
    <header class="compact-header">
      <strong>BINRAT <span aria-hidden="true">/</span> Dig Deeper</strong>
      <span>VERIFIED HISTORICAL / NOT LIVE</span>
    </header>

    <div class="dossier-shell">
      <nav class="evidence-index" aria-label="Evidence index">
        <h2>SCANNER → DOSSIER</h2>
        <ol>
          <li class="active">FOUND / FACTORY LOG</li>
          <li>MATCH / DEPLOYER</li>
          <li>MATCH / CURVE</li>
          <li>VERIFY / OPEN TX ↗</li>
          <li>Unsupported fields</li>
        </ol>
        <strong>SCAN COMPLETE · ARCHIVED</strong>
      </nav>

      <article class="dossier" aria-labelledby="dossier-title">
        <p class="archive-rail">ARCHIVED RECEIPT / RETRIEVED</p>
        <p class="status-chip">VERIFIED HISTORICAL SNAPSHOT · NOT LIVE</p>
        <h1 id="dossier-title" bind:this={sceneHeading} tabindex="-1">PONS V2 / FACTORY RECEIPT</h1>
        <p>{receipt.network} · block {receipt.block}</p>
        <p class="observed-time">25 SEP 2026 · 18:40:22 UTC</p>
        <p>Token <code>{receipt.token}</code></p>

        <section class="fact-section">
          <p class="section-number">01 / What is documented</p>
          <h2>Observed on chain</h2>
          <dl>
            <div><dt>Factory</dt><dd><code>{receipt.factory}</code></dd></div>
            <div><dt>Original deployer</dt><dd><code>{receipt.originalDeployer}</code></dd></div>
            <div><dt>Curve</dt><dd><code>{receipt.curve}</code></dd></div>
            <div><dt>Pair</dt><dd>{receipt.pair}</dd></div>
          </dl>
        </section>

        <section class="source-section">
          <p class="section-number">02 / UNDERLYING TRANSACTION ↗</p>
          <h2>Original factory transaction</h2>
          <code>{receipt.transaction}</code>
          <a href={receipt.explorer} target="_blank" rel="noreferrer">Open Robinscan source receipt ↗</a>
        </section>

        <section class="provenance-section" aria-labelledby="provenance-title">
          <p class="section-number">03 / PROVENANCE AND CAVEATS</p>
          <h2 id="provenance-title">What was actually verified</h2>
          <p>Frozen proof captured {receipt.asOf.replace('T', ' ').replace('Z', ' UTC')}. Two independent archive-capable RPC providers (SolidRPC and Tenderly) agreed on the receipt core, corroborated by Robinscan.</p>
          <a href={receipt.evidenceManifest} target="_blank" rel="noreferrer">Open the frozen independent proof manifest ↗</a>
          <p class="provenance-warning">Explorer caveat: on 25 Sep 2026, the official Blockscout transaction UI displayed an unrelated record for this transaction hash. That conflicting UI result was not counted as corroboration. Use the archived proof manifest and Robinscan for this narrow factory-event verification.</p>
          <p>The event records <code>originalDeployer</code>, not the creator fee recipient. It does not establish human identity, funding, trading history, graduation, V4 state or a finality guarantee.</p>
        </section>

        <section class="unknown-section" aria-labelledby="unsupported-title">
          <p class="section-number">04 / UNSUPPORTED ≠ ABSENT</p>
          <h2 id="unsupported-title">What this receipt can't tell us</h2>
          <ul>
            <li>Direct funding: <strong>UNKNOWN</strong></li>
            <li>Pricing and market cap: <strong>NOT RECONSTRUCTED</strong></li>
            <li>Graduation: <strong>UNKNOWN</strong></li>
            <li>V4 status: <strong>UNKNOWN</strong></li>
          </ul>
        </section>
      </article>

      <aside class="next-rail">
        <img src="./rat-original.jpg" alt="Approved BINRAT rat artwork" width="1536" height="1536" />
        <p class="demo-stamp">DEMO — FICTIONAL</p>
        <h2>The real trail stops here.</h2>
        <p>No verified direct funder. No relationship inferred.</p>
        <p>Try a completely separate fictional case to test the intended funding-history investigation.</p>
        <button class="demo-entry" bind:this={demoEntryButton} type="button" onclick={openRatTrap}>Explore fictional Rat Trap DEMO</button>
      </aside>
    </div>

    <div class="back-row">
      <button class="back" type="button" onclick={returnToDiscovery}>← Back to Fresh Garbage</button>
      <a href={receipt.explorer} target="_blank" rel="noreferrer">Original source ↗</a>
    </div>
  </main>
{:else}
  <main class="rat-trap" data-testid="rat-trap">
    <header class="compact-header demo-header">
      <strong>BINRAT <span aria-hidden="true">/</span> Rat Trap <small>(demo)</small></strong>
      <span>FICTIONAL / PRELOADED / NO MONITORING</span>
    </header>

    <section class="trap-shell" aria-labelledby="rat-trap-title">
      <div class="trap-intro">
        <p class="demo-stamp">DEMO — FICTIONAL SCENARIO</p>
        <h1 id="rat-trap-title" bind:this={sceneHeading} tabindex="-1">This wallet looks familiar.</h1>
        <p>MOLD, every address and every transfer below are fictional. Nothing here belongs to the historical Pons receipt.</p>
      </div>

      <div class="trap-workbench">
        <article class="mold-receipt" aria-label="Fictional MOLD funding receipt">
          <header><span>CURRENT FICTIONAL LAUNCH</span><strong>$MOLD</strong></header>
          <dl>
            <div><dt>Launcher</dt><dd>DEMO-LAUNCHER-MOLD</dd></div>
            <div><dt>Funding activity</dt><dd>0.18 ETH · 23m before launch</dd></div>
            <div><dt>Historical behavior</dt><dd>Not yet historical</dd></div>
            <div><dt>Exit liquidity</dt><dd class="unknown">UNKNOWN</dd></div>
          </dl>
          <button class="funder-trigger" type="button" onclick={revealFunder} aria-expanded={funderRevealed} aria-controls={funderRevealed ? "rat-trap-reveal" : undefined}>
            <span>Inspect fictional funder</span><strong>DEMO-FUNDER-A</strong><small>4 transfers appear in this fictional ledger →</small>
          </button>
        </article>

        <aside class="trap-rat" aria-label="Rat Trap status">
          <img src="./rat-original.jpg" alt="Approved BINRAT rat inspecting the fictional case" width="1536" height="1536" />
          <p>{funderRevealed ? 'Earlier transfers found' : 'Choose a fictional funder'}</p>
        </aside>
      </div>

      {#if funderRevealed}
        <section id="rat-trap-reveal" class="trap-reveal" data-testid="rat-trap-reveal" aria-labelledby="shared-funder-title">
          <div class="reveal-banner">
            <p>Fictional address relationship</p>
            <h2 id="shared-funder-title" bind:this={revealHeading} tabindex="-1">One funder. Four transfers. Three earlier launches.</h2>
            <p>This demonstrates a shared funding address—not shared human ownership, safety or profitability.</p>
          </div>

          <article class="funding-ledger" aria-labelledby="ledger-title">
            <div class="ledger-heading">
              <div><span>Example funding / fictional</span><h3 id="ledger-title">DEMO-FUNDER-A</h3></div><strong>4 FICTIONAL TRANSFERS</strong>
            </div>
            <ol>
              {#each demo.transfers as transfer}
                <li data-testid="funding-transfer">
                  <span class:current-transfer={transfer.current}>{transfer.current ? 'CURRENT' : 'PREVIOUS'}</span>
                  <strong>{transfer.launch}</strong><code>{transfer.target}</code><span>{transfer.eth} ETH</span><small>{transfer.minutesBeforeLaunch}m before launch</small>
                </li>
              {/each}
            </ol>
          </article>

          <section class="thermometer" aria-labelledby="thermometer-title">
            <div class="thermometer-heading">
              <div><p>Historical windows / fictional demo</p><h3 id="thermometer-title">Which launches have enough history?</h3></div>
              <div class="window-selector" role="group" aria-label="Historical window">
                {#each windows as window}
                  <button type="button" class:active={selectedWindow === window} aria-pressed={selectedWindow === window} onclick={() => chooseWindow(window)}>{window}</button>
                {/each}
              </div>
            </div>

            <div class="thermometer-output" aria-live="polite" data-testid="thermometer-output">
              <strong>{windowData.ageEligible} / 3</strong><span>previous launches age-eligible for {selectedWindow}</span>
              <strong>{windowData.priceSupported} / {windowData.ageEligible}</strong><span>eligible launches with simulated headline price data</span>
            </div>

            <p class="scroll-hint">Swipe sideways to inspect GRIME, SLUDGE and DUST. Keyboard: Tab here, then ← / →.</p>
            <div class="launch-strip scrollable-region" role="region" tabindex="0" aria-label="Previous fictional funded launches — use left and right arrow keys to scroll" onkeydown={scrollHorizontal}>
              {#each demo.previous as previous}
                {@const isEligible = previous.eligible.includes(selectedWindow)}
                {@const transfer = demo.transfers.find((item) => item.launch === previous.name)}
                <article class:ineligible={!isEligible}>
                  <header><span>{isEligible ? `ELIGIBLE / ${selectedWindow}` : `TOO YOUNG FOR ${selectedWindow}`}</span><h4>{previous.name} <small>(DEMO)</small></h4></header>
                  <p>{previous.ageHours}h old · {transfer?.eth} ETH · {transfer?.minutesBeforeLaunch}m before launch</p>
                  {#if previous.peakEstimatedFDV !== null && isEligible}
                    <dl>
                      <div><dt>Synthetic headline peak est. FDV</dt><dd>{usd(previous.peakEstimatedFDV)}</dd></div>
                      <div><dt>Synthetic latest est. FDV</dt><dd>{usd(previous.latestEstimatedFDV!)}</dd></div>
                    </dl>
                  {:else if previous.peakEstimatedFDV === null}
                    <p class="price-unknown">PRICE UNKNOWN · no simulated headline data</p>
                  {:else}
                    <p class="price-unknown">Headline values withheld for this window: launch is not age-eligible.</p>
                  {/if}
                  <footer>Exit liquidity <strong>UNKNOWN</strong></footer>
                </article>
              {/each}
            </div>
            <p class="metric-warning">Headline peak/latest values are synthetic fixture fields—not window-specific curves or returns. No survival, holding-period or profitability claim.</p>
          </section>

          <p class="scroll-hint">Swipe sideways for all three evidence boundaries. Keyboard: Tab here, then ← / →.</p>
          <section class="evidence-lanes scrollable-region" role="region" tabindex="0" aria-label="Three fictional evidence boundaries — use left and right arrow keys to scroll" onkeydown={scrollHorizontal}>
            <article><strong>FUNDING ACTIVITY</strong><span>4 fictional address transfers</span></article>
            <article><strong>HISTORICAL TOKEN BEHAVIOR</strong><span>2 launches have synthetic headline values</span></article>
            <article><strong>EXIT LIQUIDITY</strong><span>UNKNOWN for every launch</span></article>
          </section>

          {#if relationshipVisible}
            <section class="relationship-reveal" aria-labelledby="relationship-title" data-testid="relationship-map">
              <div class="relationship-copy"><p>SMALL RELATIONSHIP VIEW / DEMO</p><h3 id="relationship-title" bind:this={relationshipHeading} tabindex="-1">Same funder. Ownership unproven.</h3></div>
              <div class="relationship-map" aria-label="DEMO-FUNDER-A funded four fictional launchers">
                <strong>DEMO-FUNDER-A</strong><div class="relationship-lines" aria-hidden="true"></div>
                <div class="relationship-targets">
                  {#each demo.transfers as transfer}<span class:current-target={transfer.current}>{transfer.launch}<small>{transfer.eth} ETH</small></span>{/each}
                </div>
              </div>
              <p>Observed in this fictional ledger: one address funded four launcher addresses. Not established: common control, common ownership, intent, safety, exit liquidity or future performance.</p>
            </section>
          {:else}
            <button class="relationship-trigger" type="button" onclick={revealRelationship}>Unfold small relationship view</button>
          {/if}
        </section>
      {/if}
    </section>

    <div class="back-row demo-back-row">
      <button class="back" type="button" onclick={returnToInvestigation}>← Back to verified receipt</button>
      <button class="quiet-back" type="button" onclick={returnToDiscovery}>Fresh Garbage</button>
    </div>
  </main>
{/if}
