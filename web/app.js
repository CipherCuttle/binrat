import { hotGarbageFixtures } from './fixtures.js';

const grid = document.querySelector('#garbage-grid');
const drawer = document.querySelector('#drawer');
const drawerContent = document.querySelector('#drawer-content');
const drawerClose = document.querySelector('#drawer-close');
const backdrop = document.querySelector('#backdrop');
const randomBag = document.querySelector('#random-bag');

renderFeed();

function renderFeed() {
  grid.innerHTML = hotGarbageFixtures.map(renderCard).join('');
  for (const button of grid.querySelectorAll('[data-bag-id]')) {
    button.addEventListener('click', () => openBag(button.dataset.bagId));
  }
}

function renderCard(bag) {
  return `
    <article class="bag-card" tabindex="0" role="button" data-bag-id="${escapeHtml(bag.id)}" data-flags="${bag.flags}" aria-label="Open ${escapeHtml(bag.symbol)} fixture report">
      <div class="card-top">
        <span class="age">THROWN OUT ${escapeHtml(bag.age)} AGO</span>
        <span class="flag-count">${bag.flags === 0 ? 'NO FIXTURE FLAGS' : `${bag.flags} FLAG${bag.flags === 1 ? '' : 'S'}`}</span>
      </div>
      <h3 class="token-symbol">${escapeHtml(bag.symbol)}</h3>
      <div class="token-name">${escapeHtml(bag.name)}</div>
      <div class="metric-table">
        ${metric('PRIOR BAGS', String(bag.priorLaunches))}
        ${metric('24H MATURE', `${bag.mature24h}/${bag.priorLaunches || 0}`)}
        ${metric('TOP 5', bag.concentration)}
        ${metric('COVERAGE', `<span class="coverage ${bag.coverage}">${bag.coverage}</span>`, true)}
      </div>
      <div class="rat-note">binrat: “${escapeHtml(bag.note)}”</div>
      <div class="card-footer"><span>BLOCK ${escapeHtml(bag.block)}</span><span>OPEN BAG →</span></div>
    </article>
  `;
}

function metric(label, value, trustedHtml = false) {
  return `<div class="metric-row"><span>${escapeHtml(label)}</span><span>${trustedHtml ? value : escapeHtml(value)}</span></div>`;
}

function openBag(id) {
  const bag = hotGarbageFixtures.find((item) => item.id === id);
  if (!bag) return;

  const trail = bag.trail.length
    ? bag.trail.map((item) => `
        <div class="trail-row">
          <strong>${escapeHtml(item.symbol)}</strong>
          <span>${escapeHtml(item.age)} ago</span>
          <span>${escapeHtml(item.outcome)}</span>
        </div>
      `).join('')
    : '<div class="empty-trail">No earlier ArcPad fixture launch is attached to this reported creator address.</div>';

  drawerContent.innerHTML = `
    <p class="drawer-kicker">TRASH TRAIL // FIXTURE REPORT</p>
    <h2>${escapeHtml(bag.symbol)}</h2>
    <div class="address">TOKEN ${escapeHtml(bag.token)}</div>
    <div class="address">ARCPAD-REPORTED CREATOR ${escapeHtml(bag.creator)}</div>

    <div class="drawer-note">“${escapeHtml(bag.note)}”</div>

    <div class="evidence-list">
      ${bag.evidence.map((item) => `<div class="evidence-item ${escapeHtml(item.tone)}">${escapeHtml(item.text)}</div>`).join('')}
    </div>

    <div class="trail">
      <h3>OLDER BAGS</h3>
      ${trail}
    </div>

    <div class="receipt-box">
      <h3>RECEIPT</h3>
      <dl class="receipt-grid">
        <dt>receipt</dt><dd>${escapeHtml(bag.receipt)}</dd>
        <dt>coverage</dt><dd>${escapeHtml(bag.coverage)}</dd>
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
  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
  backdrop.hidden = true;
}

drawerClose.addEventListener('click', closeDrawer);
backdrop.addEventListener('click', closeDrawer);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeDrawer();
  if ((event.key === 'Enter' || event.key === ' ') && document.activeElement?.dataset?.bagId) {
    event.preventDefault();
    openBag(document.activeElement.dataset.bagId);
  }
});

randomBag.addEventListener('click', () => {
  const bag = hotGarbageFixtures[Math.floor(Math.random() * hotGarbageFixtures.length)];
  openBag(bag.id);
});

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
