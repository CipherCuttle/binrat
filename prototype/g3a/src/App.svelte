<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { demo, receipt, shortAddress } from './fixture';

  type Scene = 'discovery' | 'retrieving' | 'investigation';

  let scene = $state<Scene>('discovery');
  let progress = $state(0);
  let sceneHeading = $state<HTMLElement | null>(null);
  let intervalId: number | undefined;
  let finishId: number | undefined;

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
      progress = Math.min(96, progress + 8);
    }, 130);
    finishId = window.setTimeout(openInvestigation, 1900);
  };

  const returnToDiscovery = () => {
    clearTimers();
    progress = 0;
    scene = 'discovery';
    void focusScene();
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
          <p>Verified factory event. A historical record — not a live feed.</p>
          <dl>
            <div>
              <dt>Token</dt>
              <dd>{shortAddress(receipt.token)}</dd>
            </div>
            <div>
              <dt>Network</dt>
              <dd>{receipt.protocol} / Robinhood 4663</dd>
            </div>
            <div>
              <dt>Timestamp (UTC)</dt>
              <dd>25 Sep 18:40 UTC</dd>
            </div>
            <div>
              <dt>Funding</dt>
              <dd class="unknown">{receipt.funding}</dd>
            </div>
            <div>
              <dt>Pricing</dt>
              <dd>{receipt.pricing}</dd>
            </div>
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
          <p>{demo.description} {demo.monitoring}</p>
        </details>
      </div>

      <figure class="rat-stage">
        <img
          src="./rat-original.jpg"
          alt="The approved BINRAT pixel-art rat leaning from a dumpster in a purple city alley"
          width="1536"
          height="1536"
        />
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
      <span>ARCHIVED / NOT LIVE</span>
    </header>

    <div
      class="retrieval-instrument"
      role="dialog"
      aria-modal="true"
      aria-labelledby="retrieval-title"
      aria-describedby="retrieval-detail"
    >
      <p class="eyebrow">FACTORY INTAKE / BLOCK {receipt.block}</p>
      <h1 id="retrieval-title" bind:this={sceneHeading} tabindex="-1">DIGGING UP THE RECEIPT.</h1>
      <p id="retrieval-detail">Matching the frozen factory event to its original transaction.</p>

      <div class="scan-window" aria-hidden="true">
        <div class="scan-rat">
          <img src="./rat-original.jpg" alt="" width="1536" height="1536" />
        </div>
        <div class="scan-lines"></div>
      </div>

      <div class="progress-label">
        <span>{progress < 45 ? '01 / FACTORY EVENT' : progress < 82 ? '02 / TOKEN + CURVE' : '03 / RECEIPT FOUND'}</span>
        <output aria-live="polite">{progress}%</output>
      </div>
      <div class="progress-track" aria-label="Receipt retrieval progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress}>
        <span style={`width: ${progress}%`}></span>
      </div>

      <div class="retrieval-actions">
        <button class="skip" type="button" onclick={openInvestigation}>Skip retrieval</button>
        <a href={receipt.explorer} target="_blank" rel="noreferrer">Open original Robinscan ↗</a>
      </div>
      <p class="motion-note">Reduced-motion preference bypasses this ritual and opens the receipt immediately.</p>
    </div>
  </main>
{:else}
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
          <li>VERIFY / OPEN TX ↗</li>
          <li>Unknown funding</li>
          <li>Unknown pricing</li>
          <li>V4 unverified</li>
        </ol>
        <strong>SCAN COMPLETE · ARCHIVED</strong>
      </nav>

      <article class="dossier" aria-labelledby="dossier-title">
        <p class="archive-rail">ARCHIVED RECEIPT / RETRIEVED</p>
        <p class="status-chip">VERIFIED HISTORICAL SNAPSHOT · NOT LIVE</p>
        <h1 id="dossier-title" bind:this={sceneHeading} tabindex="-1">PONS V2 / FACTORY RECEIPT</h1>
        <p>{receipt.network} · block {receipt.block}</p>
        <p class="observed-time">25 SEP 2026 · 18:40:22 UTC</p>
        <p>Token <code>{shortAddress(receipt.token, 12, 10)}</code></p>
        <p class="unknown">Funding {receipt.funding} · Pricing {receipt.pricing}</p>
        <p>Graduation {receipt.graduation} · V4 {receipt.v4}</p>

        <section class="fact-section">
          <p class="section-number">01 / VERIFIED FACTORY EVENT</p>
          <h2>OBSERVED ON CHAIN</h2>
          <dl>
            <div><dt>Factory</dt><dd><code>{shortAddress(receipt.factory, 12, 9)}</code></dd></div>
            <div><dt>Original deployer</dt><dd><code>{shortAddress(receipt.originalDeployer, 12, 8)}</code></dd></div>
            <div><dt>Curve</dt><dd><code>{shortAddress(receipt.curve, 12, 8)}</code></dd></div>
          </dl>
        </section>

        <section class="source-section">
          <p class="section-number">02 / SOURCE TRANSACTION ↗</p>
          <h2>SOURCE / FACTORY TRANSACTION</h2>
          <code>{shortAddress(receipt.transaction, 12, 8)}</code>
          <a href={receipt.explorer} target="_blank" rel="noreferrer">Open Robinscan source receipt ↗</a>
        </section>

        <section class="unknown-section">
          <p class="section-number">03 / UNKNOWN ≠ ABSENT</p>
          <h2>SOURCE → FACTORY EVENT → TOKEN + CURVE → UNKNOWN FUNDER</h2>
          <p>Next: inspect independently verified transfers before drawing a funding relationship.</p>
        </section>
      </article>

      <aside class="next-rail">
        <img src="./rat-original.jpg" alt="Approved BINRAT rat artwork" width="1536" height="1536" />
        <h2>RAT TRAP / NEXT</h2>
        <p>No verified direct funder. No relationship inferred.</p>
        <p>Fictional MOLD is a separate DEMO.</p>
        <strong>NOT RECONSTRUCTED</strong>
      </aside>
    </div>

    <div class="back-row">
      <button class="back" type="button" onclick={returnToDiscovery}>← Back to Fresh Garbage</button>
      <a href={receipt.explorer} target="_blank" rel="noreferrer">Original source ↗</a>
    </div>
  </main>
{/if}
