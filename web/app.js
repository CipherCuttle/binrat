import { loadDumpsterFeed } from './data-source.js';
import { buildShareCardModel, buildSharePostText } from './share-card.js';

const grid = document.querySelector('#garbage-grid');
const drawer = document.querySelector('#drawer');
const drawerContent = document.querySelector('#drawer-content');
const drawerClose = document.querySelector('#drawer-close');
const backdrop = document.querySelector('#backdrop');
const randomBag = document.querySelector('#random-bag');
let returnFocus = null;
let bags = [];
let activeFilter = 'all';
const search = document.querySelector('#bag-search');
const latestBag = document.querySelector('#latest-bag');
const pageSurfaces = [
  ...document.querySelectorAll(
    'body > header, body > main, body > footer, .skip-link',
  ),
];

await bootstrap();

async function bootstrap() {
  try {
    const feed = await loadDumpsterFeed();
    if (feed?.mode !== 'FIXTURE')
      throw new Error('WEB_DATA_SOURCE_NOT_AUTHORIZED');
    if (!Array.isArray(feed?.bags)) throw new Error('WEB_DATA_SOURCE_INVALID');
    bags = feed.bags;
    renderIntake();
    renderFeed();
  } catch (error) {
    renderUnavailable(error);
  }
}

function renderUnavailable(error) {
  bags = [];
  randomBag.disabled = true;
  grid.replaceChildren();
  latestBag.querySelector('.intake-loading').textContent =
    'Fixture source unavailable';
  document.querySelector('#feed-count').textContent = 'INDEX UNAVAILABLE';
  const panel = document.createElement('div');
  panel.className = 'data-unavailable';
  panel.textContent =
    'DUMPSTER DATA UNAVAILABLE — fixture source failed closed.';
  grid.append(panel);
  console.error(error);
}

function renderIntake() {
  document.querySelector('#all-count').textContent = String(
    bags.length,
  ).padStart(2, '0');
  document.querySelector('#history-count').textContent = String(
    bags.filter((bag) => bag.priorLaunches > 0).length,
  ).padStart(2, '0');
  const latest = bags[0];
  if (!latest) {
    latestBag.querySelector('.intake-loading').textContent =
      'No fixture bags indexed';
    randomBag.disabled = true;
    return;
  }
  latestBag.innerHTML = `<span class="intake-label">LAST INTO THE BIN</span>
    <button class="intake-bag" type="button" aria-label="Open latest fixture bag ${escapeHtml(latest.symbol)}">
      <b>${escapeHtml(latest.symbol)}</b><span class="intake-note">${escapeHtml(latest.note)}</span>
      <span class="intake-block">BLOCK / ${escapeHtml(latest.block)}</span><span class="intake-open">INSPECT RECEIPT ↗</span>
    </button>`;
  const button = latestBag.querySelector('button');
  button.addEventListener('click', () => openBag(latest.id, button));
}

function renderFeed() {
  const query = search.value.trim().toLowerCase();
  const visible = bags.filter(
    (bag) =>
      (activeFilter !== 'history' || bag.priorLaunches > 0) &&
      [bag.symbol, bag.name, bag.reportedCreatorAddress].some((value) =>
        String(value).toLowerCase().includes(query),
      ),
  );
  grid.innerHTML = visible.length
    ? visible.map(renderCard).join('')
    : '<div class="empty-feed">No bags match this dig.<button type="button" id="clear-search">CLEAR FILTERS ↗</button></div>';
  document.querySelector('#feed-count').textContent =
    `${String(visible.length).padStart(2, '0')} / ${String(bags.length).padStart(2, '0')} FIXTURE BAGS`;
  grid.querySelector('#clear-search')?.addEventListener('click', () => {
    search.value = '';
    setFilter('all');
    search.focus();
  });
  for (const button of grid.querySelectorAll('[data-bag-id]')) {
    button.addEventListener('click', () =>
      openBag(button.dataset.bagId, button),
    );
  }
}

