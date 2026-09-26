<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import { demo, receipt, shortAddress, usd, type DemoWindow } from './fixture';

  type Scene = 'discovery' | 'retrieving' | 'investigation' | 'rat-trap';

  let scene = $state<Scene>('discovery');
  let progress = $state(0);
  let selectedWindow = $state<DemoWindow>('24h');
  let funderRevealed = $state(false);
  let relationshipVisible = $state(false);
  let sceneHeading = $state<HTMLElement | null>(null);
  let demoEntryButton = $state<HTMLButtonElement | null>(null);
  let revealHeading = $state<HTMLElement | null>(null);
  let relationshipHeading = $state<HTMLElement | null>(null);
  let intervalId: number | undefined;
  let finishId: number | undefined;

  const windows = Object.keys(demo.windows) as DemoWindow[];
  const windowData = $derived(demo.windows[selectedWindow]);
  const playbackStep = $derived(
    progress < 28
      ? 'Factory event found'
      : progress < 52
        ? 'Token and deployer matched'
        : progress < 76
          ? 'Curve address matched'
          : 'Your saved receipt is ready'
  );

  const prefersReducedMotion = () =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    funderRevealed: boolean;
    relationshipVisible: boolean;
  };

  const snapshot = (target: Scene = scene): RouteSnapshot => ({
    version: 1,
    scene: target,
    selectedWindow,
    funderRevealed,
    relationshipVisible
  });

  const readRoute = (state: unknown): RouteSnapshot | null => {
    if (!state || typeof state !== 'object') return null;
    const candidate = (state as { binratG3c?: RouteSnapshot }).binratG3c;
    if (
      candidate?.version !== 1 ||
      !['discovery', 'retrieving', 'investigation', 'rat-trap'].includes(candidate.scene) ||
      !['6h', '24h', '3d', '7d'].includes(candidate.selectedWindow)
    ) return null;
    return candidate;
  };

  const replaceRoute = () => {
    window.history.replaceState({ ...(window.history.state ?? {}), binratG3c: snapshot() }, '');
  };

  const focusScene = async (from?: Scene) => {
    await tick();
    if (scene === 'investigation' && from === 'rat-trap') {
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

  const beginRetrieval = () => {
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
    if (readRoute(window.history.state)) {
      window.history.go(scene === 'rat-trap' ? -2 : -1);
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

  onDestroy(clearTimers);
</script>

<svelte:head>
  <meta name="theme-color" content="#e8e7df" />
</svelte:head>

{#if scene === 'discovery'}
  <main class="discovery" data-testid="discovery">
    <header class="masthead" aria-label="Primary navigation">
      <a class="brand" href="#fresh-garbage" aria-label="BINRAT Fresh Garbage">
        <span aria-hidden="true">✳</span>
        <strong>BINRAT</strong>
      </a>
      <nav aria-label="Prototype sections">
        <a href="#fresh-garbage" aria-current="page">Fresh garbage</a>
        <a href="#evidence-limit">How it works</a>
        <span class="network">Pons V2 · Robinhood 4663</span>
      </nav>
    </header>

    <section class="poster" id="fresh-garbage" aria-labelledby="fresh-title">
      <div class="poster-copy">
        <img class="rat-cameo" src="./rat-original.jpg" alt="" width="1536" height="1536" />
        <p class="eyebrow">Small nose. Interesting receipts.</p>
        <p class="tagline">Something turned up in the dumpster.</p>
        <h1 id="fresh-title" class="display-title" bind:this={sceneHeading} tabindex="-1">
          <span>Fresh</span>
          <em>garbage.</em>
        </h1>
        <div class="ribbons" aria-label="Historical factory receipt">
          <span>One real launch.</span>
          <span>One receipt worth a look.</span>
        </div>

        <article class="receipt-card" aria-label="Verified historical launch summary">
          <div class="status-row">
            <strong>Verified historical snapshot</strong>
            <strong>Not live</strong>
          </div>
          <p>A Pons factory event, caught and saved. Have a look at what we can actually prove.</p>
          <p class="receipt-provenance">Source: two independent archive RPCs and Robinscan; an official Blockscout UI conflict is documented in Dig Deeper.</p>
          <dl>
            <div><dt>Token</dt><dd>{shortAddress(receipt.token)}</dd></div>
            <div><dt>Network</dt><dd>{receipt.protocol} / Robinhood 4663</dd></div>
            <div><dt>Time (UTC)</dt><dd>25 Sep, 18:40</dd></div>
            <div><dt>Funding</dt><dd class="unknown">{receipt.funding}</dd></div>
            <div><dt>Pricing</dt><dd>{receipt.pricing}</dd></div>
          </dl>
        </article>

        <div class="primary-actions">
          <button class="investigate" type="button" aria-label="Investigate historical receipt" onclick={beginRetrieval}>
            <span aria-hidden="true">⌕</span> Scan this receipt <span aria-hidden="true">→</span>
          </button>
          <a class="receipt-link" aria-label="View verified receipt on Robinscan" href={receipt.explorer} target="_blank" rel="noreferrer">
            View the source <span aria-hidden="true">↗</span>
          </a>
        </div>

        <p class="audit-line" id="evidence-limit">
          Factory event verified. Funding unknown. Pricing not reconstructed.
        </p>

        <details class="demo-case">
          <summary><strong>{demo.label}</strong> — {demo.name}</summary>
          <p>{demo.description} First inspect the real receipt. The fictional funding experiment is clearly separated.</p>
        </details>
      </div>

      <figure class="rat-stage">
        <img src="./rat-original.jpg" alt="The approved BINRAT pixel-art rat leaning from a dumpster in a purple city alley" width="1536" height="1536" />
        <figcaption>
          <strong>A nose for<br />the details.</strong>
          <span>An archived factory event · block {receipt.block}</span>
        </figcaption>
      </figure>
    </section>

    <footer class="principles" aria-label="Prototype principles">
      <span><strong>Spot it</strong>Pons launches first.</span>
      <span><strong>Check it</strong>Original sources included.</span>
      <span><strong>Follow it</strong>Only as far as evidence goes.</span>
      <span><strong>Know the limits</strong>Fiction stays fictional.</span>
    </footer>
  </main>
{:else if scene === 'retrieving'}
  <main class="retrieval" data-testid="retrieval" aria-labelledby="retrieval-title">
    <header class="compact-header">
      <strong>✳ BINRAT · Receipt scanner</strong>
      <span>Saved evidence · not a live scan</span>
    </header>

    <div class="retrieval-instrument" role="dialog" aria-modal="true" aria-labelledby="retrieval-title" aria-describedby="retrieval-detail">
      <div class="retrieval-copy">
        <p class="eyebrow">Factory event · block {receipt.block}</p>
        <h1 id="retrieval-title" bind:this={sceneHeading} tabindex="-1">The rat found a receipt.</h1>
        <p id="retrieval-detail">A little theatre for the saved evidence. No live blockchain request.</p>
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
          <header><strong>Pons factory receipt</strong><span>Archived</span></header>
          <p class:found={progress >= 16}>Factory event · block {receipt.block}</p>
          <p class:found={progress >= 32}>Token · {shortAddress(receipt.token, 12, 10)}</p>
          <p class:found={progress >= 48}>Deployer · {shortAddress(receipt.originalDeployer, 12, 8)}</p>
          <p class:found={progress >= 64}>Curve · {shortAddress(receipt.curve, 12, 8)}</p>
          <p class:found={progress >= 80}>Transaction · {shortAddress(receipt.transaction, 12, 8)}</p>
          <footer>Funding unknown · Pricing not reconstructed · V4 unknown</footer>
        </article>
      </div>

      <div class="playback-status" aria-live="polite"><strong>{playbackStep}</strong><span>From saved fixture {receipt.fixtureId}</span></div>
      <p class="motion-note">Playback of a saved receipt, not a fresh lookup. Reduced-motion mode opens the evidence immediately.</p>
    </div>
  </main>
{:else if scene === 'investigation'}
  <main class="investigation" data-testid="investigation">
    <header class="compact-header">
      <strong>✳ BINRAT · Dig deeper</strong>
      <span>Verified history · not live</span>
    </header>

    <div class="dossier-shell">
      <nav class="evidence-index" aria-label="Evidence index">
        <h2>Inside this receipt</h2>
        <ol>
          <li class="active">Factory event</li>
          <li>Original deployer</li>
          <li>Curve address</li>
          <li>Original transaction ↗</li>
          <li>Unsupported fields</li>
        </ol>
        <strong>Saved evidence</strong>
      </nav>

      <article class="dossier" aria-labelledby="dossier-title">
        <p class="archive-rail">In the archive</p>
        <p class="status-chip">Verified historical snapshot · not live</p>
        <h1 id="dossier-title" bind:this={sceneHeading} tabindex="-1">Pons V2 / factory receipt</h1>
        <p>{receipt.network} · block {receipt.block}</p>
        <p class="observed-time">25 Sep 2026 · 18:40:22 UTC</p>
        <p>Token <code>{receipt.token}</code></p>

        <section class="fact-section">
          <p class="section-number">01 · The factory log</p>
          <h2>What the receipt shows</h2>
          <dl>
            <div><dt>Factory</dt><dd><code>{receipt.factory}</code></dd></div>
            <div><dt>Original deployer</dt><dd><code>{receipt.originalDeployer}</code></dd></div>
            <div><dt>Curve</dt><dd><code>{receipt.curve}</code></dd></div>
            <div><dt>Pair</dt><dd>{receipt.pair}</dd></div>
          </dl>
        </section>

        <section class="source-section">
          <p class="section-number">02 · Follow the source</p>
          <h2>Original transaction</h2>
          <code>{receipt.transaction}</code>
          <a href={receipt.explorer} target="_blank" rel="noreferrer">Open Robinscan source receipt ↗</a>
        </section>

        <section class="provenance-section" aria-labelledby="provenance-title">
          <p class="section-number">03 · How we checked it</p>
          <h2 id="provenance-title">How this was verified</h2>
          <p>Frozen proof captured {receipt.asOf.replace('T', ' ').replace('Z', ' UTC')}. Two independent archive-capable RPC providers (SolidRPC and Tenderly) agreed on the receipt core, corroborated by Robinscan.</p>
          <a href={receipt.evidenceManifest} target="_blank" rel="noreferrer">Open the frozen independent proof manifest ↗</a>
          <p class="provenance-warning">Explorer caveat: on 25 Sep 2026, the official Blockscout transaction UI displayed an unrelated record for this transaction hash. That conflicting UI result was not counted as corroboration. Use the archived proof manifest and Robinscan for this narrow factory-event verification.</p>
          <p>The event records <code>originalDeployer</code>, not the creator fee recipient. It does not establish human identity, funding, trading history, graduation, V4 state or a finality guarantee.</p>
        </section>

        <section class="unknown-section" aria-labelledby="unsupported-title">
          <p class="section-number">04 · Where the trail ends</p>
          <h2 id="unsupported-title">What we still don’t know</h2>
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
        <h2>The real receipt stops here.</h2>
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
      <strong>✳ BINRAT · Rat Trap demo</strong>
      <span>Fictional · saved example</span>
    </header>

    <section class="trap-shell" aria-labelledby="rat-trap-title">
      <div class="trap-intro">
        <p class="demo-stamp">DEMO — FICTIONAL SCENARIO</p>
        <h1 id="rat-trap-title" bind:this={sceneHeading} tabindex="-1">Who fed the MOLD?</h1>
        <p>MOLD, every address and every transfer below are fictional. Nothing here belongs to the historical Pons receipt.</p>
      </div>

      <div class="trap-workbench">
        <article class="mold-receipt" aria-label="Fictional MOLD funding receipt">
          <header><span>Made-up launch · separate case</span><strong>$MOLD</strong></header>
          <dl>
            <div><dt>Launcher</dt><dd>DEMO-LAUNCHER-MOLD</dd></div>
            <div><dt>Funding activity</dt><dd>0.18 ETH · 23m before launch</dd></div>
            <div><dt>Historical behavior</dt><dd>Not yet historical</dd></div>
            <div><dt>Exit liquidity</dt><dd class="unknown">UNKNOWN</dd></div>
          </dl>
          <button class="funder-trigger" type="button" aria-label="Select fictional funder" onclick={revealFunder} aria-expanded={funderRevealed} aria-controls={funderRevealed ? "rat-trap-reveal" : undefined}>
            <span>Follow this fictional funder</span><strong>DEMO-FUNDER-A</strong><small>Four transfers in the made-up ledger →</small>
          </button>
        </article>

        <aside class="trap-rat" aria-label="Rat Trap status">
          <img src="./rat-original.jpg" alt="Approved BINRAT rat inspecting the fictional case" width="1536" height="1536" />
          <p>{funderRevealed ? 'There’s the trail.' : 'Pick an address. I’ll sniff around.'}</p>
        </aside>
      </div>

      {#if funderRevealed}
        <section id="rat-trap-reveal" class="trap-reveal" data-testid="rat-trap-reveal" aria-labelledby="shared-funder-title">
          <div class="reveal-banner">
            <p>A fictional funding trail</p>
            <h2 id="shared-funder-title" bind:this={revealHeading} tabindex="-1">One funder. Four transfers. Three previous launches.</h2>
            <p>Same fictional funding address. That doesn’t prove shared ownership, safety or profitability.</p>
          </div>

          <article class="funding-ledger" aria-labelledby="ledger-title">
            <div class="ledger-heading">
              <div><span>The fictional transfers</span><h3 id="ledger-title">DEMO-FUNDER-A</h3></div><strong>4 made-up transfers</strong>
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
              <div><p>Fictional history</p><h3 id="thermometer-title">How much history counts?</h3></div>
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
              <div class="relationship-copy"><p>SMALL RELATIONSHIP VIEW / DEMO</p><h3 id="relationship-title" bind:this={relationshipHeading} tabindex="-1">Shared address, not shared owner</h3></div>
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
