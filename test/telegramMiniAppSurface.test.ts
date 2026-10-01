import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Telegram Mini App accepts only known view deep links and preserves case priority', () => {
  const app=readFileSync(new URL('../web/app/app.js',import.meta.url),'utf8');
  assert.match(app,/searchParams/);
  assert.match(app,/params\.get\('view'\)/);
  assert.match(app,/\['home','launches','rats','watches','about'\]\.includes\(requestedView\)/);
  assert.match(app,/if\(requestedCase\) await loadCase\(requestedCase\)/);
  assert.match(app,/else if\([^\n]+requestedView[^\n]+\) show\(requestedView\)/);
});

test('Mini App exposes a full WATCHES destination for Telegram handoff', () => {
  const html=readFileSync(new URL('../web/app/index.html',import.meta.url),'utf8');
  assert.match(html,/id="watches"/);
  assert.match(html,/data-view="watches"/);
  assert.match(html,/PRIVATE ATTENTION/);
});