function renderCard(bag) {
  const coverage = normalizeCoverage(bag.coverage);
  const noted =
    Number.isInteger(bag.notedConditions) && bag.notedConditions >= 0
      ? bag.notedConditions
      : 0;
  const serial = String(bags.indexOf(bag) + 1).padStart(3, '0');
  return `
    <article class="bag-card" tabindex="0" role="button" aria-haspopup="dialog" data-bag-id="${escapeHtml(bag.id)}" data-noted="${noted}" aria-label="Open ${escapeHtml(bag.symbol)} fixture report">
      <div class="card-top"><span class="card-serial">BAG / ${serial}</span><span class="age">${escapeHtml(bag.age)} AGO ↙</span></div>
      <div class="token-heading"><div><h3 class="token-symbol">${escapeHtml(bag.symbol)}</h3><div class="token-name">${escapeHtml(bag.name)}</div></div><span class="inspect-arrow" aria-hidden="true">↗</span></div>
      <div class="creator-line"><span>ARCPAD-REPORTED CREATOR ADDRESS</span><code>${escapeHtml(shortAddress(bag.reportedCreatorAddress))}</code></div>
      <div class="card-intelligence"><div class="prior-metric"><strong>${escapeHtml(bag.priorLaunches)}</strong><span>PRIOR INDEXED<br/>BAGS</span></div><div class="coverage-metric"><span>RECORD COVERAGE</span><span class="coverage ${coverage}">${coverage}</span></div></div>
      <div class="metric-table">${metric('24H MATURE', `${bag.mature24h}/${bag.priorLaunches || 0}`)}${metric('TOP 5', bag.concentration)}</div>
      <div class="condition-strip"><span class="condition-count">${noted === 0 ? '0 NOTED CONDITIONS' : `${noted} NOTED CONDITION${noted === 1 ? '' : 'S'}`}</span><span class="observation-count">${bag.evidence.length} RECORDS</span></div>
      <div class="rat-note"><span>RAT NOTE /</span> “${escapeHtml(bag.note)}”</div>
      <div class="card-footer"><span>BLK ${escapeHtml(bag.block)}</span><span>OPEN RECEIPT ↗</span></div>
    </article>`;
}

function shortAddress(value) {
  const address = String(value);
  return address.length > 14
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : address;
}

function metric(label, value) {
  return `<div class="metric-row"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`;
}

function setFilter(value) {
  activeFilter = value;
  for (const button of document.querySelectorAll('[data-filter]')) {
    const active = button.dataset.filter === value;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  }
  renderFeed();
}

search.addEventListener('input', renderFeed);
for (const button of document.querySelectorAll('[data-filter]')) {
  button.addEventListener('click', () => setFilter(button.dataset.filter));
}
if (
  matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)')
    .matches
) {
  grid.addEventListener('pointermove', (event) => {
    const card = event.target.closest('.bag-card');
    if (!card) return;
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--pointer-x', `${event.clientX - rect.left}px`);
    card.style.setProperty('--pointer-y', `${event.clientY - rect.top}px`);
  });
}

function openBag(id, origin = document.activeElement) {
  const bag = bags.find((item) => item.id === id);
  if (!bag) return;
  returnFocus = origin instanceof HTMLElement ? origin : null;

  const trail = bag.trail.length
    ? bag.trail
        .map(
          (item) => `
        <div class="trail-row">
          <strong>${escapeHtml(item.symbol)}</strong>
          <span class="trail-age">${escapeHtml(item.age)} AGO</span>
          <span class="trail-outcome">${escapeHtml(item.outcome)}</span>
          <span class="coverage ${normalizeCoverage(item.coverage)}">${normalizeCoverage(item.coverage)}</span>
        </div>
      `,
        )
        .join('')
    : '<div class="empty-trail">No earlier ArcPad fixture launch is attached to this reported creator address. This is absence of fixture history, not positive evidence.</div>';

  const share = buildShareCardModel(bag);

  drawerContent.innerHTML = `
    <p class="drawer-kicker">TRASH TRAIL // FIXTURE REPORT</p>
    <div class="drawer-title-row"><div><h2 id="drawer-title">${escapeHtml(bag.symbol)}</h2><p>${escapeHtml(bag.name)} / ${escapeHtml(bag.age)} ago</p></div><div class="case-number">FILE<br/><b>${String(bags.indexOf(bag) + 1).padStart(3, '0')}</b></div></div>
    <div class="address creator-address"><span>ArcPad-reported creator address</span><code>${escapeHtml(bag.reportedCreatorAddress)}</code></div>
    <div class="address"><span>TOKEN ADDRESS / FIXTURE</span><code>${escapeHtml(bag.token)}</code></div>
    <div class="drawer-note"><span>RAT NOTE / PRESENTATION, NOT A VERDICT</span>“${escapeHtml(bag.note)}”</div>
    <div class="file-section-heading"><h3>01 / OBSERVATIONS</h3><span>${bag.evidence.length} RECORDS</span></div>
    <div class="evidence-list">
      ${bag.evidence.map((item) => `<div class="evidence-item ${normalizeTone(item.tone)}"><span class="evidence-label">${normalizeTone(item.tone).toUpperCase()}</span><span>${escapeHtml(item.text)}</span></div>`).join('')}
    </div>

    <div class="trail">
      <div class="file-section-heading"><h3>02 / TRASH TRAIL</h3><span>${escapeHtml(bag.priorLaunches)} PRIOR INDEXED BAGS</span></div>
      <p class="trail-summary">Same reported address. Not a claim of human identity. ${bag.trail.length} earlier bag${bag.trail.length === 1 ? '' : 's'} shown in this fixture.</p>
      <div class="trail-rows"><div class="trail-row current"><strong>${escapeHtml(bag.symbol)} / CURRENT BAG</strong><span class="trail-age">${escapeHtml(bag.age)} AGO</span><span class="trail-outcome">Launch in this fixture</span><span class="coverage ${normalizeCoverage(bag.coverage)}">${normalizeCoverage(bag.coverage)}</span></div>${trail}</div>
    </div>

    <div class="receipt-box">
      <div class="receipt-head"><h3>03 / RECEIPT</h3><span>BINRAT / ARC 5042</span></div>
      <dl class="receipt-grid">
        <dt>receipt</dt><dd>${escapeHtml(bag.receipt)}</dd>
        <dt>coverage</dt><dd>${escapeHtml(normalizeCoverage(bag.coverage))}</dd>
        <dt>source class</dt><dd>FIXTURE / PRODUCT-SHELL ONLY</dd>
        <dt>block</dt><dd>${escapeHtml(bag.block)}</dd>
      </dl>
      <span class="fixture-stamp">NOT LIVE EVIDENCE</span><span class="receipt-bars" aria-hidden="true"></span>
    </div>

    <section class="share-tools" aria-label="Share card fixture preview">
      <h3>04 / TAKE THE RECEIPT WITH YOU</h3>
      ${renderShareCard(share)}
      <div class="share-actions">
        <button class="button ghost" type="button" data-copy-post>COPY POST</button>
      </div>
      <div class="share-copy-status" aria-live="polite"></div>
    </section>
  `;

  const copyButton = drawerContent.querySelector('[data-copy-post]');
  const copyStatus = drawerContent.querySelector('.share-copy-status');
  copyButton?.addEventListener('click', () => copySharePost(bag, copyStatus));

  drawer.inert = false;
  pageSurfaces.forEach((surface) => {
    surface.inert = true;
  });
  document.body.classList.add('drawer-open');
  drawer.scrollTop = 0;
  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  backdrop.hidden = false;
  requestAnimationFrame(() => {
    if (drawer.classList.contains('open'))
      drawerClose.focus({ preventScroll: true });
  });
}

