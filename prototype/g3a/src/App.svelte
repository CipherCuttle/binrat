<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { demo, receipt, shortAddress, usd, type DemoWindow } from './fixture';

  type Scene = 'discovery' | 'retrieving' | 'investigation' | 'rat-trap';

  let scene = $state<Scene>('discovery');
  let progress = $state(0);
  let selectedWindow = $state<DemoWindow>('24h');
  let funderRevealed = $state(false);
  let relationshipVisible = $state(false);
  let sceneHeading = $state<HTMLElement | null>(null);
  let revealHeading = $state<HTMLElement | null>(null);
  let relationshipHeading = $state<HTMLElement | null>(null);
  let intervalId: number | undefined;
  let finishId: number | undefined;

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

  const clearTimers = () => {
    if (intervalId) window.clearInterval(intervalId);
    if (finishId) window.clearTimeout(finishId);
    intervalId = undefined;
    finishId = undefined;
  };

  const focusScene = async () => {
    await tick();
    sceneHeading?.focus();
  };

  const openInvestigation = () => {
    clearTimers();
    progress = 100;
    scene = 'investigation';
    void focusScene();
  };

  const beginRetrieval = () => {
    if (prefersReducedMotion()) {
      openInvestigation();
      return;
    }

    clearTimers();
    progress = 8;
    scene = 'retrieving';
    void focusScene();

    intervalId = window.setInterval(() => {
      progress = Math.min(96, progress + 4);
    }, 120);
    finishId = window.setTimeout(openInvestigation, 3000);
  };

  const returnToDiscovery = () => {
    clearTimers();
    progress = 0;
    scene = 'discovery';
    void focusScene();
  };

  const openRatTrap = () => {
    funderRevealed = false;
    relationshipVisible = false;
    selectedWindow = '24h';
    scene = 'rat-trap';
    void focusScene();
  };

  const returnToInvestigation = () => {
    scene = 'investigation';
    void focusScene();
  };

  const revealFunder = async () => {
    funderRevealed = true;
    await tick();
    revealHeading?.focus();
  };

  const revealRelationship = async () => {
    relationshipVisible = true;
    await tick();
    relationshipHeading?.focus();
  };

  onDestroy(clearTimers);
</script>

<svelte:head>
  <meta name="color-scheme" content="dark" />
</svelte:head>

