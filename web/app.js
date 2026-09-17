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

await bootstrap();

async function bootstrap() {
  try {
    const feed = await loadDumpsterFeed();
    if (feed?.mode !== 'FIXTURE') throw new Error('WEB_DATA_SOURCE_NOT_AUTHORIZED');
    if (!Array.isArray(feed?.bags)) throw new Error('WEB_DATA_SOURCE_INVALID');
    bags = feed.bags;
    renderFeed();
  } catch (error) {
    renderUnavailable(error);
  }
}

function renderUnavailable(error) {
  bags = [];
  randomBag.disabled = true;
  grid.replaceChildren();
  const panel = document.createElement('div');
  panel.className = 'data-unavailable';
  panel.textContent = 'DUMPSTER DATA UNAVAILABLE — fixture source failed closed.';
  grid.append(panel);
  console.error(error);
}

function renderFeed() {
  grid.innerHTML = bags.map(renderCard).join('');
  for (const button of grid.querySelectorAll('[data-bag-id]')) {
    button.addEventListener('click', () => openBag(button.dataset.bagId, button));
  }
}

function renderCard(bag) {
  const coverage = normalizeCoverage(bag.coverage);
  const noted = Number.isInteger(bag.notedConditions) && bag.notedConditions >= 0 ? bag.notedConditions : 0;
  return `
    <article class="bag-card" tabindex="0" role="button" data-bag-id="${escapeHtml(bag.id)}" data-noted="${noted}" aria-label="Open ${escapeHtml(bag.symbol)} fixture report">
      <div class="card-top">
        <span class="age">THROWN OUT ${escapeHtml(bag.age)} AGO</span>
        <span class="condition-count">${noted === 0 ? '0 NOTED CONDITIONS' : `${noted} NOTED CONDITION${noted === 1 ? '' : 'S'}`}</span>
      </div>
      <h3 class="token-symbol">${escapeHtml(bag.symbol)}</h3>
      <div class="token-name">${escapeHtml(bag.name)}</div>
      <div class="metric-table">
        ${metric('PRIOR BAGS', String(bag.priorLaunches))}
        ${metric('24H MATURE', `${bag.mature24h}/${bag.priorLaunches || 0}`)}
        ${metric('TOP 5', bag.concentration)}
        <div class="metric-row"><span>COVERAGE</span><span><span class="coverage ${coverage}">${coverage}</span></span></div>
      </div>
      <div class="rat-note">binrat: “${escapeHtml(bag.note)}”</div>
      <div class="card-footer"><span>BLOCK ${escapeHtml(bag.block)}</span><span>OPEN BAG →</span></div>
    </article>
  `;
}

function metric(label, value) {
  return `<div class="metric-row"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`;
}

function openBag(id, origin = document.activeElement) {
  const bag = bags.find((item) => item.id === id);
  if (!bag) return;
  returnFocus = origin instanceof HTMLElement ? origin : null;

  const trail = bag.trail.length
    ? bag.trail.map((item) => `
        <div class="trail-row">
          <strong>${escapeHtml(item.symbol)}</strong>
          <span>${escapeHtml(item.age)} ago</span>
          <span>${escapeHtml(item.outcome)}</span>
        </div>
      `).join('')
    : '<div class="empty-trail">No earlier ArcPad fixture launch is attached to this reported creator address. This is absence of fixture history, not positive evidence.</div>';

  const share = buildShareCardModel(bag);

  drawerContent.innerHTML = `
    <p class="drawer-kicker">TRASH TRAIL // FIXTURE REPORT</p>
    <h2>${escapeHtml(bag.symbol)}</h2>
    <div class="address">TOKEN ${escapeHtml(bag.token)}</div>
    <div class="address">ARCPAD-REPORTED CREATOR ${escapeHtml(bag.reportedCreatorAddress)}</div>

    <div class="drawer-note">“${escapeHtml(bag.note)}”</div>

    <div class="evidence-list">
      ${bag.evidence.map((item) => `<div class="evidence-item ${normalizeTone(item.tone)}"><span class="evidence-label">${normalizeTone(item.tone).toUpperCase()}</span>${escapeHtml(item.text)}</div>`).join('')}
    </div>

    <div class="trail">
      <h3>OLDER BAGS</h3>
      ${trail}
    </div>

    <div class="receipt-box">
      <h3>RECEIPT</h3>
      <dl class="receipt-grid">
        <dt>receipt</dt><dd>${escapeHtml(bag.receipt)}</dd>
        <dt>coverage</dt><dd>${escapeHtml(normalizeCoverage(bag.coverage))}</dd>
        <dt>source class</dt><dd>FIXTURE / PRODUCT-SHELL ONLY</dd>
        <dt>block</dt><dd>${escapeHtml(bag.block)}</dd>
      </dl>
      <span class="fixture-stamp">NOT LIVE EVIDENCE</span>
    </div>

    <section class="share-tools" aria-label="Share card fixture preview">
      <h3>SHARE CARD // FIXTURE PREVIEW</h3>
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

  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  backdrop.hidden = false;
  drawerClose.focus();
}

function renderShareCard(card) {
  return `
    <div class="share-card" data-share-card-version="${escapeHtml(card.version)}">
      <div class="share-card-copy">
        <div class="share-card-kicker">🔥🗑️ HOT GARBAGE // ${escapeHtml(card.stamp)}</div>
        <h4 class="share-card-symbol">${escapeHtml(card.symbol)}</h4>
        <div class="share-card-metrics">
          <div class="share-card-metric"><span>REPORTED CREATOR</span><b>${escapeHtml(card.creatorShort)}</b></div>
          <div class="share-card-metric"><span>PRIOR BAGS</span><b>${escapeHtml(card.priorLaunches)}</b></div>
          <div class="share-card-metric"><span>COVERAGE</span><b>${escapeHtml(card.coverage)}</b></div>
        </div>
        <p class="share-card-note">binrat: “${escapeHtml(card.note)}”</p>
      </div>
      <div class="share-card-rat" aria-hidden="true">
        <img src="./binrat-mascot-128.webp" alt="" width="128" height="128" />
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
    if (!navigator.clipboard?.writeText) throw new Error('CLIPBOARD_UNAVAILABLE');
    await navigator.clipboard.writeText(text);
    statusNode.textContent = 'COPIED // fixture stamp included';
  } catch {
    statusNode.textContent = 'COPY UNAVAILABLE // select the fixture card manually';
  }
}

function closeDrawer() {
  const wasOpen = drawer.classList.contains('open');
  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
  backdrop.hidden = true;
  if (wasOpen && returnFocus?.isConnected) returnFocus.focus();
  returnFocus = null;
}

drawerClose.addEventListener('click', closeDrawer);
backdrop.addEventListener('click', closeDrawer);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeDrawer();
  if ((event.key === 'Enter' || event.key === ' ') && document.activeElement?.dataset?.bagId) {
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
  return ['COMPLETE', 'PARTIAL', 'UNVERIFIED'].includes(value) ? value : 'UNVERIFIED';
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
