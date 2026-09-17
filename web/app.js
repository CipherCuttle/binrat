import { hotGarbageFixtures } from './fixtures.js';

const grid = document.querySelector('#garbage-grid');
const drawer = document.querySelector('#drawer');
const drawerContent = document.querySelector('#drawer-content');
const drawerClose = document.querySelector('#drawer-close');
const backdrop = document.querySelector('#backdrop');
const randomBag = document.querySelector('#random-bag');
let returnFocus = null;

renderFeed();

function renderFeed() {
  grid.innerHTML = hotGarbageFixtures.map(renderCard).join('');
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
  const bag = hotGarbageFixtures.find((item) => item.id === id);
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

  drawerContent.innerHTML = `
    <p class="drawer-kicker">TRASH TRAIL // FIXTURE REPORT</p>
    <h2>${escapeHtml(bag.symbol)}</h2>
    <div class="address">TOKEN ${escapeHtml(bag.token)}</div>
    <div class="address">ARCPAD-REPORTED CREATOR ${escapeHtml(bag.creator)}</div>

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
  `;

  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  backdrop.hidden = false;
  drawerClose.focus();
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
  const bag = hotGarbageFixtures[Math.floor(Math.random() * hotGarbageFixtures.length)];
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