function renderShareCard(card) {
  return `
    <div class="share-card" data-share-card-version="${escapeHtml(card.version)}">
      <div class="share-card-copy">
        <div class="share-card-kicker">HOT GARBAGE // ${escapeHtml(card.stamp)}</div>
        <h4 class="share-card-symbol">${escapeHtml(card.symbol)}</h4>
        <div class="share-card-metrics">
          <div class="share-card-metric"><span>REPORTED CREATOR</span><b>${escapeHtml(card.creatorShort)}</b></div>
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
      throw new Error('CLIPBOARD_UNAVAILABLE');
    await navigator.clipboard.writeText(text);
    statusNode.textContent = 'COPIED // fixture stamp included';
  } catch {
    statusNode.textContent =
      'COPY UNAVAILABLE // select the fixture card manually';
  }
}

function closeDrawer() {
  const wasOpen = drawer.classList.contains('open');
  drawer.classList.remove('open');
  drawer.inert = true;
  pageSurfaces.forEach((surface) => {
    surface.inert = false;
  });
  document.body.classList.remove('drawer-open');
  drawer.setAttribute('aria-hidden', 'true');
  backdrop.hidden = true;
  if (wasOpen && returnFocus?.isConnected) returnFocus.focus();
  returnFocus = null;
}

drawerClose.addEventListener('click', closeDrawer);
backdrop.addEventListener('click', closeDrawer);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeDrawer();
  if (event.key === 'Tab' && drawer.classList.contains('open')) {
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
    event.key === '/' &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !drawer.classList.contains('open') &&
    !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)
  ) {
    event.preventDefault();
    search.focus();
  }
  if (
    (event.key === 'Enter' || event.key === ' ') &&
    document.activeElement?.dataset?.bagId
  ) {
    event.preventDefault();
    openBag(document.activeElement.dataset.bagId, document.activeElement);
  }
});

randomBag.addEventListener('click', () => {
  if (bags.length === 0) return;
  const bag = bags[Math.floor(Math.random() * bags.length)];
  openBag(bag.id, randomBag);
});

function normalizeCoverage(value) {
  return ['COMPLETE', 'PARTIAL', 'UNVERIFIED'].includes(value)
    ? value
    : 'UNVERIFIED';
}

function normalizeTone(value) {
  return ['observed', 'noted', 'unknown'].includes(value) ? value : 'unknown';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