{#if scene === 'discovery'}
  <main class="discovery" data-testid="discovery">
    <header class="masthead" aria-label="Primary navigation">
      <a class="brand" href="#fresh-garbage" aria-label="BINRAT Fresh Garbage">
        <span aria-hidden="true">♛</span>
        <strong>BINRAT</strong>
      </a>
      <nav aria-label="Prototype sections">
        <a href="#fresh-garbage" aria-current="page">Investigate</a>
        <a href="#evidence-limit">How it works</a>
        <span class="network">PONS V2 / ROBINHOOD 4663</span>
      </nav>
    </header>

    <section class="poster" id="fresh-garbage" aria-labelledby="fresh-title">
      <div class="poster-copy">
        <img class="rat-cameo" src="./rat-original.jpg" alt="" width="1536" height="1536" />
        <p class="eyebrow">LAUNCH INTELLIGENCE / PONS FIRST</p>
        <p class="tagline">FOR A MORE HONEST DEGEN WORLD.</p>
        <h1 id="fresh-title" class="display-title" bind:this={sceneHeading} tabindex="-1">
          <span>FRESH</span>
          <em>GARBAGE</em>
        </h1>
        <div class="ribbons" aria-label="Historical factory receipt">
          <span>A HISTORICAL PONS LAUNCH.</span>
          <span>A VERIFIED FACTORY RECEIPT.</span>
        </div>

        <article class="receipt-card" aria-label="Verified historical launch summary">
          <div class="status-row">
            <strong>✓ VERIFIED HISTORICAL SNAPSHOT</strong>
            <strong>⊘ NOT LIVE</strong>
          </div>
          <p>Verified factory event. A preloaded historical record — not a live query.</p>
          <dl>
            <div><dt>Token</dt><dd>{shortAddress(receipt.token)}</dd></div>
            <div><dt>Network</dt><dd>{receipt.protocol} / Robinhood 4663</dd></div>
            <div><dt>Timestamp (UTC)</dt><dd>25 Sep 18:40 UTC</dd></div>
            <div><dt>Funding</dt><dd class="unknown">{receipt.funding}</dd></div>
            <div><dt>Pricing</dt><dd>{receipt.pricing}</dd></div>
          </dl>
        </article>

        <div class="primary-actions">
          <button class="investigate" type="button" onclick={beginRetrieval}>
            <span aria-hidden="true">⌕</span> Investigate <span aria-hidden="true">→</span>
          </button>
          <a class="receipt-link" href={receipt.explorer} target="_blank" rel="noreferrer">
            ▣ View verified receipt <span aria-hidden="true">↗</span>
          </a>
        </div>

        <p class="audit-line" id="evidence-limit">
          Historical verified factory receipt · Funding UNKNOWN · Pricing not reconstructed
        </p>

        <details class="demo-case">
          <summary><strong>{demo.label}</strong> — {demo.name}</summary>
          <p>{demo.description} First inspect the real receipt, then enter the separate Rat Trap demonstration.</p>
        </details>
      </div>

      <figure class="rat-stage">
        <img src="./rat-original.jpg" alt="The approved BINRAT pixel-art rat leaning from a dumpster in a purple city alley" width="1536" height="1536" />
        <figcaption>
          <strong>GARBAGE<br />INTO RECEIPTS</strong>
          <span>Archived factory event / block {receipt.block}</span>
        </figcaption>
      </figure>
    </section>

    <footer class="principles" aria-label="Prototype principles">
      <span><strong>FIND EARLY</strong>Pons-first, source-bound.</span>
      <span><strong>VERIFY</strong>Read the original receipt.</span>
      <span><strong>INVESTIGATE</strong>Facts ≠ speculation.</span>
      <span><strong>NO FAKE SIGNALS</strong>Demo is clearly labelled.</span>
    </footer>
  </main>
{:else if scene === 'retrieving'}
  <main class="retrieval" data-testid="retrieval" aria-labelledby="retrieval-title">
    <header class="compact-header">
      <strong>♛ BINRAT / SOURCE RETRIEVAL</strong>
      <span>PRELOADED ARCHIVE / NOT LIVE</span>
    </header>

    <div class="retrieval-instrument" role="dialog" aria-modal="true" aria-labelledby="retrieval-title" aria-describedby="retrieval-detail">
      <div class="retrieval-copy">
        <p class="eyebrow">FACTORY INTAKE / BLOCK {receipt.block}</p>
        <h1 id="retrieval-title" bind:this={sceneHeading} tabindex="-1">THE RAT FOUND A RECEIPT.</h1>
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
      <strong>♛ BINRAT / DIG DEEPER</strong>
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
          <p class="section-number">01 / DOCUMENTED FACTS</p>
          <h2>OBSERVED ON CHAIN</h2>
          <dl>
            <div><dt>Factory</dt><dd><code>{receipt.factory}</code></dd></div>
            <div><dt>Original deployer</dt><dd><code>{receipt.originalDeployer}</code></dd></div>
            <div><dt>Curve</dt><dd><code>{receipt.curve}</code></dd></div>
            <div><dt>Pair</dt><dd>{receipt.pair}</dd></div>
          </dl>
        </section>

        <section class="source-section">
          <p class="section-number">02 / UNDERLYING TRANSACTION ↗</p>
          <h2>SOURCE / FACTORY TRANSACTION</h2>
          <code>{receipt.transaction}</code>
          <a href={receipt.explorer} target="_blank" rel="noreferrer">Open Robinscan source receipt ↗</a>
        </section>

        <section class="unknown-section" aria-labelledby="unsupported-title">
          <p class="section-number">03 / UNSUPPORTED ≠ ABSENT</p>
          <h2 id="unsupported-title">NOT ESTABLISHED BY THIS RECEIPT</h2>
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
        <h2>THE REAL RECEIPT STOPS HERE.</h2>
        <p>No verified direct funder. No relationship inferred.</p>
        <p>Try a completely separate fictional case to test the intended funding-history investigation.</p>
        <button class="demo-entry" type="button" onclick={openRatTrap}>Explore fictional Rat Trap DEMO</button>
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
      <strong>♛ BINRAT / RAT TRAP DEMO</strong>
      <span>FICTIONAL / PRELOADED / NO MONITORING</span>
    </header>

    <section class="trap-shell" aria-labelledby="rat-trap-title">
      <div class="trap-intro">
        <p class="demo-stamp">DEMO — FICTIONAL SCENARIO</p>
        <h1 id="rat-trap-title" bind:this={sceneHeading} tabindex="-1">WHO FED THE MOLD?</h1>
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
          <button class="funder-trigger" type="button" onclick={revealFunder} aria-expanded={funderRevealed}>
            <span>SELECT FICTIONAL FUNDER</span><strong>DEMO-FUNDER-A</strong><small>4 transfers appear in this fictional ledger →</small>
          </button>
        </article>

        <aside class="trap-rat" aria-label="Rat Trap status">
          <img src="./rat-original.jpg" alt="Approved BINRAT rat inspecting the fictional case" width="1536" height="1536" />
          <p>{funderRevealed ? 'TRAP SPRUNG' : 'WAITING FOR A FUNDER'}</p>
        </aside>
      </div>

      {#if funderRevealed}
        <section class="trap-reveal" data-testid="rat-trap-reveal" aria-labelledby="shared-funder-title">
          <div class="reveal-banner">
            <p>FICTIONAL ADDRESS RELATIONSHIP FOUND</p>
            <h2 id="shared-funder-title" bind:this={revealHeading} tabindex="-1">ONE FUNDER. FOUR TRANSFERS. THREE PREVIOUS LAUNCHES.</h2>
            <p>This demonstrates a shared funding address—not shared human ownership, safety or profitability.</p>
          </div>

          <article class="funding-ledger" aria-labelledby="ledger-title">
            <div class="ledger-heading">
              <div><span>FUNDING ACTIVITY / DEMO</span><h3 id="ledger-title">DEMO-FUNDER-A</h3></div><strong>4 FICTIONAL TRANSFERS</strong>
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
              <div><p>HISTORICAL THERMOMETER / SYNTHETIC DEMO</p><h3 id="thermometer-title">HOW MUCH HISTORY IS MATURE ENOUGH?</h3></div>
              <div class="window-selector" role="group" aria-label="Historical window">
                {#each windows as window}
                  <button type="button" class:active={selectedWindow === window} aria-pressed={selectedWindow === window} onclick={() => (selectedWindow = window)}>{window}</button>
                {/each}
              </div>
            </div>

            <div class="thermometer-output" aria-live="polite" data-testid="thermometer-output">
              <strong>{windowData.ageEligible} / 3</strong><span>previous launches age-eligible for {selectedWindow}</span>
              <strong>{windowData.priceSupported} / {windowData.ageEligible}</strong><span>eligible launches with simulated headline price data</span>
            </div>

            <div class="launch-strip" aria-label="Previous fictional funded launches">
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

          <section class="evidence-lanes" aria-label="Evidence boundaries">
            <article><strong>FUNDING ACTIVITY</strong><span>4 fictional address transfers</span></article>
            <article><strong>HISTORICAL TOKEN BEHAVIOR</strong><span>2 launches have synthetic headline values</span></article>
            <article><strong>EXIT LIQUIDITY</strong><span>UNKNOWN for every launch</span></article>
          </section>

          {#if relationshipVisible}
            <section class="relationship-reveal" aria-labelledby="relationship-title" data-testid="relationship-map">
              <div class="relationship-copy"><p>SMALL RELATIONSHIP VIEW / DEMO</p><h3 id="relationship-title" bind:this={relationshipHeading} tabindex="-1">SHARED ADDRESS, NOT SHARED OWNER</h3></div>
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
